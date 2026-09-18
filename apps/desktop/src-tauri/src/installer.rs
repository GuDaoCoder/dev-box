use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
};

use reqwest::{blocking::Client, redirect::Policy};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use url::Url;
use uuid::Uuid;

use crate::{
    domain::{DevBoxError, PluginManifest},
    plugin_package::{
        inspect_package, normalized_plugin_path, PackagePolicy, PackageSummary, VerifiedPackage,
    },
    repositories::{InstalledPluginRecord, PluginRepository},
};

#[derive(Debug, Clone)]
struct PendingInstall {
    package_path: PathBuf,
    source: String,
    source_reference: Option<String>,
    developer_mode: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPreflight {
    pub token: String,
    pub summary: PackageSummary,
    pub source: String,
    pub source_reference: Option<String>,
    pub change: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginCatalog {
    pub schema_version: u8,
    pub generated_at: String,
    pub plugins: Vec<CatalogPlugin>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogPlugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub publisher: String,
    pub versions: Vec<CatalogVersion>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogVersion {
    pub version: String,
    pub package_url: String,
    pub package_sha256: String,
    pub devbox: String,
    pub plugin_api: String,
    pub released_at: String,
    #[serde(default)]
    pub release_notes: String,
    #[serde(default)]
    pub revoked: bool,
}

pub struct PluginInstaller {
    repository: PluginRepository,
    plugins_directory: PathBuf,
    staging_directory: PathBuf,
    trash_directory: PathBuf,
    policy: PackagePolicy,
    pending: Mutex<HashMap<String, PendingInstall>>,
}

impl PluginInstaller {
    pub fn open(data_directory: &Path, database_path: &Path) -> Result<Self, String> {
        let plugins_directory = data_directory.join("plugins");
        let staging_directory = data_directory.join("plugin-staging");
        let trash_directory = data_directory.join("plugin-trash");
        fs::create_dir_all(&plugins_directory).map_err(|error| error.to_string())?;
        fs::create_dir_all(&staging_directory).map_err(|error| error.to_string())?;
        fs::create_dir_all(&trash_directory).map_err(|error| error.to_string())?;
        let installer = Self {
            repository: PluginRepository::open(database_path).map_err(|error| error.to_string())?,
            plugins_directory,
            staging_directory,
            trash_directory,
            policy: PackagePolicy::default(),
            pending: Mutex::new(HashMap::new()),
        };
        #[cfg(debug_assertions)]
        installer.repository.register_trusted_publisher(
            "devbox-test",
            "DevBox M2 Test Publisher",
            "625017f6bad8108a6db9de12eaec4cbff228d63fa6fb478316d479bd0639f7e4",
            "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEABANbfxJp4V1Zm1tpGz3nNQeghxYeqcpi8Je0s2VUSRo=\n-----END PUBLIC KEY-----\n",
            "startup",
        )
        .map_err(|_| "无法注册 M2 测试发布者".to_owned())?;
        installer.recover("startup")?;
        Ok(installer)
    }

    pub fn preflight_offline(
        &self,
        source_path: &Path,
        developer_mode: bool,
        correlation_id: &str,
    ) -> Result<InstallPreflight, DevBoxError> {
        if source_path.extension().and_then(|value| value.to_str()) != Some("devbox-plugin") {
            return Err(DevBoxError::invalid_argument(correlation_id, "path"));
        }
        let metadata = fs::metadata(source_path)
            .map_err(|_| DevBoxError::not_found(correlation_id, "package"))?;
        if !metadata.is_file() || metadata.len() > self.policy.max_archive_bytes {
            return Err(DevBoxError::plugin_package(
                correlation_id,
                "插件包文件无效或超过大小限制",
            ));
        }
        let token = Uuid::new_v4().to_string();
        let pending_path = self
            .staging_directory
            .join(format!("{token}.devbox-plugin"));
        fs::copy(source_path, &pending_path).map_err(|_| DevBoxError::storage(correlation_id))?;
        let source = if developer_mode {
            "development"
        } else {
            "offline"
        };
        self.preflight_copied(
            token,
            pending_path,
            source,
            Some(source_path.to_string_lossy().as_ref()),
            developer_mode,
            correlation_id,
        )
    }

    pub fn preflight_online(
        &self,
        package_url: &str,
        expected_sha256: &str,
        correlation_id: &str,
    ) -> Result<InstallPreflight, DevBoxError> {
        validate_online_url(package_url, correlation_id)?;
        if expected_sha256.len() != 64
            || !expected_sha256
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err(DevBoxError::invalid_argument(
                correlation_id,
                "expectedSha256",
            ));
        }
        let token = Uuid::new_v4().to_string();
        let pending_path = self
            .staging_directory
            .join(format!("{token}.devbox-plugin"));
        let actual = download_to_file(
            package_url,
            &pending_path,
            self.policy.max_archive_bytes,
            correlation_id,
        )?;
        if !actual.eq_ignore_ascii_case(expected_sha256) {
            let _ = fs::remove_file(&pending_path);
            return Err(DevBoxError::plugin_package(
                correlation_id,
                "在线插件包摘要与目录不一致",
            ));
        }
        self.preflight_copied(
            token,
            pending_path,
            "online",
            Some(package_url),
            false,
            correlation_id,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn preflight_copied(
        &self,
        token: String,
        pending_path: PathBuf,
        source: &str,
        source_reference: Option<&str>,
        developer_mode: bool,
        correlation_id: &str,
    ) -> Result<InstallPreflight, DevBoxError> {
        let package = match self.inspect(&pending_path, developer_mode, correlation_id) {
            Ok(package) => package,
            Err(error) => {
                let _ = fs::remove_file(&pending_path);
                return Err(error);
            }
        };
        let installed = self.repository.list(correlation_id)?;
        let change = installed
            .iter()
            .find(|plugin| plugin.id == package.manifest.id)
            .map(|plugin| {
                if plugin.current_version == package.manifest.version {
                    "reinstall"
                } else {
                    "update"
                }
            })
            .unwrap_or("install")
            .to_owned();
        let summary = package.summary();
        self.pending
            .lock()
            .map_err(|_| DevBoxError::storage(correlation_id))?
            .insert(
                token.clone(),
                PendingInstall {
                    package_path: pending_path,
                    source: source.to_owned(),
                    source_reference: source_reference.map(str::to_owned),
                    developer_mode,
                },
            );
        Ok(InstallPreflight {
            token,
            summary,
            source: source.to_owned(),
            source_reference: source_reference.map(str::to_owned),
            change,
        })
    }

    pub fn confirm(
        &self,
        token: &str,
        granted_permissions: &[String],
        correlation_id: &str,
    ) -> Result<InstalledPluginRecord, DevBoxError> {
        let pending = self
            .pending
            .lock()
            .map_err(|_| DevBoxError::storage(correlation_id))?
            .remove(token)
            .ok_or_else(|| DevBoxError::not_found(correlation_id, "installToken"))?;
        let package = match self.inspect(
            &pending.package_path,
            pending.developer_mode,
            correlation_id,
        ) {
            Ok(package) => package,
            Err(error) => {
                let _ = fs::remove_file(&pending.package_path);
                return Err(error);
            }
        };
        if granted_permissions
            .iter()
            .any(|permission| !package.manifest.permissions.contains(permission))
        {
            let _ = fs::remove_file(&pending.package_path);
            return Err(DevBoxError::invalid_argument(
                correlation_id,
                "grantedPermissions",
            ));
        }
        if pending.developer_mode
            && granted_permissions
                .iter()
                .any(|permission| !permission.starts_with("storage:"))
        {
            let _ = fs::remove_file(&pending.package_path);
            return Err(DevBoxError::permission_denied(correlation_id));
        }
        let result = self.install_verified(&package, &pending, granted_permissions, correlation_id);
        let _ = fs::remove_file(&pending.package_path);
        result?;
        let installed = self
            .repository
            .list(correlation_id)?
            .into_iter()
            .find(|plugin| plugin.id == package.manifest.id)
            .ok_or_else(|| DevBoxError::not_found(correlation_id, "plugin"))?;
        self.prune_old_versions(&installed, correlation_id)?;
        Ok(installed)
    }

    pub fn cancel(&self, token: &str, correlation_id: &str) -> Result<(), DevBoxError> {
        if let Some(pending) = self
            .pending
            .lock()
            .map_err(|_| DevBoxError::storage(correlation_id))?
            .remove(token)
        {
            let _ = fs::remove_file(pending.package_path);
        }
        Ok(())
    }

    pub fn list(&self, correlation_id: &str) -> Result<Vec<InstalledPluginRecord>, DevBoxError> {
        self.repository.list(correlation_id)
    }

    pub fn set_enabled(
        &self,
        plugin_id: &str,
        enabled: bool,
        correlation_id: &str,
    ) -> Result<Vec<InstalledPluginRecord>, DevBoxError> {
        self.repository
            .set_enabled(plugin_id, enabled, correlation_id)?;
        self.repository.list(correlation_id)
    }

    pub fn grants(
        &self,
        plugin_id: &str,
        correlation_id: &str,
    ) -> Result<Vec<crate::repositories::PluginGrantRecord>, DevBoxError> {
        self.repository.grants(plugin_id, correlation_id)
    }

    pub fn set_grant(
        &self,
        plugin_id: &str,
        permission: &str,
        granted: bool,
        expected_revision: Option<i64>,
        correlation_id: &str,
    ) -> Result<crate::repositories::PluginGrantRecord, DevBoxError> {
        self.repository.set_grant(
            plugin_id,
            permission,
            granted,
            expected_revision,
            correlation_id,
        )
    }

    pub fn rollback(
        &self,
        plugin_id: &str,
        correlation_id: &str,
    ) -> Result<Vec<InstalledPluginRecord>, DevBoxError> {
        let plugin = self
            .repository
            .list(correlation_id)?
            .into_iter()
            .find(|plugin| plugin.id == plugin_id)
            .ok_or_else(|| DevBoxError::not_found(correlation_id, "plugin"))?;
        let previous = plugin
            .previous_version
            .ok_or_else(|| DevBoxError::not_found(correlation_id, "previousVersion"))?;
        if !normalized_plugin_path(&self.plugins_directory, plugin_id, &previous).is_dir() {
            return Err(DevBoxError::not_found(
                correlation_id,
                "previousVersionFiles",
            ));
        }
        self.repository.rollback(plugin_id, correlation_id)?;
        self.repository.list(correlation_id)
    }

    pub fn handle_runtime_failure(
        &self,
        plugin_id: &str,
        failing_version: &str,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let plugin = self
            .repository
            .list(correlation_id)?
            .into_iter()
            .find(|plugin| plugin.id == plugin_id)
            .ok_or_else(|| DevBoxError::not_found(correlation_id, "plugin"))?;
        if plugin.current_version != failing_version {
            return Ok(());
        }
        if let Some(previous) = &plugin.previous_version {
            if normalized_plugin_path(&self.plugins_directory, plugin_id, previous).is_dir() {
                self.repository.rollback(plugin_id, correlation_id)?;
                return Ok(());
            }
        }
        self.repository
            .set_enabled(plugin_id, false, correlation_id)
    }

    pub fn uninstall(
        &self,
        plugin_id: &str,
        delete_data: bool,
        correlation_id: &str,
    ) -> Result<Vec<InstalledPluginRecord>, DevBoxError> {
        if !crate::domain::is_plugin_id(plugin_id) {
            return Err(DevBoxError::invalid_argument(correlation_id, "pluginId"));
        }
        if !self
            .repository
            .list(correlation_id)?
            .iter()
            .any(|plugin| plugin.id == plugin_id)
        {
            return Err(DevBoxError::not_found(correlation_id, "plugin"));
        }
        let plugin_directory = self.plugins_directory.join(plugin_id);
        let trash = self
            .trash_directory
            .join(format!("{}-{}", plugin_id, Uuid::new_v4()));
        if plugin_directory.exists() {
            fs::rename(&plugin_directory, &trash)
                .map_err(|_| DevBoxError::storage(correlation_id))?;
        }
        if let Err(error) = self
            .repository
            .remove(plugin_id, delete_data, correlation_id)
        {
            if trash.exists() {
                let _ = fs::rename(&trash, &plugin_directory);
            }
            return Err(error);
        }
        if trash.exists() {
            let _ = fs::remove_dir_all(trash);
        }
        self.repository.list(correlation_id)
    }

    pub fn fetch_catalog(
        &self,
        catalog_url: &str,
        correlation_id: &str,
    ) -> Result<PluginCatalog, DevBoxError> {
        validate_online_url(catalog_url, correlation_id)?;
        let bytes = download_limited(catalog_url, 2 * 1024 * 1024, correlation_id)?;
        let catalog: PluginCatalog = serde_json::from_slice(&bytes)
            .map_err(|_| DevBoxError::plugin_package(correlation_id, "插件目录格式无效"))?;
        validate_catalog(&catalog, correlation_id)?;
        Ok(catalog)
    }

    pub fn recover(&self, correlation_id: &str) -> Result<(), String> {
        self.repository
            .recover_interrupted(correlation_id)
            .map_err(|_| "无法恢复插件数据库状态".to_owned())?;
        clean_directory(&self.staging_directory)?;
        clean_directory(&self.trash_directory)?;
        for plugin in fs::read_dir(&self.plugins_directory).map_err(|error| error.to_string())? {
            let plugin = plugin.map_err(|error| error.to_string())?;
            if !plugin
                .file_type()
                .map_err(|error| error.to_string())?
                .is_dir()
            {
                continue;
            }
            for version in fs::read_dir(plugin.path()).map_err(|error| error.to_string())? {
                let version = version.map_err(|error| error.to_string())?;
                if version
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".installing-")
                {
                    fs::remove_dir_all(version.path()).map_err(|error| error.to_string())?;
                }
            }
        }
        Ok(())
    }

    fn inspect(
        &self,
        path: &Path,
        developer_mode: bool,
        correlation_id: &str,
    ) -> Result<VerifiedPackage, DevBoxError> {
        let key_id = read_manifest_key_id(path, &self.policy)
            .map_err(|reason| DevBoxError::plugin_package(correlation_id, reason))?;
        let publisher = self.repository.trusted_publisher(&key_id, correlation_id)?;
        inspect_package(path, publisher.as_ref(), developer_mode, &self.policy).map_err(|reason| {
            if reason.contains("插件要求") || reason.contains("兼容版本") {
                DevBoxError::incompatible(correlation_id, reason)
            } else {
                DevBoxError::plugin_package(correlation_id, reason)
            }
        })
    }

    fn install_verified(
        &self,
        package: &VerifiedPackage,
        pending: &PendingInstall,
        granted_permissions: &[String],
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        self.repository
            .begin_install(&package.manifest, &pending.source, correlation_id)?;
        let plugin_root = self.plugins_directory.join(&package.manifest.id);
        fs::create_dir_all(&plugin_root).map_err(|_| DevBoxError::storage(correlation_id))?;
        let target = normalized_plugin_path(
            &self.plugins_directory,
            &package.manifest.id,
            &package.manifest.version,
        );
        let temporary = plugin_root.join(format!(".installing-{}", Uuid::new_v4()));
        let mut replaced = None;
        let operation = (|| {
            fs::create_dir(&temporary).map_err(|_| DevBoxError::storage(correlation_id))?;
            package
                .extract_to(&temporary)
                .map_err(|reason| DevBoxError::plugin_package(correlation_id, reason))?;
            if target.exists() {
                let replaced_path = self
                    .trash_directory
                    .join(format!("replace-{}", Uuid::new_v4()));
                fs::rename(&target, &replaced_path)
                    .map_err(|_| DevBoxError::storage(correlation_id))?;
                replaced = Some(replaced_path.clone());
                if let Err(error) = fs::rename(&temporary, &target) {
                    let _ = fs::rename(&replaced_path, &target);
                    return Err(DevBoxError::internal(correlation_id, error.to_string()));
                }
            } else {
                fs::rename(&temporary, &target)
                    .map_err(|_| DevBoxError::storage(correlation_id))?;
            }
            self.repository.complete_install(
                &package.manifest,
                &target,
                &package.archive_sha256,
                &package.signature_status,
                &pending.source,
                pending.source_reference.as_deref(),
                granted_permissions,
                correlation_id,
            )
        })();
        if operation.is_err() {
            let _ = fs::remove_dir_all(&temporary);
            if target.exists() {
                let _ = fs::remove_dir_all(&target);
            }
            if let Some(replaced_path) = &replaced {
                let _ = fs::rename(replaced_path, &target);
            }
            let _ = self.repository.fail_install(
                Some(&package.manifest.id),
                Some(&package.manifest.version),
                &pending.source,
                "安装事务失败",
                correlation_id,
            );
        } else if let Some(replaced_path) = replaced {
            let _ = fs::remove_dir_all(replaced_path);
        }
        operation
    }

    fn prune_old_versions(
        &self,
        plugin: &InstalledPluginRecord,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let root = self.plugins_directory.join(&plugin.id);
        if !root.is_dir() {
            return Ok(());
        }
        for entry in fs::read_dir(root).map_err(|_| DevBoxError::storage(correlation_id))? {
            let entry = entry.map_err(|_| DevBoxError::storage(correlation_id))?;
            if !entry
                .file_type()
                .map_err(|_| DevBoxError::storage(correlation_id))?
                .is_dir()
            {
                continue;
            }
            let version = entry.file_name().to_string_lossy().into_owned();
            let retained = version == plugin.current_version
                || plugin
                    .previous_version
                    .as_ref()
                    .is_some_and(|previous| previous == &version);
            if !retained {
                fs::remove_dir_all(entry.path())
                    .map_err(|_| DevBoxError::storage(correlation_id))?;
                self.repository
                    .remove_version(&plugin.id, &version, correlation_id)?;
            }
        }
        Ok(())
    }
}

fn clean_directory(directory: &Path) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            fs::remove_dir_all(entry.path()).map_err(|error| error.to_string())?;
        } else {
            fs::remove_file(entry.path()).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn read_manifest_key_id(path: &Path, policy: &PackagePolicy) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|_| "插件包不是有效 ZIP 文件".to_owned())?;
    if archive.len() > policy.max_files {
        return Err("插件包文件数量超过限制".to_owned());
    }
    let mut manifest_file = archive
        .by_name("plugin.json")
        .map_err(|_| "插件包缺少 plugin.json".to_owned())?;
    if manifest_file.size() > policy.max_file_bytes {
        return Err("plugin.json 超过大小限制".to_owned());
    }
    let mut bytes = Vec::new();
    manifest_file
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    let manifest: PluginManifest =
        serde_json::from_slice(&bytes).map_err(|_| "plugin.json 无效".to_owned())?;
    Ok(manifest.publisher.key_id)
}

fn validate_online_url(value: &str, correlation_id: &str) -> Result<Url, DevBoxError> {
    let url =
        Url::parse(value).map_err(|_| DevBoxError::invalid_argument(correlation_id, "url"))?;
    if !is_allowed_online_url(&url) {
        return Err(DevBoxError::invalid_argument(correlation_id, "url"));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(DevBoxError::invalid_argument(correlation_id, "url"));
    }
    Ok(url)
}

fn is_allowed_online_url(url: &Url) -> bool {
    let official = url.scheme() == "https"
        && matches!(
            url.host_str(),
            Some("plugins.devbox.app" | "cdn.devbox.app")
        );
    let local_development = cfg!(debug_assertions)
        && url.scheme() == "http"
        && matches!(url.host_str(), Some("127.0.0.1" | "localhost"));
    official || local_development
}

fn download_limited(url: &str, maximum: u64, correlation_id: &str) -> Result<Vec<u8>, DevBoxError> {
    let response = download_response(url, maximum, correlation_id)?;
    let mut bytes = Vec::new();
    response
        .take(maximum + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| DevBoxError::network(correlation_id, error.to_string()))?;
    if bytes.len() as u64 > maximum {
        return Err(DevBoxError::network(correlation_id, "下载内容超过大小限制"));
    }
    Ok(bytes)
}

fn download_to_file(
    url: &str,
    destination: &Path,
    maximum: u64,
    correlation_id: &str,
) -> Result<String, DevBoxError> {
    let mut response = download_response(url, maximum, correlation_id)?;
    let result = (|| {
        let mut file =
            fs::File::create(destination).map_err(|_| DevBoxError::storage(correlation_id))?;
        let mut hasher = Sha256::new();
        let mut total = 0_u64;
        let mut buffer = [0_u8; 64 * 1024];
        loop {
            let read = response
                .read(&mut buffer)
                .map_err(|error| DevBoxError::network(correlation_id, error.to_string()))?;
            if read == 0 {
                break;
            }
            total = total.saturating_add(read as u64);
            if total > maximum {
                return Err(DevBoxError::network(correlation_id, "下载内容超过大小限制"));
            }
            std::io::Write::write_all(&mut file, &buffer[..read])
                .map_err(|_| DevBoxError::storage(correlation_id))?;
            hasher.update(&buffer[..read]);
        }
        Ok(hex::encode(hasher.finalize()))
    })();
    if result.is_err() {
        let _ = fs::remove_file(destination);
    }
    result
}

fn download_response(
    url: &str,
    maximum: u64,
    correlation_id: &str,
) -> Result<reqwest::blocking::Response, DevBoxError> {
    let client = Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(60))
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 3 {
                attempt.error("重定向次数超过限制")
            } else if is_allowed_online_url(attempt.url()) {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| DevBoxError::network(correlation_id, error.to_string()))?;
    let response = client
        .get(url)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| DevBoxError::network(correlation_id, error.to_string()))?;
    if response
        .content_length()
        .is_some_and(|length| length > maximum)
    {
        return Err(DevBoxError::network(correlation_id, "下载内容超过大小限制"));
    }
    Ok(response)
}

fn validate_catalog(catalog: &PluginCatalog, correlation_id: &str) -> Result<(), DevBoxError> {
    if catalog.schema_version != 1 || catalog.plugins.len() > 500 {
        return Err(DevBoxError::plugin_package(
            correlation_id,
            "插件目录版本或数量无效",
        ));
    }
    let mut identifiers = std::collections::HashSet::new();
    for plugin in &catalog.plugins {
        if !plugin.id.starts_with("devbox.") || !identifiers.insert(&plugin.id) {
            return Err(DevBoxError::plugin_package(
                correlation_id,
                "插件目录包含非法或重复 ID",
            ));
        }
        for version in &plugin.versions {
            if version.package_sha256.len() != 64 || version.revoked {
                continue;
            }
            validate_online_url(&version.package_url, correlation_id)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{io::Write, net::TcpListener, thread};

    use super::*;
    use crate::{plugin_package::tests::write_test_package, repositories::SettingsRepository};

    #[test]
    fn 线上地址默认只允许安全协议() {
        assert!(validate_online_url("https://plugins.devbox.app/catalog.json", "test").is_ok());
        assert!(validate_online_url("https://plugins.example.com/catalog.json", "test").is_err());
        assert!(validate_online_url("http://plugins.example.com/catalog.json", "test").is_err());
    }

    #[test]
    fn 离线与在线安装共用更新回退卸载流程() {
        let root = std::env::temp_dir().join(format!("devbox-installer-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("应创建测试目录");
        let database_path = root.join("devbox.db");
        let installer = PluginInstaller::open(&root, &database_path).expect("应初始化安装器");
        let settings = SettingsRepository::open(&database_path).expect("应打开设置存储");
        let version_one = root.join("fixture-v1.devbox-plugin");
        let version_two = root.join("fixture-v2.devbox-plugin");
        write_test_package(&version_one, "1.0.0");
        write_test_package(&version_two, "1.1.0");

        let preflight = installer
            .preflight_offline(&version_one, false, "offline-v1")
            .expect("离线包应通过预检");
        assert_eq!(preflight.source, "offline");
        let installed = installer
            .confirm(&preflight.token, &["storage:read".to_owned()], "offline-v1")
            .expect("离线包应安装成功");
        assert_eq!(installed.current_version, "1.0.0");
        assert_eq!(installed.granted_permissions, ["storage:read"]);
        settings
            .update(
                "devbox.fixture",
                "fixture.value",
                &serde_json::json!("preserved"),
                None,
                "fixture-setting",
            )
            .expect("应写入插件数据");

        let preflight = installer
            .preflight_offline(&version_two, false, "offline-v2")
            .expect("更新包应通过预检");
        assert_eq!(preflight.change, "update");
        let installed = installer
            .confirm(
                &preflight.token,
                &["storage:read".to_owned(), "clipboard:write".to_owned()],
                "offline-v2",
            )
            .expect("更新应安装成功");
        assert_eq!(installed.current_version, "1.1.0");
        assert_eq!(installed.previous_version.as_deref(), Some("1.0.0"));

        installer
            .handle_runtime_failure("devbox.fixture", "1.1.0", "runtime-failure")
            .expect("运行时失败应自动回退");
        assert_eq!(
            installer.list("after-runtime-failure").expect("应读取插件")[0].current_version,
            "1.0.0"
        );

        let preflight = installer
            .preflight_offline(&version_two, false, "offline-v2-again")
            .expect("应可再次安装更新包");
        installer
            .confirm(&preflight.token, &[], "offline-v2-again")
            .expect("应再次安装更新包");

        let installed = installer
            .rollback("devbox.fixture", "rollback")
            .expect("应回退到上一版本")
            .into_iter()
            .find(|plugin| plugin.id == "devbox.fixture")
            .expect("回退后插件应存在");
        assert_eq!(installed.current_version, "1.0.0");

        let tampered = root.join("fixture-tampered.devbox-plugin");
        let mut tampered_bytes = fs::read(&version_one).expect("应读取测试包");
        let marker = b"fixture 1.0.0";
        let marker_offset = tampered_bytes
            .windows(marker.len())
            .position(|window| window == marker)
            .expect("测试包应包含入口内容");
        tampered_bytes[marker_offset] ^= 1;
        fs::write(&tampered, tampered_bytes).expect("应写入篡改包");
        assert!(installer
            .preflight_offline(&tampered, false, "tampered")
            .is_err());
        assert_eq!(
            installer.list("after-tamper").expect("应读取插件")[0].current_version,
            "1.0.0"
        );

        installer
            .uninstall("devbox.fixture", false, "uninstall-offline")
            .expect("离线插件应可卸载");
        assert!(settings
            .get("devbox.fixture", "fixture.value", "preserved-setting")
            .expect("应读取保留数据")
            .is_some());

        let unavailable = TcpListener::bind("127.0.0.1:0").expect("应获取本地端口");
        let unavailable_address = unavailable.local_addr().expect("应读取本地端口");
        drop(unavailable);
        assert!(installer
            .preflight_online(
                &format!("http://{unavailable_address}/offline.devbox-plugin"),
                &"0".repeat(64),
                "offline-network",
            )
            .is_err());

        let package_bytes = fs::read(&version_one).expect("应读取在线测试包");
        let expected_sha256 = hex::encode(Sha256::digest(&package_bytes));
        let listener = TcpListener::bind("127.0.0.1:0").expect("应启动本地测试服务");
        let address = listener.local_addr().expect("应读取服务地址");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("应接收下载请求");
            let mut request = [0_u8; 2048];
            let _ = stream.read(&mut request).expect("应读取 HTTP 请求");
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                package_bytes.len()
            )
            .expect("应写入 HTTP 响应头");
            stream.write_all(&package_bytes).expect("应写入插件包");
        });
        let preflight = installer
            .preflight_online(
                &format!("http://{address}/fixture.devbox-plugin"),
                &expected_sha256,
                "online-v1",
            )
            .expect("在线包应通过同一预检流程");
        server.join().expect("本地测试服务应正常结束");
        assert_eq!(preflight.source, "online");
        let installed = installer
            .confirm(&preflight.token, &[], "online-v1")
            .expect("在线包应通过同一安装流程");
        assert_eq!(installed.current_version, "1.0.0");
        assert!(installed.granted_permissions.is_empty());
        assert!(installer
            .uninstall("devbox.fixture", true, "uninstall-online")
            .expect("在线插件应可卸载")
            .is_empty());
        assert!(settings
            .get("devbox.fixture", "fixture.value", "deleted-setting")
            .expect("应读取删除结果")
            .is_none());

        fs::remove_dir_all(root).expect("应清理测试目录");
    }
}

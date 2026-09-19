use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::Serialize;
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
        correlation_id: &str,
    ) -> Result<InstallPreflight, DevBoxError> {
        if source_path.extension().and_then(|value| value.to_str()) != Some("zip") {
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
        let pending_path = self.staging_directory.join(format!("{token}.zip"));
        fs::copy(source_path, &pending_path).map_err(|_| DevBoxError::storage(correlation_id))?;
        self.preflight_copied(
            token,
            pending_path,
            "offline",
            Some(source_path.to_string_lossy().as_ref()),
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
        correlation_id: &str,
    ) -> Result<InstallPreflight, DevBoxError> {
        let package = match self.inspect(&pending_path, correlation_id) {
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
        let package = match self.inspect(&pending.package_path, correlation_id) {
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

    fn inspect(&self, path: &Path, correlation_id: &str) -> Result<VerifiedPackage, DevBoxError> {
        let key_id = read_manifest_key_id(path, &self.policy)
            .map_err(|reason| DevBoxError::plugin_package(correlation_id, reason))?;
        let publisher = match key_id {
            Some(key_id) => self.repository.trusted_publisher(&key_id, correlation_id)?,
            None => None,
        };
        inspect_package(path, publisher.as_ref(), &self.policy).map_err(|reason| {
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

fn read_manifest_key_id(path: &Path, policy: &PackagePolicy) -> Result<Option<String>, String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        plugin_package::tests::{write_test_package, write_unsigned_test_package},
        repositories::SettingsRepository,
    };

    #[test]
    fn 本地未签名_zip_可以在警告状态下安装() {
        let root = std::env::temp_dir().join(format!("devbox-unsigned-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("应创建测试目录");
        let installer =
            PluginInstaller::open(&root, &root.join("devbox.db")).expect("应初始化安装器");
        let package = root.join("unsigned.zip");
        write_unsigned_test_package(&package);

        let preflight = installer
            .preflight_offline(&package, "unsigned-preflight")
            .expect("未签名 ZIP 应通过预检");
        assert_eq!(preflight.summary.signature_status, "unsigned-development");
        let installed = installer
            .confirm(&preflight.token, &[], "unsigned-install")
            .expect("未签名 ZIP 应完成安装");
        assert_eq!(installed.signature_status, "unsigned-development");

        fs::remove_dir_all(root).expect("应清理测试目录");
    }

    #[test]
    fn 本地_zip_安装支持更新回退和卸载() {
        let root = std::env::temp_dir().join(format!("devbox-installer-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("应创建测试目录");
        let database_path = root.join("devbox.db");
        let installer = PluginInstaller::open(&root, &database_path).expect("应初始化安装器");
        let settings = SettingsRepository::open(&database_path).expect("应打开设置存储");
        let version_one = root.join("fixture-v1.zip");
        let version_two = root.join("fixture-v2.zip");
        write_test_package(&version_one, "1.0.0");
        write_test_package(&version_two, "1.1.0");

        let preflight = installer
            .preflight_offline(&version_one, "offline-v1")
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
            .preflight_offline(&version_two, "offline-v2")
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
            .preflight_offline(&version_two, "offline-v2-again")
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

        let tampered = root.join("fixture-tampered.zip");
        let mut tampered_bytes = fs::read(&version_one).expect("应读取测试包");
        let marker = b"fixture 1.0.0";
        let marker_offset = tampered_bytes
            .windows(marker.len())
            .position(|window| window == marker)
            .expect("测试包应包含入口内容");
        tampered_bytes[marker_offset] ^= 1;
        fs::write(&tampered, tampered_bytes).expect("应写入篡改包");
        assert!(installer.preflight_offline(&tampered, "tampered").is_err());
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

        let preflight = installer
            .preflight_offline(&version_one, "offline-delete-data")
            .expect("应可重新安装本地 ZIP");
        installer
            .confirm(&preflight.token, &[], "offline-delete-data")
            .expect("应重新安装本地 ZIP");
        assert!(installer
            .uninstall("devbox.fixture", true, "uninstall-delete-data")
            .expect("本地插件应可卸载并删除数据")
            .is_empty());
        assert!(settings
            .get("devbox.fixture", "fixture.value", "deleted-setting")
            .expect("应读取删除结果")
            .is_none());

        fs::remove_dir_all(root).expect("应清理测试目录");
    }
}

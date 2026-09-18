use std::{
    collections::{BTreeMap, HashSet},
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ed25519_dalek::{pkcs8::DecodePublicKey, Signature, Verifier, VerifyingKey};
use semver::{Version, VersionReq};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zip::ZipArchive;

use crate::domain::{is_safe_relative_path, PluginManifest};

pub const PLUGIN_API_VERSION: &str = "1.0.0";

#[derive(Debug, Clone)]
pub struct PackagePolicy {
    pub max_archive_bytes: u64,
    pub max_expanded_bytes: u64,
    pub max_file_bytes: u64,
    pub max_files: usize,
    pub max_compression_ratio: u64,
}

impl Default for PackagePolicy {
    fn default() -> Self {
        Self {
            max_archive_bytes: 25 * 1024 * 1024,
            max_expanded_bytes: 50 * 1024 * 1024,
            max_file_bytes: 8 * 1024 * 1024,
            max_files: 512,
            max_compression_ratio: 100,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TrustedPublisher {
    pub key_id: String,
    pub public_key_pem: String,
    pub revoked: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ChecksumDocument {
    algorithm: String,
    files: Vec<ChecksumEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ChecksumEntry {
    path: String,
    sha256: String,
    size: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SignatureDocument {
    algorithm: String,
    key_id: String,
    signature: String,
}

#[derive(Debug, Clone)]
pub struct VerifiedPackage {
    pub manifest: PluginManifest,
    pub archive_sha256: String,
    pub signature_status: String,
    files: BTreeMap<String, Vec<u8>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageSummary {
    pub manifest: PluginManifest,
    pub archive_sha256: String,
    pub signature_status: String,
    pub expanded_size: u64,
}

impl VerifiedPackage {
    pub fn summary(&self) -> PackageSummary {
        PackageSummary {
            manifest: self.manifest.clone(),
            archive_sha256: self.archive_sha256.clone(),
            signature_status: self.signature_status.clone(),
            expanded_size: self
                .files
                .values()
                .map(|content| content.len() as u64)
                .sum(),
        }
    }

    pub fn extract_to(&self, target: &Path) -> Result<(), String> {
        for (relative, content) in &self.files {
            let destination = target.join(relative);
            if let Some(parent) = destination.parent() {
                std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            std::fs::write(&destination, content).map_err(|error| error.to_string())?;
        }
        Ok(())
    }
}

pub fn inspect_package(
    path: &Path,
    publisher: Option<&TrustedPublisher>,
    developer_mode: bool,
    policy: &PackagePolicy,
) -> Result<VerifiedPackage, String> {
    let archive_bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    if archive_bytes.len() as u64 > policy.max_archive_bytes {
        return Err("插件包超过归档大小限制".to_owned());
    }
    let archive_sha256 = hex::encode(Sha256::digest(&archive_bytes));
    let mut archive = ZipArchive::new(File::open(path).map_err(|error| error.to_string())?)
        .map_err(|_| "插件包不是有效 ZIP 文件".to_owned())?;
    if archive.len() > policy.max_files {
        return Err("插件包文件数量超过限制".to_owned());
    }

    let mut files = BTreeMap::new();
    let mut paths = HashSet::new();
    let mut expanded_size = 0_u64;
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
        if file.is_dir() {
            continue;
        }
        let name = file.name().to_owned();
        if !is_safe_relative_path(&name) || file.enclosed_name().is_none() {
            return Err(format!("插件包路径无效：{name}"));
        }
        if file.is_symlink() || !paths.insert(name.clone()) {
            return Err(format!("插件包包含链接或重复路径：{name}"));
        }
        if file.size() > policy.max_file_bytes {
            return Err(format!("插件文件超过大小限制：{name}"));
        }
        let compressed = file.compressed_size().max(1);
        if file.size() / compressed > policy.max_compression_ratio {
            return Err(format!("插件文件压缩比超过限制：{name}"));
        }
        expanded_size = expanded_size.saturating_add(file.size());
        if expanded_size > policy.max_expanded_bytes {
            return Err("插件包展开大小超过限制".to_owned());
        }
        let mut content = Vec::with_capacity(file.size() as usize);
        file.read_to_end(&mut content)
            .map_err(|error| error.to_string())?;
        files.insert(name, content);
    }

    let manifest: PluginManifest = parse_json_file(&files, "plugin.json")?;
    manifest.validate_structure()?;
    check_compatibility(&manifest)?;
    if !files.contains_key(&manifest.entry.main) {
        return Err("插件入口文件不存在".to_owned());
    }

    let checksum_bytes = files
        .get("checksums.json")
        .ok_or_else(|| "插件包缺少 checksums.json".to_owned())?;
    let checksums: ChecksumDocument =
        serde_json::from_slice(checksum_bytes).map_err(|_| "checksums.json 无效".to_owned())?;
    if checksums.algorithm != "SHA-256" {
        return Err("插件包 checksum 算法不受支持".to_owned());
    }
    verify_checksums(&files, &checksums)?;

    let signature_status = match (files.get("signature.json"), publisher) {
        (Some(signature_bytes), Some(publisher)) => {
            verify_package_signature(signature_bytes, checksum_bytes, &manifest, publisher)?;
            "verified"
        }
        (Some(_), None) | (None, None) if developer_mode => "unsigned-development",
        (None, Some(_)) if developer_mode => "unsigned-development",
        (Some(_), None) => return Err("插件发布者不受信任".to_owned()),
        (None, Some(_)) => return Err("插件包缺少 signature.json".to_owned()),
        (None, None) => return Err("插件包缺少 signature.json".to_owned()),
    };

    Ok(VerifiedPackage {
        manifest,
        archive_sha256,
        signature_status: signature_status.to_owned(),
        files,
    })
}

fn parse_json_file<T: for<'de> Deserialize<'de>>(
    files: &BTreeMap<String, Vec<u8>>,
    name: &str,
) -> Result<T, String> {
    let content = files
        .get(name)
        .ok_or_else(|| format!("插件包缺少 {name}"))?;
    serde_json::from_slice(content).map_err(|_| format!("{name} 无效"))
}

fn check_compatibility(manifest: &PluginManifest) -> Result<(), String> {
    Version::parse(&manifest.version).map_err(|_| "插件版本无效".to_owned())?;
    let host = Version::parse(env!("CARGO_PKG_VERSION")).map_err(|error| error.to_string())?;
    let host_requirement = VersionReq::parse(&manifest.engines.devbox)
        .map_err(|_| "DevBox 兼容版本声明无效".to_owned())?;
    if !host_requirement.matches(&host) {
        return Err(format!("插件要求 DevBox {}", manifest.engines.devbox));
    }
    let api = Version::parse(PLUGIN_API_VERSION).map_err(|error| error.to_string())?;
    let api_requirement = VersionReq::parse(&manifest.engines.plugin_api)
        .map_err(|_| "Plugin API 兼容版本声明无效".to_owned())?;
    if !api_requirement.matches(&api) {
        return Err(format!(
            "插件要求 Plugin API {}",
            manifest.engines.plugin_api
        ));
    }
    Ok(())
}

fn verify_checksums(
    files: &BTreeMap<String, Vec<u8>>,
    checksums: &ChecksumDocument,
) -> Result<(), String> {
    let mut signed_paths = HashSet::new();
    for entry in &checksums.files {
        if !is_safe_relative_path(&entry.path)
            || matches!(entry.path.as_str(), "checksums.json" | "signature.json")
            || !signed_paths.insert(entry.path.clone())
        {
            return Err("checksum 路径无效或重复".to_owned());
        }
        let content = files
            .get(&entry.path)
            .ok_or_else(|| format!("checksum 引用不存在的文件：{}", entry.path))?;
        let actual = hex::encode(Sha256::digest(content));
        if content.len() as u64 != entry.size || actual != entry.sha256 {
            return Err(format!("插件文件校验失败：{}", entry.path));
        }
    }
    let payload_paths = files
        .keys()
        .filter(|path| !matches!(path.as_str(), "checksums.json" | "signature.json"))
        .collect::<HashSet<_>>();
    if payload_paths.len() != signed_paths.len()
        || !payload_paths
            .iter()
            .all(|path| signed_paths.contains(*path))
    {
        return Err("插件包包含未签名文件".to_owned());
    }
    Ok(())
}

fn verify_package_signature(
    signature_bytes: &[u8],
    checksum_bytes: &[u8],
    manifest: &PluginManifest,
    publisher: &TrustedPublisher,
) -> Result<(), String> {
    if publisher.revoked {
        return Err("插件发布者密钥已撤销".to_owned());
    }
    let document: SignatureDocument =
        serde_json::from_slice(signature_bytes).map_err(|_| "signature.json 无效".to_owned())?;
    if document.algorithm != "Ed25519"
        || document.key_id != manifest.publisher.key_id
        || document.key_id != publisher.key_id
    {
        return Err("插件签名身份不匹配".to_owned());
    }
    let key = VerifyingKey::from_public_key_pem(&publisher.public_key_pem)
        .map_err(|_| "发布者公钥无效".to_owned())?;
    let signature_data = BASE64
        .decode(document.signature)
        .map_err(|_| "插件签名编码无效".to_owned())?;
    let signature =
        Signature::from_slice(&signature_data).map_err(|_| "插件签名长度无效".to_owned())?;
    key.verify(checksum_bytes, &signature)
        .map_err(|_| "插件签名验证失败".to_owned())
}

pub fn normalized_plugin_path(root: &Path, plugin_id: &str, version: &str) -> PathBuf {
    root.join(plugin_id).join(version)
}

#[cfg(test)]
pub(crate) mod tests {
    use std::io::Write;

    use base64::{engine::general_purpose::STANDARD as TEST_BASE64, Engine};
    use ed25519_dalek::{pkcs8::DecodePrivateKey, Signer, SigningKey};
    use serde_json::json;
    use uuid::Uuid;
    use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

    use super::*;

    pub(crate) fn write_test_package(path: &Path, version: &str) {
        write_test_package_with_engine(path, version, ">=0.1.0, <0.2.0");
    }

    fn write_test_package_with_engine(path: &Path, version: &str, devbox_engine: &str) {
        let permissions = if version == "1.0.0" {
            json!(["storage:read"])
        } else {
            json!(["storage:read", "clipboard:write"])
        };
        let manifest = json!({
            "schemaVersion": 1,
            "id": "devbox.fixture",
            "name": "Fixture",
            "description": "M2 test",
            "version": version,
            "publisher": {
                "id": "devbox-test",
                "name": "DevBox M2 Test Publisher",
                "keyId": "625017f6bad8108a6db9de12eaec4cbff228d63fa6fb478316d479bd0639f7e4"
            },
            "engines": { "devbox": devbox_engine, "pluginApi": "^1.0.0" },
            "type": "ui",
            "entry": { "main": "dist/index.html" },
            "activationEvents": ["onView:fixture"],
            "permissions": permissions,
            "locales": {},
            "contributes": { "views": [] }
        });
        let manifest_bytes = serde_json::to_vec(&manifest).expect("应序列化清单");
        let html_bytes = format!("<!doctype html><title>fixture {version}</title>").into_bytes();
        let checksums = format!(
            "{}\n",
            json!({
                "algorithm": "SHA-256",
                "files": [
                    {
                        "path": "dist/index.html",
                        "sha256": hex::encode(Sha256::digest(&html_bytes)),
                        "size": html_bytes.len()
                    },
                    {
                        "path": "plugin.json",
                        "sha256": hex::encode(Sha256::digest(&manifest_bytes)),
                        "size": manifest_bytes.len()
                    }
                ]
            })
        )
        .into_bytes();
        let private_key = "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEILwCfUIH9GdLVwZjehOCY2j1KruTuExTkVlIUEvxmQx8\n-----END PRIVATE KEY-----\n";
        let signing_key = SigningKey::from_pkcs8_pem(private_key).expect("测试私钥应有效");
        let signature = signing_key.sign(&checksums);
        let signature_document = format!(
            "{}\n",
            json!({
                "algorithm": "Ed25519",
                "keyId": "625017f6bad8108a6db9de12eaec4cbff228d63fa6fb478316d479bd0639f7e4",
                "signature": TEST_BASE64.encode(signature.to_bytes())
            })
        )
        .into_bytes();

        let archive_file = File::create(path).expect("应创建测试包");
        let mut archive = ZipWriter::new(archive_file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        for (name, content) in [
            ("dist/index.html", html_bytes.as_slice()),
            ("plugin.json", manifest_bytes.as_slice()),
            ("checksums.json", checksums.as_slice()),
            ("signature.json", signature_document.as_slice()),
        ] {
            archive.start_file(name, options).expect("应写入文件头");
            archive.write_all(content).expect("应写入文件");
        }
        archive.finish().expect("应完成测试包");
    }

    #[test]
    fn 策略默认值保持有界() {
        let policy = PackagePolicy::default();
        assert!(policy.max_archive_bytes < policy.max_expanded_bytes);
        assert!(policy.max_files <= 512);
    }

    #[test]
    fn 验证由打包规范生成的签名包() {
        let archive_path =
            std::env::temp_dir().join(format!("devbox-plugin-{}.devbox-plugin", Uuid::new_v4()));
        write_test_package(&archive_path, "1.0.0");

        let publisher = TrustedPublisher {
            key_id:
                "625017f6bad8108a6db9de12eaec4cbff228d63fa6fb478316d479bd0639f7e4"
                    .to_owned(),
            public_key_pem: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEABANbfxJp4V1Zm1tpGz3nNQeghxYeqcpi8Je0s2VUSRo=\n-----END PUBLIC KEY-----\n".to_owned(),
            revoked: false,
        };
        let verified = inspect_package(
            &archive_path,
            Some(&publisher),
            false,
            &PackagePolicy::default(),
        )
        .expect("签名包应通过验证");
        assert_eq!(verified.manifest.id, "devbox.fixture");
        assert_eq!(verified.signature_status, "verified");
        assert!(inspect_package(&archive_path, None, false, &PackagePolicy::default()).is_err());
        let _ = std::fs::remove_file(archive_path);
    }

    #[test]
    fn 拒绝不兼容的插件版本() {
        let archive_path = std::env::temp_dir().join(format!(
            "devbox-incompatible-{}.devbox-plugin",
            Uuid::new_v4()
        ));
        write_test_package_with_engine(&archive_path, "1.0.0", ">=99.0.0");
        let publisher = TrustedPublisher {
            key_id:
                "625017f6bad8108a6db9de12eaec4cbff228d63fa6fb478316d479bd0639f7e4"
                    .to_owned(),
            public_key_pem: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEABANbfxJp4V1Zm1tpGz3nNQeghxYeqcpi8Je0s2VUSRo=\n-----END PUBLIC KEY-----\n".to_owned(),
            revoked: false,
        };
        assert!(inspect_package(
            &archive_path,
            Some(&publisher),
            false,
            &PackagePolicy::default(),
        )
        .is_err());
        let _ = std::fs::remove_file(archive_path);
    }
}

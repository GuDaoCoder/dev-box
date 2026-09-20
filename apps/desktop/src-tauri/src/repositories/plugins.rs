use std::{path::Path, sync::Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::{
    domain::{DevBoxError, PluginManifest},
    plugin_package::TrustedPublisher,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginRecord {
    pub id: String,
    pub name: String,
    pub publisher_id: String,
    pub current_version: String,
    pub previous_version: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub source: String,
    pub manifest: PluginManifest,
    pub granted_permissions: Vec<String>,
    pub signature_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginGrantRecord {
    pub permission: String,
    pub granted: bool,
    pub revision: i64,
}

pub struct PluginRepository {
    connection: Mutex<Connection>,
}

impl PluginRepository {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let connection = Connection::open(path)?;
        Self::initialize(connection)
    }

    #[cfg(test)]
    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::initialize(Connection::open_in_memory()?)
    }

    fn initialize(connection: Connection) -> rusqlite::Result<Self> {
        connection.execute_batch(include_str!("../../migrations/0001_initial.sql"))?;
        connection.execute_batch(include_str!("../../migrations/0002_plugins.sql"))?;
        connection.execute_batch(include_str!(
            "../../migrations/0003_remove_retired_builtin_plugins.sql"
        ))?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn trusted_publisher(
        &self,
        key_id: &str,
        correlation_id: &str,
    ) -> Result<Option<TrustedPublisher>, DevBoxError> {
        let connection = self.lock(correlation_id)?;
        connection
            .query_row(
                "SELECT key_id, public_key_pem, revoked_at IS NOT NULL
                 FROM publishers WHERE key_id = ?1 AND trusted = 1",
                params![key_id],
                |row| {
                    Ok(TrustedPublisher {
                        key_id: row.get(0)?,
                        public_key_pem: row.get(1)?,
                        revoked: row.get(2)?,
                    })
                },
            )
            .optional()
            .map_err(|_| DevBoxError::storage(correlation_id))
    }

    #[cfg(debug_assertions)]
    pub fn register_trusted_publisher(
        &self,
        publisher_id: &str,
        name: &str,
        key_id: &str,
        public_key_pem: &str,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let connection = self.lock(correlation_id)?;
        connection
            .execute(
                "INSERT INTO publishers (publisher_id, name, key_id, public_key_pem, trusted)
                 VALUES (?1, ?2, ?3, ?4, 1)
                 ON CONFLICT(publisher_id) DO UPDATE SET
                   name = excluded.name,
                   key_id = excluded.key_id,
                   public_key_pem = excluded.public_key_pem,
                   trusted = 1",
                params![publisher_id, name, key_id, public_key_pem],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        Ok(())
    }

    pub fn begin_install(
        &self,
        manifest: &PluginManifest,
        source: &str,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let mut connection = self.lock(correlation_id)?;
        let transaction = connection
            .transaction()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let publisher_key_id = manifest
            .publisher
            .key_id
            .clone()
            .unwrap_or_else(|| format!("unsigned:{}", manifest.publisher.id));
        transaction
            .execute(
                "INSERT OR IGNORE INTO publishers
                   (publisher_id, name, key_id, public_key_pem, trusted)
                 VALUES (?1, ?2, ?3, '', 0)",
                params![
                    manifest.publisher.id,
                    manifest.publisher.name,
                    publisher_key_id
                ],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let existing = transaction
            .query_row(
                "SELECT current_version FROM plugins WHERE plugin_id = ?1",
                params![manifest.id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|_| DevBoxError::storage(correlation_id))?
            .flatten();
        transaction
            .execute(
                "INSERT INTO plugins
                   (plugin_id, name, publisher_id, enabled, status, source)
                 VALUES (?1, ?2, ?3, 1, 'staging', ?4)
                 ON CONFLICT(plugin_id) DO UPDATE SET
                   name = excluded.name,
                   publisher_id = excluded.publisher_id,
                   status = 'updating',
                   source = excluded.source,
                   updated_at = CURRENT_TIMESTAMP",
                params![manifest.id, manifest.name, manifest.publisher.id, source],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        record_event(
            &transaction,
            Some(&manifest.id),
            Some(&manifest.version),
            if existing.is_some() {
                "update"
            } else {
                "install"
            },
            "started",
            Some(source),
            None,
        )
        .map_err(|_| DevBoxError::storage(correlation_id))?;
        transaction
            .commit()
            .map_err(|_| DevBoxError::storage(correlation_id))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn complete_install(
        &self,
        manifest: &PluginManifest,
        install_path: &Path,
        archive_sha256: &str,
        signature_status: &str,
        source: &str,
        source_reference: Option<&str>,
        granted_permissions: &[String],
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let manifest_json =
            serde_json::to_string(manifest).map_err(|_| DevBoxError::storage(correlation_id))?;
        let mut connection = self.lock(correlation_id)?;
        let transaction = connection
            .transaction()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let current = transaction
            .query_row(
                "SELECT current_version FROM plugins WHERE plugin_id = ?1",
                params![manifest.id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|_| DevBoxError::storage(correlation_id))?
            .flatten();
        transaction
            .execute(
                "INSERT INTO plugin_versions
                   (plugin_id, version, manifest_json, install_path, archive_sha256,
                    signature_status, source, source_reference, healthy)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1)
                 ON CONFLICT(plugin_id, version) DO UPDATE SET
                   manifest_json = excluded.manifest_json,
                   install_path = excluded.install_path,
                   archive_sha256 = excluded.archive_sha256,
                   signature_status = excluded.signature_status,
                   source = excluded.source,
                   source_reference = excluded.source_reference,
                   healthy = 1",
                params![
                    manifest.id,
                    manifest.version,
                    manifest_json,
                    install_path.to_string_lossy(),
                    archive_sha256,
                    signature_status,
                    source,
                    source_reference
                ],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let previous = current.filter(|version| version != &manifest.version);
        transaction
            .execute(
                "UPDATE plugins SET current_version = ?2, previous_version = ?3,
                   enabled = 1, status = 'installed', failure_count = 0,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE plugin_id = ?1",
                params![manifest.id, manifest.version, previous],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        for permission in &manifest.permissions {
            let granted = granted_permissions.contains(permission);
            transaction
                .execute(
                    "INSERT INTO plugin_grants
                       (plugin_id, permission, granted, revision)
                     VALUES (?1, ?2, ?3, 1)
                     ON CONFLICT(plugin_id, permission) DO UPDATE SET
                       granted = excluded.granted,
                       revision = plugin_grants.revision + 1,
                       updated_at = CURRENT_TIMESTAMP",
                    params![manifest.id, permission, granted],
                )
                .map_err(|_| DevBoxError::storage(correlation_id))?;
        }
        record_event(
            &transaction,
            Some(&manifest.id),
            Some(&manifest.version),
            if previous.is_some() {
                "update"
            } else {
                "install"
            },
            "succeeded",
            Some(source),
            None,
        )
        .map_err(|_| DevBoxError::storage(correlation_id))?;
        transaction
            .commit()
            .map_err(|_| DevBoxError::storage(correlation_id))
    }

    pub fn fail_install(
        &self,
        plugin_id: Option<&str>,
        version: Option<&str>,
        source: &str,
        detail: &str,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let connection = self.lock(correlation_id)?;
        if let Some(plugin_id) = plugin_id {
            connection
                .execute(
                    "UPDATE plugins SET status = CASE
                       WHEN current_version IS NULL THEN 'failed' ELSE 'installed' END,
                       updated_at = CURRENT_TIMESTAMP WHERE plugin_id = ?1",
                    params![plugin_id],
                )
                .map_err(|_| DevBoxError::storage(correlation_id))?;
        }
        record_event(
            &connection,
            plugin_id,
            version,
            "install",
            "failed",
            Some(source),
            Some(detail),
        )
        .map_err(|_| DevBoxError::storage(correlation_id))
    }

    pub fn list(&self, correlation_id: &str) -> Result<Vec<InstalledPluginRecord>, DevBoxError> {
        let connection = self.lock(correlation_id)?;
        let mut statement = connection
            .prepare(
                "SELECT p.plugin_id, p.name, p.publisher_id, p.current_version,
                        p.previous_version, p.enabled, p.status, p.source, v.manifest_json,
                        v.signature_status, COALESCE((
                          SELECT group_concat(permission, char(31))
                          FROM plugin_grants g
                          WHERE g.plugin_id = p.plugin_id AND g.granted = 1
                        ), '')
                 FROM plugins p
                 JOIN plugin_versions v
                   ON v.plugin_id = p.plugin_id AND v.version = p.current_version
                 ORDER BY p.name COLLATE NOCASE",
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let rows = statement
            .query_map([], |row| {
                let manifest_json = row.get::<_, String>(8)?;
                let manifest = serde_json::from_str(&manifest_json).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        8,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
                let grants = row.get::<_, String>(10)?;
                Ok(InstalledPluginRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    publisher_id: row.get(2)?,
                    current_version: row.get(3)?,
                    previous_version: row.get(4)?,
                    enabled: row.get(5)?,
                    status: row.get(6)?,
                    source: row.get(7)?,
                    manifest,
                    signature_status: row.get(9)?,
                    granted_permissions: grants
                        .split(char::from(31))
                        .filter(|permission| !permission.is_empty())
                        .map(str::to_owned)
                        .collect(),
                })
            })
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|_| DevBoxError::storage(correlation_id))
    }

    pub fn set_enabled(
        &self,
        plugin_id: &str,
        enabled: bool,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let connection = self.lock(correlation_id)?;
        let changed = connection
            .execute(
                "UPDATE plugins SET enabled = ?2, status = CASE
                   WHEN ?2 THEN 'installed' ELSE 'disabled' END,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE plugin_id = ?1 AND current_version IS NOT NULL",
                params![plugin_id, enabled],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        if changed == 0 {
            return Err(DevBoxError::not_found(correlation_id, "plugin"));
        }
        Ok(())
    }

    pub fn grants(
        &self,
        plugin_id: &str,
        correlation_id: &str,
    ) -> Result<Vec<PluginGrantRecord>, DevBoxError> {
        let connection = self.lock(correlation_id)?;
        let mut statement = connection
            .prepare(
                "SELECT permission, granted, revision FROM plugin_grants
                 WHERE plugin_id = ?1 ORDER BY permission",
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let rows = statement
            .query_map(params![plugin_id], |row| {
                Ok(PluginGrantRecord {
                    permission: row.get(0)?,
                    granted: row.get(1)?,
                    revision: row.get(2)?,
                })
            })
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|_| DevBoxError::storage(correlation_id))
    }

    pub fn set_grant(
        &self,
        plugin_id: &str,
        permission: &str,
        granted: bool,
        expected_revision: Option<i64>,
        correlation_id: &str,
    ) -> Result<PluginGrantRecord, DevBoxError> {
        let connection = self.lock(correlation_id)?;
        let current = connection
            .query_row(
                "SELECT granted, revision FROM plugin_grants
                 WHERE plugin_id = ?1 AND permission = ?2",
                params![plugin_id, permission],
                |row| Ok((row.get::<_, bool>(0)?, row.get::<_, i64>(1)?)),
            )
            .optional()
            .map_err(|_| DevBoxError::storage(correlation_id))?
            .ok_or_else(|| DevBoxError::not_found(correlation_id, "pluginPermission"))?;
        if expected_revision.is_some_and(|expected| expected != current.1) {
            return Err(DevBoxError::conflict(correlation_id, current.1));
        }
        let revision = current.1 + 1;
        connection
            .execute(
                "UPDATE plugin_grants SET granted = ?3, revision = ?4,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE plugin_id = ?1 AND permission = ?2",
                params![plugin_id, permission, granted, revision],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        Ok(PluginGrantRecord {
            permission: permission.to_owned(),
            granted,
            revision,
        })
    }

    pub fn rollback(
        &self,
        plugin_id: &str,
        correlation_id: &str,
    ) -> Result<(String, String), DevBoxError> {
        let mut connection = self.lock(correlation_id)?;
        let transaction = connection
            .transaction()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let (current, previous) = transaction
            .query_row(
                "SELECT current_version, previous_version FROM plugins WHERE plugin_id = ?1",
                params![plugin_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
            )
            .optional()
            .map_err(|_| DevBoxError::storage(correlation_id))?
            .ok_or_else(|| DevBoxError::not_found(correlation_id, "plugin"))?;
        let previous =
            previous.ok_or_else(|| DevBoxError::not_found(correlation_id, "previousVersion"))?;
        transaction
            .execute(
                "UPDATE plugins SET current_version = ?2, previous_version = ?3,
                   status = 'installed', enabled = 1, updated_at = CURRENT_TIMESTAMP
                 WHERE plugin_id = ?1",
                params![plugin_id, previous, current],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        record_event(
            &transaction,
            Some(plugin_id),
            Some(&previous),
            "rollback",
            "succeeded",
            None,
            None,
        )
        .map_err(|_| DevBoxError::storage(correlation_id))?;
        transaction
            .commit()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        Ok((current, previous))
    }

    pub fn remove(
        &self,
        plugin_id: &str,
        delete_data: bool,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let mut connection = self.lock(correlation_id)?;
        let transaction = connection
            .transaction()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let changed = transaction
            .execute(
                "DELETE FROM plugins WHERE plugin_id = ?1",
                params![plugin_id],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        if changed == 0 {
            return Err(DevBoxError::not_found(correlation_id, "plugin"));
        }
        if delete_data {
            transaction
                .execute(
                    "DELETE FROM settings WHERE plugin_id = ?1",
                    params![plugin_id],
                )
                .map_err(|_| DevBoxError::storage(correlation_id))?;
        }
        record_event(
            &transaction,
            Some(plugin_id),
            None,
            "uninstall",
            "succeeded",
            None,
            None,
        )
        .map_err(|_| DevBoxError::storage(correlation_id))?;
        transaction
            .commit()
            .map_err(|_| DevBoxError::storage(correlation_id))
    }

    pub fn remove_version(
        &self,
        plugin_id: &str,
        version: &str,
        correlation_id: &str,
    ) -> Result<(), DevBoxError> {
        let connection = self.lock(correlation_id)?;
        connection
            .execute(
                "DELETE FROM plugin_versions WHERE plugin_id = ?1 AND version = ?2
                 AND version NOT IN (
                   SELECT current_version FROM plugins WHERE plugin_id = ?1
                   UNION
                   SELECT previous_version FROM plugins WHERE plugin_id = ?1
                 )",
                params![plugin_id, version],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        Ok(())
    }

    pub fn recover_interrupted(&self, correlation_id: &str) -> Result<usize, DevBoxError> {
        let connection = self.lock(correlation_id)?;
        connection
            .execute(
                "UPDATE plugins SET
                   status = CASE WHEN current_version IS NULL THEN 'failed' ELSE 'installed' END,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE status IN ('staging', 'updating', 'uninstalling')",
                [],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))
    }

    fn lock(
        &self,
        correlation_id: &str,
    ) -> Result<std::sync::MutexGuard<'_, Connection>, DevBoxError> {
        self.connection
            .lock()
            .map_err(|_| DevBoxError::storage(correlation_id))
    }
}

fn record_event(
    connection: &Connection,
    plugin_id: Option<&str>,
    version: Option<&str>,
    operation: &str,
    outcome: &str,
    source: Option<&str>,
    detail: Option<&str>,
) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO plugin_install_events
           (plugin_id, version, operation, outcome, source, detail)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![plugin_id, version, operation, outcome, source, detail],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{collections::BTreeMap, fs};

    use uuid::Uuid;

    use super::*;
    use crate::domain::PluginManifest;

    fn manifest(version: &str) -> PluginManifest {
        serde_json::from_value(serde_json::json!({
            "schemaVersion": 1,
            "id": "devbox.fixture",
            "name": "Fixture",
            "version": version,
            "publisher": {
                "id": "devbox",
                "name": "DevBox Official",
                "keyId": "0123456789abcdef"
            },
            "engines": { "devbox": ">=0.1.0", "pluginApi": "^1.0.0" },
            "type": "ui",
            "entry": { "main": "dist/index.html" },
            "activationEvents": ["onView:fixture"],
            "permissions": ["storage:read"],
            "locales": BTreeMap::<String, String>::new(),
            "contributes": { "views": [] }
        }))
        .expect("清单应有效")
    }

    #[test]
    fn 安装更新并回退插件版本() {
        let repository = PluginRepository::in_memory().expect("应创建数据库");
        for version in ["1.0.0", "1.1.0"] {
            let manifest = manifest(version);
            repository
                .begin_install(&manifest, "offline", "test")
                .expect("应开始安装");
            repository
                .complete_install(
                    &manifest,
                    Path::new("/tmp/plugin"),
                    "abc",
                    "verified",
                    "offline",
                    None,
                    &[],
                    "test",
                )
                .expect("应完成安装");
        }
        let installed = repository.list("test").expect("应读取插件");
        assert_eq!(installed[0].current_version, "1.1.0");
        let grant = repository
            .grants("devbox.fixture", "test")
            .expect("应读取权限")[0]
            .clone();
        let updated = repository
            .set_grant(
                "devbox.fixture",
                &grant.permission,
                true,
                Some(grant.revision),
                "test",
            )
            .expect("应更新权限");
        assert!(updated.granted);
        assert!(repository
            .set_grant(
                "devbox.fixture",
                &grant.permission,
                false,
                Some(grant.revision),
                "test",
            )
            .is_err());
        repository
            .rollback("devbox.fixture", "test")
            .expect("应回退");
        assert_eq!(
            repository.list("test").expect("应读取插件")[0].current_version,
            "1.0.0"
        );
    }

    #[test]
    fn 启动迁移会移除已内置功能的旧插件记录() {
        let root = std::env::temp_dir().join(format!("devbox-plugin-migration-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("应创建测试目录");
        let database_path = root.join("devbox.db");
        drop(PluginRepository::open(&database_path).expect("应初始化数据库"));

        let connection = Connection::open(&database_path).expect("应打开数据库");
        connection
            .execute(
                "INSERT INTO publishers
                   (publisher_id, name, key_id, public_key_pem, trusted)
                 VALUES ('legacy-devbox', 'Legacy DevBox', 'legacy-key', '', 0)",
                [],
            )
            .expect("应写入旧发布者");
        connection
            .execute(
                "INSERT INTO plugins
                   (plugin_id, name, publisher_id, current_version, status, source)
                 VALUES ('devbox.official.json-tool', 'JSON Tool', 'legacy-devbox', '1.0.0',
                         'installed', 'development')",
                [],
            )
            .expect("应写入旧插件");
        connection
            .execute(
                "INSERT INTO plugin_versions
                   (plugin_id, version, manifest_json, install_path, archive_sha256,
                    signature_status, source)
                 VALUES ('devbox.official.json-tool', '1.0.0', '{}', '/tmp/legacy', 'abc',
                         'unsigned-development', 'development')",
                [],
            )
            .expect("应写入旧版本");
        connection
            .execute(
                "INSERT INTO settings (plugin_id, setting_key, value_json, revision)
                 VALUES ('devbox.official.json-tool', 'legacy', 'true', 1)",
                [],
            )
            .expect("应写入旧设置");
        drop(connection);

        let repository = PluginRepository::open(&database_path).expect("迁移应成功");
        assert!(repository.list("migration").expect("应读取插件").is_empty());
        drop(repository);
        let connection = Connection::open(&database_path).expect("应重新打开数据库");
        let settings: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM settings WHERE plugin_id = 'devbox.official.json-tool'",
                [],
                |row| row.get(0),
            )
            .expect("应统计旧设置");
        assert_eq!(settings, 0);
        fs::remove_dir_all(root).expect("应清理测试目录");
    }
}

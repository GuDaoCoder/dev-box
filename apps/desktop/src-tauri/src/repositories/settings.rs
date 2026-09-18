use std::{path::Path, sync::Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;

use crate::domain::DevBoxError;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingRecord {
    pub key: String,
    pub value: Value,
    pub revision: i64,
}

pub struct SettingsRepository {
    connection: Mutex<Connection>,
}

impl SettingsRepository {
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
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn get(
        &self,
        plugin_id: &str,
        key: &str,
        correlation_id: &str,
    ) -> Result<Option<SettingRecord>, DevBoxError> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let row = connection
            .query_row(
                "SELECT value_json, revision FROM settings WHERE plugin_id = ?1 AND setting_key = ?2",
                params![plugin_id, key],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
            )
            .optional()
            .map_err(|_| DevBoxError::storage(correlation_id))?;

        row.map(|(value_json, revision)| {
            serde_json::from_str(&value_json)
                .map(|value| SettingRecord {
                    key: key.to_owned(),
                    value,
                    revision,
                })
                .map_err(|_| DevBoxError::storage(correlation_id))
        })
        .transpose()
    }

    pub fn update(
        &self,
        plugin_id: &str,
        key: &str,
        value: &Value,
        expected_revision: Option<i64>,
        correlation_id: &str,
    ) -> Result<SettingRecord, DevBoxError> {
        let value_json = serde_json::to_string(value)
            .map_err(|_| DevBoxError::invalid_argument(correlation_id, "value"))?;
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let transaction = connection
            .transaction()
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        let current_revision = transaction
            .query_row(
                "SELECT revision FROM settings WHERE plugin_id = ?1 AND setting_key = ?2",
                params![plugin_id, key],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|_| DevBoxError::storage(correlation_id))?;

        if let Some(expected) = expected_revision {
            if expected != current_revision.unwrap_or(0) {
                return Err(DevBoxError::conflict(
                    correlation_id,
                    current_revision.unwrap_or(0),
                ));
            }
        }

        let revision = current_revision.unwrap_or(0) + 1;
        transaction
            .execute(
                "INSERT INTO settings (plugin_id, setting_key, value_json, revision) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(plugin_id, setting_key) DO UPDATE SET value_json = excluded.value_json,
                 revision = excluded.revision, updated_at = CURRENT_TIMESTAMP",
                params![plugin_id, key, value_json, revision],
            )
            .map_err(|_| DevBoxError::storage(correlation_id))?;
        transaction
            .commit()
            .map_err(|_| DevBoxError::storage(correlation_id))?;

        Ok(SettingRecord {
            key: key.to_owned(),
            value: value.clone(),
            revision,
        })
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn persists_and_revises_a_setting() {
        let repository = SettingsRepository::in_memory().expect("应创建内存数据库");
        let created = repository
            .update("plugin", "name", &json!("DevBox"), None, "request-1")
            .expect("应保存设置");
        let updated = repository
            .update(
                "plugin",
                "name",
                &json!("Toolbox"),
                Some(created.revision),
                "request-2",
            )
            .expect("应更新设置");

        assert_eq!(updated.revision, 2);
        assert_eq!(
            repository
                .get("plugin", "name", "request-3")
                .expect("应读取设置")
                .expect("设置应存在")
                .value,
            json!("Toolbox")
        );
    }

    #[test]
    fn rejects_a_stale_revision() {
        let repository = SettingsRepository::in_memory().expect("应创建内存数据库");
        repository
            .update("plugin", "name", &json!("DevBox"), None, "request-1")
            .expect("应保存设置");

        assert!(repository
            .update("plugin", "name", &json!("Old"), Some(0), "request-2")
            .is_err());
    }
}

use std::collections::BTreeMap;
use std::collections::HashSet;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginPublisher {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub key_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginEngines {
    pub devbox: String,
    pub plugin_api: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginEntry {
    pub main: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ViewContribution {
    pub id: String,
    pub title_key: String,
    pub icon: String,
    pub order: u32,
    pub category: ViewCategory,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ViewCategory {
    pub id: String,
    pub title: BTreeMap<String, String>,
    pub order: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommandContribution {
    pub id: String,
    pub title_key: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginContributions {
    pub views: Vec<ViewContribution>,
    #[serde(default)]
    pub commands: Vec<CommandContribution>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginManifest {
    pub schema_version: u8,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub version: String,
    pub publisher: PluginPublisher,
    pub engines: PluginEngines,
    #[serde(rename = "type")]
    pub plugin_type: String,
    pub entry: PluginEntry,
    pub activation_events: Vec<String>,
    pub permissions: Vec<String>,
    pub locales: BTreeMap<String, String>,
    pub contributes: PluginContributions,
}

impl PluginManifest {
    pub fn validate_structure(&self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err("schemaVersion 必须为 1".to_owned());
        }
        if !is_plugin_id(&self.id) {
            return Err("插件 ID 无效".to_owned());
        }
        if self.name.trim().is_empty() || self.name.len() > 80 {
            return Err("插件名称无效".to_owned());
        }
        if self.plugin_type != "ui" {
            return Err("运行时安装包只允许 ui 插件".to_owned());
        }
        let publisher_id_valid = (2..=64).contains(&self.publisher.id.len())
            && self.publisher.id.chars().all(|character| {
                character.is_ascii_lowercase()
                    || character.is_ascii_digit()
                    || matches!(character, '.' | '-')
            });
        if !publisher_id_valid || self.publisher.name.trim().is_empty() {
            return Err("插件发布者声明无效".to_owned());
        }
        if self.publisher.key_id.as_ref().is_some_and(|key_id| {
            !(16..=64).contains(&key_id.len())
                || !key_id
                    .chars()
                    .all(|character| character.is_ascii_hexdigit())
        }) {
            return Err("插件发布者 keyId 无效".to_owned());
        }
        if self.engines.devbox.is_empty() || self.engines.plugin_api.is_empty() {
            return Err("缺少兼容版本声明".to_owned());
        }
        if !is_safe_relative_path(&self.entry.main) || !self.entry.main.ends_with(".html") {
            return Err("插件入口路径无效".to_owned());
        }
        if self.activation_events.len() > 32 || self.permissions.len() > 16 {
            return Err("插件声明数量超过限制".to_owned());
        }
        let allowed_permissions = [
            "clipboard:read",
            "clipboard:write",
            "storage:read",
            "storage:write",
        ];
        let mut declared_permissions = HashSet::new();
        for permission in &self.permissions {
            if !allowed_permissions.contains(&permission.as_str())
                || !declared_permissions.insert(permission)
            {
                return Err(format!("不支持的插件权限：{permission}"));
            }
        }
        for (locale, file_path) in &self.locales {
            if !matches!(locale.as_str(), "zh-CN" | "en-US")
                || !is_safe_relative_path(file_path)
                || !file_path.ends_with(".json")
            {
                return Err("插件语言资源无效".to_owned());
            }
        }
        if self.contributes.views.len() > 16 || self.contributes.commands.len() > 32 {
            return Err("插件贡献点数量超过限制".to_owned());
        }
        let allowed_icons = [
            "binary",
            "box",
            "braces",
            "clock",
            "code",
            "fingerprint",
            "plug",
        ];
        let mut view_ids = HashSet::new();
        for view in &self.contributes.views {
            let valid_id = !view.id.is_empty()
                && view.id.len() <= 80
                && view.id.chars().all(|character| {
                    character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
                });
            if !valid_id
                || !view_ids.insert(&view.id)
                || view.title_key.len() < 3
                || !allowed_icons.contains(&view.icon.as_str())
                || view.order > 10_000
                || view.category.id.is_empty()
                || view.category.id.len() > 80
                || !view.category.id.chars().all(|character| {
                    character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
                })
                || view.category.order > 10_000
                || view
                    .category
                    .title
                    .keys()
                    .any(|locale| !matches!(locale.as_str(), "zh-CN" | "en-US"))
                || !matches!(view.category.title.get("zh-CN"), Some(title) if !title.trim().is_empty() && title.len() <= 80)
                || !matches!(view.category.title.get("en-US"), Some(title) if !title.trim().is_empty() && title.len() <= 80)
            {
                return Err("插件视图声明无效".to_owned());
            }
        }
        Ok(())
    }
}

pub fn is_plugin_id(value: &str) -> bool {
    value.starts_with("devbox.")
        && value.len() <= 100
        && value.chars().all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || matches!(character, '.' | '-')
        })
}

pub fn is_safe_relative_path(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('/')
        && !value.contains('\\')
        && !value
            .split('/')
            .any(|part| part.is_empty() || matches!(part, "." | ".."))
        && !value.as_bytes().get(1).is_some_and(|value| *value == b':')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 拒绝越界路径和非法插件标识() {
        assert!(is_safe_relative_path("dist/index.html"));
        assert!(!is_safe_relative_path("../index.html"));
        assert!(!is_safe_relative_path("C:/index.html"));
        assert!(is_plugin_id("devbox.tool-json"));
        assert!(!is_plugin_id("DevBox.Tool"));
    }
}

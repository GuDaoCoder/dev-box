use serde::Deserialize;

use crate::domain::{is_plugin_id, DevBoxError};

pub const API_VERSION: u8 = 1;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommandEnvelope<T> {
    api_version: u8,
    plugin_id: String,
    request_id: String,
    pub payload: T,
}

impl<T> CommandEnvelope<T> {
    pub fn validate(&self) -> Result<(), DevBoxError> {
        if self.api_version != API_VERSION {
            return Err(DevBoxError::invalid_argument(
                &self.request_id,
                "apiVersion",
            ));
        }
        if !is_plugin_id(&self.plugin_id) {
            return Err(DevBoxError::permission_denied(&self.request_id));
        }
        if self.request_id.is_empty() || self.request_id.len() > 128 {
            return Err(DevBoxError::invalid_argument(&self.request_id, "requestId"));
        }
        Ok(())
    }

    pub fn plugin_id(&self) -> &str {
        &self.plugin_id
    }

    pub fn request_id(&self) -> &str {
        &self.request_id
    }
}

pub fn validate_setting_key(key: &str, correlation_id: &str) -> Result<(), DevBoxError> {
    let valid = !key.is_empty()
        && key.len() <= 120
        && key.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
        });
    if valid {
        Ok(())
    } else {
        Err(DevBoxError::invalid_argument(correlation_id, "key"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_an_unknown_plugin() {
        let envelope = CommandEnvelope {
            api_version: API_VERSION,
            plugin_id: "unknown.plugin".to_owned(),
            request_id: "request-1".to_owned(),
            payload: (),
        };

        assert!(envelope.validate().is_err());
    }

    #[test]
    fn validates_setting_keys() {
        assert!(validate_setting_key("ui.locale", "request-1").is_ok());
        assert!(validate_setting_key("../../secret", "request-1").is_err());
    }
}

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{State, Webview};

use crate::{
    domain::DevBoxError,
    ipc::{validate_setting_key, CommandEnvelope},
    repositories::SettingRecord,
    state::AppState,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsGetRequest {
    key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsGetResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    record: Option<SettingRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsUpdateRequest {
    key: String,
    value: Value,
    expected_revision: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SettingsUpdateResponse {
    record: SettingRecord,
}

#[tauri::command]
pub fn settings_get(
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<SettingsGetRequest>,
) -> Result<SettingsGetResponse, DevBoxError> {
    envelope.validate()?;
    validate_caller_permission(&window, &state, &envelope, "storage:read")?;
    validate_setting_key(&envelope.payload.key, envelope.request_id())?;
    let record = state.settings.get(
        envelope.plugin_id(),
        &envelope.payload.key,
        envelope.request_id(),
    )?;
    Ok(SettingsGetResponse { record })
}

#[tauri::command]
pub fn settings_update(
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<SettingsUpdateRequest>,
) -> Result<SettingsUpdateResponse, DevBoxError> {
    envelope.validate()?;
    validate_caller_permission(&window, &state, &envelope, "storage:write")?;
    validate_setting_key(&envelope.payload.key, envelope.request_id())?;
    let serialized = serde_json::to_vec(&envelope.payload.value)
        .map_err(|_| DevBoxError::invalid_argument(envelope.request_id(), "value"))?;
    if serialized.len() > 64 * 1024 {
        return Err(DevBoxError::invalid_argument(
            envelope.request_id(),
            "value",
        ));
    }
    let record = state.settings.update(
        envelope.plugin_id(),
        &envelope.payload.key,
        &envelope.payload.value,
        envelope.payload.expected_revision,
        envelope.request_id(),
    )?;
    Ok(SettingsUpdateResponse { record })
}

fn validate_caller_permission<T>(
    window: &Webview,
    state: &State<'_, AppState>,
    envelope: &CommandEnvelope<T>,
    permission: &str,
) -> Result<(), DevBoxError> {
    if window.label() == "main" {
        if matches!(
            envelope.plugin_id(),
            "devbox.core" | "devbox.builtin.foundation"
        ) {
            return Ok(());
        }
    } else if state
        .runtime
        .validate_caller(window.label(), envelope.plugin_id())
        && state
            .plugins
            .grants(envelope.plugin_id(), envelope.request_id())?
            .iter()
            .any(|grant| grant.permission == permission && grant.granted)
    {
        return Ok(());
    }
    Err(DevBoxError::permission_denied(envelope.request_id()))
}

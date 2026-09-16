use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

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
    state: State<'_, AppState>,
    envelope: CommandEnvelope<SettingsGetRequest>,
) -> Result<SettingsGetResponse, DevBoxError> {
    envelope.validate()?;
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
    state: State<'_, AppState>,
    envelope: CommandEnvelope<SettingsUpdateRequest>,
) -> Result<SettingsUpdateResponse, DevBoxError> {
    envelope.validate()?;
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

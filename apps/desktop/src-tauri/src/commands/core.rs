use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::{domain::DevBoxError, ipc::CommandEnvelope};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CorePingRequest {
    client_time: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorePingResponse {
    application: &'static str,
    version: &'static str,
    ready: bool,
    server_time: String,
}

#[tauri::command]
pub fn core_ping(
    envelope: CommandEnvelope<CorePingRequest>,
) -> Result<CorePingResponse, DevBoxError> {
    envelope.validate()?;
    if envelope.payload.client_time.is_empty() || envelope.payload.client_time.len() > 64 {
        return Err(DevBoxError::invalid_argument(
            envelope.request_id(),
            "clientTime",
        ));
    }
    let server_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string();

    Ok(CorePingResponse {
        application: "DevBox",
        version: env!("CARGO_PKG_VERSION"),
        ready: true,
        server_time,
    })
}

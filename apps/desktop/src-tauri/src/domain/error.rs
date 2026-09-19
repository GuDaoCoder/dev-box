use serde::Serialize;
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevBoxError {
    code: &'static str,
    message_key: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
    correlation_id: String,
    retryable: bool,
}

impl DevBoxError {
    pub fn invalid_argument(correlation_id: &str, field: &str) -> Self {
        Self {
            code: "INVALID_ARGUMENT",
            message_key: "errors:INVALID_ARGUMENT",
            details: Some(json!({ "field": field })),
            correlation_id: correlation_id.to_owned(),
            retryable: false,
        }
    }

    pub fn permission_denied(correlation_id: &str) -> Self {
        Self {
            code: "PERMISSION_DENIED",
            message_key: "errors:PERMISSION_DENIED",
            details: None,
            correlation_id: correlation_id.to_owned(),
            retryable: false,
        }
    }

    pub fn conflict(correlation_id: &str, revision: i64) -> Self {
        Self {
            code: "CONFLICT",
            message_key: "errors:CONFLICT",
            details: Some(json!({ "currentRevision": revision })),
            correlation_id: correlation_id.to_owned(),
            retryable: true,
        }
    }

    pub fn storage(correlation_id: &str) -> Self {
        Self {
            code: "STORAGE_ERROR",
            message_key: "errors:STORAGE_ERROR",
            details: None,
            correlation_id: correlation_id.to_owned(),
            retryable: true,
        }
    }

    pub fn not_found(correlation_id: &str, resource: &str) -> Self {
        Self {
            code: "NOT_FOUND",
            message_key: "errors:NOT_FOUND",
            details: Some(json!({ "resource": resource })),
            correlation_id: correlation_id.to_owned(),
            retryable: false,
        }
    }

    pub fn plugin_package(correlation_id: &str, reason: impl Into<String>) -> Self {
        Self {
            code: "PLUGIN_PACKAGE_INVALID",
            message_key: "errors:PLUGIN_PACKAGE_INVALID",
            details: Some(json!({ "reason": reason.into() })),
            correlation_id: correlation_id.to_owned(),
            retryable: false,
        }
    }

    pub fn incompatible(correlation_id: &str, reason: impl Into<String>) -> Self {
        Self {
            code: "PLUGIN_INCOMPATIBLE",
            message_key: "errors:PLUGIN_INCOMPATIBLE",
            details: Some(json!({ "reason": reason.into() })),
            correlation_id: correlation_id.to_owned(),
            retryable: false,
        }
    }

    pub fn internal(correlation_id: &str, reason: impl Into<String>) -> Self {
        Self {
            code: "INTERNAL",
            message_key: "errors:INTERNAL",
            details: Some(json!({ "reason": reason.into() })),
            correlation_id: correlation_id.to_owned(),
            retryable: false,
        }
    }
}

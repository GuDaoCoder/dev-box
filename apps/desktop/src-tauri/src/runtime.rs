use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{
    http::{header, Response, StatusCode},
    Manager, UriSchemeContext,
};

use crate::{domain::is_safe_relative_path, state::AppState};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginWebviewIdentity {
    pub label: String,
    pub plugin_id: String,
    pub version: String,
    #[serde(skip)]
    pub root: PathBuf,
    pub consecutive_failures: u8,
    pub ready: bool,
    #[serde(skip)]
    pub bridge_secret: String,
    #[serde(skip)]
    pub gesture_token: Option<(String, Instant)>,
}

#[derive(Default)]
pub struct PluginRuntimeRegistry {
    identities: Mutex<HashMap<String, PluginWebviewIdentity>>,
}

impl PluginRuntimeRegistry {
    pub fn bind(
        &self,
        label: String,
        plugin_id: String,
        version: String,
        root: PathBuf,
    ) -> Result<PluginWebviewIdentity, String> {
        let identity = PluginWebviewIdentity {
            label: label.clone(),
            plugin_id,
            version,
            root,
            consecutive_failures: 0,
            ready: false,
            bridge_secret: uuid::Uuid::new_v4().to_string(),
            gesture_token: None,
        };
        self.identities
            .lock()
            .map_err(|_| "插件运行时状态不可用".to_owned())?
            .insert(label, identity.clone());
        Ok(identity)
    }

    pub fn resolve(&self, label: &str) -> Option<PluginWebviewIdentity> {
        self.identities.lock().ok()?.get(label).cloned()
    }

    pub fn validate_caller(&self, label: &str, plugin_id: &str) -> bool {
        self.resolve(label)
            .is_some_and(|identity| identity.plugin_id == plugin_id)
    }

    pub fn report_ready(&self, label: &str, plugin_id: &str, version: &str) -> bool {
        let Ok(mut identities) = self.identities.lock() else {
            return false;
        };
        let Some(identity) = identities.get_mut(label) else {
            return false;
        };
        if identity.plugin_id != plugin_id || identity.version != version {
            return false;
        }
        identity.ready = true;
        identity.consecutive_failures = 0;
        true
    }

    pub fn is_ready(&self, label: &str, plugin_id: &str, version: &str) -> bool {
        self.resolve(label).is_some_and(|identity| {
            identity.plugin_id == plugin_id && identity.version == version && identity.ready
        })
    }

    pub fn issue_gesture_token(
        &self,
        label: &str,
        plugin_id: &str,
        bridge_secret: &str,
    ) -> Option<String> {
        let mut identities = self.identities.lock().ok()?;
        let identity = identities.get_mut(label)?;
        if identity.plugin_id != plugin_id || identity.bridge_secret != bridge_secret {
            return None;
        }
        let token = uuid::Uuid::new_v4().to_string();
        identity.gesture_token = Some((token.clone(), Instant::now()));
        Some(token)
    }

    pub fn validate_bridge_secret(
        &self,
        label: &str,
        plugin_id: &str,
        version: &str,
        bridge_secret: &str,
    ) -> bool {
        self.resolve(label).is_some_and(|identity| {
            identity.plugin_id == plugin_id
                && identity.version == version
                && identity.bridge_secret == bridge_secret
        })
    }

    pub fn consume_gesture_token(&self, label: &str, plugin_id: &str, token: &str) -> bool {
        let Ok(mut identities) = self.identities.lock() else {
            return false;
        };
        let Some(identity) = identities.get_mut(label) else {
            return false;
        };
        if identity.plugin_id != plugin_id {
            return false;
        }
        identity
            .gesture_token
            .take()
            .is_some_and(|(expected, issued_at)| {
                expected == token && issued_at.elapsed() <= Duration::from_secs(2)
            })
    }

    pub fn unbind(&self, label: &str) {
        if let Ok(mut identities) = self.identities.lock() {
            identities.remove(label);
        }
    }

    pub fn record_failure(&self, label: &str) -> u8 {
        let Ok(mut identities) = self.identities.lock() else {
            return u8::MAX;
        };
        let Some(identity) = identities.get_mut(label) else {
            return u8::MAX;
        };
        identity.consecutive_failures = identity.consecutive_failures.saturating_add(1);
        identity.consecutive_failures
    }

    pub fn record_success(&self, label: &str) {
        if let Ok(mut identities) = self.identities.lock() {
            if let Some(identity) = identities.get_mut(label) {
                identity.consecutive_failures = 0;
            }
        }
    }
}

pub fn serve_plugin_asset(
    context: UriSchemeContext<'_, tauri::Wry>,
    request: tauri::http::Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let state = context.app_handle().state::<AppState>();
    let Some(identity) = state.runtime.resolve(context.webview_label()) else {
        return response(
            StatusCode::FORBIDDEN,
            "text/plain",
            b"unknown plugin webview".to_vec(),
        );
    };
    // WebView 身份由宿主窗口标签绑定。Windows 会改写自定义协议域名，
    // 因此这里不使用 URI host 再次推导插件身份。
    let request_path = request.uri().path().trim_start_matches('/');
    let relative = if request_path.is_empty() {
        "index.html"
    } else {
        request_path
    };
    if !is_safe_relative_path(relative) {
        return response(
            StatusCode::BAD_REQUEST,
            "text/plain",
            b"invalid path".to_vec(),
        );
    }
    let Some(path) = confined_path(&identity.root, relative) else {
        return response(StatusCode::FORBIDDEN, "text/plain", b"path denied".to_vec());
    };
    match std::fs::read(&path) {
        Ok(content) => {
            state.runtime.record_success(context.webview_label());
            let content_type = mime_guess::from_path(path)
                .first_or_octet_stream()
                .essence_str()
                .to_owned();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(
                    "Content-Security-Policy",
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
                )
                .header("X-Content-Type-Options", "nosniff")
                .body(content)
                .unwrap_or_else(|_| Response::new(Vec::new()))
        }
        Err(_) => {
            if state.runtime.record_failure(context.webview_label()) >= 3 {
                let _ = state.plugins.handle_runtime_failure(
                    &identity.plugin_id,
                    &identity.version,
                    "runtime-asset",
                );
            }
            response(StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec())
        }
    }
}

fn confined_path(root: &Path, relative: &str) -> Option<PathBuf> {
    let root = root.canonicalize().ok()?;
    let candidate = root.join(relative).canonicalize().ok()?;
    candidate.starts_with(&root).then_some(candidate)
}

fn response(status: StatusCode, content_type: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webview身份不能伪造其他插件() {
        let registry = PluginRuntimeRegistry::default();
        let identity = registry
            .bind(
                "plugin-fixture".to_owned(),
                "devbox.fixture".to_owned(),
                "1.0.0".to_owned(),
                PathBuf::from("/tmp/fixture"),
            )
            .expect("应绑定身份");
        assert!(registry.validate_caller("plugin-fixture", "devbox.fixture"));
        assert!(!registry.validate_caller("plugin-fixture", "devbox.other"));
        assert!(!registry.is_ready("plugin-fixture", "devbox.fixture", "1.0.0"));
        assert!(registry.report_ready("plugin-fixture", "devbox.fixture", "1.0.0"));
        assert!(registry.is_ready("plugin-fixture", "devbox.fixture", "1.0.0"));
        assert!(!registry.report_ready("plugin-fixture", "devbox.fixture", "2.0.0"));
        assert!(registry.validate_bridge_secret(
            "plugin-fixture",
            "devbox.fixture",
            "1.0.0",
            &identity.bridge_secret,
        ));
        assert!(!registry.validate_bridge_secret(
            "plugin-fixture",
            "devbox.other",
            "1.0.0",
            &identity.bridge_secret,
        ));
        assert!(registry
            .issue_gesture_token("plugin-fixture", "devbox.fixture", "wrong-secret")
            .is_none());
        let token = registry
            .issue_gesture_token("plugin-fixture", "devbox.fixture", &identity.bridge_secret)
            .expect("真实用户手势应换取一次性令牌");
        assert!(registry.consume_gesture_token("plugin-fixture", "devbox.fixture", &token));
        assert!(!registry.consume_gesture_token("plugin-fixture", "devbox.fixture", &token));
    }
}

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::{
    domain::DevBoxError,
    installer::{InstallPreflight, PluginCatalog},
    ipc::CommandEnvelope,
    repositories::{InstalledPluginRecord, PluginGrantRecord},
    state::AppState,
};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EmptyRequest {}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfflinePreflightRequest {
    path: String,
    developer_mode: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OnlinePreflightRequest {
    package_url: String,
    expected_sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstallConfirmRequest {
    token: String,
    granted_permissions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstallTokenRequest {
    token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginIdRequest {
    plugin_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginUninstallRequest {
    plugin_id: String,
    delete_data: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginEnabledRequest {
    plugin_id: String,
    enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginGrantRequest {
    plugin_id: String,
    permission: String,
    granted: bool,
    expected_revision: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogRequest {
    url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginsResponse {
    plugins: Vec<InstalledPluginRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightResponse {
    preflight: InstallPreflight,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogResponse {
    catalog: PluginCatalog,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginOpenedResponse {
    label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginGrantsResponse {
    grants: Vec<PluginGrantRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginReadyRequest {
    version: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginGestureRequest {
    bridge_secret: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginFailureRequest {
    version: String,
    bridge_secret: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginClipboardRequest {
    gesture_token: String,
    #[serde(default)]
    value: String,
}

fn validate_core<T>(
    window: &WebviewWindow,
    envelope: &CommandEnvelope<T>,
) -> Result<(), DevBoxError> {
    envelope.validate()?;
    if window.label() != "main" || envelope.plugin_id() != "devbox.core" {
        return Err(DevBoxError::permission_denied(envelope.request_id()));
    }
    Ok(())
}

fn close_plugin_window(app: &AppHandle, state: &State<'_, AppState>, plugin_id: &str) {
    let label = format!("plugin-{}", plugin_id.replace('.', "-"));
    state.runtime.unbind(&label);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }
}

#[tauri::command]
pub fn plugins_list(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<EmptyRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    Ok(InstalledPluginsResponse {
        plugins: state.plugins.list(envelope.request_id())?,
    })
}

#[tauri::command]
pub fn plugin_preflight_offline(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<OfflinePreflightRequest>,
) -> Result<PreflightResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let preflight = state.plugins.preflight_offline(
        &PathBuf::from(&envelope.payload.path),
        envelope.payload.developer_mode,
        envelope.request_id(),
    )?;
    Ok(PreflightResponse { preflight })
}

#[tauri::command]
pub async fn plugin_preflight_online(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<OnlinePreflightRequest>,
) -> Result<PreflightResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let installer = state.plugins.clone();
    let request_id = envelope.request_id().to_owned();
    let worker_request_id = request_id.clone();
    let payload = envelope.payload;
    tauri::async_runtime::spawn_blocking(move || {
        installer
            .preflight_online(
                &payload.package_url,
                &payload.expected_sha256,
                &worker_request_id,
            )
            .map(|preflight| PreflightResponse { preflight })
    })
    .await
    .map_err(|error| DevBoxError::internal(&request_id, error.to_string()))?
}

#[tauri::command]
pub fn plugin_install_confirm(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<InstallConfirmRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let installed = state.plugins.confirm(
        &envelope.payload.token,
        &envelope.payload.granted_permissions,
        envelope.request_id(),
    )?;
    close_plugin_window(&app, &state, &installed.id);
    Ok(InstalledPluginsResponse {
        plugins: state.plugins.list(envelope.request_id())?,
    })
}

#[tauri::command]
pub fn plugin_install_cancel(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<InstallTokenRequest>,
) -> Result<(), DevBoxError> {
    validate_core(&window, &envelope)?;
    state
        .plugins
        .cancel(&envelope.payload.token, envelope.request_id())
}

#[tauri::command]
pub fn plugin_set_enabled(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginEnabledRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let plugins = state.plugins.set_enabled(
        &envelope.payload.plugin_id,
        envelope.payload.enabled,
        envelope.request_id(),
    )?;
    if !envelope.payload.enabled {
        close_plugin_window(&app, &state, &envelope.payload.plugin_id);
    }
    Ok(InstalledPluginsResponse { plugins })
}

#[tauri::command]
pub fn plugin_grants(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginIdRequest>,
) -> Result<PluginGrantsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    Ok(PluginGrantsResponse {
        grants: state
            .plugins
            .grants(&envelope.payload.plugin_id, envelope.request_id())?,
    })
}

#[tauri::command]
pub fn plugin_set_grant(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginGrantRequest>,
) -> Result<PluginGrantRecord, DevBoxError> {
    validate_core(&window, &envelope)?;
    state.plugins.set_grant(
        &envelope.payload.plugin_id,
        &envelope.payload.permission,
        envelope.payload.granted,
        envelope.payload.expected_revision,
        envelope.request_id(),
    )
}

#[tauri::command]
pub fn plugin_rollback(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginIdRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let plugins = state
        .plugins
        .rollback(&envelope.payload.plugin_id, envelope.request_id())?;
    close_plugin_window(&app, &state, &envelope.payload.plugin_id);
    Ok(InstalledPluginsResponse { plugins })
}

#[tauri::command]
pub fn plugin_uninstall(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginUninstallRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    close_plugin_window(&app, &state, &envelope.payload.plugin_id);
    Ok(InstalledPluginsResponse {
        plugins: state.plugins.uninstall(
            &envelope.payload.plugin_id,
            envelope.payload.delete_data,
            envelope.request_id(),
        )?,
    })
}

#[tauri::command]
pub async fn plugin_catalog_fetch(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<CatalogRequest>,
) -> Result<CatalogResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let installer = state.plugins.clone();
    let request_id = envelope.request_id().to_owned();
    let worker_request_id = request_id.clone();
    let url = envelope.payload.url;
    tauri::async_runtime::spawn_blocking(move || {
        installer
            .fetch_catalog(&url, &worker_request_id)
            .map(|catalog| CatalogResponse { catalog })
    })
    .await
    .map_err(|error| DevBoxError::internal(&request_id, error.to_string()))?
}

#[tauri::command]
pub fn plugin_report_ready(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginReadyRequest>,
) -> Result<(), DevBoxError> {
    envelope.validate()?;
    if !state.runtime.report_ready(
        window.label(),
        envelope.plugin_id(),
        &envelope.payload.version,
    ) {
        return Err(DevBoxError::permission_denied(envelope.request_id()));
    }
    Ok(())
}

#[tauri::command]
pub fn plugin_report_failure(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginFailureRequest>,
) -> Result<(), DevBoxError> {
    envelope.validate()?;
    if !state.runtime.validate_bridge_secret(
        window.label(),
        envelope.plugin_id(),
        &envelope.payload.version,
        &envelope.payload.bridge_secret,
    ) {
        return Err(DevBoxError::permission_denied(envelope.request_id()));
    }
    state.plugins.handle_runtime_failure(
        envelope.plugin_id(),
        &envelope.payload.version,
        envelope.request_id(),
    )?;
    close_plugin_window(&app, &state, envelope.plugin_id());
    Ok(())
}

#[tauri::command]
pub fn plugin_user_gesture(
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginGestureRequest>,
) -> Result<String, DevBoxError> {
    envelope.validate()?;
    state
        .runtime
        .issue_gesture_token(
            window.label(),
            envelope.plugin_id(),
            &envelope.payload.bridge_secret,
        )
        .ok_or_else(|| DevBoxError::permission_denied(envelope.request_id()))
}

#[tauri::command]
pub fn plugin_clipboard_read(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginClipboardRequest>,
) -> Result<String, DevBoxError> {
    validate_plugin_capability(&window, &state, &envelope, "clipboard:read")?;
    app.clipboard()
        .read_text()
        .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))
}

#[tauri::command]
pub fn plugin_clipboard_write(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginClipboardRequest>,
) -> Result<(), DevBoxError> {
    validate_plugin_capability(&window, &state, &envelope, "clipboard:write")?;
    if envelope.payload.value.len() > 1024 * 1024 {
        return Err(DevBoxError::invalid_argument(
            envelope.request_id(),
            "value",
        ));
    }
    app.clipboard()
        .write_text(&envelope.payload.value)
        .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))
}

fn validate_plugin_capability<T>(
    window: &WebviewWindow,
    state: &State<'_, AppState>,
    envelope: &CommandEnvelope<T>,
    permission: &str,
) -> Result<(), DevBoxError>
where
    T: ClipboardGesture,
{
    envelope.validate()?;
    let granted = state
        .plugins
        .grants(envelope.plugin_id(), envelope.request_id())?
        .iter()
        .any(|grant| grant.permission == permission && grant.granted);
    if granted
        && state.runtime.consume_gesture_token(
            window.label(),
            envelope.plugin_id(),
            envelope.payload.gesture_token(),
        )
    {
        return Ok(());
    }
    Err(DevBoxError::permission_denied(envelope.request_id()))
}

trait ClipboardGesture {
    fn gesture_token(&self) -> &str;
}

impl ClipboardGesture for PluginClipboardRequest {
    fn gesture_token(&self) -> &str {
        &self.gesture_token
    }
}

#[tauri::command]
pub async fn plugin_open(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginIdRequest>,
) -> Result<PluginOpenedResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let plugin = state
        .plugins
        .list(envelope.request_id())?
        .into_iter()
        .find(|plugin| plugin.id == envelope.payload.plugin_id && plugin.enabled)
        .ok_or_else(|| DevBoxError::not_found(envelope.request_id(), "plugin"))?;
    let label = format!("plugin-{}", plugin.id.replace('.', "-"));
    if let Some(existing) = app.get_webview_window(&label) {
        existing
            .set_focus()
            .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))?;
        return Ok(PluginOpenedResponse { label });
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))?
        .join("plugins")
        .join(&plugin.id)
        .join(&plugin.current_version);
    let identity = state
        .runtime
        .bind(
            label.clone(),
            plugin.id.clone(),
            plugin.current_version.clone(),
            root,
        )
        .map_err(|reason| DevBoxError::internal(envelope.request_id(), reason))?;
    let url = format!(
        "devbox-plugin://{}/{}",
        plugin.id, plugin.manifest.entry.main
    )
    .parse()
    .map_err(|_| DevBoxError::internal(envelope.request_id(), "插件入口 URL 无效"))?;
    let allowed_plugin = plugin.id.clone();
    let context = serde_json::json!({
        "apiVersion": crate::plugin_package::PLUGIN_API_VERSION,
        "pluginId": plugin.id,
        "version": plugin.current_version,
        "permissions": plugin.granted_permissions
    })
    .to_string();
    let initialization_script = [
        "(()=>{Object.defineProperty(window,'__DEVBOX_PLUGIN__',{value:Object.freeze(",
        &context,
        "),writable:false,configurable:false});",
        "const __devboxTauriInvoke=window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);const __devboxInvoke=(command,payload={})=>__devboxTauriInvoke(command,{envelope:{apiVersion:1,pluginId:window.__DEVBOX_PLUGIN__.pluginId,requestId:crypto.randomUUID(),payload}});",
        "let __devboxGesture;const __devboxArmGesture=(event)=>{if(event.isTrusted){__devboxGesture=__devboxInvoke('plugin_user_gesture',{bridgeSecret:'",
        &identity.bridge_secret,
        "'})}};addEventListener('pointerdown',__devboxArmGesture,true);addEventListener('keydown',__devboxArmGesture,true);",
        "const __devboxReportFailure=()=>__devboxInvoke('plugin_report_failure',{version:window.__DEVBOX_PLUGIN__.version,bridgeSecret:'",
        &identity.bridge_secret,
        "'}).catch(()=>{});addEventListener('error',__devboxReportFailure,true);addEventListener('unhandledrejection',__devboxReportFailure,true);",
        "const __devboxWithGesture=async(command,payload={})=>{const gestureToken=await __devboxGesture;__devboxGesture=undefined;if(!gestureToken)throw new Error('clipboard requires a recent user gesture');return __devboxInvoke(command,{...payload,gestureToken})};",
        "Object.defineProperty(window,'__DEVBOX_PLUGIN_API__',{value:Object.freeze({reportReady:()=>__devboxInvoke('plugin_report_ready',{version:window.__DEVBOX_PLUGIN__.version}),core:Object.freeze({version:'",
        env!("CARGO_PKG_VERSION"),
        "',ping:()=>__devboxInvoke('core_ping',{clientTime:new Date().toISOString()})}),settings:Object.freeze({get:(key)=>__devboxInvoke('settings_get',{key}).then(response=>response.record),update:(key,value,expectedRevision)=>__devboxInvoke('settings_update',{key,value,expectedRevision}).then(response=>response.record)}),clipboard:Object.freeze({readText:()=>__devboxWithGesture('plugin_clipboard_read'),writeText:(value)=>__devboxWithGesture('plugin_clipboard_write',{value})})}),writable:false,configurable:false});",
        "window.dispatchEvent(new CustomEvent('devbox:host-ready',{detail:window.__DEVBOX_PLUGIN__}));})();",
    ]
    .concat();
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::CustomProtocol(url))
        .title(&plugin.name)
        .inner_size(1000.0, 720.0)
        .min_inner_size(640.0, 480.0)
        .initialization_script(initialization_script)
        .on_navigation(move |url| {
            let native_protocol = url.scheme() == "devbox-plugin"
                && url.host_str().is_some_and(|host| host == allowed_plugin);
            // Windows/Android 会把自定义协议映射为 http://<scheme>.localhost。
            let rewritten_protocol = matches!(url.scheme(), "http" | "https")
                && url.host_str() == Some("devbox-plugin.localhost");
            native_protocol || rewritten_protocol
        })
        .build();
    if let Err(error) = window {
        state.runtime.unbind(&label);
        return Err(DevBoxError::internal(
            envelope.request_id(),
            error.to_string(),
        ));
    }
    let timeout_app = app.clone();
    let timeout_label = label.clone();
    let timeout_plugin_id = plugin.id.clone();
    let timeout_version = plugin.current_version.clone();
    tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_secs(5));
        let state = timeout_app.state::<AppState>();
        if state
            .runtime
            .is_ready(&timeout_label, &timeout_plugin_id, &timeout_version)
        {
            return;
        }
        let _ = state.plugins.handle_runtime_failure(
            &timeout_plugin_id,
            &timeout_version,
            "runtime-timeout",
        );
        state.runtime.unbind(&timeout_label);
        if let Some(window) = timeout_app.get_webview_window(&timeout_label) {
            let _ = window.close();
        }
    });
    Ok(PluginOpenedResponse { label })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 插件列表接受空对象请求() {
        let envelope = serde_json::from_value::<CommandEnvelope<EmptyRequest>>(serde_json::json!({
            "apiVersion": 1,
            "pluginId": "devbox.core",
            "requestId": "plugins-list-test",
            "payload": {}
        }))
        .expect("空对象应可反序列化");

        envelope.validate().expect("请求包应通过校验");
    }

    #[test]
    fn 插件列表拒绝未知参数() {
        assert!(
            serde_json::from_value::<CommandEnvelope<EmptyRequest>>(serde_json::json!({
                "apiVersion": 1,
                "pluginId": "devbox.core",
                "requestId": "plugins-list-test",
                "payload": { "unexpected": true }
            }))
            .is_err()
        );
    }
}

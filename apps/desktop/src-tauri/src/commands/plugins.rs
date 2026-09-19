use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, State, Webview, WebviewBuilder, WebviewUrl,
};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::{
    domain::DevBoxError,
    installer::InstallPreflight,
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginViewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginOpenRequest {
    plugin_id: String,
    view_id: String,
    bounds: PluginViewBounds,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginViewRequest {
    plugin_id: String,
    view_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginViewVisibleRequest {
    plugin_id: String,
    view_id: String,
    visible: bool,
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

fn validate_core<T>(window: &Webview, envelope: &CommandEnvelope<T>) -> Result<(), DevBoxError> {
    envelope.validate()?;
    if window.label() != "main" || envelope.plugin_id() != "devbox.core" {
        return Err(DevBoxError::permission_denied(envelope.request_id()));
    }
    Ok(())
}

fn plugin_view_label(plugin_id: &str, view_id: &str) -> String {
    format!(
        "plugin-{}-{}",
        plugin_id.replace('.', "-"),
        view_id.replace('.', "-")
    )
}

fn close_plugin_webviews(app: &AppHandle, state: &State<'_, AppState>, plugin_id: &str) {
    for (label, webview) in app.webviews() {
        if state
            .runtime
            .resolve(&label)
            .is_some_and(|identity| identity.plugin_id == plugin_id)
        {
            state.runtime.unbind(&label);
            let _ = webview.close();
        }
    }
}

#[tauri::command]
pub fn plugins_list(
    window: Webview,
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
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<OfflinePreflightRequest>,
) -> Result<PreflightResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let preflight = state.plugins.preflight_offline(
        &PathBuf::from(&envelope.payload.path),
        envelope.request_id(),
    )?;
    Ok(PreflightResponse { preflight })
}

#[tauri::command]
pub fn plugin_install_confirm(
    app: AppHandle,
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<InstallConfirmRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let installed = state.plugins.confirm(
        &envelope.payload.token,
        &envelope.payload.granted_permissions,
        envelope.request_id(),
    )?;
    close_plugin_webviews(&app, &state, &installed.id);
    Ok(InstalledPluginsResponse {
        plugins: state.plugins.list(envelope.request_id())?,
    })
}

#[tauri::command]
pub fn plugin_install_cancel(
    window: Webview,
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
    window: Webview,
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
        close_plugin_webviews(&app, &state, &envelope.payload.plugin_id);
    }
    Ok(InstalledPluginsResponse { plugins })
}

#[tauri::command]
pub fn plugin_grants(
    window: Webview,
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
    window: Webview,
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
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginIdRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    let plugins = state
        .plugins
        .rollback(&envelope.payload.plugin_id, envelope.request_id())?;
    close_plugin_webviews(&app, &state, &envelope.payload.plugin_id);
    Ok(InstalledPluginsResponse { plugins })
}

#[tauri::command]
pub fn plugin_uninstall(
    app: AppHandle,
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginUninstallRequest>,
) -> Result<InstalledPluginsResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    close_plugin_webviews(&app, &state, &envelope.payload.plugin_id);
    Ok(InstalledPluginsResponse {
        plugins: state.plugins.uninstall(
            &envelope.payload.plugin_id,
            envelope.payload.delete_data,
            envelope.request_id(),
        )?,
    })
}

#[tauri::command]
pub fn plugin_report_ready(
    window: Webview,
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
    window: Webview,
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
    close_plugin_webviews(&app, &state, envelope.plugin_id());
    Ok(())
}

#[tauri::command]
pub fn plugin_user_gesture(
    window: Webview,
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
    window: Webview,
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
    window: Webview,
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
    window: &Webview,
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
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginOpenRequest>,
) -> Result<PluginOpenedResponse, DevBoxError> {
    validate_core(&window, &envelope)?;
    validate_view_bounds(&envelope.payload.bounds, envelope.request_id())?;
    let plugin = state
        .plugins
        .list(envelope.request_id())?
        .into_iter()
        .find(|plugin| plugin.id == envelope.payload.plugin_id && plugin.enabled)
        .ok_or_else(|| DevBoxError::not_found(envelope.request_id(), "plugin"))?;
    if !plugin
        .manifest
        .contributes
        .views
        .iter()
        .any(|view| view.id == envelope.payload.view_id)
    {
        return Err(DevBoxError::not_found(envelope.request_id(), "plugin view"));
    }
    let label = plugin_view_label(&plugin.id, &envelope.payload.view_id);
    if let Some(existing) = app.get_webview(&label) {
        existing
            .set_position(LogicalPosition::new(
                envelope.payload.bounds.x,
                envelope.payload.bounds.y,
            ))
            .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))?;
        existing
            .set_size(LogicalSize::new(
                envelope.payload.bounds.width,
                envelope.payload.bounds.height,
            ))
            .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))?;
        existing
            .show()
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
        "devbox-plugin://{}/{}#{}",
        plugin.id, plugin.manifest.entry.main, envelope.payload.view_id
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
    let child = WebviewBuilder::new(&label, WebviewUrl::CustomProtocol(url))
        .initialization_script(initialization_script)
        .on_navigation(move |url| {
            let native_protocol = url.scheme() == "devbox-plugin"
                && url.host_str().is_some_and(|host| host == allowed_plugin);
            // Windows/Android 会把自定义协议映射为 http://<scheme>.localhost。
            let rewritten_protocol = matches!(url.scheme(), "http" | "https")
                && url.host_str() == Some("devbox-plugin.localhost");
            native_protocol || rewritten_protocol
        });
    let created = window.window().add_child(
        child,
        LogicalPosition::new(envelope.payload.bounds.x, envelope.payload.bounds.y),
        LogicalSize::new(
            envelope.payload.bounds.width,
            envelope.payload.bounds.height,
        ),
    );
    if let Err(error) = created {
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
        if let Some(webview) = timeout_app.get_webview(&timeout_label) {
            let _ = webview.close();
        }
    });
    Ok(PluginOpenedResponse { label })
}

#[tauri::command]
pub fn plugin_view_set_visible(
    app: AppHandle,
    window: Webview,
    envelope: CommandEnvelope<PluginViewVisibleRequest>,
) -> Result<(), DevBoxError> {
    validate_core(&window, &envelope)?;
    let label = plugin_view_label(&envelope.payload.plugin_id, &envelope.payload.view_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| DevBoxError::not_found(envelope.request_id(), "plugin view"))?;
    if envelope.payload.visible {
        webview.show()
    } else {
        webview.hide()
    }
    .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))
}

#[tauri::command]
pub fn plugin_view_close(
    app: AppHandle,
    window: Webview,
    state: State<'_, AppState>,
    envelope: CommandEnvelope<PluginViewRequest>,
) -> Result<(), DevBoxError> {
    validate_core(&window, &envelope)?;
    let label = plugin_view_label(&envelope.payload.plugin_id, &envelope.payload.view_id);
    if let Some(webview) = app.get_webview(&label) {
        webview
            .close()
            .map_err(|error| DevBoxError::internal(envelope.request_id(), error.to_string()))?;
    }
    state.runtime.unbind(&label);
    Ok(())
}

fn validate_view_bounds(bounds: &PluginViewBounds, request_id: &str) -> Result<(), DevBoxError> {
    let valid = [bounds.x, bounds.y, bounds.width, bounds.height]
        .iter()
        .all(|value| value.is_finite())
        && bounds.x >= 0.0
        && bounds.y >= 0.0
        && bounds.width >= 1.0
        && bounds.height >= 1.0
        && bounds.width <= 16_384.0
        && bounds.height <= 16_384.0;
    if valid {
        Ok(())
    } else {
        Err(DevBoxError::invalid_argument(request_id, "bounds"))
    }
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

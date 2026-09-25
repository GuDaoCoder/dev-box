mod commands;
mod domain;
mod editor;
mod installer;
mod ipc;
mod java_runner;
mod plugin_package;
mod repositories;
mod runtime;
mod state;

use std::fs;

use commands::{
    core_ping, editor_list_directory, editor_open_directory, editor_read_file, editor_rename_file,
    editor_save_file, plugin_clipboard_read, plugin_clipboard_write, plugin_grants,
    plugin_install_cancel, plugin_install_confirm, plugin_java_execute, plugin_open,
    plugin_preflight_offline, plugin_report_failure, plugin_report_ready, plugin_rollback,
    plugin_set_enabled, plugin_set_grant, plugin_uninstall, plugin_user_gesture, plugin_view_close,
    plugin_view_set_visible, plugins_list, settings_get, settings_update,
};
use editor::EditorService;
use installer::PluginInstaller;
use java_runner::JavaRunnerService;
use repositories::SettingsRepository;
use runtime::{serve_plugin_asset, PluginRuntimeRegistry};
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .register_uri_scheme_protocol("devbox-plugin", serve_plugin_asset)
        .setup(|app| {
            let data_directory = app.path().app_data_dir()?;
            fs::create_dir_all(&data_directory)?;
            let database_path = data_directory.join("devbox.db");
            let settings = SettingsRepository::open(&database_path)?;
            let plugins = PluginInstaller::open(&data_directory, &database_path)
                .map_err(std::io::Error::other)?;
            app.manage(AppState {
                settings,
                plugins: std::sync::Arc::new(plugins),
                java_runner: std::sync::Arc::new(JavaRunnerService::default()),
                editor: EditorService::default(),
                runtime: PluginRuntimeRegistry::default(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core_ping,
            editor_open_directory,
            editor_list_directory,
            editor_read_file,
            editor_save_file,
            editor_rename_file,
            settings_get,
            settings_update,
            plugins_list,
            plugin_preflight_offline,
            plugin_install_confirm,
            plugin_install_cancel,
            plugin_set_enabled,
            plugin_grants,
            plugin_set_grant,
            plugin_rollback,
            plugin_uninstall,
            plugin_open,
            plugin_view_set_visible,
            plugin_view_close,
            plugin_report_failure,
            plugin_report_ready,
            plugin_user_gesture,
            plugin_clipboard_read,
            plugin_clipboard_write,
            plugin_java_execute
        ])
        .run(tauri::generate_context!())
        .expect("DevBox 启动失败");
}

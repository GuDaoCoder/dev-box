mod commands;
mod domain;
mod ipc;
mod repositories;
mod state;

use std::fs;

use commands::{core_ping, settings_get, settings_update};
use repositories::SettingsRepository;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_directory = app.path().app_data_dir()?;
            fs::create_dir_all(&data_directory)?;
            let settings = SettingsRepository::open(&data_directory.join("devbox.db"))?;
            app.manage(AppState { settings });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core_ping,
            settings_get,
            settings_update
        ])
        .run(tauri::generate_context!())
        .expect("DevBox 启动失败");
}

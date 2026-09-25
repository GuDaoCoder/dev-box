use std::sync::Arc;

use crate::editor::EditorService;
use crate::installer::PluginInstaller;
use crate::java_runner::JavaRunnerService;
use crate::repositories::SettingsRepository;
use crate::runtime::PluginRuntimeRegistry;

pub struct AppState {
    pub settings: SettingsRepository,
    pub plugins: Arc<PluginInstaller>,
    pub java_runner: Arc<JavaRunnerService>,
    pub editor: EditorService,
    pub runtime: PluginRuntimeRegistry,
}

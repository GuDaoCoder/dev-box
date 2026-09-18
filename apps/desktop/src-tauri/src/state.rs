use std::sync::Arc;

use crate::installer::PluginInstaller;
use crate::repositories::SettingsRepository;
use crate::runtime::PluginRuntimeRegistry;

pub struct AppState {
    pub settings: SettingsRepository,
    pub plugins: Arc<PluginInstaller>,
    pub runtime: PluginRuntimeRegistry,
}

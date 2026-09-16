use serde::Serialize;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct HealthStatus {
    application: &'static str,
    version: &'static str,
    ready: bool,
}

fn current_health() -> HealthStatus {
    HealthStatus {
        application: "DevBox",
        version: env!("CARGO_PKG_VERSION"),
        ready: true,
    }
}

#[tauri::command]
fn health_check() -> HealthStatus {
    current_health()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![health_check])
        .run(tauri::generate_context!())
        .expect("error while running DevBox");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_status_reports_the_current_application() {
        assert_eq!(
            current_health(),
            HealthStatus {
                application: "DevBox",
                version: "0.1.0",
                ready: true,
            }
        );
    }
}

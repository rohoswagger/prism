// Prism - GitHub PR Menu Bar App
// Main Tauri Application

use tauri::{tray::TrayIconBuilder, Manager, WindowEvent};

mod github;

// Tauri commands
#[tauri::command]
fn get_github_token() -> Result<String, String> {
    github::get_stored_token().ok_or_else(|| "No token found".to_string())
}

#[tauri::command]
async fn start_github_oauth() -> Result<String, String> {
    github::start_device_flow().await
}

#[tauri::command]
async fn fetch_pull_requests() -> Result<github::PullRequestData, String> {
    github::fetch_pull_requests().await
}

#[tauri::command]
fn open_github() -> Result<(), String> {
    open::that("https://github.com/pulls").map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_github_token,
            start_github_oauth,
            fetch_pull_requests,
            open_github,
            open_url,
            quit_app
        ])
        .setup(|app| {
            // Create system tray
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Prism - GitHub PRs")
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide window when it loses focus (menu bar app behavior)
            if let WindowEvent::Focused(false) = event {
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

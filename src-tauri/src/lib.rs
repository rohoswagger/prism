// Prism - GitHub PR Menu Bar App
// Main Tauri Application

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, WindowEvent,
};

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
                    // Only handle left click release (not press)
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                // Position window near tray icon (centered below it)
                                if let Ok(Some(rect)) = tray.rect() {
                                    let window_width: f64 = 340.0;
                                    // Get physical position values
                                    let tray_x = match rect.position {
                                        tauri::Position::Physical(p) => p.x as f64,
                                        tauri::Position::Logical(l) => l.x,
                                    };
                                    let tray_y = match rect.position {
                                        tauri::Position::Physical(p) => p.y as f64,
                                        tauri::Position::Logical(l) => l.y,
                                    };
                                    let tray_width = match rect.size {
                                        tauri::Size::Physical(p) => p.width as f64,
                                        tauri::Size::Logical(l) => l.width,
                                    };
                                    let tray_height = match rect.size {
                                        tauri::Size::Physical(p) => p.height as f64,
                                        tauri::Size::Logical(l) => l.height,
                                    };

                                    let x = tray_x - (window_width / 2.0) + (tray_width / 2.0);
                                    let y = tray_y + tray_height + 5.0;
                                    let _ = window
                                        .set_position(PhysicalPosition::new(x as i32, y as i32));
                                }
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
            match event {
                // Hide window when it loses focus (menu bar app behavior)
                WindowEvent::Focused(false) => {
                    // Small delay to prevent immediate hide after show
                    let window = window.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        if !window.is_focused().unwrap_or(true) {
                            let _ = window.hide();
                        }
                    });
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

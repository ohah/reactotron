#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod reactauri_core_server;
use tauri::Manager;

use android_commands::*;
mod android_commands;

#[tauri::command]
fn start_core_server(app: tauri::AppHandle) {
    reactauri_core_server::start_server(app);
}

#[tauri::command]
fn stop_core_server(app: tauri::AppHandle) {
    reactauri_core_server::stop_server(app);
}

#[tauri::command]
async fn send_command(
    app: tauri::AppHandle, 
    r#type: String, 
    payload: serde_json::Value, 
    client_id: String
) {
    let command = reactauri_core_server::CommandWithClientId {
        r#type,
        payload,
        client_id,
        important: false,
        date: Some(chrono::Utc::now().to_rfc3339()),
        delta_time: Some(0),
    };
    println!("send_command: {:?}", command);
    reactauri_core_server::send_command(app, command).await;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            start_core_server,
            stop_core_server,
            send_command,
            get_device_list,
            reverse_tunnel_device,
            reload_app,
            shake_device,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window: tauri::WebviewWindow = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            // 앱 시작 시 자동으로 Android 디바이스 감시 시작
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = android_commands::start_device_tracking_internal(app_handle) {
                    println!("Failed to start Android device tracking: {}", e);
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


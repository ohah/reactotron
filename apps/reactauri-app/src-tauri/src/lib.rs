#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod reactauri_core_server;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};

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
            
            // 메뉴 설정
            let about_item = MenuItem::with_id(
                app,
                "about",
                "About Reactauri",
                true,
                None::<&str>,
            ).unwrap();
            
            let documentation_item = MenuItem::with_id(
                app,
                "documentation", 
                "Documentation",
                true,
                None::<&str>,
            ).unwrap();

            let quit_item = MenuItem::with_id(
                app,
                "quit",
                "Quit", 
                true,
                Some("CmdOrCtrl+Q"),
            ).unwrap();

            let reload_item = MenuItem::with_id(
                app,
                "reload",
                "Reload",
                true, 
                Some("CmdOrCtrl+R"),
            ).unwrap();

            let force_reload_item = MenuItem::with_id(
                app,
                "force_reload",
                "Force Reload",
                true,
                Some("CmdOrCtrl+Shift+R"),
            ).unwrap();

            // 서브메뉴들 생성
            let help_submenu = SubmenuBuilder::new(app, "Help")
                .item(&about_item)
                .item(&documentation_item)
                .build().unwrap();

            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&quit_item)
                .build().unwrap();

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&reload_item)
                .item(&force_reload_item)
                .build().unwrap();

            // 메인 메뉴 생성
            let menu = MenuBuilder::new(app)
                .items(&[&help_submenu, &file_submenu, &view_submenu])
                .build().unwrap();

            // 메뉴 설정
            app.set_menu(menu).unwrap();
            
            // 메뉴 이벤트 핸들러
            app.on_menu_event(move |app_handle, event| {
                match event.id().0.as_str() {
                    "about" => {
                        println!("About Reactauri clicked");
                    }
                    "documentation" => {
                        println!("Documentation clicked");
                        // URL 열기
                        #[cfg(target_os = "macos")]
                        {
                            use std::process::Command;
                            let _ = Command::new("open").arg("https://github.com/infinitered/reactotron").spawn();
                        }
                        #[cfg(not(target_os = "macos"))]
                        {
                            use std::process::Command;
                            let _ = Command::new("xdg-open").arg("https://github.com/infinitered/reactotron").spawn();
                        }
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    "reload" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.eval("window.location.reload()");
                        }
                    }
                    "force_reload" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.eval("window.location.reload()");
                        }
                    }
                    _ => {
                        println!("unexpected menu event: {}", event.id().0);
                    }
                }
            });
            
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


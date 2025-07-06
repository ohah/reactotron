#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod reactauri_core_server;
use tauri::{Manager};
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
        .plugin(tauri_plugin_dialog::init())
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
            
            // Setup menu
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

            // Edit menu items
            let copy_item = MenuItem::with_id(
                app,
                "copy",
                "Copy",
                true,
                Some("CmdOrCtrl+C"),
            ).unwrap();

            let paste_item = MenuItem::with_id(
                app,
                "paste",
                "Paste",
                true,
                Some("CmdOrCtrl+V"),
            ).unwrap();

            let cut_item = MenuItem::with_id(
                app,
                "cut",
                "Cut",
                true,
                Some("CmdOrCtrl+X"),
            ).unwrap();

            let select_all_item = MenuItem::with_id(
                app,
                "select_all",
                "Select All",
                true,
                Some("CmdOrCtrl+A"),
            ).unwrap();

            // Create submenus
            let help_submenu = SubmenuBuilder::new(app, "Help")
                .item(&about_item)
                .item(&documentation_item)
                .build().unwrap();

            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&quit_item)
                .build().unwrap();

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&copy_item)
                .item(&paste_item)
                .item(&cut_item)
                .item(&select_all_item)
                .build().unwrap();

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&reload_item)
                .item(&force_reload_item)
                .build().unwrap();

            // Create main menu
            let menu = MenuBuilder::new(app)
                .items(&[&file_submenu, &edit_submenu, &view_submenu, &help_submenu])
                .build().unwrap();

            // Set menu
            app.set_menu(menu).unwrap();
            
            // Menu event handler
            app.on_menu_event(|app_handle, event| {
                match event.id().0.as_str() {
                    "about" => {
                        use tauri_plugin_dialog::DialogExt;
                        let _ = app_handle.dialog()
                            .message("Reactauri v0.1.0\nReact Native Debugging Tool")
                            .title("About Reactauri")
                            .blocking_show();
                    }
                    "documentation" => {
                        println!("Documentation clicked");
                        // Open URL
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
                        println!("Quit pressed");
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
                    "copy" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.eval("document.execCommand('copy')");
                        }
                    }
                    "paste" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.eval("document.execCommand('paste')");
                        }
                    }
                    "cut" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.eval("document.execCommand('cut')");
                        }
                    }
                    "select_all" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.eval("document.execCommand('selectAll')");
                        }
                    }
                    _ => {
                        println!("unexpected menu event: {}", event.id().0);
                    }
                }
            });
            
            // Start Android device tracking automatically on app startup
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


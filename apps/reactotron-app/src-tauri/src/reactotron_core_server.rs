use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::async_runtime;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Listener;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub r#type: String,
    pub payload: serde_json::Value,
    // add fields..
}

type ServerHandle = Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>;

static mut SERVER_HANDLE: Option<ServerHandle> = None;

pub fn get_server_handle() -> &'static ServerHandle {
    unsafe {
        if SERVER_HANDLE.is_none() {
            SERVER_HANDLE = Some(Arc::new(Mutex::new(None)));
        }
        SERVER_HANDLE.as_ref().unwrap()
    }
}

pub fn start_server(app_handle: AppHandle) {

    let server_handle = get_server_handle();
    {
        let mut guard = server_handle.lock().unwrap();
        if let Some(handle) = guard.take() {
            handle.abort();
            app_handle.emit("stop", "stop").unwrap();
        }
    }

    let handle = async_runtime::spawn(async move {
        // todo: get port from store.json
        let listener = TcpListener::bind("0.0.0.0:9090").await.unwrap();
        println!("WebSocket server started: ws://0.0.0.0:9090");

        loop {
            let (stream, _) = listener.accept().await.unwrap();
            let app_handle = app_handle.clone();
            app_handle.emit("start", "start").unwrap();

            async_runtime::spawn(async move {
                let mut ws_stream = accept_async(stream).await.unwrap();

                while let Some(msg) = ws_stream.next().await {
                    let msg = msg.unwrap();
                    if msg.is_text() {
                        let text = msg.to_text().unwrap();
                        if let Ok(cmd) = serde_json::from_str::<Command>(text) {
                            println!("received: {:?}", cmd);
                            app_handle.emit("command", &cmd).unwrap();
                        }
                    }
                }
            });
        }
    });
    let server_handle = get_server_handle();
    let mut guard = server_handle.lock().unwrap();
    *guard = Some(handle);
}

pub fn stop_server(app_handle: AppHandle) {
    let server_handle = get_server_handle();
    let mut guard = server_handle.lock().unwrap();
    if let Some(handle) = guard.take() {
        handle.abort(); // tokio의 abort로 종료
        app_handle.emit("stop", "stop").unwrap();
    }
}

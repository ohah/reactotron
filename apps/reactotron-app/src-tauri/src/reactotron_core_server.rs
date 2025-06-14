use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::async_runtime;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Listener;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as TokioMutex;  // 상단에 추가

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub r#type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandWithClientId {
    pub r#type: String,
    pub payload: serde_json::Value,
    pub client_id: String,
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

type WsStream = Arc<TokioMutex<Option<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>>>>;
static mut WS_STREAM: Option<WsStream> = None;

pub fn get_ws_stream() -> &'static WsStream {
    unsafe {
        if WS_STREAM.is_none() {
            WS_STREAM = Some(Arc::new(TokioMutex::new(None)));
        }
        WS_STREAM.as_ref().unwrap()
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
                let ws_stream = get_ws_stream();
                let mut ws = accept_async(stream).await.unwrap();
                println!("WebSocket connection accepted");
                
                {
                    let mut guard = ws_stream.lock().await;
                    *guard = Some(ws);
                    println!("WebSocket stream stored");
                }

                let mut ws_ref = ws_stream.lock().await;
                if let Some(ws) = ws_ref.as_mut() {
                    while let Some(msg) = ws.next().await {
                        println!("Received raw message");
                        let msg = msg.unwrap();
                        if msg.is_text() {
                            let text = msg.to_text().unwrap();
                            println!("Received text: {}", text);
                            if let Ok(cmd) = serde_json::from_str::<Command>(text) {
                                println!("received: {:?}", cmd);
                                if cmd.r#type == "client.intro" {
                                    let payload = cmd.payload.clone();
                                    app_handle.emit("connectionEstablished", &payload).unwrap();
                                }
                                if cmd.r#type == "customCommand.register" {
                                    let payload = cmd.payload.clone();
                                    app_handle.emit("customCommandRegister", &payload).unwrap();
                                }
                                app_handle.emit("command", &cmd).unwrap();
                            } else {
                                println!("Failed to parse command: {}", text);
                            }
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
        handle.abort();
        app_handle.emit("stop", "stop").unwrap();
    }
}

pub async fn send_command(app_handle: AppHandle, command: CommandWithClientId) {
    let ws_stream = get_ws_stream();
    let mut guard = ws_stream.lock().await;
    println!("async send_command: {:?}", command);
    if let Some(ws) = guard.as_mut() {
        let command_json = serde_json::to_string(&command).unwrap();
        let message = Message::Text(command_json.into());
        ws.send(message).await.unwrap();
    }
}
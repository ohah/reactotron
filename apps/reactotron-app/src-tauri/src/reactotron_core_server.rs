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
use tokio::sync::Mutex as TokioMutex;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Command {
    pub r#type: String,
    pub payload: serde_json::Value,
    #[serde(default)]
    pub important: Option<serde_json::Value>,
    #[serde(default)]
    pub diff: Option<serde_json::Value>,
    #[serde(default, rename = "connectionId")]
    pub connection_id: Option<u32>,
    #[serde(default, rename = "messageId")]
    pub message_id: Option<u32>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default, rename = "deltaTime")]
    pub delta_time: Option<serde_json::Value>,
    #[serde(default, rename = "clientId")]
    pub client_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandWithClientId {
    pub r#type: String,
    pub payload: serde_json::Value,
    pub client_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClientConnection {
    pub id: u32,
    pub address: String,
    pub client_id: String,
    #[serde(skip)]
    pub socket: Arc<TokioMutex<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>>>,
}

type ServerHandle = Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>;
type WsStream = Arc<TokioMutex<Option<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>>>>;
type ClientConnections = Arc<TokioMutex<HashMap<String, ClientConnection>>>;
type Subscriptions = Arc<TokioMutex<Vec<String>>>;

static mut SERVER_HANDLE: Option<ServerHandle> = None;
static mut WS_STREAM: Option<WsStream> = None;
static mut CLIENT_CONNECTIONS: Option<ClientConnections> = None;
static mut SUBSCRIPTIONS: Option<Subscriptions> = None;

pub fn get_server_handle() -> &'static ServerHandle {
    unsafe {
        if SERVER_HANDLE.is_none() {
            SERVER_HANDLE = Some(Arc::new(Mutex::new(None)));
        }
        SERVER_HANDLE.as_ref().unwrap()
    }
}

pub fn get_ws_stream() -> &'static WsStream {
    unsafe {
        if WS_STREAM.is_none() {
            WS_STREAM = Some(Arc::new(TokioMutex::new(None)));
        }
        WS_STREAM.as_ref().unwrap()
    }
}

pub fn get_client_connections() -> &'static ClientConnections {
    unsafe {
        if CLIENT_CONNECTIONS.is_none() {
            CLIENT_CONNECTIONS = Some(Arc::new(TokioMutex::new(HashMap::new())));
        }
        CLIENT_CONNECTIONS.as_ref().unwrap()
    }
}

pub fn get_subscriptions() -> &'static Subscriptions {
    unsafe {
        if SUBSCRIPTIONS.is_none() {
            SUBSCRIPTIONS = Some(Arc::new(TokioMutex::new(Vec::new())));
        }
        SUBSCRIPTIONS.as_ref().unwrap()
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
        let listener = match TcpListener::bind("0.0.0.0:9090").await {
            Ok(listener) => listener,
            Err(e) => {
                if e.to_string().contains("EADDRINUSE") {
                    app_handle.emit("portUnavailable", 9090).unwrap();
                } else {
                    println!("Error starting server: {}", e);
                }
                return;
            }
        };
        println!("WebSocket server started: ws://0.0.0.0:9090");

        let mut connection_id = 0;
        let mut message_id = 0;

        loop {
            let (stream, addr) = listener.accept().await.unwrap();
            let app_handle = app_handle.clone();
            let current_connection_id = connection_id;
            connection_id += 1;

            async_runtime::spawn(async move {
                let ws_stream = get_ws_stream();
                let client_connections = get_client_connections();
                let subscriptions = get_subscriptions();
                
                let ws = accept_async(stream).await.unwrap();
                let ws = Arc::new(TokioMutex::new(ws));
                println!("WebSocket connection accepted from {}", addr);

                let mut current_client_id = None;

                loop {
                    let mut ws_guard = ws.lock().await;
                    if let Some(msg) = ws_guard.next().await {
                        let msg = msg.unwrap();
                        if msg.is_text() {
                            let text = msg.to_text().unwrap();
                            println!("Received text: {}", text);
                            
                            if let Ok(mut cmd) = serde_json::from_str::<Command>(text) {
                                message_id += 1;
                                cmd.message_id = Some(message_id);
                                cmd.connection_id = Some(current_connection_id);

                                if cmd.r#type == "client.intro" {
                                    let client_id = if let Some(id) = cmd.payload.get("clientId") {
                                        id.as_str().unwrap().to_string()
                                    } else {
                                        Uuid::new_v4().to_string()
                                    };

                                    current_client_id = Some(client_id.clone());
                                    cmd.client_id = Some(client_id.clone());

                                    let mut connections = client_connections.lock().await;
                                    connections.insert(client_id.clone(), ClientConnection {
                                        id: current_connection_id,
                                        address: addr.to_string(),
                                        client_id: client_id.clone(),
                                        socket: ws.clone(),
                                    });

                                    // Send client ID back to client
                                    let response = serde_json::json!({
                                        "type": "setClientId",
                                        "payload": client_id
                                    });
                                    ws_guard.send(Message::Text(response.to_string().into())).await.unwrap();

                                    // Send current subscriptions
                                    let subs = subscriptions.lock().await;
                                    let sub_response = serde_json::json!({
                                        "type": "state.values.subscribe",
                                        "payload": { "paths": *subs }
                                    });
                                    ws_guard.send(Message::Text(sub_response.to_string().into())).await.unwrap();
                                    app_handle.emit("connectionEstablished", &cmd.payload).unwrap();
                                }

                                if cmd.r#type == "state.values.change" {
                                    if let Some(changes) = cmd.payload.get("changes") {
                                        if let Some(paths) = changes.as_array() {
                                            let mut subs = subscriptions.lock().await;
                                            for path in paths {
                                                if let Some(path_str) = path.get("path").and_then(|p| p.as_str()) {
                                                    if !subs.contains(&path_str.to_string()) {
                                                        subs.push(path_str.to_string());
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                app_handle.emit("command", &cmd).unwrap();
                            } else {
                                println!("Failed to parse command: {}", text);
                            }
                        }
                    } else {
                        break;
                    }
                }

                // Handle disconnection
                if let Some(client_id) = current_client_id {
                    let mut connections = client_connections.lock().await;
                    if let Some(conn) = connections.remove(&client_id) {
                        app_handle.emit("disconnect", &conn).unwrap();
                    }
                }
            });
        }
    });

    let server_handle = get_server_handle();
    let mut guard = server_handle.lock().unwrap();
    *guard = Some(handle);
}

pub async fn stop_server(app_handle: AppHandle) {
    let server_handle = get_server_handle();
    let mut guard = server_handle.lock().unwrap();
    
    if let Some(handle) = guard.take() {
        handle.abort();
        
        // Clean up client connections
        let client_connections = get_client_connections();
        let mut connections = client_connections.lock().await;
        connections.clear();
        
        // Clear subscriptions
        let subscriptions = get_subscriptions();
        let mut subs = subscriptions.lock().await;
        subs.clear();
        
        app_handle.emit("stop", "stop").unwrap();
    }
}

pub async fn send_command(app_handle: AppHandle, command: CommandWithClientId) {
    let client_connections = get_client_connections();
    let connections = client_connections.lock().await;
    
    println!("async send_command: {:?}", command);
    
    for (_, conn) in connections.iter() {
        if command.client_id.is_empty() || conn.client_id == command.client_id {
            let command_json = serde_json::to_string(&command).unwrap();
            let message = Message::Text(command_json.into());
            let mut socket = conn.socket.lock().await;
            if let Err(e) = socket.send(message).await {
                println!("Error sending message to client {}: {}", conn.client_id, e);
            }
        }
    }
}

pub async fn send_custom_message(app_handle: AppHandle, value: String, client_id: Option<String>) {
    let command = CommandWithClientId {
        r#type: "custom".to_string(),
        payload: serde_json::Value::String(value),
        client_id: client_id.unwrap_or_default(),
    };
    send_command(app_handle, command).await;
}

pub async fn state_values_subscribe(app_handle: AppHandle, path: String) {
    let subscriptions = get_subscriptions();
    let mut subs = subscriptions.lock().await;
    
    if !subs.contains(&path) {
        if path == "*" {
            subs.push("".to_string());
        } else {
            subs.push(path);
        }
        
        let command = CommandWithClientId {
            r#type: "state.values.subscribe".to_string(),
            payload: serde_json::json!({ "paths": *subs }),
            client_id: String::new(),
        };
        send_command(app_handle, command).await;
    }
}

pub async fn state_values_unsubscribe(app_handle: AppHandle, path: String) {
    let subscriptions = get_subscriptions();
    let mut subs = subscriptions.lock().await;
    
    if let Some(pos) = subs.iter().position(|x| x == &path) {
        subs.remove(pos);
        
        let command = CommandWithClientId {
            r#type: "state.values.subscribe".to_string(),
            payload: serde_json::json!({ "paths": *subs }),
            client_id: String::new(),
        };
        send_command(app_handle, command).await;
    }
}

pub async fn state_values_clear_subscriptions(app_handle: AppHandle) {
    let subscriptions = get_subscriptions();
    let mut subs = subscriptions.lock().await;
    subs.clear();
    
    let command = CommandWithClientId {
        r#type: "state.values.subscribe".to_string(),
        payload: serde_json::json!({ "paths": [] }),
        client_id: String::new(),
    };
    send_command(app_handle, command).await;
}
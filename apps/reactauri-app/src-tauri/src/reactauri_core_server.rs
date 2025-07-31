use futures_util::{SinkExt, StreamExt, stream::{SplitSink, SplitStream}};
use serde::{Deserialize, Serialize};
use tauri::async_runtime;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, Mutex as TokioMutex};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{accept_async, WebSocketStream};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use uuid::Uuid;

// --- Data Structures ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Command {
    pub r#type: String,
    pub payload: serde_json::Value,
    #[serde(default)]
    pub important: Option<serde_json::Value>,
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
    pub important: bool,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub delta_time: Option<i64>,
}

/// Represents a fully established client connection.
/// The `sender` is used to send messages to this client's actor task.
#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub id: u32,
    pub address: String,
    pub client_id: String,
    pub sender: mpsc::Sender<Message>,
}

// --- Global State ---

type ServerHandle = Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>;
type ClientConnections = Arc<TokioMutex<HashMap<String, ClientConnection>>>;
type Subscriptions = Arc<TokioMutex<Vec<String>>>;
type ServerStateHandle = Arc<TokioMutex<ServerState>>;

static mut SERVER_HANDLE: Option<ServerHandle> = None;
static mut CLIENT_CONNECTIONS: Option<ClientConnections> = None;
static mut SUBSCRIPTIONS: Option<Subscriptions> = None;
static mut SERVER_STATE: Option<ServerStateHandle> = None;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerOptions {
    pub port: u16,
}

impl Default for ServerOptions {
    fn default() -> Self {
        Self { port: 9090 }
    }
}

#[derive(Debug, Clone)]
pub struct ServerState {
    pub started: bool,
    pub options: ServerOptions,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            started: false,
            options: ServerOptions::default(),
        }
    }
}

// --- State Accessors ---

pub fn get_server_handle() -> &'static ServerHandle {
    unsafe {
        SERVER_HANDLE.get_or_insert_with(|| Arc::new(Mutex::new(None)))
    }
}

pub fn get_client_connections() -> &'static ClientConnections {
    unsafe {
        CLIENT_CONNECTIONS.get_or_insert_with(|| Arc::new(TokioMutex::new(HashMap::new())))
    }
}

pub fn get_subscriptions() -> &'static Subscriptions {
    unsafe {
        SUBSCRIPTIONS.get_or_insert_with(|| Arc::new(TokioMutex::new(Vec::new())))
    }
}

pub fn get_server_state() -> &'static ServerStateHandle {
    unsafe {
        SERVER_STATE.get_or_insert_with(|| Arc::new(TokioMutex::new(ServerState::default())))
    }
}

// --- Public API ---

pub async fn configure_server(options: ServerOptions) {
    let server_state = get_server_state();
    let mut state = server_state.lock().await;
    state.options = options;
}

pub fn start_server(app_handle: AppHandle) {
    let server_handle = get_server_handle();
    let server_state = get_server_state();

    if let Some(handle) = server_handle.lock().unwrap().take() {
        #[cfg(debug_assertions)]
        println!("Stopping existing server");
        handle.abort();
    }

    {
        let mut state = server_state.blocking_lock();
        state.started = true;
        app_handle.emit("start", "start").unwrap();
    }

    let handle = async_runtime::spawn(async move {
        let port = get_server_state().lock().await.options.port;
        let listener = match TcpListener::bind(format!("0.0.0.0:{}", port)).await {
            Ok(listener) => listener,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::AddrInUse {
                    get_server_state().lock().await.started = false;
                    app_handle.emit("portUnavailable", port).unwrap();
                } else {
                    #[cfg(debug_assertions)]
                    println!("Error starting server: {}", e);
                }
                return;
            }
        };
        #[cfg(debug_assertions)]
        println!("WebSocket server started: ws://0.0.0.0:{}", port);

        let mut connection_id_counter: u32 = 0;
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    connection_id_counter += 1;
                    let app_handle = app_handle.clone();
                    
                    // Spawn an actor for each new connection.
                    // The actor manages the entire lifecycle of the connection.
                    async_runtime::spawn(client_actor(
                        app_handle,
                        stream,
                        connection_id_counter,
                        addr,
                    ));
                }
                Err(e) => {
                    #[cfg(debug_assertions)]
                    println!("Error accepting connection: {}", e);
                }
            }
        }
    });

    *server_handle.lock().unwrap() = Some(handle);
}

pub async fn stop_server(app_handle: AppHandle) {
    #[cfg(debug_assertions)]
    println!("Stopping server");
    if let Some(handle) = get_server_handle().lock().unwrap().take() {
        handle.abort();
        let _ = handle.await;
    }

    get_server_state().lock().await.started = false;
    get_client_connections().lock().await.clear();
    get_subscriptions().lock().await.clear();
    
    app_handle.emit("stop", "stop").unwrap();
}

pub async fn send_command(app_handle: AppHandle, command: CommandWithClientId) {
    let connections = get_client_connections().lock().await;
    
    let target_client_id = command.client_id.clone();
    let command_json = serde_json::json!({
        "type": command.r#type,
        "payload": command.payload
    });
    let message = Message::Text(command_json.to_string().into());

    if target_client_id.is_empty() {
        // Broadcast to all clients
        for conn in connections.values() {
            if let Err(e) = conn.sender.send(message.clone()).await {
                #[cfg(debug_assertions)]
                println!("Failed to send message to client {}: {}", conn.client_id, e);
            }
        }
    } else if let Some(conn) = connections.get(&target_client_id) {
        // Send to a specific client
        if let Err(e) = conn.sender.send(message).await {
            #[cfg(debug_assertions)]
            println!("Failed to send message to client {}: {}", conn.client_id, e);
        }
    }
}

// --- The Actor ---

/// Manages a single WebSocket connection.
/// This function is spawned as a separate task for each client.
async fn client_actor(
    app_handle: AppHandle,
    stream: TcpStream,
    id: u32,
    addr: SocketAddr,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            #[cfg(debug_assertions)]
            println!("[{}] Error during WebSocket handshake: {}", id, e);
            return;
        }
    };
    
    let address_str = format_address(&addr);
    #[cfg(debug_assertions)]
    println!("[{}] WebSocket connection accepted from {}", id, address_str);
    app_handle.emit("connect", &serde_json::json!({ "id": id, "address": address_str })).unwrap();

    let (mut writer, mut reader) = ws_stream.split();
    let (tx, mut rx) = mpsc::channel::<Message>(32);
    
    let mut current_client_id: Option<String> = None;
    let mut message_id_counter: u32 = 0;
    let mut keep_alive_interval = tokio::time::interval(Duration::from_secs(15));

    loop {
        tokio::select! {
            // 1. A message is received from the internal channel to be sent to the client.
            Some(msg_to_send) = rx.recv() => {
                if writer.send(msg_to_send).await.is_err() {
                    #[cfg(debug_assertions)]
                    println!("[{}] Failed to send message. Closing connection.", id);
                    break;
                }
            }

            // 2. A message is received from the client's WebSocket connection.
            Some(msg_result) = reader.next() => {
                match msg_result {
                    Ok(msg) => {
                        if handle_incoming_message(
                            msg,
                            &app_handle,
                            id,
                            &mut message_id_counter,
                            &mut current_client_id,
                            &address_str,
                            tx.clone()
                        ).await.is_err() {
                            // A critical error occurred or a close message was received.
                            break;
                        }
                    }
                    Err(e) => {
                        #[cfg(debug_assertions)]
                        println!("[{}] WebSocket read error: {}. Closing connection.", id, e);
                        break;
                    }
                }
            }

            // 3. The keep-alive interval ticks.
            _ = keep_alive_interval.tick() => {
                if writer.send(Message::Ping(vec![].into())).await.is_err() {
                    #[cfg(debug_assertions)]
                    println!("[{}] Failed to send ping. Closing connection.", id);
                    break;
                }
            }
        }
    }

    // --- Cleanup Logic ---
    #[cfg(debug_assertions)]
    println!("[{}] Actor is shutting down. Cleaning up resources.", id);
    if let Some(client_id) = current_client_id {
        let mut connections = get_client_connections().lock().await;
        if let Some(conn) = connections.remove(&client_id) {
            let disconnect_payload = serde_json::json!({ 
                "id": conn.id,
                "address": conn.address,
                "clientId": conn.client_id
            });
            app_handle.emit("disconnect", disconnect_payload).unwrap();
            #[cfg(debug_assertions)]
            println!("[{}] Client {} disconnected.", id, client_id);
        }
    }
}

/// Processes a single incoming message from a client.
/// Returns `Err(())` to signal that the connection should be closed.
async fn handle_incoming_message(
    msg: Message,
    app_handle: &AppHandle,
    connection_id: u32,
    message_id: &mut u32,
    current_client_id: &mut Option<String>,
    address: &str,
    sender: mpsc::Sender<Message>,
) -> Result<(), ()> {
    match msg {
        Message::Text(text) => {
            let mut cmd: Command = match serde_json::from_str(&text) {
                Ok(cmd) => cmd,
                Err(e) => {
                    #[cfg(debug_assertions)]
                    println!("[{}] Failed to parse command: {}. Raw: {}", connection_id, e, text);
                    return Ok(()); // Don't close connection for a single bad command.
                }
            };

            *message_id += 1;
            cmd.message_id = Some(*message_id);
            cmd.connection_id = Some(connection_id);

            // --- client.intro is a special case that establishes the connection ---
            if cmd.r#type == "client.intro" {
                let mut client_id = cmd.payload.get("clientId").and_then(|v| v.as_str()).map(String::from);

                if client_id.is_none() || client_id.as_deref() == Some("~~~ null ~~~") {
                    client_id = Some(Uuid::new_v4().to_string());
                    let response = serde_json::json!({
                        "type": "setClientId",
                        "payload": client_id.as_ref().unwrap()
                    });
                    let _ = sender.send(Message::Text(response.to_string().into())).await;
                }

                let final_client_id = client_id.unwrap();
                *current_client_id = Some(final_client_id.clone());
                cmd.client_id = Some(final_client_id.clone());

                let connection = ClientConnection {
                    id: connection_id,
                    address: address.to_string(),
                    client_id: final_client_id.clone(),
                    sender: sender.clone(),
                };
                
                let mut connections = get_client_connections().lock().await;
                if let Some(old_conn) = connections.insert(final_client_id.clone(), connection) {
                    #[cfg(debug_assertions)]
                    println!("[{}] Client {} reconnected, closing old connection.", connection_id, old_conn.client_id);
                    // The old actor will die because its channel sender is dropped.
                }
                
                app_handle.emit("connectionEstablished", &cmd).unwrap();
            }

            if let Some(client_id) = current_client_id {
                cmd.client_id = Some(client_id.clone());
            }

            // Handle other command types
            if cmd.r#type == "state.values.subscribe" {
                if let Some(paths) = cmd.payload.get("paths").and_then(|p| p.as_array()) {
                    let mut subs = get_subscriptions().lock().await;
                    for path in paths {
                        if let Some(path_str) = path.as_str() {
                            if !subs.contains(&path_str.to_string()) {
                                subs.push(path_str.to_string());
                            }
                        }
                    }
                }
            }

            app_handle.emit("command", &cmd).unwrap();
        }
        Message::Close(_) => {
            #[cfg(debug_assertions)]
            println!("[{}] Received close frame.", connection_id);
            return Err(()); // Signal to close the connection.
        }
        Message::Ping(_) => {
            // Tungstenite handles pong automatically. We can also send one manually if needed.
            let _ = sender.send(Message::Pong(vec![].into())).await;
        }
        Message::Pong(_) => {
            // Pong received, connection is alive.
        }
        Message::Binary(_) => {
            #[cfg(debug_assertions)]
            println!("[{}] Received unexpected binary message.", connection_id);
        }
        Message::Frame(_) => {
            // Ignore raw frames, they're handled by tungstenite
        }
    }
    Ok(())
}

fn format_address(addr: &SocketAddr) -> String {
    if addr.is_ipv4() {
        format!("::ffff:{}", addr.ip())
    } else {
        addr.to_string()
    }
}

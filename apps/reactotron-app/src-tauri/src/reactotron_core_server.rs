use tauri::AppHandle;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use tauri::async_runtime;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub r#type: String,
    pub payload: serde_json::Value,
    // add fields..
}

pub fn start_reactotron_core_server(app_handle: AppHandle) {
    async_runtime::spawn(async move {
        // todo: get port from store.json
        let listener = TcpListener::bind("127.0.0.1:9090").await.unwrap();
        println!("WebSocket server started: ws://127.0.0.1:9090");

        loop {
            let (stream, _) = listener.accept().await.unwrap();
            let app_handle = app_handle.clone();

            async_runtime::spawn(async move {
                let mut ws_stream = accept_async(stream).await.unwrap();

                while let Some(msg) = ws_stream.next().await {
                    let msg = msg.unwrap();
                    if msg.is_text() {
                        let text = msg.to_text().unwrap();
                        if let Ok(cmd) = serde_json::from_str::<Command>(text) {
                            println!("received: {:?}", cmd);
                            app_handle.emit("ws-message", &cmd).unwrap();
                            let response = serde_json::json!({
                                "type": "pong",
                                "payload": { "msg": "hello from tauri rust!" }
                            });
                            ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(response.to_string().into())).await.unwrap();
                        }
                    }
                }
            });
        }
    });
} 
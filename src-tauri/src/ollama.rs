//! Thin, dumb proxy between the TypeScript engine and the local Ollama server.
//!
//! All prompt assembly, model selection, and context budgeting live in the TS
//! engine. Rust only forwards HTTP and — for chat — streams the NDJSON response
//! back to the webview a token at a time via a Tauri `Channel`. Going through
//! Rust (rather than `fetch` in the webview) sidesteps CORS entirely and gives
//! us reliable streaming.

use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;

/// Cancellation flags for in-flight chat streams, keyed by the frontend's
/// `stream_id`. Set by `ollama_chat_cancel`; checked per chunk in
/// `ollama_chat_stream` (dropping the response aborts the HTTP request, which
/// makes Ollama halt generation on client disconnect).
#[derive(Default)]
pub struct StreamRegistry(pub Mutex<HashMap<String, Arc<AtomicBool>>>);

fn client() -> reqwest::Client {
    reqwest::Client::new()
}

fn join(base_url: &str, path: &str) -> String {
    format!("{}{}", base_url.trim_end_matches('/'), path)
}

/// GET a JSON endpoint (e.g. `/api/tags`, `/api/version`).
#[tauri::command]
pub async fn ollama_get(base_url: String, path: String) -> Result<Value, String> {
    let url = join(&base_url, &path);
    let resp = client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Could not reach Ollama at {url}: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("Ollama GET {path} → {status}"));
    }
    resp.json::<Value>().await.map_err(|e| e.to_string())
}

/// POST a JSON body to a non-streaming endpoint (e.g. `/api/embed`).
#[tauri::command]
pub async fn ollama_post(base_url: String, path: String, body: Value) -> Result<Value, String> {
    let url = join(&base_url, &path);
    let resp = client()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Could not reach Ollama at {url}: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Ollama POST {path} → {status}: {text}"));
    }
    serde_json::from_str::<Value>(&text).map_err(|e| format!("Bad JSON from Ollama: {e}"))
}

/// POST `/api/chat` with `stream: true` and forward each NDJSON object to the
/// frontend through `on_event`. Each event is a raw Ollama chat chunk
/// (`{ message: { content }, done, eval_count, ... }`).
#[tauri::command]
pub async fn ollama_chat_stream(
    base_url: String,
    mut body: Value,
    stream_id: Option<String>,
    on_event: Channel<Value>,
    registry: tauri::State<'_, StreamRegistry>,
) -> Result<(), String> {
    let url = join(&base_url, "/api/chat");
    if let Value::Object(ref mut map) = body {
        map.insert("stream".into(), Value::Bool(true));
    }

    let cancel = Arc::new(AtomicBool::new(false));
    if let Some(ref id) = stream_id {
        registry.0.lock().unwrap().insert(id.clone(), cancel.clone());
    }
    // remove the registry entry on every exit path
    let _guard = RegistryGuard {
        registry: &registry,
        stream_id: stream_id.as_deref(),
    };

    let resp = client()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Could not reach Ollama at {url}: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama chat → {status}: {text}"));
    }

    let mut resp = resp;
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Stream interrupted: {e}"))?
    {
        if cancel.load(Ordering::Relaxed) {
            // dropping `resp` closes the connection; Ollama stops generating
            let _ = on_event.send(serde_json::json!({ "done": true, "done_reason": "cancel" }));
            return Ok(());
        }
        buf.extend_from_slice(&chunk);
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            emit_line(&line, &on_event);
        }
    }
    if !buf.is_empty() {
        emit_line(&buf, &on_event);
    }
    Ok(())
}

/// Flag a running stream for cancellation. Idempotent — unknown ids are fine
/// (the stream may have already finished and cleaned up).
#[tauri::command]
pub async fn ollama_chat_cancel(
    stream_id: String,
    registry: tauri::State<'_, StreamRegistry>,
) -> Result<(), String> {
    if let Some(flag) = registry.0.lock().unwrap().get(&stream_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

struct RegistryGuard<'a> {
    registry: &'a tauri::State<'a, StreamRegistry>,
    stream_id: Option<&'a str>,
}

impl Drop for RegistryGuard<'_> {
    fn drop(&mut self) {
        if let Some(id) = self.stream_id {
            self.registry.0.lock().unwrap().remove(id);
        }
    }
}

fn emit_line(line: &[u8], on_event: &Channel<Value>) {
    let text = String::from_utf8_lossy(line);
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    if let Ok(v) = serde_json::from_str::<Value>(text) {
        let _ = on_event.send(v);
    }
}

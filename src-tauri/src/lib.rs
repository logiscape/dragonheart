mod files;
mod ollama;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            ollama::ollama_chat_stream,
            ollama::ollama_post,
            ollama::ollama_get,
            files::read_file_bytes,
            files::read_file_base64,
            files::write_file_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dragon Heart");
}

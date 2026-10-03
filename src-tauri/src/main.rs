#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::Manager;
use std::io::Write;
use tauri_plugin_dialog::DialogExt;
fn state_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}
#[tauri::command]
fn load_state(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = state_path(&app)?;
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
#[tauri::command]
fn save_state(app: tauri::AppHandle, json: String) -> Result<(), String> {
    if json.len() > 32_000 { return Err("Configuration is too large".into()); }
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
    let path = state_path(&app)?;
    let temporary = path.with_extension("tmp");
    std::fs::write(&temporary, json).map_err(|e| e.to_string())?;
    std::fs::rename(&temporary, &path).map_err(|e| e.to_string())
}
#[tauri::command]
async fn save_pdf(app: tauri::AppHandle, bytes: Vec<u8>, filename: String) -> Result<bool, String> {
    if bytes.len() > 10_000_000 || !bytes.starts_with(b"%PDF-") { return Err("Invalid PDF".into()); }
    if !filename.ends_with(".pdf") || filename.contains('/') || filename.contains('\\') { return Err("Invalid filename".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let chosen = app.dialog().file().set_title("Save invoice PDF")
            .add_filter("PDF invoice", &["pdf"]).set_file_name(&filename).blocking_save_file();
        match chosen {
            None => Ok(false),
            Some(file) => {
                let path = file.into_path().map_err(|e| e.to_string())?;
                let parent = path.parent().ok_or("Invalid save destination")?;
                let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
                temporary.write_all(&bytes).map_err(|e| e.to_string())?;
                temporary.as_file().sync_all().map_err(|e| e.to_string())?;
                temporary.persist(&path).map_err(|e| e.to_string())?;
                Ok(true)
            }
        }
    }).await.map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_state, save_state, save_pdf])
        .run(tauri::generate_context!())
        .expect("Failed to run Recurring Bill");
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use owguide_core::{Result, Store};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
type Database = Arc<Mutex<Store>>;
struct DataRoot(std::path::PathBuf);
async fn run<T: Send + 'static>(
    db: Database,
    f: impl FnOnce(&mut Store) -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut store = db.lock().map_err(|_| "Database lock failed")?;
        f(&mut store)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn load_data(db: tauri::State<'_, Database>) -> Result<owguide_core::Snapshot> {
    run(db.inner().clone(), |s| s.snapshot()).await
}
#[tauri::command]
async fn save_user(
    app: tauri::AppHandle,
    db: tauri::State<'_, Database>,
    user: serde_json::Value,
    revision: i64,
) -> Result<i64> {
    let result = run(db.inner().clone(), move |s| s.save_user(&user, revision)).await?;
    app.emit("data-changed", result)
        .map_err(|e| e.to_string())?;
    Ok(result)
}
#[tauri::command]
async fn update_content(
    app: tauri::AppHandle,
    db: tauri::State<'_, Database>,
    endpoint: String,
) -> Result<()> {
    let key = option_env!("OWGUIDE_CONTENT_PUBLIC_KEY").ok_or(
        "No trusted publisher key was configured for this build. Content updates are disabled.",
    )?;
    let current = run(db.inner().clone(), |s| {
        Ok(s.snapshot()?.content["version"]
            .as_str()
            .unwrap_or_default()
            .to_owned())
    })
    .await?;
    let value = tauri::async_runtime::spawn_blocking(move || {
        owguide_core::fetch_update(&endpoint, &current, key)
    })
    .await
    .map_err(|e| e.to_string())??;
    run(db.inner().clone(), move |s| s.install(&value)).await?;
    app.emit("data-changed", ()).map_err(|e| e.to_string())
}
#[tauri::command]
async fn rollback_content(app: tauri::AppHandle, db: tauri::State<'_, Database>) -> Result<()> {
    run(db.inner().clone(), |s| s.rollback()).await?;
    app.emit("data-changed", ()).map_err(|e| e.to_string())
}
#[tauri::command]
async fn open_quick(app: tauri::AppHandle) -> Result<()> {
    if let Some(w) = app.get_webview_window("quick") {
        w.show().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        &app,
        "quick",
        tauri::WebviewUrl::App("index.html?quick=1".into()),
    )
    .data_directory(app.state::<DataRoot>().0.join("webview"))
    .title("OWGuide · Quick Reference")
    .inner_size(420., 650.)
    .min_inner_size(320., 380.)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
async fn open_source(
    app: tauri::AppHandle,
    db: tauri::State<'_, Database>,
    url: String,
) -> Result<()> {
    owguide_core::safe_url(&url)?;
    let check = url.clone();
    let allowed = run(db.inner().clone(), move |s| s.source_allowed(&check)).await?;
    if !allowed {
        return Err("Only attributed content sources can be opened by this command".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}
fn main() {
    let mut windows = tauri_plugin_window_state::Builder::default();
    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            if parent.join("portable.marker").is_file() {
                let root = match owguide_core::data_root(&executable, parent) {
                    Ok(root) => root,
                    Err(error) => {
                        report_startup_error(&error);
                        std::process::exit(1);
                    }
                };
                windows =
                    windows.with_filename(root.join("windows.json").to_string_lossy().into_owned());
            }
        }
    }
    let result = tauri::Builder::default()
        .plugin(windows.build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let root = owguide_core::data_root(
                &std::env::current_exe()?,
                &app.path().app_local_data_dir()?,
            )
            .map_err(std::io::Error::other)?;
            let db = Store::open(&root.join("owguide.sqlite")).map_err(|error| {
                let _ = std::fs::write(root.join("startup-error.log"), &error);
                std::io::Error::other(error)
            })?;
            app.manage(Arc::new(Mutex::new(db)));
            app.manage(DataRoot(root.clone()));
            tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .data_directory(root.join("webview"))
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_user,
            update_content,
            rollback_content,
            open_quick,
            open_source
        ])
        .run(tauri::generate_context!());
    if let Err(error) = result {
        report_startup_error(&format!("OWGuide could not start. Your personal data was not reset. Check the data folder and WebView2 installation.\n\n{error}"));
        std::process::exit(1);
    }
}

#[cfg(windows)]
fn report_startup_error(message: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
    let body: Vec<u16> = message.encode_utf16().chain(Some(0)).collect();
    let title: Vec<u16> = "OWGuide startup error"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    // SAFETY: both strings are null-terminated and live for the entire synchronous call.
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            body.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
}
#[cfg(not(windows))]
fn report_startup_error(message: &str) {
    eprintln!("{message}");
}

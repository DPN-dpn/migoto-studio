mod backups;
mod files;
mod storage;

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
  #[cfg(windows)]
  {
    std::process::Command::new("rundll32")
      .args(["url.dll,FileProtocolHandler", &url])
      .spawn()
      .map_err(|e| e.to_string())?;
    Ok(())
  }
  #[cfg(not(windows))]
  {
    Err("Unsupported platform".into())
  }
}

#[tauri::command]
fn relaunch_app(app: tauri::AppHandle) {
  app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Keep the WebView2 cache inside the portable data folder (unless a dev environment already set it).
  if std::env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_none() {
    let dir = storage::data_dir().join("webview2");
    // SAFETY: called at startup before any other thread is spawned.
    unsafe { std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dir) };
  }

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      files::open_file,
      files::save_file,
      storage::load_settings,
      storage::save_settings,
      storage::get_data_dir,
      storage::is_portable_mode,
      backups::cleanup_backups,
      backups::get_backup_dir,
      backups::list_backups,
      open_in_browser,
      relaunch_app,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

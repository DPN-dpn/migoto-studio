mod backups;
mod files;
mod storage;

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
    .invoke_handler(tauri::generate_handler![
      files::open_file,
      files::save_file,
      storage::load_settings,
      storage::save_settings,
      storage::get_data_dir,
      backups::cleanup_backups,
      backups::get_backup_dir,
      backups::list_backups,
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

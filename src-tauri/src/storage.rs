use std::fs;
use std::path::PathBuf;

use std::sync::OnceLock;

const APP_FOLDER: &str = "MigotoStudio";
/// Put an (empty) file with this name next to the program to run in portable mode.
const PORTABLE_MARKER: &str = "portable.txt";

/// Where user data (settings, backups, WebView cache) lives. Order of precedence:
///  1. `MIGOTO_STUDIO_DATA` environment variable (explicit override)
///  2. debug builds: `<project>/data`, so development never touches the real user profile
///  3. portable mode (`portable.txt` next to the program): `<program folder>/data`
///  4. the operating system's app-data folder + `MigotoStudio`
///     (Windows `%APPDATA%`, macOS `~/Library/Application Support`, Linux `$XDG_DATA_HOME` or `~/.local/share`)
fn resolve_data_dir(
  env_override: Option<PathBuf>,
  debug: bool,
  exe_dir: Option<PathBuf>,
  os_base: Option<PathBuf>,
) -> PathBuf {
  if let Some(p) = env_override {
    return p;
  }
  if debug {
    return PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("data");
  }
  if let Some(dir) = &exe_dir {
    if dir.join(PORTABLE_MARKER).exists() {
      return dir.join("data");
    }
  }
  match os_base {
    Some(base) => base.join(APP_FOLDER),
    // No app-data folder available: fall back to next to the program.
    None => exe_dir.unwrap_or_else(|| PathBuf::from(".")).join("data"),
  }
}

fn os_app_data_base() -> Option<PathBuf> {
  #[cfg(windows)]
  {
    std::env::var_os("APPDATA").map(PathBuf::from)
  }
  #[cfg(target_os = "macos")]
  {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library").join("Application Support"))
  }
  #[cfg(all(unix, not(target_os = "macos")))]
  {
    std::env::var_os("XDG_DATA_HOME")
      .map(PathBuf::from)
      .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")))
  }
}

/// The (created) data directory; resolved once per run.
pub fn data_dir() -> PathBuf {
  static DIR: OnceLock<PathBuf> = OnceLock::new();
  DIR
    .get_or_init(|| {
      let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()));
      let dir = resolve_data_dir(
        std::env::var_os("MIGOTO_STUDIO_DATA").map(PathBuf::from),
        cfg!(debug_assertions),
        exe_dir,
        os_app_data_base(),
      );
      let _ = fs::create_dir_all(&dir);
      dir.canonicalize().unwrap_or(dir)
    })
    .clone()
}

fn settings_path() -> PathBuf {
  data_dir().join("settings.json")
}

/// Returns the raw settings JSON text (empty string if none yet). Parsing/defaults live in the UI
/// so settings schema changes never need a Rust rebuild.
#[tauri::command]
pub fn load_settings() -> String {
  fs::read_to_string(settings_path()).unwrap_or_default()
}

#[tauri::command]
pub fn save_settings(json: String) -> Result<(), String> {
  serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("설정 형식 오류: {e}"))?;
  fs::write(settings_path(), json).map_err(|e| format!("설정을 저장할 수 없습니다: {e}"))
}

#[tauri::command]
pub fn get_data_dir() -> String {
  data_dir().to_string_lossy().to_string()
}

#[tauri::command]
pub fn is_portable_mode() -> bool {
  if let Ok(exe) = std::env::current_exe() {
    if let Some(dir) = exe.parent() {
      return dir.join(PORTABLE_MARKER).exists();
    }
  }
  false
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn env_override_wins() {
    let p = resolve_data_dir(Some("X:/custom".into()), false, None, Some("C:/AppData".into()));
    assert_eq!(p, PathBuf::from("X:/custom"));
  }

  #[test]
  fn release_uses_os_app_data_folder() {
    let p = resolve_data_dir(None, false, Some("C:/Program/MS".into()), Some("C:/AppData".into()));
    assert_eq!(p, PathBuf::from("C:/AppData").join("MigotoStudio"));
  }

  #[test]
  fn portable_marker_switches_to_local_data() {
    let exe = std::env::temp_dir().join(format!("migoto-portable-test-{}", std::process::id()));
    fs::create_dir_all(&exe).unwrap();
    fs::write(exe.join(PORTABLE_MARKER), "").unwrap();
    let p = resolve_data_dir(None, false, Some(exe.clone()), Some("C:/AppData".into()));
    assert_eq!(p, exe.join("data"));
    fs::remove_dir_all(&exe).unwrap();
  }

  #[test]
  fn debug_stays_in_project() {
    let p = resolve_data_dir(None, true, None, Some("C:/AppData".into()));
    assert!(p.ends_with("data") && !p.starts_with("C:/AppData"));
  }
}

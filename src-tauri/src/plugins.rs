use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ExecOutput {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PluginDiskInfo {
  pub id: String,
  pub path: String,
  pub manifest_json: String,
  pub script_content: String,
}

pub fn plugins_dir() -> PathBuf {
  let p = crate::storage::data_dir().join("plugins");
  let _ = fs::create_dir_all(&p);
  p
}

#[tauri::command]
pub fn get_plugins_dir() -> Result<String, String> {
  let dir = plugins_dir();
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_plugins_folder() -> Result<(), String> {
  let dir = plugins_dir();
  crate::files::show_in_folder(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
  let p = Path::new(&path);
  fs::read(p).map_err(|e| format!("바이너리 파일을 읽을 수 없습니다: {e}"))
}

#[tauri::command]
pub fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
  let p = Path::new(&path);
  if let Some(parent) = p.parent() {
    let _ = fs::create_dir_all(parent);
  }
  fs::write(p, bytes).map_err(|e| format!("바이너리 파일 저장 실패: {e}"))
}

#[tauri::command]
pub fn launch_installer_and_exit(app: tauri::AppHandle, path: String) -> Result<(), String> {
  #[cfg(windows)]
  {
    Command::new("cmd")
      .args(["/c", "start", "", &path])
      .spawn()
      .map_err(|e| format!("설치 파일 실행 실패: {e}"))?;
    app.exit(0);
    Ok(())
  }
  #[cfg(not(windows))]
  {
    Err("Windows 전용 기능입니다.".into())
  }
}

#[tauri::command]
pub fn exec_process(
  command: String,
  args: Vec<String>,
  cwd: Option<String>,
) -> Result<ExecOutput, String> {
  let mut cmd = Command::new(&command);
  cmd.args(&args);
  if let Some(c) = cwd {
    if !c.is_empty() {
      cmd.current_dir(c);
    }
  }

  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW = 0x08000000
    cmd.creation_flags(0x08000000);
  }

  match cmd.output() {
    Ok(output) => {
      let stdout = String::from_utf8_lossy(&output.stdout).to_string();
      let stderr = String::from_utf8_lossy(&output.stderr).to_string();
      let exit_code = output.status.code().unwrap_or(-1);
      Ok(ExecOutput {
        stdout,
        stderr,
        exit_code,
      })
    }
    Err(e) => Err(format!("프로세스 실행 실패 ({command}): {e}")),
  }
}

/// Reads all plugin folders under `%APPDATA%\MigotoStudio\plugins`
#[tauri::command]
pub fn list_disk_plugins() -> Result<Vec<PluginDiskInfo>, String> {
  let dir = plugins_dir();
  let mut list = Vec::new();

  if let Ok(entries) = fs::read_dir(&dir) {
    for entry in entries.flatten() {
      let p = entry.path();
      if p.is_dir() {
        let manifest_path = p.join("plugin.json");
        let script_path = p.join("main.js");
        if manifest_path.exists() && script_path.exists() {
          if let (Ok(manifest_json), Ok(script_content)) = (
            fs::read_to_string(&manifest_path),
            fs::read_to_string(&script_path),
          ) {
            let id = p.file_name().unwrap_or_default().to_string_lossy().to_string();
            list.push(PluginDiskInfo {
              id,
              path: p.to_string_lossy().to_string(),
              manifest_json,
              script_content,
            });
          }
        }
      }
    }
  }

  Ok(list)
}

/// Write or create a plugin folder on disk
#[tauri::command]
pub fn save_disk_plugin(id: String, manifest_json: String, script_content: String) -> Result<(), String> {
  let dir = plugins_dir().join(&id);
  fs::create_dir_all(&dir).map_err(|e| format!("플러그인 폴더 생성 실패: {e}"))?;
  fs::write(dir.join("plugin.json"), manifest_json).map_err(|e| format!("plugin.json 저장 실패: {e}"))?;
  fs::write(dir.join("main.js"), script_content).map_err(|e| format!("main.js 저장 실패: {e}"))?;
  Ok(())
}

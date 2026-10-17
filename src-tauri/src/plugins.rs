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
  #[serde(default)]
  pub entry_path: Option<String>,
  #[serde(default)]
  pub files: std::collections::HashMap<String, String>,
}

pub fn plugins_dir() -> PathBuf {
  let p = crate::storage::data_dir().join("plugins");
  let _ = fs::create_dir_all(&p);

  // Auto-prune legacy "resource-checker" folder and ensure "custom-lint" is freshly installed
  let legacy_checker = p.join("resource-checker");
  let had_legacy = legacy_checker.exists();
  if had_legacy {
    let _ = fs::remove_dir_all(&legacy_checker);
  }

  let custom_lint_dir = p.join("custom-lint");
  let need_reinstall = had_legacy || !custom_lint_dir.exists() || {
    let bundled_manifest = include_str!("../default-plugins/custom-lint/plugin.json");
    let installed_manifest_file = custom_lint_dir.join("plugin.json");
    if let Ok(content) = fs::read_to_string(&installed_manifest_file) {
      let b_val: Option<String> = serde_json::from_str::<serde_json::Value>(bundled_manifest)
        .ok()
        .and_then(|v| v.get("version").and_then(|s| s.as_str()).map(|s| s.to_string()));
      let i_val: Option<String> = serde_json::from_str::<serde_json::Value>(&content)
        .ok()
        .and_then(|v| v.get("version").and_then(|s| s.as_str()).map(|s| s.to_string()));
      match (b_val, i_val) {
        (Some(b), Some(i)) => b != i,
        _ => false,
      }
    } else {
      true
    }
  };

  if need_reinstall {
    if custom_lint_dir.exists() {
      let _ = fs::remove_dir_all(&custom_lint_dir);
    }
    let _ = fs::create_dir_all(&custom_lint_dir);
    let _ = fs::write(
      custom_lint_dir.join("plugin.json"),
      include_str!("../default-plugins/custom-lint/plugin.json"),
    );
    let _ = fs::write(
      custom_lint_dir.join("plugin.js"),
      include_str!("../default-plugins/custom-lint/plugin.js"),
    );
  }

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
pub fn download_and_install_update(app: tauri::AppHandle, url: String, version: String) -> Result<(), String> {
  let temp_file = std::env::temp_dir().join(format!("MigotoStudio-Setup-v{version}.exe"));
  let dest_path = temp_file.to_string_lossy().to_string();

  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    // 1. Try curl.exe with follow-redirects (-fL) and silent output (-sS)
    let mut curl = Command::new("curl.exe");
    curl.args(["-fL", "-sS", "-o", &dest_path, &url]);
    curl.creation_flags(0x08000000);
    let curl_ok = match curl.status() {
      Ok(s) => s.success() && temp_file.exists() && fs::metadata(&temp_file).map(|m| m.len() > 100_000).unwrap_or(false),
      Err(_) => false,
    };

    if !curl_ok {
      // 2. Fallback to PowerShell WebClient with TLS 1.2
      let ps_script = format!(
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; $wc.Headers.Add('User-Agent', 'MigotoStudio-Updater'); $wc.DownloadFile('{}', '{}')",
        url.replace('\'', "''"),
        dest_path.replace('\'', "''")
      );
      let mut ps = Command::new("powershell");
      ps.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &ps_script]);
      ps.creation_flags(0x08000000);
      let ps_status = ps.status().map_err(|e| format!("PowerShell 다운로드 실패: {e}"))?;
      if !ps_status.success() || !temp_file.exists() || fs::metadata(&temp_file).map(|m| m.len() < 100_000).unwrap_or(true) {
        return Err("설치 파일 다운로드에 실패했습니다. GitHub 릴리스 페이지에서 직접 다운로드해 주세요.".into());
      }
    }

    // Launch installer and exit
    Command::new("cmd")
      .args(["/c", "start", "", &dest_path])
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
  stdin: Option<String>,
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

  if let Some(input_text) = stdin {
    use std::io::Write;
    cmd.stdin(std::process::Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("프로세스 생성 실패 ({command}): {e}"))?;
    if let Some(mut child_stdin) = child.stdin.take() {
      let _ = child_stdin.write_all(input_text.as_bytes());
      // child_stdin dropped and closed here
    }
    let output = child.wait_with_output().map_err(|e| format!("프로세스 대기 실패 ({command}): {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);
    Ok(ExecOutput {
      stdout,
      stderr,
      exit_code,
    })
  } else {
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
}

fn collect_plugin_files(base_dir: &Path, current_dir: &Path, files: &mut std::collections::HashMap<String, String>) {
  if let Ok(entries) = fs::read_dir(current_dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      let file_name = path.file_name().unwrap_or_default().to_string_lossy();
      if file_name.starts_with('.') || file_name == "node_modules" || file_name == "__pycache__" {
        continue;
      }
      if path.is_dir() {
        collect_plugin_files(base_dir, &path, files);
      } else if path.is_file() {
        // Read text files up to 5MB
        if let Ok(meta) = path.metadata() {
          if meta.len() <= 5 * 1024 * 1024 {
            if let Ok(content) = fs::read_to_string(&path) {
              if let Ok(rel) = path.strip_prefix(base_dir) {
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                files.insert(rel_str, content);
              }
            }
          }
        }
      }
    }
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
        let manifest_path = if p.join("manifest.json").exists() {
          Some(p.join("manifest.json"))
        } else if p.join("plugin.json").exists() {
          Some(p.join("plugin.json"))
        } else {
          None
        };

        let Some(manifest_file) = manifest_path else {
          continue;
        };

        let Ok(manifest_json) = fs::read_to_string(&manifest_file) else {
          continue;
        };

        // Try reading manifest.main if specified
        let mut entry_rel_path: Option<String> = None;
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&manifest_json) {
          if let Some(main_str) = val.get("main").and_then(|v| v.as_str()) {
            let candidate = p.join(main_str.trim_start_matches("./"));
            if candidate.exists() && candidate.is_file() {
              entry_rel_path = Some(main_str.trim_start_matches("./").replace('\\', "/"));
            }
          }
        }

        if entry_rel_path.is_none() {
          let candidates = ["index.js", "plugin.js", "main.js", "index.mjs"];
          for c in candidates {
            if p.join(c).exists() {
              entry_rel_path = Some(c.to_string());
              break;
            }
          }
        }

        let Some(entry_rel) = entry_rel_path else {
          continue;
        };

        let Ok(script_content) = fs::read_to_string(p.join(&entry_rel)) else {
          continue;
        };

        let id = p.file_name().unwrap_or_default().to_string_lossy().to_string();
        if id == "resource-checker" {
          continue;
        }

        let mut files = std::collections::HashMap::new();
        collect_plugin_files(&p, &p, &mut files);

        list.push(PluginDiskInfo {
          id,
          path: p.to_string_lossy().to_string(),
          manifest_json,
          script_content,
          entry_path: Some(entry_rel),
          files,
        });
      }
    }
  }

  Ok(list)
}

/// Write or create a plugin folder on disk
#[tauri::command]
pub fn save_disk_plugin(
  id: String,
  manifest_json: String,
  script_content: String,
  files: Option<std::collections::HashMap<String, String>>,
) -> Result<(), String> {
  let dir = plugins_dir().join(&id);
  if dir.exists() {
    let _ = fs::remove_dir_all(&dir);
  }
  fs::create_dir_all(&dir).map_err(|e| format!("플러그인 폴더 생성 실패: {e}"))?;

  if let Some(f_map) = files {
    for (rel_path, content) in f_map {
      let file_path = dir.join(&rel_path);
      if let Some(parent) = file_path.parent() {
        let _ = fs::create_dir_all(parent);
      }
      let _ = fs::write(file_path, content);
    }
  } else {
    fs::write(dir.join("plugin.json"), manifest_json).map_err(|e| format!("plugin.json 저장 실패: {e}"))?;
    fs::write(dir.join("main.js"), script_content).map_err(|e| format!("main.js 저장 실패: {e}"))?;
  }
  Ok(())
}

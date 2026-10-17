//! Safety copies made right before a file is overwritten.
//! They live in the app's portable data folder (`data/backups`), never next to the user's file,
//! and are pruned automatically by age and by count per file.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::storage;

const DAY_MS: u128 = 24 * 60 * 60 * 1000;

pub fn root() -> PathBuf {
  storage::data_dir().join("backups")
}

fn now_ms() -> u128 {
  SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

/// Stable (version independent) FNV-1a hash, used to keep same-named files from different folders apart.
fn fnv1a(s: &str) -> u32 {
  let mut h: u32 = 0x811c9dc5;
  for b in s.as_bytes() {
    h ^= *b as u32;
    h = h.wrapping_mul(0x01000193);
  }
  h
}

fn dir_for(target: &Path) -> PathBuf {
  let name = target.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "file".into());
  let safe: String = name.to_lowercase().chars().map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' }).collect();
  let id = fnv1a(&target.to_string_lossy().to_lowercase());
  root().join(format!("{safe}-{id:08x}"))
}

/// Copy `target` into the backup folder as `<epoch_ms>_<filename>`, then prune that file's backups.
pub fn create(target: &Path, keep_days: u32, max_per_file: u32) -> Result<(), String> {
  let dir = dir_for(target);
  fs::create_dir_all(&dir).map_err(|e| format!("백업 폴더를 만들 수 없습니다: {e}"))?;
  let name = target.file_name().unwrap_or_default().to_string_lossy();
  let dest = dir.join(format!("{}_{}", now_ms(), name));
  fs::copy(target, &dest).map_err(|e| format!("백업을 만들 수 없습니다: {e}"))?;
  prune_dir(&dir, now_ms(), keep_days, max_per_file);
  Ok(())
}

/// Remove expired backups everywhere (called once at startup).
pub fn cleanup_all(keep_days: u32, max_per_file: u32) {
  let Ok(entries) = fs::read_dir(root()) else { return };
  let now = now_ms();
  for e in entries.flatten() {
    if e.path().is_dir() {
      prune_dir(&e.path(), now, keep_days, max_per_file);
    }
  }
}

fn timestamp_of(path: &Path) -> Option<u128> {
  path.file_name()?.to_string_lossy().split('_').next()?.parse().ok()
}

/// Delete backups older than `keep_days`, then keep only the newest `max_per_file`.
fn prune_dir(dir: &Path, now: u128, keep_days: u32, max_per_file: u32) {
  let Ok(entries) = fs::read_dir(dir) else { return };
  let mut items: Vec<(u128, PathBuf)> =
    entries.flatten().filter_map(|e| timestamp_of(&e.path()).map(|t| (t, e.path()))).collect();
  items.sort_by(|a, b| b.0.cmp(&a.0)); // newest first
  let max_age = keep_days as u128 * DAY_MS;
  for (i, (ts, path)) in items.iter().enumerate() {
    if i >= max_per_file as usize || now.saturating_sub(*ts) > max_age {
      let _ = fs::remove_file(path);
    }
  }
  // drop the folder if nothing is left (fails harmlessly when it is not empty)
  let _ = fs::remove_dir(dir);
}

#[tauri::command]
pub fn cleanup_backups(keep_days: u32, max_per_file: u32) {
  cleanup_all(keep_days, max_per_file);
}

#[tauri::command]
pub fn get_backup_dir() -> String {
  root().to_string_lossy().to_string()
}

#[derive(serde::Serialize)]
pub struct BackupInfo {
  /// Full path of the backup copy (readable with `open_file`).
  pub path: String,
  /// When the backup was made, milliseconds since the Unix epoch.
  pub timestamp_ms: u64,
  pub size: u64,
}

/// Backups of one file, newest first.
#[tauri::command]
pub fn list_backups(path: String) -> Vec<BackupInfo> {
  let Ok(entries) = fs::read_dir(dir_for(Path::new(&path))) else { return Vec::new() };
  let mut list: Vec<BackupInfo> = entries
    .flatten()
    .filter_map(|e| {
      let p = e.path();
      let ts = timestamp_of(&p)?;
      Some(BackupInfo {
        path: p.to_string_lossy().to_string(),
        timestamp_ms: ts as u64,
        size: e.metadata().map(|m| m.len()).unwrap_or(0),
      })
    })
    .collect();
  list.sort_by(|a, b| b.timestamp_ms.cmp(&a.timestamp_ms));
  list
}

#[tauri::command]
pub fn create_backup(path: String) -> Result<String, String> {
  let p = Path::new(&path);
  if !p.exists() {
    return Err(format!("파일이 존재하지 않습니다: {path}"));
  }
  create(p, 30, 20)?;
  let backups = list_backups(path);
  Ok(backups.first().map(|b| b.path.clone()).unwrap_or_default())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn temp_dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("migoto-studio-test-{name}-{}", now_ms()));
    fs::create_dir_all(&d).unwrap();
    d
  }

  #[test]
  fn prune_by_age_and_count() {
    let dir = temp_dir("prune");
    let now = 100 * DAY_MS;
    // ages in days: 0, 1, 2, 10 (too old)
    for age in [0u128, 1, 2, 10] {
      fs::write(dir.join(format!("{}_a.ini", now - age * DAY_MS)), "x").unwrap();
    }
    prune_dir(&dir, now, 7, 2);
    let left: Vec<_> = fs::read_dir(&dir).unwrap().flatten().collect();
    assert_eq!(left.len(), 2, "only the 2 newest non-expired backups remain");
    fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn hash_is_stable_and_case_insensitive_dir() {
    assert_eq!(fnv1a("abc"), 0x1A47E90B);
    assert_eq!(dir_for(Path::new("C:/A/x.ini")), dir_for(Path::new("c:/a/X.ini")));
  }
}

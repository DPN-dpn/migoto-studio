use std::fs;
use std::path::PathBuf;

use encoding_rs::EUC_KR;
use serde::Serialize;

/// Result of reading a text file: decoded text plus how it was encoded on disk,
/// so saving can write it back the same way.
#[derive(Serialize)]
pub struct OpenedFile {
  pub text: String,
  /// "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" | "cp949"
  pub encoding: String,
}

fn decode(bytes: &[u8]) -> Result<(String, &'static str), String> {
  if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
    return String::from_utf8(rest.to_vec())
      .map(|s| (s, "utf-8-bom"))
      .map_err(|_| "UTF-8 BOM 파일이 올바르지 않습니다.".to_string());
  }
  if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
    return Ok((decode_utf16(rest, true), "utf-16le"));
  }
  if let Some(rest) = bytes.strip_prefix(&[0xFE, 0xFF]) {
    return Ok((decode_utf16(rest, false), "utf-16be"));
  }
  if let Ok(s) = std::str::from_utf8(bytes) {
    return Ok((s.to_string(), "utf-8"));
  }
  // Not valid UTF-8: very likely a legacy Korean (CP949) file.
  match EUC_KR.decode_without_bom_handling_and_without_replacement(bytes) {
    Some(s) => Ok((s.into_owned(), "cp949")),
    None => Err("파일 인코딩을 알 수 없습니다 (UTF-8, UTF-16, CP949만 지원).".to_string()),
  }
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> String {
  let units: Vec<u16> = bytes
    .chunks_exact(2)
    .map(|c| if little_endian { u16::from_le_bytes([c[0], c[1]]) } else { u16::from_be_bytes([c[0], c[1]]) })
    .collect();
  String::from_utf16_lossy(&units)
}

fn encode(text: &str, encoding: &str) -> Result<Vec<u8>, String> {
  match encoding {
    "utf-8" => Ok(text.as_bytes().to_vec()),
    "utf-8-bom" => {
      let mut v = vec![0xEF, 0xBB, 0xBF];
      v.extend_from_slice(text.as_bytes());
      Ok(v)
    }
    "utf-16le" | "utf-16be" => {
      let le = encoding == "utf-16le";
      let mut v = if le { vec![0xFF, 0xFE] } else { vec![0xFE, 0xFF] };
      for u in text.encode_utf16() {
        v.extend_from_slice(&if le { u.to_le_bytes() } else { u.to_be_bytes() });
      }
      Ok(v)
    }
    "cp949" => {
      let (bytes, _, had_unmappable) = EUC_KR.encode(text);
      if had_unmappable {
        Err("CP949로 저장할 수 없는 문자가 있습니다. 인코딩을 UTF-8로 바꿔 저장하세요.".to_string())
      } else {
        Ok(bytes.into_owned())
      }
    }
    other => Err(format!("지원하지 않는 인코딩: {other}")),
  }
}

#[tauri::command]
pub fn open_file(path: String) -> Result<OpenedFile, String> {
  let bytes = fs::read(&path).map_err(|e| format!("파일을 읽을 수 없습니다: {e}"))?;
  let (text, encoding) = decode(&bytes)?;
  Ok(OpenedFile { text, encoding: encoding.to_string() })
}

/// Writes atomically (temp file + rename). When `backup` is set and the target exists,
/// the previous contents are first copied into the app's backup folder (see `backups`).
#[tauri::command]
pub fn save_file(
  path: String,
  text: String,
  encoding: String,
  backup: bool,
  keep_days: u32,
  max_per_file: u32,
) -> Result<(), String> {
  let bytes = encode(&text, &encoding)?;
  let target = PathBuf::from(&path);

  if backup && target.exists() {
    crate::backups::create(&target, keep_days, max_per_file)?;
  }

  let tmp = target.with_extension(match target.extension() {
    Some(ext) => format!("{}.tmp", ext.to_string_lossy()),
    None => "tmp".to_string(),
  });
  fs::write(&tmp, &bytes).map_err(|e| format!("저장할 수 없습니다: {e}"))?;
  fs::rename(&tmp, &target).map_err(|e| {
    let _ = fs::remove_file(&tmp);
    format!("저장할 수 없습니다: {e}")
  })
}

#[derive(Serialize)]
pub struct DirEntry {
  pub name: String,
  pub path: String,
  pub is_dir: bool,
  pub size: u64,
  pub children: Option<Vec<DirEntry>>,
}

#[tauri::command]
pub fn read_directory(path: String, max_depth: Option<u32>) -> Result<Vec<DirEntry>, String> {
  let root = PathBuf::from(&path);
  if !root.is_dir() {
    return Err(format!("폴더를 찾을 수 없습니다: {path}"));
  }
  let depth = max_depth.unwrap_or(4);
  scan_dir(&root, depth)
}

fn scan_dir(dir: &std::path::Path, remaining_depth: u32) -> Result<Vec<DirEntry>, String> {
  let read = fs::read_dir(dir).map_err(|e| format!("폴더 읽기 실패: {e}"))?;
  let mut entries = Vec::new();

  for item in read.flatten() {
    let name = item.file_name().to_string_lossy().to_string();
    if name.starts_with('.') || name == "node_modules" || name == "$RECYCLE.BIN" {
      continue;
    }
    let p = item.path();
    let is_dir = p.is_dir();
    let size = if is_dir { 0 } else { item.metadata().map(|m| m.len()).unwrap_or(0) };

    let children = if is_dir && remaining_depth > 0 {
      scan_dir(&p, remaining_depth - 1).ok()
    } else {
      None
    };

    entries.push(DirEntry {
      name,
      path: p.to_string_lossy().to_string(),
      is_dir,
      size,
      children,
    });
  }

  entries.sort_by(|a, b| {
    b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
  });

  Ok(entries)
}

#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
  #[cfg(windows)]
  {
    use std::process::Command;
    let p = std::path::PathBuf::from(&path);
    if p.is_dir() {
      Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    } else {
      Command::new("explorer").args(["/select,", &path]).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
  }
  #[cfg(not(windows))]
  {
    let _ = path;
    Ok(())
  }
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
  let p = std::path::PathBuf::from(&path);
  if p.exists() {
    return Err("이미 존재하는 파일입니다.".into());
  }
  if let Some(parent) = p.parent() {
    let _ = fs::create_dir_all(parent);
  }
  fs::write(&p, b"; [Section]\n").map_err(|e| format!("파일 생성 실패: {e}"))?;
  Ok(())
}

#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
  let p = std::path::PathBuf::from(&path);
  if p.is_dir() {
    fs::remove_dir_all(&p).map_err(|e| format!("폴더 삭제 실패: {e}"))?;
  } else {
    fs::remove_file(&p).map_err(|e| format!("파일 삭제 실패: {e}"))?;
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn utf8_roundtrip() {
    let (t, e) = decode("hello 한글".as_bytes()).unwrap();
    assert_eq!((t.as_str(), e), ("hello 한글", "utf-8"));
  }

  #[test]
  fn cp949_roundtrip() {
    let bytes = encode("키 = 한글", "cp949").unwrap();
    assert!(std::str::from_utf8(&bytes).is_err());
    let (t, e) = decode(&bytes).unwrap();
    assert_eq!((t.as_str(), e), ("키 = 한글", "cp949"));
  }

  #[test]
  fn bom_detection() {
    let bytes = encode("x", "utf-8-bom").unwrap();
    assert_eq!(decode(&bytes).unwrap().1, "utf-8-bom");
    let bytes = encode("x", "utf-16le").unwrap();
    assert_eq!(decode(&bytes).unwrap().1, "utf-16le");
  }

  #[test]
  fn cp949_rejects_unmappable() {
    assert!(encode("😀", "cp949").is_err());
  }
}

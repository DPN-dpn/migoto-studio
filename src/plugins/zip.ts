import { unzipSync } from 'fflate';
import type { PluginManifest } from './types.ts';

export interface ExtractedPlugin {
  manifest: PluginManifest;
  manifestJson: string;
  scriptContent: string;
  entryPath: string;
  files: Record<string, Uint8Array>;
}

/**
 * Validates and extracts a plugin .zip archive.
 * Expects manifest.json (or plugin.json) and index.js (or plugin.js, main.js).
 * Handles both flat archives and nested root-folder archives.
 */
export function validatePluginZip(bytes: Uint8Array): ExtractedPlugin {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch (err: any) {
    throw new Error(`압축 파일 해제 실패: ${err?.message || err}`);
  }

  const fileNames = Object.keys(unzipped).filter(
    (name) => !name.startsWith('__MACOSX/') && !name.endsWith('/.DS_Store') && !name.endsWith('/'),
  );

  if (fileNames.length === 0) {
    throw new Error('압축 파일이 비어 있습니다.');
  }

  // 1. Locate manifest file (manifest.json or plugin.json)
  const manifestPath = fileNames.find((name) =>
    /(?:^|\/)(?:manifest|plugin)\.json$/i.test(name),
  );
  if (!manifestPath) {
    throw new Error('압축 파일 내에 manifest.json (또는 plugin.json) 설정 파일이 없습니다.');
  }

  const manifestDir = manifestPath.includes('/')
    ? manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1)
    : '';

  const manifestRaw = new TextDecoder('utf-8').decode(unzipped[manifestPath]);
  let manifest: PluginManifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    throw new Error('manifest.json 구문 오류: 올바른 JSON 형식이 아닙니다.');
  }

  if (!manifest.id || typeof manifest.id !== 'string') {
    throw new Error('manifest.json에 "id" 항목이 누락되었거나 올바르지 않습니다.');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error('manifest.json에 "name" 항목이 누락되었습니다.');
  }

  // 2. Locate main script file
  let scriptPath: string | undefined;
  if (manifest.main) {
    const expected = (manifestDir + manifest.main.replace(/^\.\//, '')).toLowerCase();
    scriptPath = fileNames.find((name) => name.toLowerCase() === expected);
  }

  if (!scriptPath) {
    const candidates = ['index.js', 'plugin.js', 'main.js', 'index.mjs'];
    for (const c of candidates) {
      const found = fileNames.find((name) => {
        const rel = manifestDir ? name.replace(manifestDir, '') : name;
        return rel.toLowerCase() === c;
      });
      if (found) {
        scriptPath = found;
        break;
      }
    }
  }

  if (!scriptPath) {
    throw new Error('압축 파일 내에 플러그인 실행 스크립트(index.js, plugin.js 또는 main.js)가 없습니다.');
  }

  const entryPath = manifestDir ? scriptPath.replace(manifestDir, '') : scriptPath;
  const scriptContent = new TextDecoder('utf-8').decode(unzipped[scriptPath]);

  // Normalize files relative to manifestDir
  const normalizedFiles: Record<string, Uint8Array> = {};
  for (const name of fileNames) {
    if (manifestDir && name.startsWith(manifestDir)) {
      const rel = name.substring(manifestDir.length);
      if (rel) normalizedFiles[rel] = unzipped[name];
    } else if (!manifestDir) {
      normalizedFiles[name] = unzipped[name];
    }
  }

  // Resolve icon file from archive if referenced or present
  const iconRef = manifest.icon?.trim() || 'icon.svg';
  if (normalizedFiles[iconRef] && iconRef.endsWith('.svg')) {
    manifest.icon = new TextDecoder('utf-8').decode(normalizedFiles[iconRef]);
  } else if (normalizedFiles['icon.svg']) {
    manifest.icon = new TextDecoder('utf-8').decode(normalizedFiles['icon.svg']);
  }

  normalizedFiles['plugin.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  if (!normalizedFiles['main.js'] && !normalizedFiles['index.js']) {
    normalizedFiles['main.js'] = unzipped[scriptPath];
  }

  return {
    manifest,
    manifestJson: JSON.stringify(manifest, null, 2),
    scriptContent,
    entryPath,
    files: normalizedFiles,
  };
}

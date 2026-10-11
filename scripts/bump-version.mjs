#!/usr/bin/env node
// Synchronize version numbers across package.json, tauri.conf.json, and Cargo.toml.
// Usage:
//   node scripts/bump-version.mjs                 # Show current versions
//   node scripts/bump-version.mjs 0.1.1           # Set exact version (v0.1.1 also works)
//   node scripts/bump-version.mjs patch           # Bump patch: 0.1.0 -> 0.1.1
//   node scripts/bump-version.mjs minor           # Bump minor: 0.1.0 -> 0.2.0
//   node scripts/bump-version.mjs major           # Bump major: 0.1.0 -> 1.0.0

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_PATH = join(ROOT, 'package.json');
const TAURI_PATH = join(ROOT, 'src-tauri', 'tauri.conf.json');
const CARGO_PATH = join(ROOT, 'src-tauri', 'Cargo.toml');

async function readVersions() {
  const pkg = JSON.parse(await readFile(PKG_PATH, 'utf8'));
  const tauri = JSON.parse(await readFile(TAURI_PATH, 'utf8'));
  const cargoContent = await readFile(CARGO_PATH, 'utf8');
  const cargoMatch = /\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargoContent);
  return {
    pkgVersion: pkg.version ?? 'unknown',
    tauriVersion: tauri.version ?? 'unknown',
    cargoVersion: cargoMatch ? cargoMatch[1] : 'unknown',
    pkg,
    tauri,
    cargoContent,
  };
}

function computeNewVersion(current, arg) {
  const semverMatch = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(current);
  if (!semverMatch) {
    throw new Error(`현재 버전 '${current}'이 유효한 semver 형식이 아닙니다.`);
  }
  let major = parseInt(semverMatch[1], 10);
  let minor = parseInt(semverMatch[2], 10);
  let patch = parseInt(semverMatch[3], 10);

  if (arg === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  } else if (arg === 'minor') {
    return `${major}.${minor + 1}.0`;
  } else if (arg === 'major') {
    return `${major + 1}.0.0`;
  } else {
    // Direct version string: strip leading 'v'
    const clean = arg.replace(/^v/i, '').trim();
    if (!/^\d+\.\d+\.\d+/.test(clean)) {
      throw new Error(`지정한 버전 '${arg}'이 유효한 형식(예: 0.1.1 또는 v0.1.1)이 아닙니다.`);
    }
    return clean;
  }
}

async function main() {
  const arg = process.argv[2];
  const { pkgVersion, tauriVersion, cargoVersion, pkg, tauri, cargoContent } = await readVersions();

  if (!arg) {
    console.log('[version] 현재 버전 현황:');
    console.log(`  package.json:          ${pkgVersion}`);
    console.log(`  src-tauri/tauri.conf:  ${tauriVersion}`);
    console.log(`  src-tauri/Cargo.toml:  ${cargoVersion}`);
    console.log('\n사용법:');
    console.log('  node scripts/bump-version.mjs patch        # 패치 버전 올리기 (0.1.0 -> 0.1.1)');
    console.log('  node scripts/bump-version.mjs minor        # 마이너 버전 올리기 (0.1.0 -> 0.2.0)');
    console.log('  node scripts/bump-version.mjs 0.2.0        # 특정 버전으로 지정');
    return;
  }

  // Base version is tauri.conf.json or package.json
  const baseVersion = tauriVersion !== 'unknown' ? tauriVersion : pkgVersion;
  const newVersion = computeNewVersion(baseVersion, arg);

  console.log(`[version] 새 버전 적용: ${newVersion}`);

  // 1. Update package.json
  pkg.version = newVersion;
  await writeFile(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ✓ package.json: ${pkgVersion} -> ${newVersion}`);

  // 2. Update src-tauri/tauri.conf.json
  tauri.version = newVersion;
  await writeFile(TAURI_PATH, JSON.stringify(tauri, null, 2) + '\n');
  console.log(`  ✓ src-tauri/tauri.conf.json: ${tauriVersion} -> ${newVersion}`);

  // 3. Update src-tauri/Cargo.toml
  const updatedCargo = cargoContent.replace(
    /(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
    `$1"${newVersion}"`
  );
  await writeFile(CARGO_PATH, updatedCargo);
  console.log(`  ✓ src-tauri/Cargo.toml: ${cargoVersion} -> ${newVersion}`);

  console.log('\n[version] 모든 파일의 버전이 동기화되었습니다!');
  console.log('배포 시 다음 명령어를 실행하세요:');
  console.log(`  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`);
  console.log(`  git commit -m "버전 갱신: v${newVersion}"`);
  console.log(`  git tag v${newVersion}`);
  console.log(`  git push origin main`);
  console.log(`  git push origin v${newVersion}`);
}

main().catch((err) => {
  console.error(`[version] 오류: ${err.message}`);
  process.exit(1);
});

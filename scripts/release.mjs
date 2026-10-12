#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_PATH = join(ROOT, 'package.json');
const CHANGELOG_PATH = join(ROOT, 'CHANGELOG.md');

function computeVersion(current, bumpType) {
  const parts = current.split('.').map(Number);
  if (bumpType === 'patch') return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  if (bumpType === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
  if (bumpType === 'major') return `${parts[0] + 1}.0.0`;
  const clean = bumpType.replace(/^v/i, '').trim();
  if (/^\d+\.\d+\.\d+/.test(clean)) return clean;
  throw new Error(`알 수 없는 버전 인자: ${bumpType}`);
}

function main() {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
  const currentVersion = pkg.version || '0.1.0';
  const arg = process.argv[2] || 'patch';
  const newVersion = computeVersion(currentVersion, arg);

  console.log(`[release] v${newVersion} 릴리스 작업을 시작합니다 (현재 버전: v${currentVersion})...`);

  // 1. 버전 파일 일괄 동기화 및 CHANGELOG.md 릴리스 버전 헤더 적용
  console.log('[release] 1. package.json, tauri.conf.json, Cargo.toml 및 CHANGELOG 버전 동기화...');
  execSync(`node scripts/bump-version.mjs ${newVersion}`, { cwd: ROOT, stdio: 'inherit' });

  // 2. 릴리스 노트 생성 (release-notes.md 생성)
  console.log('[release] 2. 릴리스 노트 추출 및 release-notes.md 생성...');
  execSync(`node scripts/generate-release-notes.mjs v${newVersion}`, { cwd: ROOT, stdio: 'inherit' });

  // 3. Git 릴리스 커밋 및 태그 생성 (태그 시점에 완성된 릴리스 노트 보존)
  console.log('[release] 3. Git 릴리스 커밋 및 태그 생성...');
  try {
    execSync('git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock src/updater/version.ts CHANGELOG.md', { cwd: ROOT, stdio: 'inherit' });
    execSync(`git commit -m "chore(release): v${newVersion} 버전 릴리스"`, { cwd: ROOT, stdio: 'inherit' });
    execSync(`git tag v${newVersion}`, { cwd: ROOT, stdio: 'inherit' });

    // 4. CHANGELOG.md를 다음 개발 버전을 위해 깨끗하게 초기화 커밋
    console.log('[release] 4. CHANGELOG.md 다음 개발을 위한 초기화 커밋...');
    const cleanChangelog = '# 릴리스 노트 (Release Notes)\n\n## [다음 버전]\n\n### 신규 기능\n\n### 기능 개선\n\n### 버그 수정\n\n';
    writeFileSync(CHANGELOG_PATH, cleanChangelog, 'utf8');
    execSync('git add CHANGELOG.md', { cwd: ROOT, stdio: 'inherit' });
    execSync(`git commit -m "chore: prepare for next development iteration"`, { cwd: ROOT, stdio: 'inherit' });

    console.log(`\n[release] v${newVersion} 릴리스 커밋 및 태그(v${newVersion}) 생성이 완료되었습니다.`);
    console.log('CHANGELOG.md는 다음 개발을 위해 깨끗하게 초기화되었습니다.');
    console.log('원격 저장소에 배포하려면 다음 명령어를 실행하세요:');
    console.log('  git push origin main');
    console.log(`  git push origin v${newVersion}`);
  } catch (err) {
    console.log(`[release] Git 커밋/태그 생성 알림: ${err.message}`);
  }
}

main();

#!/usr/bin/env node
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_PATH = join(ROOT, 'CHANGELOG.md');

/**
 * Remove all emoji characters from a string.
 */
function stripEmojis(str) {
  return str
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/gu,
      ''
    )
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Parse changelog section for a specific version.
 */
function getChangelogSection(targetVersion) {
  if (!existsSync(CHANGELOG_PATH)) return null;
  const content = readFileSync(CHANGELOG_PATH, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  let capturing = false;
  const result = [];

  const targetHeader = `## [${targetVersion}]`;
  const altHeader = `## [v${targetVersion}]`;
  const simpleHeader = `## ${targetVersion}`;
  const simpleVHeader = `## v${targetVersion}`;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!capturing) {
      if (
        trimmed.startsWith(targetHeader) ||
        trimmed.startsWith(altHeader) ||
        trimmed.startsWith(simpleHeader) ||
        trimmed.startsWith(simpleVHeader)
      ) {
        capturing = true;
      }
    } else {
      if (trimmed.startsWith('## ') || trimmed === '---') {
        break;
      }
      result.push(line);
    }
  }

  const rawSection = result.join('\n').trim();
  if (rawSection.length > 0) return rawSection;

  // Fallback: If only the current release section is in CHANGELOG.md, use it
  const firstHeaderIdx = lines.findIndex((l) => l.trim().startsWith('## '));
  if (firstHeaderIdx >= 0) {
    const subLines = lines.slice(firstHeaderIdx + 1);
    const endIdx = subLines.findIndex((l) => l.trim().startsWith('## ') || l.trim() === '---');
    const fallbackLines = endIdx >= 0 ? subLines.slice(0, endIdx) : subLines;
    const fallback = fallbackLines.join('\n').trim();
    if (fallback.length > 0) return fallback;
  }

  return null;
}

/**
 * Fallback: Generate release notes from git commits between previous tag and HEAD.
 */
function getNotesFromGit(targetVersion) {
  let prevTag = '';
  try {
    const tags = execSync('git tag --sort=-creatordate', { cwd: ROOT, encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    const targetTag = `v${targetVersion}`;
    const idx = tags.indexOf(targetTag);
    if (idx >= 0 && idx < tags.length - 1) {
      prevTag = tags[idx + 1];
    } else if (tags.length > 0) {
      prevTag = tags[0] !== targetTag ? tags[0] : (tags[1] || '');
    }
  } catch {}

  const range = prevTag ? `${prevTag}..HEAD` : 'HEAD~15..HEAD';
  let logLines = [];
  try {
    const output = execSync(`git log ${range} --pretty=format:"%s"`, { cwd: ROOT, encoding: 'utf8' });
    logLines = output.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return '최신 개선사항 및 버그 수정이 포함되어 있습니다.';
  }

  const features = [];
  const fixes = [];
  const improvements = [];

  for (const line of logLines) {
    if (line.startsWith('chore(release)') || line.startsWith('release:')) continue;
    const clean = line.replace(/^[a-z]+(\([^)]+\))?:\s*/i, '').trim();

    if (/^feat/i.test(line)) {
      features.push(`- ${clean}`);
    } else if (/^fix/i.test(line)) {
      fixes.push(`- ${clean}`);
    } else if (/^(refactor|style|perf)/i.test(line)) {
      improvements.push(`- ${clean}`);
    }
  }

  const sections = [];
  if (features.length > 0) {
    sections.push(`### 신규 기능\n${features.join('\n')}`);
  }
  if (improvements.length > 0) {
    sections.push(`### 개선 사항\n${improvements.join('\n')}`);
  }
  if (fixes.length > 0) {
    sections.push(`### 버그 수정\n${fixes.join('\n')}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : '최신 개선사항 및 버그 수정이 포함되어 있습니다.';
}

function main() {
  const rawArg = process.argv[2] || '';
  const version = rawArg.replace(/^v/i, '').trim() || 'latest';

  let bodyContent = getChangelogSection(version);
  if (!bodyContent) {
    bodyContent = getNotesFromGit(version);
  }

  const downloadGuide = `### 다운로드 안내
- 설치형 프로그램: 아래 Assets에서 Migoto.Studio_${version}_x64-setup.exe를 다운로드하여 설치하세요.
  - 윈도우 시작 메뉴 및 프로그램 추가/제거에 등록됩니다.
  - 제거 시 앱 데이터 폴더(%APPDATA%\\MigotoStudio) 정리 체크박스를 지원합니다.
- 무설치 포터블 버전: Migoto-Studio_${version}_portable-x64.zip을 다운로드하여 원하는 폴더에 압축 해제 후 바로 실행할 수 있습니다. (설정 및 백업이 프로그램 옆 data/ 폴더에 보관됩니다.)
- 웹 버전 (브라우저 / PWA): https://DPN-dpn.github.io/migoto-studio/`;

  const fullNotes = `## Migoto Studio v${version}

${bodyContent}

${downloadGuide}`;

  // Enforce zero emojis across the entire release notes
  const cleanedNotes = stripEmojis(fullNotes);

  // Write to release-notes.md
  writeFileSync(join(ROOT, 'release-notes.md'), cleanedNotes, 'utf8');

  // If in GitHub Actions, append to GITHUB_OUTPUT
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    const delimiter = `EOF_${Math.random().toString(36).substring(2, 10)}`;
    const outputString = `body<<${delimiter}\n${cleanedNotes}\n${delimiter}\n`;
    appendFileSync(ghOutput, outputString, 'utf8');
  }

  console.log(cleanedNotes);
}

main();

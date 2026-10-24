# 워크스페이스 & 파일 I/O API (`context.workspace`)


열려 있는 파일 및 폴더와 상호작용합니다.

```typescript
// 활성 파일 정보
const currentFile = context.workspace.getCurrentFile();
// { name: 'mod.ini', path: 'd:/mods/...', location: 'd:/mods/mod.ini' }

// 현재 열려 있는 모드 폴더 경로
const folder = context.workspace.getCurrentFolder();

// 파일 열기 및 저장
await context.workspace.openFile('d:/mods/character/mod.ini', 42, 1); // 42번째 줄로 이동
await context.workspace.saveCurrentFile();

// 파일 읽기 / 쓰기
const text = await context.workspace.readTextFile('d:/mods/character/mod.ini');
await context.workspace.writeTextFile('d:/mods/character/mod.ini', updatedText);

// 바이너리 파일 읽기 / 쓰기
const bytes = await context.workspace.readBinaryFile('d:/mods/character/texture.dds');
await context.workspace.writeBinaryFile('d:/mods/character/output.bin', new Uint8Array([1, 2, 3]));

// 디렉토리 목록 읽기
const entries = await context.workspace.readDirectory(folder);
// entries: Array of { name, path, id, isDir, isDirectory, size, children }
// ※ readDirectory는 기본적으로 최대 8단계(maxDepth: 8)까지 하위 디렉터리 및 파일을 children 트리로 재귀 수집하여 단 한 번의 호출로 반환합니다.
// ※ 디렉터리 여부 판별 시 `isDir`과 `isDirectory`를 모두 지원하여 하위 호환성을 완벽하게 보장합니다.

// 고속 glob 파일 검색 (모든 하위 디렉터리 재귀 탐색)
const iniFiles = await context.workspace.findFiles('**/*.ini');
// ['d:/mods/Roxy/Roxy.ini', 'd:/mods/Roxy/RoxyWeapon/weapon.ini']

// 특정 폴더(cwd) 지정 및 최대 결과 개수 제한
const ddsFiles = await context.workspace.findFiles('textures/**/*.dds', {
  cwd: 'd:/mods/Roxy',
  maxResults: 50,
});

// 워크스페이스 전역 텍스트 검색 (열린 탭 + 미열린 모드 폴더 파일 통합 검색)
const matches = await context.workspace.search('CommandList', {
  caseSensitive: false,
  wholeWord: true,
  isRegex: false,
  includePatterns: ['*.ini'], // 특정 파일 필터
});
// matches: Array of { filePath, fileName, line, column, lineContent, matchedText }

// 안전 파일 백업 생성 (수정 전 안전 사본 보관)
const backupPath = await context.workspace.createBackup(); // 현재 파일 백업
// await context.workspace.createBackup('d:/mods/character/mod.ini', 'v1-작업전');

// 열려 있는 탭 목록 조회 및 전환/닫기 제어
const openTabs = context.workspace.getOpenTabs();
// [ { id: 'tab_1', title: 'mod.ini', path: '...', isDirty: false, kind: 'text', isActive: true }, ... ]

context.workspace.focusTab('tab_1'); // 해당 탭 활성화
await context.workspace.closeTab('tab_1'); // 해당 탭 닫기 (미저장 변경 시 사용자에게 확인)

// 파일 활성화 변경 감지
const unlisten = context.workspace.onDidChangeActiveFile((file) => {
  console.log('현재 작업 파일 변경됨:', file?.name);
});

// 모드 작업 폴더 변경(열림 또는 닫힘) 실시간 감지
const unlistenFolder = context.workspace.onDidChangeActiveFolder((folderPath) => {
  if (folderPath) {
    console.log('새 모드 폴더 열림:', folderPath);
  } else {
    console.log('모드 폴더 닫힘 (null)');
  }
});
// unlistenFolder(); // 필요 시 리스너 해제

// 작업 영역 초기화 및 메모리 제거 감지 (모드 폴더 닫기/변경 시 플러그인 자체 캐시 정리)
const unlistenClear = context.workspace.onDidClearMemory(({ reason }) => {
  // reason: 'folder_closed' | 'folder_changed' | 'reset'
  myPluginCache.clear();
});
// unlistenClear();

// 파일 저장 완료 감지 (에디터 Ctrl+S 저장 또는 플러그인 파일 쓰기 시)
const unlistenSave = context.workspace.onDidSaveFile(({ path, name }) => {
  console.log('파일 저장 완료:', name, path);
});
// unlistenSave();

// 에디터 탭 닫힘 감지 (닫힌 탭 ID, 연결 파일 경로, 제목 전달)
const unlistenCloseTab = context.workspace.onDidCloseTab(({ tabId, filePath, title }) => {
  console.log('탭 닫힘:', title, filePath);
});
// unlistenCloseTab();
```

---

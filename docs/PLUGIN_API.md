# Migoto Studio 플러그인 개발 가이드 및 API 문서

Migoto Studio는 개발자가 에디터의 기능을 자유롭게 확장하고 자체 도구를 구축할 수 있도록 강력한 플러그인 시스템을 제공합니다.

---

## 1. 플러그인 기본 구조

플러그인은 독립된 하나의 폴더이며, 최소 2개의 파일로 구성됩니다.

```
my-custom-plugin/
├── plugin.json       # 플러그인 메타데이터 매니페스트
└── index.js          # 플러그인 메인 스크립트 (ES Module)
```

### `plugin.json` 매니페스트 예시

```json
{
  "id": "my-custom-plugin",
  "name": "내 커스텀 플러그인",
  "version": "1.0.0",
  "description": "Migoto Studio를 위한 맞춤형 확장 도구입니다.",
  "author": "제작자명",
  "icon": "🎛️",
  "category": "tools",
  "main": "index.js"
}
```

- `icon`: 이모지(`🎛️`), SVG 마크업 문자열(`<svg>...</svg>`), 이미지 URL 또는 Base64 Data URI를 지원합니다.
- `category`: `'tools'` | `'assets'` | `'ai'` | `'general'`

---

## 2. 플러그인 생명주기 (Lifecycle)

플러그인 메인 스크립트는 ES Module 규격으로 작성하며, `activate(context)`와 선택적인 `deactivate()`를 내보냅니다.

```javascript
export default {
  activate(context) {
    console.log(`${context.manifest.name} 활성화됨`);

    // 상단 툴바 메뉴 등록
    context.ui.registerMenuItem({
      label: '도구 열기',
      shortcut: 'Ctrl+Shift+T',
      action: () => {
        openMyTab(context);
      },
    });
  },

  deactivate() {
    console.log('플러그인 비활성화됨');
    // 필요한 경우 추가 리소스 정리
  },
};
```

> **자동 정리(Auto Cleanup)**:
> 플러그인이 `context.ui.openTab`, `context.ui.registerMenuItem`, `context.ui.registerSidebarView`, `context.editor.onDidChangeText` 등을 통해 등록한 UI 요소나 이벤트 리스너는 플러그인이 비활성화되거나 삭제될 때 플랫폼에 의해 자동으로 정리됩니다.

---

## 3. UI 확장 API (`context.ui`)

### 3.1 메인 에디터 탭 열기 (`context.ui.openTab`)

사이드바 패널이 비좁거나 사용자에게 넓은 GUI 작업 공간을 제공해야 하는 경우, INI 에디터 탭과 나란히 메인 에디터 영역에 독립된 탭을 생성할 수 있습니다.

```typescript
const tab = context.ui.openTab({
  id: 'my-gui-tab',
  title: '토글 키 설정기',
  icon: '⚙️',
  render(container) {
    container.innerHTML = `
      <div style="padding: 24px; max-width: 800px; margin: 0 auto; color: var(--fg);">
        <h2>🎛️ 토글 키 설정 매니저</h2>
        <p>열려 있는 모드의 INI 설정을 직관적으로 편집합니다.</p>
        <div id="gui-content"></div>
      </div>
    `;

    // 정리(Cleanup)가 필요한 경우 함수를 반환합니다.
    return () => {
      console.log('탭이 닫히거나 전환될 때 정리 로직 수행');
    };
  },
});

// 프로그래밍 방식으로 탭 제어 가능:
// tab.focus();  // 탭으로 포커스 전환
// tab.close();  // 탭 닫기
```

- **다중 탭 호환**: 다른 INI 탭들과 완벽히 호환되며, `Ctrl+W`로 닫거나 마우스 휠 클릭 닫기, 탭 간 전환이 자연스럽게 작동합니다.
- **상태 보존**: 동일한 `id`로 `openTab`을 다시 호출하면 새 탭을 중복 생성하지 않고 기존에 열려 있는 탭으로 즉시 전환됩니다.

---

### 3.2 상단 툴바 '플러그인' 메뉴 등록 (`context.ui.registerMenuItem`)

상단 메인 메뉴바의 **[플러그인]** 메뉴에 플러그인의 기능을 등록할 수 있습니다.
메뉴가 무분별하게 길어지는 것을 방지하기 위해, 각 플러그인이 등록한 메뉴 항목은 **플러그인 이름의 서브메뉴**로 깔끔하게 묶여 노출됩니다.

```typescript
const unregister = context.ui.registerMenuItem({
  label: '토글 키 설정 열기…',
  shortcut: 'Ctrl+Shift+T', // 선택 사항 (표시용 텍스트)
  action: () => {
    // 클릭 시 실행할 동작
    openMyTab(context);
  },
});
```

- **메뉴 구조**:
  ```
  [상단 메뉴바]
    └── [플러그인]
          ├── 플러그인 관리… (Ctrl+Shift+X)
          ├── 플러그인 폴더 열기…
          ├── ────────────────────
          └── [내 커스텀 플러그인] ▶
                └── 토글 키 설정 열기… (Ctrl+Shift+T)
  ```

---

### 3.3 좌측 사이드바 패널 등록 (`context.ui.registerSidebarView`)

좌측 액티비티 바에 전용 탭 아이콘과 사이드바 패널을 등록합니다.

```typescript
context.ui.registerSidebarView({
  id: 'my-sidebar-panel',
  title: '플러그인 도구',
  icon: '🛠️',
  render(container) {
    container.innerHTML = `<div style="padding: 12px;">사이드바 내용</div>`;
    return () => {
      // 사이드바 언마운트 시 정리
    };
  },
});
```

---

### 3.4 모달 창 및 토스트 알림

```typescript
// 모달 띄우기
context.ui.showModal('설정 마법사', (bodyEl, closeModal) => {
  bodyEl.innerHTML = `<p>설정을 진행하시겠습니까?</p>`;
  const btn = document.createElement('button');
  btn.textContent = '확인';
  btn.onclick = () => {
    closeModal();
  };
  bodyEl.appendChild(btn);
});

// 토스트 메시지
context.ui.showToast('설정이 성공적으로 저장되었습니다.', 'info'); // 'info' | 'warn' | 'error'
```

---

### 3.5 상태 표시줄 아이템 (`context.ui.registerStatusBarItem`)

```typescript
context.ui.registerStatusBarItem({
  id: 'my-status',
  text: '모드: 활성',
  tooltip: '클릭하여 상태 변경',
  onClick: () => {
    context.ui.showToast('상태 토글됨');
  },
});
```

---

### 3.6 UI 빌더 헬퍼 함수 (`context.ui.*`)

빠르고 일관된 테마 디자인을 위해 내장 컴포넌트 팩토리 메서드를 제공합니다.

- `context.ui.createButton(options)`: 일관된 스타일의 버튼 생성
- `context.ui.createInput(options)`: 텍스트 입력 필드
- `context.ui.createSelect(options)`: 드롭다운 선택 필드
- `context.ui.createCheckbox(options)`: 체크박스
- `context.ui.createSlider(options)`: 슬라이더
- `context.ui.createSection(title, description)`: 섹션 컨테이너 카드
- `context.ui.createBadge(text, color)`: 배지

---

## 4. INI 문서 파싱 및 조작 API (`context.ini`)

3DMigoto 및 XXMI 문법에 특화된 파서와 조작 유틸리티를 제공합니다.

```typescript
// 1. 현재 에디터 또는 임의의 텍스트 파싱
const doc = context.ini.parse();
// doc.sections: Array of { name, rawName, lines: [{ type, key, value, line, raw }] }
// doc.variables: Record<string, string>

// 2. 섹션 분류
const kind = context.ini.classifySection('KeyToggleDress');
// 'key' | 'resource' | 'command_list' | 'custom_shader' | 'constants' | 'present' | 'texture_override' | 'general'

// 3. 섹션 병합
const merged = context.ini.merge(currentTargetText, newSectionText, { appendNew: true });
// merged.text: 병합된 전체 문자열
// merged.updatedCount, merged.appendedCount

// 4. 섹션 서식화 문자열 생성
const sectionStr = context.ini.formatSection(
  'KeyToggleExample',
  {
    key: 'VK_F4',
    type: 'cycle',
    '$toggle': '0, 1',
  },
  { comments: ['토글 키 설정 섹션'] },
);
```

---

## 5. 워크스페이스 & 파일 I/O (`context.workspace`)

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
// entries: Array of { name, isDirectory, isFile, path }

// 파일 활성화 변경 감지
const unlisten = context.workspace.onDidChangeActiveFile((file) => {
  console.log('현재 작업 파일 변경됨:', file?.name);
});
```

---

## 6. 에디터 제어 (`context.editor`)

```typescript
// 텍스트 읽기 및 변경
const allText = context.editor.getText();
const selected = context.editor.getSelectedText();
context.editor.insertText('삽입할 내용');
context.editor.replaceSelection('교체할 내용');

// 커서 위치
const cursor = context.editor.getCursor(); // { lineNumber, column }
context.editor.setCursor(10, 1);

// 에디터 우클릭 컨텍스트 메뉴 추가
context.editor.registerContextMenuAction({
  id: 'my-action',
  label: '선택 영역 변환',
  onClick: () => {
    const text = context.editor.getSelectedText();
    context.editor.replaceSelection(text.toUpperCase());
  },
});
```

---

## 7. 영구 저장소 (`context.storage`)

플러그인별로 격리된 `localStorage` 저장 공간을 제공합니다.

```typescript
// 설정값 가져오기 (기본값 지원)
const apiKey = context.storage.get('apiKey', '');
const config = context.storage.get('userConfig', { mode: 'fast' });

// 설정값 저장하기
context.storage.set('apiKey', 'sk-...');
context.storage.set('userConfig', { mode: 'precise' });
```

---

## 8. 시스템 프로세스 실행 (`context.system` - 데스크톱 전용)

데스크톱 앱 환경에서 외부 유틸리티나 도구를 실행할 수 있습니다.

```typescript
const result = await context.system.exec('git', ['status'], context.workspace.getCurrentFolder());
console.log('exitCode:', result.exitCode);
console.log('stdout:', result.stdout);
```

---

## 9. 실전 예제: 상단 메뉴와 전용 에디터 탭을 여는 플러그인

```javascript
// index.js
export default {
  activate(context) {
    // 1. 상단 메뉴바의 [플러그인] 메뉴에 등록
    context.ui.registerMenuItem({
      label: '모드 설정 패널 열기',
      shortcut: 'Ctrl+Shift+M',
      action: () => {
        openStudioTab(context);
      },
    });

    // 2. 단축키 안내 토스트
    context.ui.showToast(`${context.manifest.name}이 활성화되었습니다. [플러그인] 메뉴에서 열 수 있습니다.`, 'info');
  },
};

function openStudioTab(context) {
  context.ui.openTab({
    id: 'studio-control-tab',
    title: '모드 컨트롤러',
    icon: '🎮',
    render(container) {
      container.innerHTML = `
        <div style="padding: 24px; max-width: 900px; margin: 0 auto; color: var(--fg); font-family: sans-serif;">
          <h2>🎮 모드 비주얼 컨트롤러</h2>
          <p style="color: var(--fg-dim);">현재 열린 모드의 INI 설정을 손쉽게 관리할 수 있습니다.</p>
          <hr style="border: none; border-top: 1px solid var(--border); margin: 16px 0;" />
          <div id="status-view"></div>
          <button id="btn-save" class="primary" style="margin-top: 16px;">설정 적용</button>
        </div>
      `;

      const currentFile = context.workspace.getCurrentFile();
      const statusView = container.querySelector('#status-view');
      statusView.textContent = currentFile ? `현재 파일: ${currentFile.location}` : '열려 있는 INI 파일이 없습니다.';

      const btnSave = container.querySelector('#btn-save');
      btnSave.addEventListener('click', () => {
        context.ui.showToast('설정이 적용되었습니다!', 'info');
      });

      return () => {
        console.log('컨트롤러 탭이 정리되었습니다.');
      };
    },
  });
}
```

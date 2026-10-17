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

### 3.1 메인 에디터 탭 열기 (`context.ui.openTab` 및 `context.ui.openFormTab`)

사이드바 패널이 비좁거나 사용자에게 넓은 GUI 작업 공간을 제공해야 하는 경우, INI 에디터 탭과 나란히 메인 에디터 영역에 독립된 탭을 생성할 수 있습니다.

#### A. 초간단 선언형 폼 탭 (`context.ui.openFormTab`) - **(권장)**
HTML/CSS를 일일이 짤 필요 없이, 필드 목록 스키마만 정의하면 Migoto Studio가 테마에 맞추어 카드 레이아웃, 실시간 키 캡처, 유효성 검사, 적용 버튼이 포함된 고품질 GUI 탭을 자동으로 생성합니다.

```typescript
const formTab = context.ui.openFormTab({
  id: 'key-toggle-wizard',
  title: '토글 키 설정',
  icon: '🎛️',
  form: {
    title: '토글 키 생성 마법사',
    description: '단축키와 모드를 선택하면 현재 INI 파일에 [KeyToggle] 섹션을 자동으로 추가합니다.',
    fields: [
      { id: 'section', type: 'text', label: '섹션 이름', default: 'KeyToggleDress', placeholder: 'KeyToggle...' },
      { id: 'key', type: 'key', label: '단축키', default: 'VK_F4', description: '토글을 발동할 키 (키 감지 버튼으로 직접 입력 가능)' },
      { id: 'mode', type: 'select', label: '토글 모드', options: ['cycle', 'hold'], default: 'cycle' },
      { id: 'varName', type: 'text', label: '변수명', default: '$dress', placeholder: '$var_name' },
      { id: 'states', type: 'number', label: '의상 상태 개수', default: 2, min: 2, max: 10 },
    ],
    submitLabel: 'INI 파일에 적용하기',
    onSubmit: (values) => {
      // 1. 3DMigoto KeyToggle 섹션 텍스트 생성
      const sectionText = context.ini.formatKeyToggle({
        sectionName: values.section,
        key: values.key,
        type: values.mode,
        states: values.states,
        variableName: values.varName,
      });

      // 2. 현재 열린 INI 파일에 자동으로 섹션 병합/업서트
      context.ini.upsertSection(values.section, {
        key: values.key,
        type: values.mode,
        [values.varName]: Array.from({ length: values.states }, (_, i) => i).join(', '),
      });

      context.ui.showToast(`[${values.section}] 토글 키가 적용되었습니다!`, 'info');
    },
  },
});
```

- 지원하는 필드 타입(`type`):
  - `'key'`: 3DMigoto 전용 키 바인딩 선택기 (실시간 키보드 입력 감지 버튼 내장)
  - `'text'`: 텍스트 입력창
  - `'number'`: 숫자 입력창 (`min`, `max`, `step` 지원)
  - `'select'`: 드롭다운 선택창 (`options` 배열 지원)
  - `'checkbox'`: 체크박스 토글
  - `'textarea'`: 여러 줄 텍스트/코드 입력창
  - `'color'`: 색상 선택기

---

#### B. 자유 형식 커스텀 탭 (`context.ui.openTab`)
원시 DOM 요소를 직접 구성하거나 외부 캔버스 라이브러리 등을 렌더링할 때 사용합니다.

```typescript
const tab = context.ui.openTab({
  id: 'my-gui-tab',
  title: '커스텀 뷰어',
  icon: '⚙️',
  render(container) {
    container.innerHTML = `<div style="padding: 24px;">...자유로운 HTML/CSS...</div>`;
    return () => {
      // 탭이 닫히거나 전환될 때 정리 로직 수행
    };
  },
});
```

- **다중 탭 호환**: 다른 INI 탭들과 완벽히 호환되며, `Ctrl+W`로 닫거나 마우스 휠 클릭 닫기, 탭 간 전환이 자연스럽게 작동합니다.
- **상태 보존**: 동일한 `id`로 `openTab` 또는 `openFormTab`을 다시 호출하면 새 탭을 중복 생성하지 않고 기존에 열려 있는 탭으로 즉시 전환됩니다.

---

### 3.2 상단 툴바 '플러그인' 메뉴 등록 (`context.ui.registerMenuItem`)

상단 메인 메뉴바의 **[플러그인]** 메뉴에 플러그인의 기능을 등록할 수 있습니다.
메뉴가 무분별하게 길어지는 것을 방지하기 위해, 각 플러그인이 등록한 메뉴 항목은 **플러그인 이름의 서브메뉴**로 깔끔하게 묶여 노출됩니다.

```typescript
const unregister = context.ui.registerMenuItem({
  label: '토글 키 설정 열기…',
  shortcut: 'Ctrl+Shift+T', // 선택 사항 (표시용 텍스트)
  action: () => {
    // 클릭 시 실행할 동작 (예: 폼 탭 열기)
    openMyForm(context);
  },
});
```

---

### 3.6 UI 빌더 헬퍼 함수 (`context.ui.*`)

빠르고 일관된 테마 디자인을 위해 내장 컴포넌트 팩토리 메서드를 제공합니다.

- `context.ui.createForm(config)`: 고수준 선언형 폼 컴포넌트 생성 (`getValues()`, `setValues()`, `reset()`)
- `context.ui.createKeyInput(options)`: 3DMigoto 전용 키 캡처 입력기 위젯
- `context.ui.createCard(options)`: 헤더/설명/액션 버튼이 포함된 스타일 카드
- `context.ui.createButton(options)`: 일관된 스타일의 버튼 생성
- `context.ui.createInput(options)`: 텍스트 입력 필드
- `context.ui.createSelect(options)`: 드롭다운 선택 필드
- `context.ui.createCheckbox(options)`: 체크박스
- `context.ui.createSlider(options)`: 슬라이더
- `context.ui.createBadge(text, color)`: 배지

---

### 3.7 키 바인딩 설정 모달 대화상자 (`context.ui.openKeyBindingModal`)

3DMigoto 전용 키 입력 도우미 모달 대화상자를 호출하여 실시간 키보드 입력 감지, 필수/부정 수식키(`ctrl`, `no_ctrl`, `alt`, `no_alt` 등) 조합 및 전체 가상 키 목록 검색/선택을 제공합니다.
사용자가 [확인]을 누르면 선택된 3DMigoto 단축키 문자열을 반환하고, 취소 시 `null`을 반환합니다.

```typescript
// 1. 비동기 대화상자 호출 (Promise)
const selectedKey = await context.ui.openKeyBindingModal({
  title: '헤어 토글 키 설정',
  initialKey: 'no_modifiers alt VK_F4', // 기존 설정값 (생략 시 기본값)
});

if (selectedKey) {
  console.log('선택된 키:', selectedKey); // e.g. "ctrl no_alt VK_F4"
  // INI 파일이나 설정에 적용
}

// 2. 콜백 방식으로 호출
context.ui.openKeyBindingModal({
  title: '단축키 변경',
  initialKey: currentKey,
  onApply: (newKey) => {
    updateBinding(newKey);
  },
});
```

- **별칭**: `context.ui.openKeyHelperModal(options)`로도 동일하게 호출할 수 있습니다.
- **위젯 연동**: `context.ui.createKeyInput(options)` 위젯에는 실시간 [키 감지] 버튼 외에 모달을 여는 [키 도우미] 버튼이 기본 내장되어 있습니다.

---

## 4. INI 문서 파싱 및 조작 API (`context.ini`)

3DMigoto 및 XXMI 문법에 특화된 고수준 조작 유틸리티를 제공합니다.

```typescript
// 1. 토글 키 섹션 텍스트 생성
const keyToggleBlock = context.ini.formatKeyToggle({
  sectionName: 'KeyToggleHair',
  key: 'no_modifiers alt VK_F4',
  type: 'cycle',
  states: 3,
  variableName: '$hair',
  comments: ['머리 모양 순환 토글'],
});

// 2. 키 바인딩 문자열 파싱 (수식키 및 가상키 분해)
const parsedKey = context.ini.parseKeyBinding('ctrl no_alt VK_F4');
// { vk: 'VK_F4', ctrl: 'require', alt: 'exclude', shift: 'none', win: 'none' }

// 3. 키 바인딩 문자열 조합
const keyStr = context.ini.formatKeyBinding({
  vk: 'VK_F4',
  ctrl: 'require',
  alt: 'exclude',
});
// "ctrl no_alt VK_F4"

// 4. 지원하는 3DMigoto 가상키 전체 목록 조회
const allKeys = context.ini.getKeyList();
// [ { vk: 'VK_F1', label: 'F1', category: '기능키(F1~F12)' }, ... ]

// 5. 현재 열린 INI 파일에 섹션 추가/업데이트 (기존 섹션은 제자리 교체)
context.ini.upsertSection('KeyToggleHair', {
  key: 'no_modifiers alt VK_F4',
  type: 'cycle',
  '$hair': '0, 1, 2',
});

// 6. 특정 섹션 삭제
context.ini.deleteSection('KeyToggleHair');

// 7. 섹션 검색 및 목록
const sections = context.ini.getSections(); // 현재 문서의 모든 섹션 배열
const keySec = context.ini.findSection(/^Key/i); // 정규식 또는 문자열로 섹션 검색

// 8. 문서 내 선언된 모든 변수 목록 가져오기
const variables = context.ini.getVariables(); // { "$hair": "0", "$active": "1" }

// 9. 원본 파싱 및 수동 병합
const doc = context.ini.parse();
const kind = context.ini.classifySection('TextureOverrideBody');
const merged = context.ini.merge(currentTargetText, newSectionText, { appendNew: true });
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
// command, args, cwd(선택), stdin(선택)
const result = await context.system.exec('python', ['tool.py'], context.workspace.getCurrentFolder(), '사용자 입력\n');
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

---

## 10. AI 코딩 어시스턴트 활용 (ChatGPT / Claude / Cursor)

다른 AI(ChatGPT, Claude, Cursor 등)에게 Migoto Studio 플러그인 개발을 요청할 때는 [`docs/AGENTS.md`](./AGENTS.md) 지침서를 시스템 프롬프트로 제공하세요.
내부 코드를 일일이 설명할 필요 없이 선언형 폼 빌더(`openFormTab`)와 `context.ini` API를 사용한 안전하고 즉시 실행 가능한 플러그인 코드를 단번에 작성할 수 있습니다.


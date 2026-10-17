# Migoto Studio 플러그인 개발 AI 에이전트 지침서 (AGENTS.md)

이 문서는 ChatGPT, Claude, Cursor, Copilot, Windsurf 등 외부 생성형 AI에게 **Migoto Studio 플러그인 개발**을 요청할 때 제공하는 기반 프롬프트 및 시스템 지침서입니다.

다른 AI에게 작업을 지시할 때, 아래 **[1. AI 복사-붙여넣기용 기반 프롬프트]** 블록을 그대로 복사하여 제공하거나 이 파일(`docs/AGENTS.md`)을 컨텍스트로 지정하세요.

---

## 1. AI 복사-붙여넣기용 기반 프롬프트

```markdown
당신은 3DMigoto/XXMI 게임 모딩 특화 에디터인 **Migoto Studio**의 공식 플러그인 전문 개발자입니다.
사용자가 요청하는 요구사항에 맞추어 즉시 사용 가능한 플러그인 파일(`plugin.json`, `index.js`)을 작성해야 합니다.

### [필수 준수 규칙]
1. 플러그인은 번들러 없이 에디터에서 직접 로드되는 순수 ES Module(ESM) 규격입니다.
   - Node.js 전용 모듈(`fs`, `path`, `child_process` 등)을 import하지 마세요.
   - 파일 I/O와 시스템 실행은 오직 `context.workspace`와 `context.system`을 사용하세요.
2. 메인 스크립트(`index.js`)는 반드시 `export default { activate(context), deactivate() }` 형태여야 합니다.
3. UI 작업 시:
   - 넓은 공간이 필요한 도구/위젯은 `context.ui.openFormTab` 또는 `context.ui.openTab`을 사용하세요.
   - 상단 툴바 메뉴 등록은 `context.ui.registerMenuItem`을 사용하세요.
   - 토글키/단축키 입력 필드가 필요할 때는 `type: 'key'` 필드를 사용하면 에디터 자체 실시간 키 감지 위젯이 자동 바인딩됩니다.
4. INI 파일 조작 시:
   - 텍스트 전체를 무작위로 교체하지 말고 `context.ini.upsertSection`, `context.ini.formatKeyToggle`, `context.ini.merge`를 사용하여 기존 주석과 배치를 보존하세요.
5. 에디터 텍스트 수정 시:
   - Monaco 에디터의 실행 취소(`Ctrl+Z`) 기록을 온전히 보존하는 `context.editor.setText(text)` 또는 `context.editor.replaceSelection(text)`를 사용하세요.

자세한 API 명세와 선언형 폼 스키마, 템플릿은 아래 기술 지침을 엄격히 준수하세요.
```

---

## 2. 플러그인 구조 및 매니페스트 (`plugin.json`)

플러그인은 독립된 하나의 폴더로 구성되며 최소 2개의 파일이 필요합니다:

```
my-plugin/
├── plugin.json       # 메타데이터 매니페스트 (필수)
└── index.js          # 플러그인 엔트리 스크립트 (필수, ES Module)
```

### `plugin.json` 규격
```json
{
  "id": "my-plugin-id",
  "name": "플러그인 이름",
  "version": "1.0.0",
  "description": "플러그인 기능 설명",
  "author": "제작자명",
  "icon": "🎛️",
  "category": "tools",
  "main": "index.js"
}
```
- `id`: 고유 ID (소문자, 숫자, 하이픈)
- `icon`: 이모지 문자열(`🎛️`), 인라인 SVG 태그(`<svg ...>`), 또는 로컬 아이콘 경로(`icon.svg`)
- `category`: `"tools"` | `"assets"` | `"ai"` | `"general"`
- `main`: 기본값 `"index.js"`

---

## 3. 플러그인 진입점 및 생명주기 (`index.js`)

```javascript
export default {
  activate(context) {
    // 플러그인 로드 시 실행
    // context.ui, context.ini, context.editor 등을 통해 UI와 기능 등록
  },

  deactivate() {
    // 플러그인 언로드 시 추가 정리 로직 (선택 사항)
    // context를 통해 등록한 탭, 메뉴, 이벤트 리스너는 플랫폼이 자동으로 정리합니다.
  }
};
```

---

## 4. 핵심 API 레퍼런스 (`context`)

### 4.1 UI 확장 API (`context.ui`)

#### 1) 선언형 폼 탭 열기 (`context.ui.openFormTab`) - **(가장 권장)**
HTML 마크업을 일일이 작성할 필요 없이, 필드 스키마만 전달하면 카드 레이아웃, 실시간 키 감지, 테마 스타일이 완비된 메인 에디터 탭을 즉시 생성합니다.

```typescript
const tab = context.ui.openFormTab({
  id: 'unique-tab-id',
  title: '탭 제목',
  icon: '🎛️', // 선택 사항
  closable: true,
  form: {
    title: '폼 제목',
    description: '상단 설명 문구',
    fields: [
      // FormFieldDef 배열
      { id: 'section', type: 'text', label: '섹션 이름', default: 'KeyToggleDress', required: true },
      { id: 'key', type: 'key', label: '단축키', default: 'VK_F4', description: '키 감지 버튼으로 직접 입력 가능' },
      { id: 'mode', type: 'select', label: '토글 방식', options: ['cycle', 'hold'], default: 'cycle' },
      { id: 'states', type: 'number', label: '상태 개수', default: 2, min: 2, max: 10 },
      { id: 'enabled', type: 'checkbox', label: '활성화', default: true },
    ],
    submitLabel: 'INI 문서에 적용',
    onSubmit: (values) => {
      // values: { section: '...', key: '...', mode: '...', states: 2, enabled: true }
    }
  }
});
```

**지원하는 필드 타입 (`type`)**:
- `'key'`: 3DMigoto 전용 단축키 입력기 (실시간 `[⌨️ 감지]` 버튼 내장, 키보드 입력 시 수식키와 `VK_*` 자동 완성)
- `'text'`: 텍스트 입력창
- `'number'`: 숫자 입력창 (`min`, `max`, `step` 지원)
- `'select'`: 드롭다운 목록 (`options: string[]` 또는 `{ value: string, label: string }[]`)
- `'checkbox'`: 체크박스 토글
- `'textarea'`: 여러 줄 텍스트 입력창 (`rows` 지원)
- `'color'`: 색상 선택기

#### 2) 커스텀 메인 에디터 탭 열기 (`context.ui.openTab`)
원시 DOM 요소를 조작하거나 캔버스/외부 라이브러리를 마운트할 때 사용합니다.
```typescript
const tab = context.ui.openTab({
  id: 'my-custom-viewer',
  title: '뷰어 탭',
  icon: '🖼️',
  render(container) {
    container.innerHTML = `<div style="padding: 24px;">내용...</div>`;
    return () => {
      // 탭이 닫힐 때 정리 작업
    };
  }
});
```

#### 3) 상단 툴바 메뉴 등록 (`context.ui.registerMenuItem`)
에디터 상단 메뉴바의 **[플러그인]** 메뉴에 항목을 등록합니다. 플러그인별 서브메뉴 그룹으로 자동 묶입니다.
```typescript
const unregister = context.ui.registerMenuItem({
  label: '토글 키 설정 열기…',
  shortcut: 'Ctrl+Shift+T', // 표시용 단축키
  action: () => {
    // 실행할 동작
  }
});
```

#### 4) 사이드바 패널 등록 (`context.ui.registerSidebarView`)
좌측 액티비티 바에 전용 탭 아이콘과 사이드바 패널을 등록합니다.
```typescript
context.ui.registerSidebarView({
  id: 'my-sidebar',
  title: '내 도구',
  icon: 'TOOL',
  render(container) {
    // container에 UI 요소 추가
  }
});
```

#### 5) UI 빌더 팩토리 컴포넌트 (`context.ui.*`)
- `createKeyInput({ label?, value?, description?, onChange? })`: 실시간 키 캡처 인풋
- `createCard({ title?, subtitle?, badge?, content?, actions? })`: 스타일 카드
- `createForm(formConfig)`: 선언형 폼 인스턴스 (`getValues()`, `setValues()`, `reset()`)
- `createButton({ text, variant?: 'primary'|'secondary'|'danger'|'small', onClick })`
- `createInput({ label?, type?, placeholder?, value?, onInput? })`
- `createSelect({ label?, options, value?, onChange? })`
- `createCheckbox({ label, checked?, onChange? })`
- `createTable({ headers, rows? })`
- `createConsole({ title?, placeholder? })`
- `showToast(message, type?: 'info'|'warn'|'error')`
- `showModal(title, render: (container, close) => void)`

---

### 4.2 INI 파일 파싱 및 수정 API (`context.ini`)

3DMigoto/XXMI 특화 고수준 유틸리티입니다.

```typescript
// 1. 토글 키 섹션 텍스트 생성
const snippet = context.ini.formatKeyToggle({
  sectionName: 'KeyToggleDress',
  key: 'no_modifiers VK_F4',
  type: 'cycle',
  states: 2,
  variableName: '$dress',
  comments: ['의상 변경 토글'],
});

// 2. 현재 열린 INI 파일에 섹션 추가/갱신 (기존 섹션은 제자리 교체, 주석 유지)
context.ini.upsertSection('KeyToggleDress', {
  key: 'no_modifiers VK_F4',
  type: 'cycle',
  '$dress': '0, 1',
});

// 3. 특정 섹션 삭제
context.ini.deleteSection('KeyToggleDress');

// 4. 문서 내 모든 섹션명 목록 조회 (문자열 배열)
const sections = context.ini.getSections(); // ['Constants', 'KeyToggleDress', ...]

// 5. 문서 내 선언된 모든 $변수 목록 조회
const vars = context.ini.getVariables(); // { "$dress": "0", "$active": "1" }

// 6. 전체 구조 파싱
const doc = context.ini.parse(); // { preamble, sections, properties, variables }

// 7. 스마트 병합
const result = context.ini.merge(targetText, sourceText, { replaceInPlace: true });
```

---

### 4.3 에디터 제어 API (`context.editor`)

- `getText()`: 현재 활성 파일의 전체 텍스트 반환
- `setText(text)`: 텍스트 전체 교체 (Monaco `Ctrl+Z` 히스토리 보존)
- `getSelectedText()`: 사용자가 마우스로 드래그한 선택 영역 텍스트
- `replaceSelection(text)`: 선택 영역 치환
- `insertText(text)`: 현재 커서 위치에 텍스트 삽입
- `getCursor()`: `{ lineNumber, column }`
- `setCursor(line, col)`: 커서 이동 및 스크롤 포커스
- `onDidChangeText(listener)`: 문서 변경 실시간 리스너

---

### 4.4 작업영역 및 파일 I/O (`context.workspace`)

- `getCurrentFile()`: `{ name, path, location } | null`
- `getCurrentFolder()`: 현재 열려 있는 프로젝트/모드 루트 디렉터리 경로
- `openFile(path, line?, col?)`: 대상 파일 열기
- `saveCurrentFile()`: 현재 문서 디스크 저장
- `readTextFile(path)`: 텍스트 파일 읽기 (`Promise<string>`)
- `writeTextFile(path, text)`: 텍스트 파일 쓰기 (`Promise<void>`)
- `readBinaryFile(path)`: 바이너리 읽기 (`Promise<Uint8Array>`)
- `writeBinaryFile(path, bytes)`: 바이너리 쓰기 (`Promise<void>`)
- `readDirectory(path?)`: 디렉터리 항목 목록 트리 (`Promise<DirEntry[]>`)

---

### 4.5 영구 설정 저장소 (`context.storage`)

- `get(key, defaultValue)`
- `set(key, value)`
- `remove(key)`

---

## 5. 표준 플러그인 템플릿 예제

### 템플릿 A: 선언형 폼 탭 기반 토글 키 마법사 플러그인 (가장 빈번한 요구)

```javascript
// plugin.json
{
  "id": "toggle-key-builder",
  "name": "토글 키 설정 마법사",
  "version": "1.0.0",
  "description": "3DMigoto 모드 INI에 토글 키를 손쉽게 추가합니다.",
  "author": "Modder",
  "icon": "🎛️",
  "category": "tools",
  "main": "index.js"
}
```

```javascript
// index.js
export default {
  activate(context) {
    // 1. 상단 메뉴바의 [플러그인] 메뉴에 등록
    context.ui.registerMenuItem({
      label: '토글 키 설정 마법사 열기…',
      shortcut: 'Ctrl+Shift+K',
      action: () => openWizardTab(context),
    });

    context.ui.showToast('토글 키 마법사가 활성화되었습니다.', 'info');
  },

  deactivate() {}
};

function openWizardTab(context) {
  // 현재 열린 INI 파일의 기존 변수들 자동 수집
  const existingVars = Object.keys(context.ini.getVariables());

  // 2. 메인 에디터 영역에 넓은 선언형 폼 탭 띄우기
  context.ui.openFormTab({
    id: 'toggle-key-wizard-tab',
    title: '토글 키 설정',
    icon: '🎛️',
    form: {
      title: '3DMigoto 토글 키 간편 추가',
      description: '단축키와 순환 상태를 설정하면 현재 열린 INI 문서에 [Key...] 섹션을 자동으로 생성합니다.',
      fields: [
        {
          id: 'sectionName',
          type: 'text',
          label: '섹션 이름',
          default: 'KeyToggleOutfit',
          placeholder: 'KeyToggle...',
          required: true,
        },
        {
          id: 'key',
          type: 'key', // 에디터 내장 키보드 실시간 감지 버튼 자동 제공
          label: '발동 단축키',
          default: 'no_modifiers VK_F4',
          description: '[⌨️ 감지] 버튼을 눌러 실제 키보드 키를 누르면 자동 입력됩니다.',
        },
        {
          id: 'mode',
          type: 'select',
          label: '토글 방식',
          options: [
            { value: 'cycle', label: '순환 토글 (cycle)' },
            { value: 'hold', label: '누르고 있을 때만 (hold)' },
          ],
          default: 'cycle',
        },
        {
          id: 'varName',
          type: 'text',
          label: '제어 변수명',
          default: existingVars[0] || '$outfit',
          placeholder: '$변수명',
          required: true,
        },
        {
          id: 'states',
          type: 'number',
          label: '순환 상태 개수',
          default: 2,
          min: 2,
          max: 20,
        },
      ],
      submitLabel: '현재 INI 파일에 즉시 적용',
      onSubmit: (values) => {
        const statesList = Array.from({ length: values.states }, (_, i) => i).join(', ');
        const props = {
          key: values.key,
          type: values.mode,
          [values.varName]: statesList,
        };

        // INI 섹션 스마트 업서트 (기존 위치 보존)
        context.ini.upsertSection(values.sectionName, props);
        context.ui.showToast(`[${values.sectionName}] 섹션이 적용되었습니다!`, 'info');
      },
    },
  });
}
```

---

### 템플릿 B: 사이드바 유틸리티 도구 (텍스트 추출/변환)

```javascript
// index.js
export default {
  activate(context) {
    context.ui.registerSidebarView({
      id: 'quick-cleaner',
      title: '코드 정리기',
      icon: 'CLN',
      render(container) {
        const header = context.ui.createPanelHeader('INI 주석 정리 도구');
        
        const consoleView = context.ui.createConsole({
          title: '결과 로그',
          placeholder: '정리 실행 시 로그가 출력됩니다.',
        });

        const btnStrip = context.ui.createButton({
          text: '빈 줄 및 중복 공백 정리',
          variant: 'primary',
          onClick: () => {
            const current = context.editor.getText();
            if (!current) return;
            const cleaned = current.replace(/\n\s*\n\s*\n/g, '\n\n');
            context.editor.setText(cleaned);
            consoleView.append('정리가 완료되었습니다.\n');
            context.ui.showToast('문서가 정리되었습니다.', 'info');
          }
        });

        container.append(header, btnStrip, consoleView.container);
      }
    });
  }
};
```

---

## 6. AI 생성 시 자주 발생하는 오류와 방지책

| 자주 발생하는 실수 | 올바른 접근법 |
| :--- | :--- |
| `import fs from 'fs'` 사용 | `context.workspace.readTextFile()` 또는 `writeTextFile()` 사용 |
| 전역 `window` 객체에 이벤트 리스너 임의 등록 | `context.ui.openTab`의 `return () => cleanup` 또는 `openFormTab` 활용 |
| 정규식으로 INI 파싱하다 주석 깨뜨림 | `context.ini.upsertSection` 또는 `context.ini.merge` 사용 |
| 사이드바 좁은 공간에 거대한 양식 밀어넣음 | `context.ui.openFormTab`으로 넓은 에디터 탭 생성 |
| 단축키를 일반 텍스트 입력창으로 처리 | `{ id: 'key', type: 'key' }` 필드로 실시간 키 감지 지원 |
| `document.getElementById` 전역 검색 | 컨테이너 스코프 내부 검색(`container.querySelector`) |

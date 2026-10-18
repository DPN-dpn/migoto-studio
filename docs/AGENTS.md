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
   - 단일 파일(`index.js`)뿐만 아니라, 여러 파일(`ui.js`, `constants.js`, `style.css`, `config.json` 등)로 분할하여 작성할 수 있습니다.
   - Migoto Studio의 내장 가상 모듈 링커가 상대 경로 `import ... from './ui.js'`를 자동 해석하므로 번들러(Vite/esbuild) 빌드 과정이 필요 없습니다.
   - Node.js 전용 모듈(`fs`, `path`, `child_process` 등)을 import하지 마세요.
   - 파일 I/O와 시스템 실행은 오직 `context.workspace`와 `context.system`을 사용하세요.
2. 메인 스크립트(`index.js`)는 반드시 `export default { activate(context), deactivate() }` 형태여야 합니다.
3. UI 작업 시:
   - 넓은 공간이 필요한 도구/위젯은 `context.ui.openFormTab` 또는 `context.ui.openTab`을 사용하세요.
   - 상단 툴바 메뉴 등록은 `context.ui.registerMenuItem`을 사용하세요.
   - 사용자 확인이 필요할 때는 `context.ui.confirm` 및 `context.ui.prompt` 비동기 모달을 사용하세요.
   - 텍스트 변경점 비교 시 `context.ui.openDiffTab`을 열고, 백업 복원 시 `context.ui.openRestoreModal`을 활용하세요.
   - 모든 UI 빌더 컴포넌트는 최상위 DOM 요소인 `.element`와 `.getElement()`를 표준 제공합니다. 레이아웃 컴포넌트(`createRow`, `createColumn`, `createCard` 등)의 `children` 배열에는 위젯 객체 자체를 넘기면 자동으로 최상위 엘리먼트로 언래핑됩니다.
   - 입력 필드 유효성 검사 실패 시 `widget.setError(msg)`와 `widget.clearError()`를 사용하여 인라인 경고 테두리와 메시지 툴팁을 띄우세요.
   - 토글키/단축키 입력 필드가 필요할 때는 `type: 'key'`(폼 탭) 또는 `context.ui.createKeyInput`을 사용하며, 화면 표시용 정제 문자열은 `context.ini.formatDisplayKey(rawKey)` 또는 `keyInput.getDisplayValue()`로 간결하게 취득하세요 (`'no_modifiers alt VK_F4'` ➔ `'Alt + F4'`).
   - 고품질 인터페이스 구현 시 분할 화면(`createSplitView`), 탭 네비게이션(`createTabs`), 아코디언(`createCollapsible`), 세그먼트 컨트롤(`createSegmentedControl`), 디바운스 검색창(`createSearchInput`), 숫자 입력 스텝퍼(`createNumberInput`), 파일 선택기(`createFilePicker`), 드롭존(`createDropZone`), 툴팁(`attachTooltip`)을 적극 활용하세요.
4. INI 파일 조작 시:
   - 텍스트 전체를 무작위로 교체하지 말고 `context.ini.upsertSection`, `context.ini.formatKeyToggle`, `context.ini.merge`를 사용하여 기존 주석과 배치를 보존하세요.
   - `drawindexed = auto` 다중 호출, `match_first_index`, 주석 순서, `if-endif` 블록 등이 중요한 메쉬 오버라이드 섹션은 딕셔너리 대신 `context.ini.getSectionRaw`, `context.ini.setSectionRaw`, `context.ini.parseSectionLines`를 활용하세요.
   - 변수/리소스/섹션 구조 파악 시 `context.ini.extractSymbols`를 사용하세요.
5. 에디터 텍스트 수정 및 작업영역:
   - Monaco 에디터의 실행 취소(`Ctrl+Z`) 기록을 온전히 보존하는 `context.editor.setText(text)` 또는 `context.editor.replaceSelection(text)`를 사용하세요.
   - 워크스페이스 전역 검색은 `context.workspace.search`, 탭 제어는 `context.workspace.getOpenTabs / focusTab / closeTab`, 안전 백업은 `context.workspace.createBackup`을 활용하세요.
6. API 상세 레퍼런스:
   - 플러그인 개발 시 사용할 수 있는 모든 `context.*` API의 상세 시그니처, 매개변수 및 예제는 [`docs/PLUGIN_API.md`](./PLUGIN_API.md)를 반드시 참조하세요.

자세한 아키텍처 규칙, 권장 개발 지침 및 템플릿은 아래 내용을 엄격히 준수하세요.
```

---

## 2. 플러그인 구조 및 매니페스트 (`plugin.json`)

플러그인은 독립된 하나의 폴더로 구성되며 단일 파일 또는 다중 파일 구조를 지원합니다:

### 단일 파일 구조
```
my-plugin/
├── plugin.json       # 메타데이터 매니페스트 (필수)
└── index.js          # 플러그인 엔트리 스크립트 (필수, ES Module)
```

### 다중 파일 분할 구조 (권장 - 번들러 불필요)
```
my-plugin/
├── plugin.json       # 메타데이터 매니페스트 (필수)
├── index.js          # 플러그인 메인 엔트리
├── ui.js             # UI 빌더 컴포넌트 분리
├── constants.js      # 상수 및 기본값 정의
└── style.css         # 전용 스타일시트
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

## 4. 플러그인 아키텍처 및 핵심 API 도메인 개요

Migoto Studio 플러그인은 `activate(context)` 함수로 전달되는 `PluginContext` 객체를 통해 에디터의 모든 기능과 상호작용합니다.

> [!IMPORTANT]
> **공식 API 상세 레퍼런스 문서 안내 (`PLUGIN_API.md`)**
> 각 네임스페이스별 모든 메서드의 상세 시그니처, 파라미터 타입, 반환값 및 실행 예제는 공식 레퍼런스 문서인 **[`docs/PLUGIN_API.md`](./PLUGIN_API.md)**에 완전하게 수록되어 있습니다.
> 코드를 작성할 때는 `AGENTS.md`의 아키텍처 규칙과 템플릿을 따르되, 구체적인 API 명세는 반드시 `PLUGIN_API.md`를 참조하세요.

### 주요 API 네임스페이스 개요

| 네임스페이스 | 주요 역할 및 핵심 기능 | 상세 레퍼런스 문서 |
| :--- | :--- | :--- |
| **`context.ui`** | • 선언형 폼 탭(`openFormTab`) 및 커스텀 에디터 탭(`openTab`) 열기<br>• 상단 툴바 메뉴 등록(`registerMenuItem`), 사이드바 패널 등록(`registerSidebarView`)<br>• 확인/입력 모달(`confirm`, `prompt`), Diff 비교 탭(`openDiffTab`), 백업 복원 모달(`openRestoreModal`)<br>• 3DMigoto 키 바인딩 대화상자(`openKeyBindingModal`), 키 입력 위젯(`createKeyInput` - 실시간 감지/표시용 정제/인라인 검증)<br>• UI 빌더: 모든 위젯 표준 `.element` 및 `.getElement()`, 자동 언래핑(`toElement`)<br>• 인라인 검증 상태(`setError`, `clearError`, `hasError`)<br>• 레이아웃: 분할뷰(`createSplitView` - Flex 방어 내장), 탭(`createTabs`), 아코디언(`createCollapsible`), 세그먼트(`createSegmentedControl`), 검색창(`createSearchInput`), 숫자 스텝퍼(`createNumberInput`), 파일선택기(`createFilePicker`), 드롭존(`createDropZone`), 툴팁(`attachTooltip`), 카드, 테이블, 콘솔 등 | [`PLUGIN_API.md#3-ui-api-contextui`](./PLUGIN_API.md#3-ui-api-contextui) |
| **`context.ini`** | • 3DMigoto/XXMI 문법 파싱 및 섹션 자동 분류(`parse`, `classifySection`)<br>• 기존 주석 및 배치 보존 스마트 섹션 갱신(`upsertSection`) 및 삭제(`deleteSection`)<br>• 토글 키 섹션 텍스트 생성(`formatKeyToggle`), 단축키 파싱 및 조합(`parseKeyBinding`, `formatKeyBinding`)<br>• 화면 표시용 단축키 텍스트 정제(`formatDisplayKey` - 부정키 제거 및 배지 표기)<br>• 다중 동일 키(`drawindexed = auto`), `if-endif` 블록, 주석 보존 Raw 조작(`getSectionRaw`, `setSectionRaw`, `parseSectionLines`)<br>• 변수, 리소스, CommandList 고속 심볼 추출(`extractSymbols`), 스마트 병합(`merge`) | [`PLUGIN_API.md#4-ini-문서-파싱-및-조작-api-contextini`](./PLUGIN_API.md#4-ini-문서-파싱-및-조작-api-contextini) |
| **`context.editor`** | • 현재 열린 활성 파일의 텍스트 읽기/쓰기(`getText`, `setText`) — Monaco 실행 취소(`Ctrl+Z`) 이력 완벽 보존<br>• 커서 위치 조회/이동(`getCursor`, `setCursor`), 선택 영역 교체(`replaceSelection`), 텍스트 삽입(`insertText`)<br>• 에디터 우클릭 컨텍스트 메뉴 등록(`registerContextMenuAction`), 텍스트 변경 이벤트 감지 | [`PLUGIN_API.md#6-에디터-제어-contexteditor`](./PLUGIN_API.md#6-에디터-제어-contexteditor) |
| **`context.workspace`** | • 활성 파일/작업 폴더 정보(`getCurrentFile`, `getCurrentFolder`), 파일 열기 및 저장(`openFile`, `saveCurrentFile`)<br>• 텍스트/바이너리 파일 I/O(`readTextFile`, `writeTextFile`, `readBinaryFile`, `writeBinaryFile`)<br>• 디렉터리 트리 순회(`readDirectory`), 워크스페이스 전역 텍스트 검색(`search`)<br>• 수정 전 안전 백업 생성(`createBackup`), 열린 탭 목록 조회/전환/닫기 제어(`getOpenTabs`, `focusTab`, `closeTab`) | [`PLUGIN_API.md#5-워크스페이스--파일-io-contextworkspace`](./PLUGIN_API.md#5-워크스페이스--파일-io-contextworkspace) |
| **`context.linter`** | • 커스텀 INI 린트 규칙 등록(`registerRule`)<br>• 외부 플러그인 전용 허용 리소스 및 변수 화이트리스트 등록(`registerAllowedResource`, `registerAllowedVariable`) | [`PLUGIN_API.md`](./PLUGIN_API.md) |
| **`context.storage`** | • 플러그인 ID별로 격리된 영구 설정 저장/조회/삭제(`get`, `set`, `remove`) | [`PLUGIN_API.md#7-영구-저장소-contextstorage`](./PLUGIN_API.md#7-영구-저장소-contextstorage) |
| **`context.system`** | • 데스크톱 환경에서 외부 유틸리티 CLI 프로세스 비동기 실행(`exec`) | [`PLUGIN_API.md#8-시스템-프로세스-실행-contextsystem---데스크톱-전용`](./PLUGIN_API.md#8-시스템-프로세스-실행-contextsystem---데스크톱-전용) |

### UI 구성 시 권장 개발 가이드라인

1. **설정/입력 위주의 도구**: 복잡한 HTML을 작성하지 말고 `context.ui.openFormTab`을 사용하세요. 선언적 필드 배열(`FormFieldDef[]`)만 정의하면 카드 레이아웃, 실시간 키보드 감지, 테마 스타일, 값 수집 및 검증이 자동 처리됩니다.
2. **복합 뷰어/커스텀 레이아웃**: `context.ui.openTab`을 사용하고, 내부 구조는 `context.ui.createSplitView`, `createTabs`, `createCollapsible`, `createRow`, `createColumn`, `createScrollContainer` 등 내장 UI 빌더 컴포넌트를 조합하여 구성하세요.
3. **위젯 엘리먼트 전달**: 모든 UI 컴포넌트는 `.element` 속성을 표준 제공하며, `createRow`, `createColumn`, `createCard`의 `children` 배열에 위젯 객체를 그대로 넘기면 코어가 자동 언래핑합니다.
4. **단축키 및 숫자 입력**: 단축키 필드는 항상 `type: 'key'`(폼 탭) 또는 `context.ui.createKeyInput` / `openKeyBindingModal`을 사용하고, 정수/실수 입력 필드는 `type: 'number'` 또는 `context.ui.createNumberInput` 스텝퍼 위젯(`min`, `max`, `step`, `precision`, `integerOnly` 지원)을 활용하세요.
5. **폼 에러 피드백**: 유효하지 않은 입력 발생 시 `input.setError(message)`를 호출하여 인라인 툴팁을 표시하고, 정상 입력 시 `input.clearError()`를 호출하세요.

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

### 템플릿 C: 다중 파일 모듈 분할 플러그인 (UI, 상수, 스타일 분리 - 번들러 불필요)

Migoto Studio는 내장 가상 모듈 링커를 제공하므로, Vite나 esbuild 없이 순수 JS/ESM 문법으로 코드를 여러 파일로 분할할 수 있습니다.

```
my-advanced-plugin/
├── plugin.json
├── index.js      # 엔트리 포인트
├── ui.js         # UI 빌더 로직
├── constants.js  # 상수 정의
├── config.json   # JSON 설정값
└── style.css     # 전용 스타일시트
```

```javascript
// constants.js
export const DEFAULT_KEY = 'VK_F4';
export const DEFAULT_TYPE = 'cycle';
```

```javascript
// ui.js
import { DEFAULT_KEY, DEFAULT_TYPE } from './constants.js';
import config from './config.json';
import './style.css'; // 플러그인 활성화 시 DOM에 자동 주입

export function openWizard(context) {
  context.ui.openFormTab({
    id: 'advanced-wizard-tab',
    title: '고급 모드 마법사',
    icon: '🧩',
    config: {
      title: '다중 모듈 토글 키 설정',
      description: `버전: ${config.version || '1.0.0'}`,
      fields: [
        { id: 'section', label: '섹션명', type: 'text', default: 'KeyToggleOutfit', required: true },
        { id: 'key', label: '단축키', type: 'key', default: DEFAULT_KEY, required: true },
        { id: 'type', label: '모드', type: 'select', default: DEFAULT_TYPE, options: ['cycle', 'hold'] },
      ],
      onSubmit: (values) => {
        context.ini.upsertSection(values.section, {
          key: values.key,
          type: values.type,
        });
        context.ui.showToast(`[${values.section}] 섹션이 반영되었습니다!`, 'info');
      },
    },
  });
}
```

```javascript
// index.js
import { openWizard } from './ui.js';

export default {
  activate(context) {
    context.ui.registerMenuItem({
      label: '고급 모드 마법사 열기',
      shortcut: 'Ctrl+Shift+Z',
      action: () => openWizard(context),
    });
    context.ui.showToast(`${context.manifest.name} 활성화됨`, 'info');
  },
  deactivate() {}
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
| 스크롤바를 위해 `style.css`에서 `!important`나 부모 flex를 수동 주입 | 에디터 코어 API(`createScrollContainer`, `createTabs`, `createSplitView`, `openTab`)에 `flex: 1 1 0; min-height: 0;` 및 테마 스크롤바가 자동 내장되어 있으므로 수동 스타일 조작 없이 API만 호출 |
| `document.getElementById` 전역 검색 | 컨테이너 스코프 내부 검색(`container.querySelector`) |
| 위젯마다 최상위 프로퍼티(`.row`, `.container`)를 외워서 분기 | 모든 컴포넌트 표준인 `.element` 사용 또는 `children: [myWidget]`으로 직접 전달 (자동 언래핑) |
| 원시 키 문자열(`no_modifiers alt VK_F4`)을 UI에 그대로 노출 | `context.ini.formatDisplayKey(rawKey)` 또는 `keyInput.getDisplayValue()`로 깔끔하게 변환 (`Alt + F4`) |
| `drawindexed = auto` 다중 호출이나 if-endif 블록을 단일 딕셔너리로 덮어쓰다 유실 | `context.ini.getSectionRaw`, `setSectionRaw`, `parseSectionLines`로 원본 라인 및 순서 보존 |
| 입력값 오류 시 화면 전체 경고창이나 토스트만 남발 | `input.setError('경고 메시지')`와 `input.clearError()`를 활용하여 인라인 필드 피드백 제공 |
| 코드가 길어졌을 때 단일 파일에 억지로 우겨넣음 | `index.js`, `ui.js`, `constants.js`, `style.css` 등으로 분할하여 상대 경로 `import` 사용 |
| Vite/webpack/esbuild 번들러 설정 생성 시도 | 에디터 코어 가상 모듈 링커가 런타임에 자동 해석하므로 번들러 불필요 (순수 ESM 작성) |


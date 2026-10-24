# Migoto Studio 플러그인 개발 가이드 및 API 문서

Migoto Studio는 개발자가 에디터의 기능을 자유롭게 확장하고 자체 도구를 구축할 수 있도록 강력한 플러그인 시스템을 제공합니다.

---

## 1. 플러그인 기본 구조

플러그인은 독립된 하나의 폴더이며, 단일 파일 또는 여러 파일로 자유롭게 구성할 수 있습니다.

### A. 단일 파일 구조
```
my-custom-plugin/
├── plugin.json       # 플러그인 메타데이터 매니페스트
└── index.js          # 플러그인 메인 스크립트 (ES Module)
```

### B. 다중 파일 분할 구조 (Multi-File Plugins - 번들러 불필요)
코드의 가독성과 모듈화를 위해 코드를 여러 파일로 분리할 수 있습니다.  
Migoto Studio 코어의 **가상 모듈 링커(Virtual Module Linker)** 가 상대 경로 `import`(`import ... from './ui.js'`)를 런타임에 자동으로 해석하고 연결하므로, Vite나 esbuild 같은 별도의 번들러 없이 순수 JS/ESM으로 여러 파일에 코드를 나누어 작성할 수 있습니다.

```
my-advanced-plugin/
├── plugin.json       # 플러그인 매니페스트
├── index.js          # 엔트리 스크립트 (activate / deactivate 내보내기)
├── ui.js             # UI 빌더 및 컴포넌트 로직
├── constants.js      # 상수 및 디폴트 설정
├── config.json       # JSON 데이터 (import config from './config.json' 지원)
└── style.css         # 전용 스타일시트 (import './style.css' 시 자동 주입 및 플러그인 언로드 시 자동 정리)
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

- `main`: 플러그인의 엔트리 스크립트 경로 (생략 시 `index.js`, `plugin.js`, `main.js` 순으로 자동 탐색)
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
- **작업 상태 영구 보존**: 탭 간 전환 시(예: INI 에디터나 다른 플러그인 탭으로 이동했다 돌아올 때) DOM 트리를 파괴하지 않고 상태를 완벽히 유지하므로, 입력 중이던 텍스트/숫자 필드, 드롭다운 선택값, 스크롤 위치 및 에디터 커서가 휘발되지 않고 그대로 보존됩니다.

---

### 3.2 상단 툴바 '플러그인' 메뉴 등록 (`context.ui.registerMenuItem`)

상단 메인 메뉴바의 **[플러그인]** 메뉴에 플러그인의 기능을 등록할 수 있습니다.
- **1개 등록 시**: 상단 메뉴에 직접 1단 메뉴 항목으로 바로 연결됩니다.
- **2개 이상 등록 시**: 플러그인 이름의 서브메뉴(▶)로 깔끔하게 묶여 하위 항목으로 노출됩니다.

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

### 3.3 대화형 확인 대화상자 (`context.ui.confirm`)

플러그인에서 위험 작업(파일 삭제, 대량 변경 등)을 수행하기 전 사용자에게 확인을 요청하는 모달 대화상자입니다.

```typescript
// 1. 단순 문자열 호출
const ok = await context.ui.confirm('이 섹션을 정말 삭제하시겠습니까?');

// 2. 제목, 버튼 문구, 위험 스타일 지정
const confirmed = await context.ui.confirm({
  title: '모드 프리셋 초기화',
  message: '모든 커스텀 설정이 기본값으로 초기화됩니다.\n계속 진행하시겠습니까?',
  confirmText: '초기화 실행',
  cancelText: '취소',
  variant: 'danger', // 'danger' | 'primary' (빨간색 강조)
});

if (confirmed) {
  // 사용자가 확인을 누름
}
```

---

### 3.4 텍스트 입력 프롬프트 (`context.ui.prompt`)

사용자에게 텍스트 입력을 비동기로 요청하는 입력 대화상자입니다. 취소하거나 창을 닫으면 `null`을 반환합니다.

```typescript
// 1. 단순 프롬프트
const name = await context.ui.prompt('생성할 새 섹션 이름을 입력하세요:');

// 2. 기본값 및 placeholder 지정
const varName = await context.ui.prompt({
  title: '새 토글 변수 추가',
  message: '등록할 전역 변수명을 입력하세요 ($ 접두사 포함):',
  placeholder: '$my_variable',
  defaultValue: '$outfit_state',
  confirmText: '변수 생성',
});

if (varName !== null) {
  console.log('입력된 변수명:', varName);
}
```

---

### 3.5 Monaco 기반 Diff 비교 탭 열기 (`context.ui.openDiffTab`)

두 텍스트 간의 차이점을 나란히(Side-by-Side) 비교하고 인라인 차이점을 시각적으로 검토할 수 있는 메인 Diff 탭을 생성합니다.

```typescript
const diffTab = context.ui.openDiffTab({
  title: '모드 변경 전후 비교',
  originalTitle: '현재 INI 파일',
  modifiedTitle: 'AI 자동 수정본',
  originalText: currentText,
  modifiedText: newText,
  languageId: 'migoto', // 기본값: 'migoto' (3DMigoto 문법 하이라이팅 적용)
});

// 프로그래밍 방식으로 탭 제어 가능
// diffTab.focus();
// diffTab.close();
```

---

### 3.6 백업 복원 및 Diff 비교 모달 열기 (`context.ui.openRestoreModal`)

지정된 파일(또는 현재 활성 파일)의 자동 보관 백업 목록을 띄우고, 각 백업과의 즉시 Diff 비교 및 되돌리기(Undo 가능한 안전 복원) 기능을 제공합니다.

```typescript
// 현재 활성 파일의 백업 목록 열기
context.ui.openRestoreModal();

// 특정 경로 파일의 백업 목록 열기
context.ui.openRestoreModal('d:/mods/Character/merged.ini');
```

---

### 3.7 독립 서브 윈도우 띄우기 (`context.ui.openSubWindow`)

메인 에디터 화면(사이드바/메인 탭)에 구애받지 않고, **독립된 서브 윈도우(Pop-out Window)**를 띄워 넓은 마법사, 실시간 프리뷰 캔버스, 전용 도구 UI를 구성할 수 있습니다. 메인 창의 테마와 CSS 스타일이 자동으로 복제 주입됩니다.
창 상단의 **PiP(별도 창 분리)** 버튼을 누르면 즉시 **독립된 OS 윈도우(Document Picture-in-Picture / Pop-out Window)**로 분리되어 듀얼 모니터로 이동하거나 자유롭게 배치할 수 있습니다.

```typescript
const subWin = context.ui.openSubWindow({
  id: 'my-texture-tool',
  title: '텍스처 오버라이드 실시간 도구',
  width: 720,
  height: 560,
  minWidth: 400,
  minHeight: 300,
  resizable: true,
  // 포커스 모드: 'alwaysOnTop' | 'parentLinked' | 'independent' (기본: 'parentLinked')
  focusMode: 'parentLinked',
  // 초기 실행 시 별도 OS 윈도우(PiP 팝아웃)로 우선 분리할지 여부 (선택)
  preferPopout: false,
  render(container, handle) {
    const card = context.ui.createCard({
      title: '실시간 프리뷰',
      content: '독립된 서브창에서 자유롭게 UI를 구성할 수 있습니다.',
    });
    container.append(card.element);

    return () => {
      // 서브창이 닫힐 때 실행될 정리(cleanup) 로직
      console.log('서브창 정리 완료');
    };
  },
});

// 프로그래밍 방식으로 서브창 제어
// subWin.focus();
// subWin.setTitle('새로운 타이틀');
// subWin.resize(800, 600);
// subWin.setFocusMode('alwaysOnTop');
// await subWin.togglePopout(); // 별도 OS 윈도우(PiP) 팝아웃 토글
// const isPopped = subWin.isPoppedOut();
// subWin.setInitialData({ folder: currentFolder }); // 초기 데이터 동적 갱신 (PiP 분리 시 전달 및 열려있는 독립 OS창 실시간 동기화)
// subWin.postMessage({ type: 'RELOAD', data }); // 서브윈도우 및 PiP 분리된 독립 OS 창으로 메시지 전송
// const unlisten = subWin.onMessage((msg) => { ... }); // 서브윈도우 및 독립 OS 창으로부터 수신된 메시지 리스너
// subWin.close();
```

#### 포커스 및 레이어 모드 (`focusMode`)
- **`'alwaysOnTop'` (항상 맨 위)**: 다른 외부 프로그램이나 게임 창보다 화면 최상단에 계속 유지됩니다. 실시간 모니터링이나 단축키 가이드에 유용합니다.
- **`'parentLinked'` (에디터 연동 - 기본값)**: 평소에는 다른 창 뒤로 갈 수 있지만, 메인 Migoto Studio 에디터를 클릭하거나 포커스하면 **서브창이 자동으로 메인 창과 함께 맨 위로 올라옵니다.**
- **`'independent'` (독립 창)**: 메인 에디터와 완전히 독립된 창으로 동작합니다. 듀얼 모니터 환경에서 다른 모니터로 이동시켜 작업하기에 최적입니다.

#### PiP 별도 OS 윈도우 분리 기능 및 마스터-슬레이브 상태 동기화
- **원클릭 독립 OS 분리**: 서브창 상단 컨트롤러의 **PiP 버튼**(`⧉`)을 클릭하면 즉시 메인 에디터와 완전히 독립된 데스크톱 OS 윈도우(`WebviewWindow`)로 분리(Pop-out)됩니다.
- **메인 화면 자동 숨김 & 하단 상태표시줄 '열린 창' 드롭다운 통합 관리**:
  - 독립 OS 창으로 분리되는 즉시 메인 화면을 가로막던 커다란 플로팅 창은 **자동으로 숨겨집니다.**
  - 화면에 불필요한 플로팅 칩을 남기지 않고, **하단 상태표시줄에 `🗔 열린 창 (N) ▾` 드롭다운 버튼**이 동적으로 활성화됩니다.
  - 드롭다운 메뉴를 통해 현재 열려 있는 모든 별도 OS 창(서브윈도우 팝아웃 창 및 순수 독립 OS 창) 목록을 확인하고 클릭하여 포커스할 수 있으며, `[내장 창으로 복원]` 또는 개별/전체 닫기가 가능합니다.
- **마스터-슬레이브 윈도우 생명주기 및 상태 동기화 (Master-Slave Synchronization)**:
  - **창 종료 동기화**: 원본(메인) 창을 닫으면 열려 있는 모든 별도 OS 창들도 안전하게 함께 종료됩니다.
  - **최소화 및 복원 동기화**: 메인 창을 최소화하면 모든 별도 OS 창들도 자동으로 함께 최소화되며, 메인 창을 다시 복원하면 메인 창에 의해 최소화되었던 모든 별도 OS 창들도 함께 복원됩니다.
- **내장 창과 별도 OS 창 동시 지원 표준 패턴 (권장)**:
  - 데스크톱 독립 창은 메인 창과 다른 별개의 프로세스/Webview이므로, 메인 창 메모리의 `render` 클로저 함수가 자동으로 복사되지 않습니다.
  - 따라서 `openSubWindow` 호출 시 `entry: 'subwindow.js'`를 지정하고, 해당 파일에 `export default` 진입점을 두어 렌더링 로직을 공유하는 것을 권장합니다:

```javascript
// plugins/my-plugin/subwindow.js

// 1. 공통 UI 렌더링 함수
function renderViewer(container, contextOrHandle) {
  container.innerHTML = `
    <div style="padding: 16px;">
      <h3>🧊 3D 뷰어</h3>
      <div id="viewport" style="width: 100%; height: 400px;"></div>
    </div>
  `;
}

// 2. [별도 OS 창 진입점] PiP로 분리되어 독립 창으로 떴을 때 자동 실행
export default async function runInNativeWindow(context) {
  renderViewer(context.container, context);
}

// 3. [내장 서브 윈도우 진입점] 상단 메뉴 등에서 서브 윈도우를 열 때 호출
export async function openViewerSubWindow(context) {
  context.ui.openSubWindow({
    id: 'my-viewer-subwin',
    title: '🧊 3D 뷰어',
    width: 900,
    height: 650,
    // ★ 별도 OS 창으로 분리될 때 실행할 엔트리 스크립트 지정
    entry: 'subwindow.js',
    // ★ 별도 OS 창으로 넘겨줄 초기 데이터
    initialData: {
      folder: context.workspace.getActiveFolder(),
    },
    // 내장 플로팅 창으로 떴을 때 호출
    render(container, handle) {
      renderViewer(container, handle);
    },
  });
}
```

---

### 3.8 독립 OS 윈도우 띄우기 (`context.ui.openNativeWindow`)

서브 윈도우(내장 플로팅 창)를 거치지 않고, **처음부터 메인 에디터와 완전히 분리된 별도의 독립 Windows OS 창**을 띄워 듀얼 모니터 전용 도구(3D 뷰어, 전용 사운드 플레이어, 외부 모니터 프리뷰 등)를 구성할 수 있습니다.

```typescript
const nativeWin = await context.ui.openNativeWindow({
  id: 'my-dual-screen-viewer',
  title: '3D 모드 뷰어 (독립 윈도우)',
  width: 900,
  height: 650,
  minWidth: 400,
  minHeight: 300,
  resizable: true,
  alwaysOnTop: false,
  center: true,
  // 독립 OS 창에서 실행될 플러그인 엔트리 스크립트 (플러그인 폴더 기준 상대 경로)
  entry: 'subwindow.js',
  // 메인 창에서 별도 OS 창으로 전달할 초기 데이터
  initialData: {
    folder: context.workspace.getActiveFolder(),
  },
});

// 메인 창에서 독립 OS 창으로 실시간 메시지 전송
nativeWin.postMessage({ type: 'CHANGE_FOLDER', folder: '...' });

// 독립 OS 창에서 보낸 메시지 수신
const unlisten = nativeWin.onMessage((msg) => {
  console.log('서브창에서 받은 데이터:', msg);
});

// 프로그래밍 방식으로 창 제어
// await nativeWin.focus();
// await nativeWin.setTitle('새로운 타이틀');
// await nativeWin.setSize(1024, 768);
// await nativeWin.close();
```

#### 독립 OS 창 엔트리 스크립트 작성 규격 (`entry: 'subwindow.js'`)
별도 OS 창으로 실행될 스크립트는 `default` 함수 또는 `run` 함수를 export하며, 가벼운 전용 컨텍스트(`NativeSubWindowContext`)를 인자로 받습니다:

```javascript
// plugins/my-plugin/subwindow.js
export default async function(context) {
  // 1. context.container: 별도 OS 창의 전체 화면 루트 DOM 요소
  context.container.innerHTML = `
    <div style="padding: 16px;">
      <h2>🧊 3D 뷰어 독립 윈도우</h2>
      <div id="viewport" style="width: 100%; height: 500px;"></div>
    </div>
  `;

  // 2. context.workspace: 별도 창에서도 Tauri 네이티브 파일 읽기/쓰기 100% 동작
  const folder = context.initialData?.folder;
  if (folder) {
    const iniText = await context.workspace.readTextFile(`${folder}/mod.ini`);
    // ...
  }

  // 3. context.channel: 메인 창과의 실시간 통신
  context.channel.onMessage((data) => {
    if (data.type === 'CHANGE_FOLDER') {
      // 메인 창에서 폴더가 변경되었을 때 실시간 갱신
    }
  });

  // 메인 창으로 데이터 전송
  context.channel.postMessage({ type: 'LOADED', time: Date.now() });

  // 4. context.logger: 별도 창 콘솔 및 메인 에디터 콘솔 패널로 동시 전송
  context.logger.info('독립 3D 뷰어 창이 정상적으로 시작되었습니다.');
}
```

---

### 3.9 기본 폼 컨트롤 및 위젯 팩토리 (`context.ui.*`)

빠르고 일관된 테마 디자인을 위해 내장 컴포넌트 팩토리 메서드를 제공합니다.

> [!TIP]
> **컴포넌트 최상위 엘리먼트 통일 표준 (`.element` 및 `.getElement()`, `context.ui.toElement`)**
> * 모든 UI 빌더 컴포넌트(`createInput`, `createNumberInput`, `createSelect`, `createKeyInput`, `createSplitView`, `createScrollContainer`, `createCard` 등)는 **라벨을 포함한 최상위 DOM 요소를 항상 `.element` 속성 및 `.getElement()` 메서드로 통일 제공**합니다. (기존 `.row`, `.container`도 100% 하위 호환됩니다.)
> * `createRow`, `createColumn`, `createGrid`, `createCard`, `createScrollContainer`의 `children`/`content` 배열에는 DOM 요소뿐만 아니라 **위젯 인스턴스 자체를 그대로 전달**할 수 있습니다. 코어가 `toElement()`를 통해 자동으로 최상위 엘리먼트를 언래핑하여 DOM에 부착합니다.

> [!NOTE]
> **표준 폼 유효성 검사 및 에러 피드백 API (`setError`, `clearError`, `hasError`)**
> * 입력 컴포넌트(`createInput`, `createNumberInput`, `createSelect`, `createKeyInput`, `createSearchInput`, `createFilePicker`)는 모두 표준 에러 검증 메서드를 제공합니다:
>   * `widget.setError('이미 존재하는 섹션명입니다.')`: 필드에 빨간색 테두리와 포커스 링, 하단 경고 메시지(`⚠️`)를 즉시 띄웁니다.
>   * `widget.clearError()`: 에러 상태 및 메시지를 제거하고 원래 스타일로 복원합니다.
>   * `widget.hasError()`: 현재 에러 상태인지 여부(`boolean`)를 확인합니다.

#### 1) 스타일 카드 (`context.ui.createCard`)
제목, 부제목, 상태 배지 및 액션 버튼이 통합된 카드 컨테이너를 생성합니다.
```typescript
const card = context.ui.createCard({
  title: '텍스처 오버라이드 설정',
  subtitle: '캐릭터 텍스처 교체 슬롯 정의',
  badge: { text: '활성', variant: 'success' },
  content: [row1, row2, numInput], // 위젯 인스턴스를 직접 넘겨도 자동 부착!
  actions: [btnEdit, btnDelete],
});
```

#### 2) 버튼, 아이콘 버튼, 토글 버튼 및 액션 행 (`createButton`, `createIconButton`, `createToggleButton`, `createButtonRow`)
테마 일관 스타일의 액션 버튼, 컴팩트 정사각형 아이콘 버튼 및 상태 토글 버튼을 생성합니다.
```typescript
// 1. 기본 액션 버튼 (텍스트 + 내장 아이콘)
const btnSave = context.ui.createButton({
  text: '설정 저장',
  icon: 'check',      // 내장 아이콘 ('refresh', 'plus', 'trash', 'copy', 'check', 'edit', 'folder', 'play', 'settings', 'search', 'close') 또는 커스텀 SVG
  variant: 'primary', // 'primary' | 'secondary' | 'danger' | 'small' | 'ghost'
  onClick: () => saveSettings(),
});

// 2. 텍스트 없는 컴팩트 정사각형 아이콘 버튼 (툴바 / 퀵 액션 전용)
const btnRefresh = context.ui.createButton({
  icon: 'refresh',
  iconOnly: true,
  title: '문서 새로고침 (Ctrl+R)', // 툴팁 및 aria-label 자동 적용
  variant: 'secondary',
  onClick: () => refresh(),
});

// 또는 createIconButton 편의 헬퍼 사용:
const btnDelete = context.ui.createIconButton({
  icon: 'trash',
  title: '섹션 삭제',
  variant: 'danger',
  onClick: () => deleteSection(),
});

// 3. 활성/비활성 상태가 토글되는 버튼 (3D 와이어프레임, 그리드, 자동회전 등에 최적)
const btnWireframe = context.ui.createToggleButton({
  text: '와이어프레임',
  icon: '📐',
  active: false,
  onChange: (isActive) => viewer.setWireframe(isActive),
});
// btnWireframe.setActive(true); // 프로그래밍 방식 상태 전환
// btnWireframe.isActive(); // true/false 반환

const btnRow = context.ui.createButtonRow([btnSave, btnRefresh, btnDelete, btnWireframe]);
```

#### 3) 기본 폼 입력 컨트롤 (`createInput`, `createSelect`, `createCheckbox`, `createSlider`, `createNumberInput`)
라벨이 자동으로 결합된 표준 입력 필드들이며, 에러 피드백(`.setError`) 및 인라인/컴팩트 모드를 지원합니다.
```typescript
// 텍스트 입력창
const nameInput = context.ui.createInput({
  label: '섹션 이름',
  value: 'TextureOverrideBody',
  placeholder: '섹션명 입력',
  onInput: (val) => {
    if (val.includes(' ')) {
      nameInput.setError('섹션명에는 공백이 들어갈 수 없습니다.');
    } else {
      nameInput.clearError();
    }
  },
});

// 드롭다운 선택 필드 (기본 폼 모드)
const selectBox = context.ui.createSelect({
  label: '토글 방식',
  options: [
    { value: 'cycle', label: '순환 (Cycle)' },
    { value: 'hold', label: '홀드 (Hold)' },
  ],
  value: 'cycle',
  onChange: (val) => console.log('선택:', val),
});

// 드롭다운 선택 필드 (툴바 전용 인라인 / 컴팩트 모드)
const axisUpSelect = context.ui.createSelect({
  variant: 'compact', // 또는 inline: true
  prefix: '위',        // 앞쪽에 붙는 컴팩트 태그 배지
  options: ['+Y', '-Y', '+Z', '-Z', '+X', '-X'],
  value: '+Y',
  onChange: (up) => viewer.setUpAxis(up),
});
// axisUpSelect.setOptions(['+Y', '+Z']); // 동적 옵션 교체
// axisUpSelect.setValue('+Z');
```

// 체크박스
const check = context.ui.createCheckbox({
  label: '작업 전 자동 백업 생성',
  checked: true,
  onChange: (checked) => console.log('백업 활성:', checked),
});

// 슬라이더
const slider = context.ui.createSlider({
  label: '불투명도',
  min: 0,
  max: 100,
  value: 80,
  step: 5,
  onChange: (val) => console.log('값:', val),
});

// 스텝퍼 지원 숫자 입력 필드 (마우스 휠, 좌우 증감 버튼, 길게 누르기 연속 증감 지원)
const numInput = context.ui.createNumberInput({
  label: '투명도 (Alpha)',
  value: 0.5,
  min: 0,
  max: 1,
  precision: 2, // 소수점 2자리 제한
  step: 0.05,
  onChange: (val) => console.log('Alpha 변경:', val),
});
// numInput.element; // 최상위 래퍼 (라벨 + 증감 버튼 일체)
// numInput.getValue(); // 0.5
// numInput.setValue(0.8);
// numInput.setError('값은 0 이상이어야 합니다.');
```

#### 4) 상태 배지 및 진행률 표시 바 (`createBadge`, `createProgressBar`)
```typescript
// 상태 배지
const badge = context.ui.createBadge({
  text: '권장',
  variant: 'success', // 'neutral' | 'info' | 'success' | 'warning' | 'danger'
});

// 진행률 표시 바
const progress = context.ui.createProgressBar({
  label: 'DDS 텍스처 디코딩 중…',
  value: 45,
  max: 100,
});
// progress.setProgress(80);
// progress.setLabel('완료 중…');
```

#### 5) 데이터 테이블 (`context.ui.createTable`)
테마 스크롤과 자동 열 정렬을 지원하는 데이터 테이블을 생성합니다.
```typescript
const table = context.ui.createTable({
  headers: ['섹션명', '타입', '단축키', '상태'],
  rows: [
    ['KeyToggleHair', 'cycle', 'VK_F4', '정상'],
    ['KeyToggleDress', 'hold', 'VK_F5', '경고'],
  ],
});

// table.addRow(['KeyToggleShoe', 'cycle', 'VK_F6', '정상']);
// table.setRows([ ... ]);
// table.clear();
```

#### 6) 대화형 콘솔 뷰어 (`context.ui.createConsole`)
실시간 로그 출력 및 명령어 입력을 지원하는 터미널 스타일 뷰어입니다.
```typescript
const consoleView = context.ui.createConsole({
  title: 'Python 빌드 출력',
  placeholder: '로그가 여기에 표시됩니다…',
});

consoleView.append('작업을 시작합니다.\n');
// consoleView.clear();
```

#### 7) 키보드 실시간 감지 단축키 입력 필드 (`context.ui.createKeyInput`)
3DMigoto 전용 단축키 입력 필드로, 실시간 `[⌨️ 감지]` 및 모달 `[키 도우미]` 버튼이 기본 탑재되어 있으며, 화면 표시용 정제(`display`) 및 유효성 검사를 기본 지원합니다.
```typescript
const keyInput = context.ui.createKeyInput({
  label: '토글 키',
  value: 'no_modifiers alt VK_F4',
  onChange: (rawKey, details) => {
    console.log('원문 INI 포맷:', rawKey); // 'no_modifiers alt VK_F4'
    console.log('UI 표시용 포맷:', details?.display); // 'Alt + F4'
  },
});

// keyInput.element; // 최상위 DOM 래퍼 (라벨 + 입력필드 + 감지 버튼 일체)
// keyInput.getValue(); // 'no_modifiers alt VK_F4'
// keyInput.getDisplayValue(); // 'Alt + F4' (부정키가 제거된 깔끔한 표시용 문자열)
// keyInput.setValue('ctrl no_alt no_shift VK_F1');
// keyInput.setError('이미 사용 중인 단축키입니다.');
// keyInput.clearError();
```

---

### 3.8 스플릿 뷰 및 레이아웃 컨테이너 (`context.ui.*`)

플러그인 탭이나 사이드바에서 복잡한 다분할 레이아웃을 손쉽게 구성할 수 있도록 분할 패널과 레이아웃 컴포넌트를 제공합니다.

#### A. 리사이저블 스플릿 뷰 (`context.ui.createSplitView`)
마우스 드래그로 실시간 크기를 조절할 수 있는 분할 뷰입니다. 가로(좌우) 및 세로(상하) 분할을 지원하며, 사용자가 조절한 크기를 `localStorage`에 자동 영구 보존할 수 있습니다.
`firstPane`과 `secondPane` 및 루트 컨테이너, 리사이저 바 모두 코어 차원에서 `display: flex; height: 100%; flex: 1 1 0%; align-items: stretch; overflow: hidden; min-height: 0;`가 기본 보장되어, 내부 내용물 분량에 관계없이 뷰포트나 탭 패널 전체 높이에 맞추어 완벽하게 늘어납니다.

```typescript
const split = context.ui.createSplitView({
  direction: 'horizontal', // 'horizontal' (좌우 분할) | 'vertical' (상하 분할)
  initialSize: 260,        // 초기 크기 (숫자 px, '260px', '40%' 등)
  minFirstSize: 120,       // 첫 번째 패널 최소 크기 (px)
  minSecondSize: 150,      // 두 번째 패널 최소 크기 (px)
  resizable: true,         // 드래그 조절 지원 (더블 클릭 시 기본값 복원)
  storageKey: 'my_plugin_split_width', // 사용자 조절 크기 자동 저장/복원
  onResize: (firstSize, secondSize) => {
    console.log(`패널 크기 변경됨: ${firstSize}px / ${secondSize}px`);
  },
});

// 패널에 요소 추가
split.firstPane.append(leftSidebarContent);
split.secondPane.append(rightMainContent);

// 프로그래밍 방식 크기 제어
split.setSize(300);
console.log('현재 크기:', split.getSize());
// split.reset(); // 초기 크기로 복원

container.append(split.container);
```

#### B. 가로/세로 Flexbox 컨테이너 (`context.ui.createRow`, `context.ui.createColumn`)
복잡한 CSS 없이 일관된 간격(`gap`)과 정렬을 갖춘 유연한 레이아웃을 구성합니다.

```typescript
// 가로 배치 (Row)
const toolbar = context.ui.createRow({
  gap: 8,
  align: 'center',         // 'start' | 'center' | 'end' | 'stretch'
  justify: 'space-between', // 'start' | 'center' | 'end' | 'space-between'
  wrap: true,              // flex-wrap
  children: [btnRefresh, btnApply, searchInput],
});

// 세로 배치 (Column)
const formCol = context.ui.createColumn({
  gap: 12,
  align: 'stretch',
  fill: true, // 남은 세로 영역을 채우고 min-height: 0, overflow: hidden을 자동 적용하여 내부 createScrollContainer 및 createTabs의 스크롤바 작동 보장
  children: [headerEl, card1, card2],
});
```

#### C. 그리드 레이아웃 (`context.ui.createGrid`)
다단 카드나 버튼 매트릭스를 구성할 때 사용합니다.

```typescript
const grid = context.ui.createGrid({
  columns: 2, // 열 개수 (또는 'repeat(auto-fit, minmax(140px, 1fr))')
  gap: 10,
  children: [item1, item2, item3, item4],
});
```

#### D. 구분선 (`context.ui.createDivider`)
```typescript
const hDivider = context.ui.createDivider(); // 가로 구분선
const vDivider = context.ui.createDivider({ vertical: true, margin: 8 }); // 세로 구분선
```

#### E. 테마 일관 스크롤 컨테이너 (`context.ui.createScrollContainer`)
미고토 스튜디오의 슬림한 다크/라이트 테마 스크롤바와 상/하단 스크롤 제어 메서드를 제공하는 스크롤 영역입니다.
코어 차원에서 `flex: 1 1 0%`, `min-height: 0`, `height: 100%` 및 테마 WebKit 스크롤바가 기본 내장되어 있어, 별도의 보조 CSS나 `!important` 지정 없이도 탭/스플릿 뷰 내부에서 뷰포트에 맞추어 자연스럽게 스크롤바가 표시됩니다.

```typescript
const scroll = context.ui.createScrollContainer({
  direction: 'vertical', // 'vertical' | 'horizontal' | 'both' (기본: 'vertical')
  maxHeight: 400,        // 최대 높이 (생략 시 flex: 1 1 0% 및 height: 100% 자동 적용)
  autoScroll: true,      // append 시 자동으로 스크롤 하단 이동
});

scroll.append(logItem1, logItem2);
// scroll.scrollToTop(true);    // 부드러운 상단 스크롤
// scroll.scrollToBottom(true); // 부드러운 하단 스크롤
// scroll.clear();              // 내용 비우기

container.append(scroll.container);
```

#### F. 상단 툴바 / 액션 바 (`context.ui.createToolbar`)
서브창이나 뷰어 상단에 좌측 타이틀, 중앙 제어부, 우측 액션 버튼들을 한 줄로 깔끔하게 배치할 수 있는 전용 툴바 컨테이너입니다.
```typescript
const toolbar = context.ui.createToolbar({
  left: [
    titleSpan,
    context.ui.createBadge({ text: '3D 뷰어', variant: 'accent' }),
  ],
  center: [
    axisUpSelect,      // 컴팩트 셀렉트
    axisForwardSelect,
  ],
  right: [
    btnWireframe,      // 상태 토글 버튼
    btnGrid,
    btnRotate,
    btnResetCam,
  ],
});

// 프로그래밍 방식으로 동적 항목 추가/제거
// toolbar.appendRight(btnReload);
// toolbar.clearLeft();
// container.append(toolbar.element); // .getElement() 지원
```

#### G. 하단 상태 표시줄 (`context.ui.createStatusBar`)
서브창이나 패널 하단에 실시간 수치(정점, 삼각형 수, 파츠 등)와 상태 메시지를 표시하고, 60fps로 즉시 갱신할 수 있는 하단 바입니다.
```typescript
const statusbar = context.ui.createStatusBar({
  items: [
    { id: 'vertex', label: '버텍스', value: '70,511' },
    { id: 'tris', label: '삼각형', value: '35,000' },
    { id: 'parts', label: '파츠', value: '12개' },
  ],
  rightItems: [
    { id: 'status', label: '상태', value: '준비 완료' },
  ],
});

// 고속 실시간 수치 갱신 (60fps DOM 부하 없음)
statusbar.setValue('tris', '42,000 / 70,000');
statusbar.setLabel('tris', '활성 폴리곤');
// statusbar.setItemVisible('parts', false); // 보이기/숨기기
// container.append(statusbar.element); // .getElement() 지원
```

---

### 3.9 키 바인딩 설정 모달 대화상자 (`context.ui.openKeyBindingModal`)

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

### 3.10 고급 확장 UI 컴포넌트 (`context.ui.*`)

플러그인 화면을 데스크톱 네이티브 앱 수준의 고품질 UI로 쉽게 빌드할 수 있도록 탭 네비게이션, 아코디언, 세그먼트 컨트롤, 실시간 디바운스 검색창, 파일 선택기, 툴팁, 파일 드롭존 등의 확장 컴포넌트를 제공합니다.

#### A. 인라인 탭 네비게이션 (`context.ui.createTabs`)
플러그인 탭이나 패널 내부에서 섹션별 서브 화면을 전환할 수 있는 탭 네비게이션입니다.
탭 컨테이너와 내부 패널 모두 `flex: 1 1 0%`, `min-height: 0`, `height: 100%`, `overflow: hidden`이 적용되어 있어, 각 패널 내부에 `createScrollContainer`나 `createSplitView`를 배치했을 때 무한히 늘어나지 않고 뷰포트에 맞추어 자연스럽게 스크롤바가 작동합니다.

```typescript
const tabs = context.ui.createTabs({
  tabs: [
    { id: 'settings', label: '설정', icon: '⚙️', content: settingsEl },
    { id: 'logs', label: '로그', icon: '📜', badge: '3', content: logsEl },
    { id: 'advanced', label: '고급', content: advancedEl },
  ],
  defaultTab: 'settings',
  onChange: (tabId) => {
    console.log('선택된 탭:', tabId);
  },
});

// 프로그래밍 방식 탭 제어
tabs.switchTab('logs');
tabs.setTabBadge('logs', '5'); // 배지 업데이트 (생략 시 숨김)
tabs.setTabDisabled('advanced', true); // 탭 비활성화

container.append(tabs.container);
```

#### B. 접기/펼치기 아코디언 (`context.ui.createCollapsible`)
설정 그룹, 하위 옵션 등을 깔끔하게 접거나 펼칠 수 있는 아코디언 컴포넌트입니다.

```typescript
const section = context.ui.createCollapsible({
  title: '고급 그래픽 설정',
  subtitle: '텍스처 오버라이드 및 셰이더 세부 옵션',
  defaultOpen: false,
  badge: { text: '실험적', variant: 'warning' }, // 'neutral'|'info'|'success'|'warning'|'danger'
  content: [opt1, opt2, opt3],
  onToggle: (isOpen) => {
    console.log('접힘 상태:', isOpen);
  },
});

// 프로그래밍 방식 제어
// section.open();
// section.close();
// section.toggle();
// section.setTitle('새 제목');

container.append(section.container);
```

#### C. 세그먼트 컨트롤 (`context.ui.createSegmentedControl`)
라디오 버튼보다 직관적인 알약(Pill) 스타일의 옵션 선택 버튼 그룹입니다 (예: 순환/홀드 모드, 테마 선택).

```typescript
const modeControl = context.ui.createSegmentedControl({
  label: '토글 동작 방식',
  options: [
    { value: 'cycle', label: '순환 (Cycle)', icon: '🔄' },
    { value: 'hold', label: '홀드 (Hold)', icon: '⏱️' },
  ],
  value: 'cycle',
  onChange: (val) => {
    console.log('선택된 모드:', val);
  },
});

// modeControl.setValue('hold');
// modeControl.setDisabled(true);

container.append(modeControl.row);
```

#### D. 실시간 디바운스 검색 입력창 (`context.ui.createSearchInput`)
검색 아이콘, 실시간 타이핑 디바운스(200ms 기본), 원클릭 내용 지우기(✕) 버튼이 내장된 검색창입니다.

```typescript
const search = context.ui.createSearchInput({
  placeholder: '섹션 또는 변수명 검색…',
  debounceMs: 250,
  onSearch: (query) => {
    filterList(query);
  },
  onClear: () => {
    filterList('');
  },
});

// search.setValue('TextureOverride', true); // 두 번째 인자가 true이면 검색 콜백 즉시 실행
// search.clear();
// search.focus();

container.append(search.container);
```

#### E. 파일 경로 선택기 (`context.ui.createFilePicker`)
경로 입력 필드와 [찾아보기…] 버튼이 결합된 위젯입니다. 플랫폼 네이티브 파일 열기 대화상자와 자동 연동됩니다.

```typescript
const picker = context.ui.createFilePicker({
  label: '텍스처 파일 경로',
  placeholder: 'DDS 또는 PNG 파일 선택',
  onChange: (path) => {
    console.log('선택된 경로:', path);
  },
  // 커스텀 대화상자 로직이 필요한 경우 onBrowse 지정 (생략 시 기본 platform().pickOpen() 연동)
  // onBrowse: async () => { ... return filePath; }
});

// picker.setValue('d:/mods/character/diffuse.dds');
container.append(picker.row);
```

#### F. 동적 플로팅 툴팁 (`context.ui.attachTooltip`)
임의의 HTML 요소에 마우스 호버 시 자연스럽게 나타나는 테마 툴팁을 연결합니다.

```typescript
const helpBtn = context.ui.createButton({ text: '?', variant: 'small' });

// 단순 텍스트 툴팁
const detach = context.ui.attachTooltip(helpBtn, '3DMigoto 가상 키 코드를 선택하는 도움말 창을 엽니다.');

// 옵션 지정 툴팁 (상/하/좌/우 위치, 지연 시간)
context.ui.attachTooltip(helpBtn, {
  text: '현재 파일의 백업 기록을 확인합니다.',
  position: 'top', // 'top' | 'bottom' | 'left' | 'right'
  delayMs: 150,
});

// 해제 시: detach();
```

#### G. 파일 드래그 & 드롭 영역 (`context.ui.createDropZone`)
외부 파일(DDS 텍스처, INI 파일, 스크립트 등)을 마우스로 끌어다 놓을 수 있는 점선 하이라이트 드롭 영역입니다.

```typescript
const dropZone = context.ui.createDropZone({
  label: 'DDS 텍스처 또는 INI 파일을 이곳에 드롭하세요',
  sublabel: '또는 클릭하여 파일 탐색기 열기',
  accept: ['.dds', '.ini', '.txt'], // 지원 확장자 필터
  onDrop: (files) => {
    console.log('드롭된 파일 목록:', files);
    files.forEach((f) => processFile(f));
  },
});

container.append(dropZone.container);
```

#### H. 숫자 입력 스텝퍼 (`context.ui.createNumberInput`)
브라우저 기본의 미세한 스핀 버튼 대신 입력 필드 좌우 양쪽에 큼직한 조절 버튼(`◀`, `▶`)이 배치된 숫자 입력 위젯입니다.
마우스 클릭 및 길게 누르기(Hold to step), 키보드 방향키(`↑`/`↓`), Shift(10배), Alt(0.1배) 조절을 완벽하게 지원하며, 정수 전용 제한(`integerOnly`) 및 소수점 자릿수 포맷팅(`precision`)을 제공합니다.

```typescript
const numStepper = context.ui.createNumberInput({
  label: '상태 개수',
  value: 2,
  min: 1,
  max: 10,
  step: 1,
  integerOnly: true,      // 정수 전용 제한 (소수점 입력 방지)
  // precision: 2,        // 실수인 경우 소수점 자릿수 포맷팅 (예: 0.50)
  clampOnBlur: true,      // 포커스 벗어날 시 min/max 범위로 자동 보정 (기본: true)
  onChange: (val) => {
    console.log('변경된 숫자값:', val);
  },
});

container.append(numStepper.row); // label이 있으면 row, 없으면 container

// 값 제어 및 변경
numStepper.setValue(3);
console.log('현재 값:', numStepper.getValue()); // 3
numStepper.setMin(1);
numStepper.setMax(8);
numStepper.setDisabled(false);
// numStepper.destroy();   // 컴포넌트 해제 시 타이머 정리 (선택 사항)
```

#### I. 인라인 배지 위젯 (`context.ui.createBadge`)
단축키(`VK_F4`), 조건문(`$arm == 0`), 상태값 등을 깔끔한 고정폭(monospace) 폰트와 테마 배지로 표시합니다.

```typescript
// 1. 단순 텍스트로 생성
const simpleBadge = context.ui.createBadge('$hair == 1');

// 2. 옵션 및 색상 테마(variant) 지정
const statusBadge = context.ui.createBadge({
  text: '상시 렌더링',
  variant: 'muted', // 'accent' | 'muted' | 'success' | 'warning' | 'danger' | 'info'
  icon: '⚡',
  monospace: true,
});

// 프로그래밍 방식 동적 변경
statusBadge.setText('$outfit == 2');
statusBadge.setVariant('accent');

container.append(statusBadge.element);
```

#### J. 복사 기능 내장 코드 블록 (`context.ui.createCodeBlock`)
INI 파일에 삽입될 코드나 결과 미리보기를 위한 코드 블록입니다. 테마 다크 배경, 가로 스크롤, 그리고 원클릭 클립보드 복사 버튼이 기본 내장되어 있습니다.

```typescript
const codePreview = context.ui.createCodeBlock({
  code: '[TextureOverrideDress]\nhash = abcdef12\nrun = CommandList\\Dress\\Draw',
  language: 'ini',
  copyable: true,   // 우측 상단 '복사' 버튼 자동 탑재 (기본값: true)
  maxHeight: 250,   // 최대 높이 제한 (스크롤 지원)
});

// 내용 실시간 갱신
codePreview.setCode('$\dress = 1');
console.log(codePreview.getCode());

container.append(codePreview.container);
```

#### K. 표준 리스트 아이템 (`context.ui.createListItem`)
모딩 도구의 좌측 토글 목록, 메쉬 부위 목록, 드로우콜 목록 등을 단 한 줄로 구현할 수 있는 고수준 리스트 아이템 컴포넌트입니다. 마우스 호버, 선택 시 하이라이트 테두리, 제목/부제목 2행 구조, 우측 배지 및 커스텀 액션 버튼을 기본 탑재합니다.

```typescript
const item = context.ui.createListItem({
  title: '머리 파트 (부위 #1)',
  subtitle: 'drawindexed = auto · match_first_index: 0',
  badge: {
    text: '$hair == 1',
    variant: 'accent',
  },
  selected: true, // 선택 상태 하이라이트 테두리 적용
  onClick: () => {
    selectPart('hair');
  },
});

// 동적 제어
item.setSelected(false);
item.setTitle('몸체 파트');
item.setSubtitle('상시 표시');
item.setBadge({ text: '상시', variant: 'muted' });

container.append(item.element);
```

#### L. 커스텀 모달 다이얼로그 (`context.ui.createModal`)
플러그인 설정, 해시 스킵 섹션 추가 폼, 확인/취소 팝업 등 플로팅 다이얼로그 창을 손쉽게 생성합니다. 배경 딤(`backdrop`), ESC 키 및 배경 클릭 자동 닫기, 반응형 너비(`small` 360px, `medium` 480px, `large` 640px 또는 직접 지정), 하단 액션 버튼 행을 표준 탑재합니다.

```typescript
const modal = context.ui.createModal({
  title: '해시 스킵 섹션 추가',
  description: '특정 부위를 투명화/제거하기 위한 섹션을 등록합니다.',
  width: 'medium', // 'small' | 'medium' | 'large' | 500 | '500px'
  closeOnBackdrop: true,
  closeOnEsc: true,
  content: formContainer,
  actions: [
    context.ui.createButton({
      text: '취소',
      variant: 'ghost',
      onClick: () => modal.close(),
    }),
    context.ui.createButton({
      text: '추가',
      variant: 'primary',
      onClick: () => {
        saveSection();
        modal.close();
      },
    }),
  ],
  onOpen: () => console.log('모달 열림'),
  onClose: () => console.log('모달 닫힘'),
});

modal.open();
// modal.close();
// modal.isOpen();
// modal.setTitle('새 제목');
// modal.setDescription('새 설명');
// modal.setContent(newContent);
```

#### M. 다중 / 단일 선택 칩 그룹 (`context.ui.createChipGroup`)
태그 필터링, 활성 부위 다중 선택, 토글 상태 그룹 선택 등에 최적화된 칩/배지 버튼 그룹입니다. `multiple: true`로 다중 선택 태그 모드를 켜거나, `multiple: false`로 단일 라디오/세그먼트 칩 모드로 작동할 수 있습니다.

```typescript
// 다중 선택 태그 칩
const tagGroup = context.ui.createChipGroup({
  label: '적용 부위',
  multiple: true,
  options: [
    { value: 'head', label: '머리' },
    { value: 'body', label: '몸체' },
    { value: 'dress', label: '의상' },
    { value: 'extra', label: '장신구', disabled: true },
  ],
  value: ['head', 'body'],
  onChange: (selectedValues) => {
    console.log('선택된 부위:', selectedValues); // ['head', 'body']
  },
});

// 단일 선택 세그먼트 칩
const modeGroup = context.ui.createChipGroup({
  label: '표시 모드',
  multiple: false,
  variant: 'compact',
  options: ['전체', '활성만', '비활성만'],
  value: '전체',
  onChange: (selected) => console.log('선택 모드:', selected),
});

// 동적 제어
tagGroup.setValue(['head']);
console.log(tagGroup.getValue()); // ['head']

// 에디터 테마 조회 및 변경 감지 ('dark' | 'light')
const theme = context.ui.getTheme();
const unlistenTheme = context.ui.onDidChangeTheme(({ theme }) => {
  console.log('테마 변경됨:', theme);
});
// unlistenTheme();
```

---

### 3.11 플러그인 레이아웃 및 폼 반응형 표준 규칙 (코어 기본 탑재)

Migoto Studio 코어 UI 빌더는 플러그인 개발자가 불필요한 인라인 CSS 보정 코드를 작성하지 않아도 데스크톱 네이티브 수준의 견고한 반응형 레이아웃을 유지할 수 있도록 아래 규칙을 기본 탑재합니다:

1. **Flex & Split 계층의 높이 100% 자동 방어**:
   - `createSplitView`의 컨테이너 및 좌/우(`firstPane`, `secondPane`) 패널, `createTabs`의 탭 패널 컨테이너는 기본적으로 `height: 100%; min-height: 0; min-width: 0; overflow: hidden; display: flex; flex-direction: column;`가 강제 적용됩니다.
   - 스플릿 내부나 탭 내부에 `createScrollContainer`나 `createColumn`을 배치해도 높이가 0으로 찌그러지지 않고 뷰포트에 맞추어 자연스럽게 스크롤바가 작동합니다.
2. **모든 폼 컨트롤의 너비 100% 자동 반응 (`min-width: 0`)**:
   - `createSelect`, `createInput`, `createNumberInput`, `createSearchInput` 등 모든 폼 위젯의 외곽 래퍼 및 내부 입력 엘리먼트에 `width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; text-overflow: ellipsis;`가 기본 내장됩니다.
   - 좁은 스플릿 패널이나 `createRow` 내부에 배치해도 내용물의 긴 텍스트로 인해 부모 너비를 뚫고 나가 옆 요소를 찌그러뜨리지 않습니다.
3. **컴포넌트 외곽 마진 제로화 (Gap 기반 정렬 표준화)**:
   - 모든 위젯은 기본적으로 `margin: 0`을 유지합니다. 요소 간의 상하/좌우 여백은 부모 컨테이너(`createColumn({ gap: 8 })`, `createRow({ gap: 6 })`)의 `gap` 속성에 의해서만 일관되게 제어되므로, 패널 최상단에 위젯을 단독 배치했을 때 상단이 불필요하게 붕 뜨는 현상이 원천 차단됩니다.
4. **위젯 DOM 일관성 (모든 create... 함수의 HTMLElement 직접 반환 및 toElement 제거)**:
   - 모든 UI 빌더 함수(`createButton`, `createInput`, `createSelect`, `createModal`, `createChipGroup` 등)가 반환하는 인스턴스는 최상위 `HTMLElement`를 직접 상속/확장(`Object.assign`)합니다.
   - 따라서 별도로 `.element`나 `.toElement()`를 추출할 필요 없이 `container.append(widget)`처럼 네이티브 DOM 함수에 그대로 전달할 수 있습니다. (기존 `.element`, `.getElement()` 속성 또한 100% 호환성 유지)

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

// 9. INI 심볼(변수, 리소스, CommandList, 섹션) 고속 구조 분석
const symbols = context.ini.extractSymbols();
// {
//   variables: { "swapvar": "초기값: 0", "skin": "[Constants] 초기값: 1" },
//   resources: ["ResourceTextureBody", "ResourceBuffer"],
//   commandLists: ["CommandListSwap"],
//   sections: ["Constants", "KeyToggleDress", ...]
// }

// 10. 원본 파싱 및 수동 병합
const doc = context.ini.parse();
const kind = context.ini.classifySection('TextureOverrideBody');
const merged = context.ini.merge(currentTargetText, newSectionText, { appendNew: true });

// 11. 화면 표시용 단축키 변환 (부정키 제거 및 깔끔한 조합 표기)
const displayKey = context.ini.formatDisplayKey('no_modifiers alt VK_F4');
// 'Alt + F4'
const customDisplay = context.ini.formatDisplayKey('ctrl no_alt no_shift VK_F1');
// 'Ctrl + F1'

// 12. 중복 키 / if-endif 조건문 / 주석 보존 원본 섹션 조작 (Raw Section API)
// 딕셔너리({ key: val }) 구조로 다 담기 어려운 다중 drawindexed나 주석, if문 구조를 그대로 읽고 수정합니다.
const rawBlock = context.ini.getSectionRaw('TextureOverrideBody');
// [TextureOverrideBody]
// hash = abcdef12
// match_first_index = 0
// drawindexed = auto
// match_first_index = 100
// drawindexed = auto

// 섹션 라인 단위 구조 파싱
const lines = context.ini.parseSectionLines('TextureOverrideBody');
// [
//   { type: 'property', key: 'hash', value: 'abcdef12', isProperty: true, raw: 'hash = abcdef12' },
//   { type: 'property', key: 'match_first_index', value: '0', isProperty: true, ... },
//   { type: 'property', key: 'drawindexed', value: 'auto', isProperty: true, ... },
//   ...
// ]

// 기존 주석/라인 배치를 온전히 유지한 채 에디터의 해당 섹션만 통째로 제자리 교체 (실행 취소 Ctrl+Z 보존)
context.ini.setSectionRaw('TextureOverrideBody', `[TextureOverrideBody]\nhash = abcdef12\nmatch_first_index = 0\ndrawindexed = auto`);
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

// 인라인 변경 제안 및 사용자 검토 (수락/되돌리기 지원)
const result = await context.editor.proposeChanges(newIniText);

if (result.accepted) {
  context.ui.showToast('변경사항이 적용되었습니다.', 'info');
} else {
  context.ui.showToast('변경이 취소되고 원래 코드로 복구되었습니다.', 'warn');
}
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

## 8.1 콘솔 로깅 API (`context.logger`)

플러그인 실행 중 발생하는 동작 상태, 진행 정보, 경고 및 오류 데이터를 에디터 하단의 **[출력 콘솔]**(`Ctrl+\``) 창에 실시간으로 전송합니다.  
각 로그에는 자동으로 해당 플러그인의 식별 태그(`[Plugin: 플러그인명]`)가 부착되며, 타임스탬프, 로그 레벨별 배지, 객체 펼쳐보기, 소스/레벨별 필터링, 클립보드 복사를 지원합니다.

```typescript
// 1. 일반 정보 로그
context.logger.info('INI 모드 분석 완료', { sectionCount: 12 });

// 2. 경고 로그
context.logger.warn('일부 텍스처 해시 파일이 누락되었습니다.', missingList);

// 3. 에러 로그 (Error 객체 및 스택 트레이스 자동 지원)
try {
  runTask();
} catch (err) {
  context.logger.error('외부 스크립트 실행 실패:', err);
}

// 4. 디버그 로그
context.logger.debug('파싱 내부 파라미터:', intermediateData);
```

> **콘솔창 접근성**: 사용자는 상단 메뉴 **[보기] -> [콘솔창 보기]**, 단축키 **`Ctrl+\``**, 또는 하단 상태바의 **[콘솔]** 버튼을 통해 언제든지 콘솔 창을 열고 닫을 수 있습니다.

---

## 9. 린터 및 템플릿 확장 API (`context.linter`, `context.templates`)

Migoto Studio의 코어 린터 및 코드 템플릿 제안을 플러그인에서 동적으로 확장할 수 있습니다.

### 9.1 허용 리소스 및 변수 화이트리스트 등록 (`context.linter`)

특정 게임 프레임워크(ZZMI, GIMI 등)나 전용 라이브러리(TTL 등)에서 사용되는 고유 커맨드리스트, 슬롯 리소스, 변수를 등록하여 미정의 오류/경고 없이 정상 문법으로 인식하도록 합니다.
문자열, 정규식, 또는 콜백 함수(`(name: string) => boolean`)를 전달할 수 있으며, 반환되는 정리 함수(`() => void`)를 호출하면 등록이 해제됩니다.

```typescript
// 1. 특정 커맨드리스트 및 리소스 허용
context.linter.registerAllowedResource('CommandList\\ZZMI\\SetTextures');
context.linter.registerAllowedResource(/^commandlist\\ttl\\/i);
context.linter.registerAllowedResource(/^resource\\ttl\\/i);

// 2. 전용 변수 허용 ($\TTL\alpha, $\TTL\_1 등)
context.linter.registerAllowedVariable((name: string) => {
  const norm = name.toLowerCase().replace(/^[\\$]+/, '');
  return norm.startsWith('ttl\\');
});
context.linter.registerAllowedVariable(/^\\?ttl\\/i);

// 3. 미사용(Unused) 경고 방지 등록
context.linter.registerAllowedUsedVariable(/^\\?ttl\\/i);
context.linter.registerAllowedUsedResource(/^resource\\ttl\\/i);
```

### 9.2 커스텀 린트 규칙 등록 (`context.linter.registerRule`)

에디터 검사 시 실시간으로 실행될 커스텀 린트 검사 로직을 추가합니다:

```typescript
context.linter.registerRule({
  id: 'my-custom-check',
  name: '모드 리소스 무결성 검사',
  run: (iniDoc, ctx) => {
    const diagnostics = [];
    // 검사 로직 작성 후 Diagnostic 객체 반환
    return diagnostics;
  },
});
```

### 9.3 사후 진단 필터링 및 보정 (`context.linter.registerDiagnosticFilter`)

플러그인 간의 **완전한 상호 독립성**을 유지하면서 도메인별 특수 문법을 유연하게 보정하기 위해, 린터 실행 파이프라인의 최종 단계에서 진단 마커를 필터링하는 API입니다.

예를 들어, 범용 XXMI 린터(`custom-lint`)는 모드 폴더 내 `namespace = TTL` 선언이 없으면 독립적으로 네임스페이스 부재 경고를 발생시킵니다. 이때 도메인 전용 플러그인(`zzmi-support`)은 `custom-lint`에 직접 결합되지 않고, `registerDiagnosticFilter`를 등록하여 해당 경고가 ZZMI 표준 내장 라이브러리(TTL 등)에 부합하는 경우 사후에 이를 가로채어 정상 코드로 보정(억제)합니다.

```typescript
const unregister = context.linter.registerDiagnosticFilter((diag, ctx) => {
  const msg = diag.message || '';

  // TTL 관련 네임스페이스 경고나 미선언 변수 경고를 정상 코드로 보정하여 억제
  if (msg.includes("'TTL'") || msg.includes("'ttl'")) {
    return false; // false를 반환하면 진단 마커가 제거됩니다.
  }
  if (/\bttl[\\_]/i.test(msg) || /\$?\\?ttl\\/i.test(msg)) {
    return false;
  }

  // 그 외 일반 경고는 유지
  return true;
});

// 필요 시 등록 해제
// unregister();
```

- **파라미터**:
  - `diag`: Monaco 진단 마커 객체 (`message`, `startLineNumber`, `startColumn`, `endLineNumber`, `endColumn`, `severity`)
  - `ctx`: 검사 컨텍스트 (`model`: 현재 에디터 텍스트 모델)
- **반환값**: `boolean` (`true`: 마커 유지, `false`: 마커 억제/제거)
- **생명주기**: 플러그인이 언로드되거나 비활성화될 때 자동으로 정리됩니다.

### 9.4 커스텀 코드 템플릿 등록 (`context.templates.registerTemplate`)

Monaco 에디터에서 `[` 입력 시 노출되는 인라인 자동완성 템플릿 또는 템플릿 패널에 새 코드 스니펫을 등록합니다:

```typescript
context.templates.registerTemplate({
  id: 'zzmi_ttl_draw',
  title: 'ZZMI TTL 투명도 드로우 (단일 투명도)',
  description: '텍스처 없이 지정한 알파 값으로 반투명을 렌더링하는 TTL 기본 드로우 구문',
  category: 'zzmi',
  snippet: [
    '; --- ZZMI TTL Transparency Draw ---',
    '$\\TTL\\alpha = ${1:0.5}',
    'run = CommandList\\TTL\\Draw',
  ].join('\n'),
});
```

---

## 10. 실전 예제

### 10.1 단일 파일 플러그인 예제

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

### 10.2 다중 파일 모듈 분할 예제 (Multi-File Plugins)

번들러 빌드 없이 코드를 기능별로 분할하여 작성할 수 있습니다.

#### `plugin.json`
```json
{
  "id": "multi-file-sample",
  "name": "다중 파일 샘플 플러그인",
  "version": "1.0.0",
  "description": "Virtual Module Linker로 연동되는 다중 파일 플러그인 예제입니다.",
  "author": "Modder",
  "icon": "🧩",
  "category": "tools",
  "main": "index.js"
}
```

#### `constants.js`
```javascript
export const DEFAULT_SECTION = 'KeyToggleOutfit';
export const DEFAULT_KEY = 'VK_F4';
export const DEFAULT_TYPE = 'cycle';
```

#### `config.json`
```json
{
  "themeColor": "#3b82f6",
  "maxStates": 4
}
```

#### `style.css`
```css
.sample-card-title {
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 8px;
}
.sample-badge {
  background: var(--bg-card);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}
```

#### `ui.js`
```javascript
import { DEFAULT_SECTION, DEFAULT_KEY, DEFAULT_TYPE } from './constants.js';
import config from './config.json';
import './style.css'; // 플러그인 로드 시 자동 스타일 주입

export function openSampleTab(context) {
  context.ui.openFormTab({
    id: 'sample-form-tab',
    title: '샘플 폼 마법사',
    icon: '🧩',
    config: {
      title: '다중 파일 토글 키 생성기',
      description: `기본 상태 개수: ${config.maxStates}개`,
      fields: [
        { id: 'section', label: '섹션명', type: 'text', default: DEFAULT_SECTION, required: true },
        { id: 'key', label: '토글 키', type: 'key', default: DEFAULT_KEY, required: true },
        { id: 'type', label: '모드', type: 'select', default: DEFAULT_TYPE, options: ['cycle', 'hold'] },
      ],
      onSubmit: (values) => {
        context.ini.upsertSection(values.section, {
          key: values.key,
          type: values.type,
        });
        context.ui.showToast(`[${values.section}] 섹션이 저장되었습니다!`, 'info');
      },
    },
  });
}
```

#### `index.js`
```javascript
import { openSampleTab } from './ui.js';

export default {
  activate(context) {
    context.ui.registerMenuItem({
      label: '다중 파일 샘플 열기',
      shortcut: 'Ctrl+Shift+U',
      action: () => {
        openSampleTab(context);
      },
    });

    context.ui.showToast(`${context.manifest.name} 활성화 완료!`, 'info');
  },

  deactivate() {
    console.log('샘플 플러그인 비활성화');
  },
};
```

---

## 11. 플러그인 설치 및 배포

### 1) 데스크톱 환경 직접 복사
1. 액티비티 바 하단 **[플러그인]** 탭(`Ctrl+Shift+P`)으로 이동합니다.
2. 상단 액션 바의 **[플러그인 폴더 열기]** 버튼을 클릭합니다.
3. 열린 폴더(`%APPDATA%\MigotoStudio\plugins\`) 아래에 플러그인 폴더(예: `my-plugin/`)를 생성하고 `plugin.json`과 `index.js`(다중 파일 플러그인인 경우 관련 파일들 모두)를 복사합니다.
4. 플러그인 관리자에서 새로고침하거나 플러그인을 활성화합니다.

### 2) `.zip` 압축 파일로 설치
1. 플러그인 폴더 내부 파일들(`plugin.json`, `index.js`, 서브 모듈 파일들)이 루트에 오도록 `.zip`으로 압축합니다.
2. 플러그인 관리 상단의 **[플러그인 설치]** 버튼을 눌러 해당 `.zip` 파일을 선택하면 즉시 설치 및 활성화됩니다. (데스크톱 및 웹 환경 모두 지원)

---

## 12. AI 코딩 어시스턴트 활용 (ChatGPT / Claude / Cursor)

다른 AI(ChatGPT, Claude, Cursor 등)에게 Migoto Studio 플러그인 개발을 요청할 때는 [`docs/AGENTS.md`](./AGENTS.md) 지침서를 시스템 프롬프트로 제공하세요.
내부 코드를 일일이 설명할 필요 없이 선언형 폼 빌더(`openFormTab`)와 `context.ini` API, 그리고 가상 모듈 링커 기반 다중 파일 구조를 활용한 고품질 플러그인을 단번에 작성할 수 있습니다.


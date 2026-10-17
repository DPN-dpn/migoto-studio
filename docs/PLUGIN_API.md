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

### 3.7 UI 빌더 헬퍼 함수 (`context.ui.*`)

빠르고 일관된 테마 디자인을 위해 내장 컴포넌트 팩토리 메서드를 제공합니다.

- `context.ui.createForm(config)`: 고수준 선언형 폼 컴포넌트 생성 (`getValues()`, `setValues()`, `reset()`)
- `context.ui.createKeyInput(options)`: 3DMigoto 전용 키 캡처 입력기 위젯 ([키 감지] 및 [키 도우미] 버튼 내장)
- `context.ui.createCard(options)`: 헤더/설명/액션 버튼이 포함된 스타일 카드
- `context.ui.createButton(options)`: 일관된 스타일의 버튼 생성
- `context.ui.createInput(options)`: 텍스트 입력 필드
- `context.ui.createSelect(options)`: 드롭다운 선택 필드
- `context.ui.createCheckbox(options)`: 체크박스
- `context.ui.createSlider(options)`: 슬라이더
- `context.ui.createBadge(text, color)`: 배지

---

### 3.8 스플릿 뷰 및 레이아웃 컨테이너 (`context.ui.*`)

플러그인 탭이나 사이드바에서 복잡한 다분할 레이아웃을 손쉽게 구성할 수 있도록 분할 패널과 레이아웃 컴포넌트를 제공합니다.

#### A. 리사이저블 스플릿 뷰 (`context.ui.createSplitView`)
마우스 드래그로 실시간 크기를 조절할 수 있는 분할 뷰입니다. 가로(좌우) 및 세로(상하) 분할을 지원하며, 사용자가 조절한 크기를 `localStorage`에 자동 영구 보존할 수 있습니다.

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

```typescript
const scroll = context.ui.createScrollContainer({
  direction: 'vertical', // 'vertical' | 'horizontal' | 'both'
  maxHeight: 400,        // 최대 높이 (또는 height: '100%')
  autoScroll: true,      // append 시 자동으로 스크롤 하단 이동
});

scroll.append(logItem1, logItem2);
// scroll.scrollToTop(true);    // 부드러운 상단 스크롤
// scroll.scrollToBottom(true); // 부드러운 하단 스크롤
// scroll.clear();              // 내용 비우기

container.append(scroll.container);
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


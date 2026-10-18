# 릴리스 노트 (Release Notes)

## [0.12.7] - 2026-10-18

### 신규 기능
- 플러그인 UI 컴포넌트 최상위 엘리먼트 표준화 (`.element` & `.getElement()`):
  - `createInput`, `createNumberInput`, `createSelect`, `createKeyInput`, `createCard`, `createSplitView`, `createTabs` 등 모든 UI 빌더 컴포넌트에 통일된 최상위 DOM 요소 속성(`.element`) 및 메서드(`.getElement()`) 표준 제공
  - `context.ui.toElement()` 헬퍼 도입 및 컨테이너 컴포넌트(`createRow`, `createColumn`, `createGrid`, `createCard`, `createSplitView`, `createScrollContainer`, `createTabs`, `createCollapsible`)의 `children`/`content` 배열에 위젯 객체 전달 시 자동 최상위 엘리먼트 언래핑 지원
- 단축키 표시용 포맷팅 유틸리티 (`context.ini.formatDisplayKey`) 및 `KeyInput` 개선:
  - 3DMigoto 키 바인딩 문자열(`no_modifiers alt VK_F4`)에서 부정 플래그(`no_*`)를 제거하고 수식키 대문자화 및 가상 키 명칭 정제를 거쳐 화면 표시용 배지 텍스트(`Alt + F4`)로 즉시 변환하는 API 제공
  - `createKeyInput` 위젯에 `.getDisplayValue()` 메서드 추가 및 `onChange(rawKey, details)` 콜백에서 `{ raw, display, tokens }` 상세 정보 구조체 전달 지원
- 복수 동일 키 및 주석/순서 보존 원본 섹션 조작 API (Raw Section API):
  - 딕셔너리(`{ key: value }`) 파서의 중복 키 덮어쓰기 한계를 극복하기 위해, 섹션 원본 텍스트 블록 전체를 읽고 쓰는 `context.ini.getSectionRaw` 및 `context.ini.setSectionRaw` 신설 (`drawindexed = auto` 다중 호출 및 메쉬 오버라이드 정밀 편집 지원)
  - 섹션 내부의 주석, 조건문(`if-endif`), 속성을 라인 단위로 구조화하여 분석할 수 있는 `context.ini.parseSectionLines` 파서 도입
- 폼 입력 필드 유효성 검사 상태 API (`setError`, `clearError`, `hasError`):
  - 모든 입력 컴포넌트(`createInput`, `createNumberInput`, `createSelect`, `createKeyInput`, `createSearchInput`, `createFilePicker`)에 표준 에러 검증 메서드 탑재
  - 에러 설정 시 입력 필드 경고 테두리(`--accent-danger`)와 함께 하단 에러 메시지 툴팁(`.plugin-input-error`)이 부드러운 애니메이션으로 표시되며, `clearError()` 호출 시 즉시 복원

### 기능 개선
- 플러그인 스플릿 뷰 (`context.ui.createSplitView`) Flexbox 비율 방어 강화:
  - 스플릿 내부 패널(`.plugin-split-pane`, `.plugin-split-first`, `.plugin-split-second`)에 `min-width: 0 !important; min-height: 0 !important; overflow: hidden !important;`를 적용하여 긴 텍스트나 자식 스크롤 컨테이너 배치 시에도 스플릿 비율이 화면 밖으로 붕괴되지 않도록 방어

---

## [0.12.6] - 2026-10-18

### 기능 개선
- 플러그인 UI 빌더 스플릿 뷰 (`context.ui.createSplitView`) 전체 높이 및 정렬 강제 보장:
  - 스플릿 컨테이너(`.plugin-split-container`)에 `height: 100% !important; flex: 1 1 0% !important; align-items: stretch !important;`를 코어 스타일로 적용하여 내부 자식 요소의 내용물 길이에 따라 스플릿 바가 중간에서 끊기거나 늘어나던 Flexbox 상속 문제 해결
  - 스플릿 구분선(`.plugin-split-resizer`)에 `align-self: stretch !important; height: 100% !important;`를 적용하여 패널 내용물 분량과 상관없이 창 상하 끝까지 일관되게 늘어나도록 보장
  - 탭 패널(`.plugin-tab-panel`) 및 직속 자식 스플릿 뷰(`plugin-tab-panel > .plugin-split-container`)에 `align-items: stretch !important; height: 100% !important;`를 부여하여 탭 내부에서도 스플릿이 뷰포트 전체를 채우도록 개선
- 에디터 탭 내부 및 대화창 여백(패딩) 최적화:
  - 플러그인 커스텀 에디터 탭(`context.ui.openTab`의 `.plugin-tab-editor-content`)에 슬림 패딩(`padding: 8px 10px;`)을 기본 적용하여 툴바와 폼 요소가 창 테두리에 바짝 붙지 않도록 개선
  - 확인/프롬프트 대화상자(`context.ui.confirm`, `context.ui.prompt`) 바디 및 내부 메시지에 여백을 적용하여 텍스트가 모달 테두리에 밀착되던 현상 해결

### 버그 수정
- 스플릿 뷰가 탭 패널이나 부모 컨테이너 내부에 배치될 때 기본 높이가 `height: auto`로 동작하여 내용물 길이에 따라 스플릿 구분선이 축소되던 버그 수정

---

## [0.12.5] - 2026-10-17

### 신규 기능
- 플러그인 UI 빌더 숫자 입력 스텝퍼 위젯 (`context.ui.createNumberInput`):
  - 브라우저 기본의 작은 스핀 버튼 대신 입력창 좌우 양쪽에 직관적인 큰 증감 버튼(`◀`, `▶`) 배치
  - 마우스 클릭 및 누르고 있기(Hold to step) 연속 증감 지원
  - `min`, `max` 범위 제한, `integerOnly` 정수 전용 제한, `precision` 소수점 자릿수 자동 포맷팅 지원
  - `context.ui.createForm`의 `type: 'number'` 폼 필드와 완벽 자동 연동

### 기능 개선
- 플러그인 UI 빌더 세로 컨테이너 (`context.ui.createColumn`) 높이 구속 및 화면 채움(`fill`) 지원:
  - `.plugin-column` 기본 스타일에 `min-height: 0; min-width: 0;`을 내장하여 Flexbox 자식 크기로 인한 컨테이너 무한 팽창 방지
  - `fill: true` 옵션(`flex: 1 1 0%; height: 100%; min-height: 0; overflow: hidden;`) 탑재로 툴바와 탭/스크롤 뷰를 세로로 묶을 때 플러그인 측의 수동 CSS나 인라인 스타일 주입 없이도 자식 `createScrollContainer`의 스크롤바가 완벽히 동작하도록 개선
- 탭 및 뷰 전환 시 작업 상태(스크롤 위치, 커서, 드롭다운/입력값) 보존:
  - 플러그인 커스텀 탭(`kind: 'custom'`) 전환 시 DOM 트리를 파괴하지 않고 유지하도록 호스트 구조(`migoto-custom-tab-host`)를 개선하여, 다른 탭으로 이동했다가 복귀해도 드롭다운 선택값, 텍스트 입력값, 스크롤 위치가 휘발되지 않고 그대로 유지
  - 커스텀 탭의 `customCleanup` 콜백이 탭 전환 시마다 잘못 실행되던 문제를 해결하여 탭이 실제로 닫힐 때(`closeTab`)만 정상 정리되도록 라이프사이클 분리
  - Monaco 에디터 탭 복귀 시 뷰포트 레이아웃 계산과 `restoreViewState` 동기화를 보완하여 커서 및 스크롤 위치 복원 안정화
  - `context.ui.createTabs` 서브 탭 전환 시에도 각 패널 내부의 스크롤 위치를 기록하고 복원하도록 개선
- ZZMI 플러그인(`zzmi-support` v1.3.1) TTL 템플릿 기본값 개선:
  - TTL 단일 투명도 드로우 템플릿의 `$\TTL\alpha` 기본값을 `0.4`에서 `0.5`로 변경
  - TTL 템플릿의 `$\TTL\_2` 플레이스홀더를 `${3:StartIndexLocation}`에서 `${3:FirstIndex}`로 변경하여 가독성 및 호환성 향상

### 버그 수정
- `node --test` 환경에서 `createNumberInput` 마우스 연속 누름 타이머가 활성 상태로 남아 프로세스가 종료되지 않던 현상 수정 (`unref` 적용 및 `destroy` 정리 메서드 추가)

---

## [0.12.4] - 2026-10-17

### 신규 기능
- ZZMI TTL(Transparency Texture Lib) 투명도 라이브러리 구문 및 템플릿 지원:
  - ZZMI 지원 플러그인(`zzmi-support` v1.3.0)에 TTL 투명도 렌더링 구문(`$\TTL\alpha`, `$\TTL\_1`, `$\TTL\_2`, `$\TTL\mask_channel`, `$\TTL\mask_invert`, `run = CommandList\TTL\Draw`, `Resource\TTL\TransparencyTex`) 린트 허용 등록
  - 단일 알파 투명도 렌더링 템플릿(`ZZMI TTL 투명도 드로우 (단일 투명도)`) 및 텍스처 마스크 기반 투명도 템플릿(`ZZMI TTL 텍스처 마스크 투명도 (Texture Mask)`) 2종 추가

### 기능 개선
- 플러그인 UI 빌더 스크롤 컨테이너 및 탭 레이아웃 자동 구속:
  - `context.ui.createScrollContainer`: `flex: 1 1 0%`, `min-height: 0`, `height: 100%`, `scrollbar-gutter: stable`, `scrollbar-width: thin` 및 테마 WebKit 스크롤바 기본 내장
  - `context.ui.createTabs`: 탭 컨테이너, 탭 바디 래퍼 및 개별 탭 패널에 `flex: 1 1 0%`, `min-height: 0`, `height: 100%`, `overflow: hidden`을 기본 내장하여 부모 컨테이너가 무한히 늘어나지 않고 뷰포트에 맞추어 자연스럽게 스크롤바가 작동하도록 개선
  - `context.ui.createSplitView`: 패널(`firstPane`, `secondPane`)에 `display: flex`, `flex-direction: column`, `overflow: hidden`, `min-height: 0`을 부여하여 내부 스크롤 컨테이너 크기 계산 자동 보장
  - `context.ui.openTab`: 플러그인에 전달되는 루트 요소를 `migoto-tab-editor-content`로 감싸 `flex: 1 1 0%`, `min-height: 0`, `height: 100%`를 기본 보장함으로써 플러그인에서 보조 CSS나 `!important` 없이도 완벽한 반응형 스크롤 동작 지원
- 플러그인 역할 분담 아키텍처 공식화:
  - `custom-lint`: 게임 중립적인 순수 범용 XXMI 기본 문법(네임스페이스, 교차 참조, 모드 폴더 리소스 실재성 검사) 전담
  - `zzmi-support`: ZZMI 전용 문법(슬롯픽스, WEngineFX) 및 전용 라이브러리(TTL) 전담
  - 아키텍처 결정서(`docs/DECISIONS.md`) 및 각 플러그인 README 최신화

### 버그 수정
- 플러그인 UI 빌더 사용 시 스크롤 컨테이너가 뷰포트 높이에 구속되지 않고 무한히 늘어나거나 WebKit 브라우저 엔진에서 스크롤바가 숨겨지던 문제 수정

---

## [0.12.3] - 2026-10-17

### 신규 기능
- 가상 모듈 링커(Virtual Module Linker) 기반 다중 파일 플러그인(Multi-File Plugins) 지원:
  - 플러그인 코드를 단일 파일에 몰아넣지 않고 `index.js`, `ui.js`, `constants.js`, `config.json`, `style.css` 등 여러 파일로 분할 작성 지원
  - Vite나 esbuild 등 외부 번들러 빌드 없이 순수 ES Module 상대 경로 `import`(`import ... from './ui.js'`)를 런타임에서 자동으로 해석 및 위상 정렬 기반 인메모리 링크
  - `.json` 데이터 모듈 및 `.css` 스타일 모듈(플러그인 로드 시 자동 DOM 주입, 언로드 시 자동 정리) 지원
  - 데스크톱(Tauri 파일 재귀 탐색) 및 웹(localStorage 파일 영속화) 환경 모두 완전 지원
  - 플러그인 엔트리 스크립트로 `index.js` 표준 인식 (`plugin.json`의 `main` 필드 또는 `index.js` -> `plugin.js` -> `main.js` 우선순위 자동 탐색)

### 기능 개선
- 기본 내장 플러그인 전면 모듈화: `ai-assistant`, `custom-lint`, `python-runner`, `zzmi-support` 등 거대 단일 파일로 작성되었던 기본 플러그인을 역할별 세부 모듈(`ui.ts`, `api.ts`, `rules.ts`, `indexer.ts`, `runner.ts`, `templates.ts` 등)로 분리·구조화하여 가독성 및 유지보수성 대폭 개선
- 플러그인 업데이트 클린 재설치 보장: 플러그인 업데이트 시 기존 폴더를 완전히 제거(`RMDir` / `deleteEntry`)한 후 최신 파일을 설치하도록 개선하여, 파일명 변경이나 파일 삭제 시 구버전 잔여 파일이 남아 발생하는 충돌 방지
- 기본 플러그인 버전 업데이트: 모듈화 및 개선 사항을 반영하여 기본 플러그인 5종 버전 일괄 상향 (`ai-assistant 1.2.0`, `asset-viewer 1.3.0`, `custom-lint 1.4.0`, `python-runner 1.2.0`, `zzmi-support 1.2.0`)
- 플러그인 관리 패널 UI 패딩 정규화: 플러그인 항목들을 접었을 때와 펼쳤을 때 내부 패딩이 동일한 기준선에 맞춰지도록 개선하여 시각적 어색함 해소
- 플러그인 개발 가이드 및 API 레퍼런스(`docs/PLUGIN_API.md`, `docs/AGENTS.md`, `migoto-studio.wiki`) 최신화: 다중 파일 구조 및 가상 모듈 링커 명세 반영

---

## [0.12.2] - 2026-10-17

### 신규 기능
- 플러그인 레이아웃 및 분할 뷰 API (`context.ui.createSplitView`, `createRow`, `createColumn`, `createGrid`, `createDivider`, `createScrollContainer`): 마우스 드래그 조절 리사이저블 스플릿 뷰(크기 자동 저장 지원), 가로/세로 Flexbox 컨테이너, Grid 다단 레이아웃, 테마 스크롤바 컨테이너 추가
- 플러그인 확장 UI 빌더 컴포넌트 API (`createTabs`, `createCollapsible`, `createSegmentedControl`, `createSearchInput`, `createFilePicker`, `attachTooltip`, `createDropZone`): 인라인 탭 네비게이션, 아코디언 접기/펼치기, 알약(Pill) 세그먼트 컨트롤, 실시간 디바운스 검색창(클리어 버튼 내장), 파일 열기 대화상자 연동 경로 선택기, 테마 플로팅 툴팁, 파일 드래그 앤 드롭 영역 7종 추가

### 기능 개선
- 상단 메뉴바 플러그인 메뉴 노출 개선: 플러그인이 메뉴를 1개 등록할 경우 상단 [플러그인] 메뉴에 1단으로 직접 노출하고, 2개 이상 등록 시에만 플러그인 이름의 서브메뉴(▶)로 자동 그룹화하도록 개선
- AI 플러그인 개발 지침서(`docs/AGENTS.md`) 및 공식 레퍼런스 문서(`docs/PLUGIN_API.md`) 구조 개편: `AGENTS.md`의 중복 API 열거를 걷어내고 `PLUGIN_API.md`를 단일 진실 공급원(Single Source of Truth)으로 참조하도록 슬림화 및 전체 위젯 명세 보강
- GitHub Wiki (`migoto-studio.wiki`) 최신화: `Plugin-System.md`에 레이아웃 및 신규 확장 UI 컴포넌트 13종의 매개변수와 사용법 수록

### 버그 수정
- 커스텀 플러그인 사이드바 탭 순서 동기화 버그 수정: 기본 내장 플러그인 외에 사용자가 직접 설치한 외부 커스텀 플러그인도 플러그인 관리자에서 설정한 정렬 순서대로 액티비티 바 탭 순서가 올바르게 재배치되도록 수정

---

## [0.12.1] - 2026-10-17

### 신규 기능
- 플러그인 대화상자 API (`context.ui.confirm`, `context.ui.prompt`): 플러그인에서 위험 작업 전 사용자 확인을 요청하는 모달(`variant: 'danger'` 지원) 및 텍스트 입력을 비동기로 받는 프롬프트 대화상자 추가
- 플러그인 Diff 비교 탭 API (`context.ui.openDiffTab`): Monaco 기반 양방향 파일 비교 탭을 플러그인에서 프로그래밍 방식으로 직접 생성하고 제어할 수 있는 API 추가
- 플러그인 워크스페이스 전역 검색 API (`context.workspace.search`): 열린 탭 및 모드 폴더 전체 파일을 대상으로 텍스트/정규식 통합 검색 기능 제공
- 안전 백업 및 복원 API (`context.workspace.createBackup`, `context.ui.openRestoreModal`): 플러그인이 파일 수정 전 안전 백업을 생성하고, 파일별 백업 목록 및 Diff 비교/복원 모달을 호출할 수 있는 기능 추가
- 플러그인 에디터 탭 제어 API (`context.workspace.getOpenTabs`, `context.workspace.focusTab`, `context.workspace.closeTab`): 현재 열려 있는 탭 목록 조회 및 특정 탭으로의 전환/닫기 제어 지원
- INI 심볼 고속 추출 API (`context.ini.extractSymbols`): INI 문서 내 전역/로컬 변수, 리소스, 커맨드리스트, 섹션 구조를 초고속으로 파싱하여 반환하는 구조 분석 API 추가
- 3DMigoto 토글키 설정창 및 단축키 도우미 API (`context.ui.openKeyBindingModal`, `context.ini.parseKeyBinding`, `context.ini.formatKeyBinding`, `context.ini.getKeyList`): 실시간 키보드/마우스 입력 감지, 필수/부정 수식키 조합, 가상키 목록 조회가 가능한 대화형 키 도우미 모달 및 파싱 유틸리티 추가

### 기능 개선
- 공식 문서 및 개발자 지침서 동기화: `docs/PLUGIN_API.md`, `docs/AGENTS.md` 및 `migoto-studio.wiki`(`Plugin-System.md`, `Key-Helper-Guide.md`, `Diff-Viewer-Guide.md`)에 신규 API 명세 및 실전 코드 예제 반영
- 플러그인 폼 위젯 키 입력 도우미 연동: `createKeyInput` 및 FormField `'key'` 필드에 실시간 키 감지 외에 [키 도우미] 모달 버튼 기본 내장

---

## [0.12.0] - 2026-10-17

### 신규 기능
- 파이썬 스크립트 파일(.py) 로드 및 실행 지원: Python 실행기 플러그인에서 인라인 코드 작성뿐만 아니라 워크스페이스 내 외부 `.py` 파일을 직접 선택하여 원클릭으로 실행할 수 있는 파일 실행 모드 추가
- 대화형 표준 입력(stdin) 콘솔 및 백엔드 파이프 지원: 파이썬 등 외부 프로세스가 사용자 입력을 요구(`input()`)할 경우 실행 결과 콘솔 하단 입력창을 통해 실시간으로 명령 및 데이터를 전달할 수 있도록 Tauri Rust 백엔드(`exec_process`)와 플러그인 콘솔 UI 컴포넌트(`createConsole`)에 표준 입력 파이프 확장
- 플러그인 고수준 UI 빌더 API (`context.ui`): 복잡한 DOM 직접 조작 없이 모던한 일관성을 갖춘 UI를 간편하게 구성할 수 있도록 `openFormTab`, `createCard`, `createConsole`, `createSectionHeader`, `createButton` 등 고수준 빌더 API 제공
- 외부 AI 플러그인 개발 지침서 (`docs/AGENTS.md`) 및 공식 API 명세서 (`docs/PLUGIN_API.md`): 타 AI 코딩 세션이나 서드파티 개발자가 Migoto Studio 플러그인을 원활하게 제작·검증할 수 있도록 설계 원칙, UI 빌더, INI 도우미, 시스템 프로세스 실행 규칙 등을 정리한 종합 가이드라인 제공

### 기능 개선
- 상단 메뉴바 플러그인 동적 연동 및 기본 관리 항목 정비: 상단 [플러그인] 메뉴에 '플러그인 관리…' 및 '플러그인 폴더 열기…' 기본 액션을 상시 제공하며, 활성화된 플러그인이 메뉴를 등록할 때만 하위 항목이 동적으로 생성되도록 개선 (기본 플러그인의 불필요한 고정 에디터 탭 및 메뉴 제거)
- 기본 플러그인 5종 가독성 및 예제성 복원: 번들 빌드 시 불필요한 코드 압축/난독화를 제거하고 의미 있는 함수명·변수명을 유지하여 서드파티 개발자를 위한 고품질 참조 구현체로 개선
- 빌드 파이프라인 최적화 및 줄바꿈 정규화: `build-default-plugins.mjs`에서 변경 사항이 없을 경우 불필요한 파일 덮어쓰기를 건너뛰도록 개선하고, `.gitattributes`를 통해 OS 간 줄바꿈(CRLF/LF) 일관성 보장
- 프로젝트 도구체계 격리 복원: `env.ps1`에서 시스템 전역 환경과 충돌 없이 프로젝트 로컬 `.toolchain`의 Rust 및 Cargo를 안정적으로 호출할 수 있도록 환경 변수 정비

---

## [0.11.0] - 2026-10-16

### 신규 기능
- 심볼 탐색 확장 API 및 플러그인 연동: 코어 에디터에 `CustomDefinitionResolver`, `CustomReferencesResolver` API를 제공하여, 플러그인이 모나코 기본 정의 이동(F12), 모든 참조 찾기(Shift+F12), Ctrl+클릭에 개입하여 동일 네임스페이스를 공유하는 외부 파일 심볼까지 끊김 없이 추적 및 탭 자동 열기 지원
- 모드 폴더 전체 검색 (Workspace Global Search): `Ctrl+Shift+F` 검색 패널에서 열려있는 탭뿐만 아니라 모드 폴더 내 모든 INI 파일을 대상으로 검색 및 결과 목록 탐색 지원
- 오버레이 스크롤바 (Overlay Scrollbar): UI 너비를 차지하지 않고 콘텐츠 위에 얇고 반투명하게 떠 있는 슬림형 오버레이 스크롤바 디자인 적용 (Tauri 데스크톱 & 웹 에디터 전체)

### 기능 개선
- 플러그인 폴더 명칭 및 식별자 쇄신: 구버전 명칭인 `resource-checker`를 `custom-lint`로 변경하고, 기존 플러그인 설정 및 로컬 스토리지 자동 마이그레이션 적용
- 플러그인 목록 기본 접힘(Collapsed) 처리: 플러그인 관리 패널 진입 시 모든 플러그인 카드가 1줄 형태로 간략히 접혀 표시되며, 셰브론 아이콘 및 카드 간격 최적화로 쾌적한 뷰 제공
- Monaco 에디터 단축키 및 컨텍스트 메뉴 단일화: F12 단축키를 '정의로 이동 (Go to Definition)'으로 통합하고, 불필요한 기본 피킹(Peek) 메뉴들을 컨텍스트 메뉴에서 제거하여 에디터 우클릭 메뉴 간소화
- XXMI 내장 함수 및 커맨드리스트 허용 범위 확장: `BuiltinCommandList~`, `CommandListSkinTexture` 등 XXMI 표준 내장 커맨드리스트에 대한 린트 및 참조 허용 확장

### 버그 수정
- 심볼 탐색 시 중복 색인 버그 해결: 열린 탭(절대경로)과 탐색기(상대경로)의 경로 표기 차이로 인해 심볼 선언/참조가 2개씩 중복 노출되던 문제 수정
- 커스텀 린트 독립 메뉴 오동작 정리: 동작하지 않던 플러그인 독자 우클릭 메뉴 대신 코어 표준 F12/Shift+F12 단축키 및 에디터 네비게이션으로 완전 통합

---

## [0.10.1] - 2026-10-13

### 신규 기능
- 웹 버전 기본 플러그인 정적 서빙 지원: 웹 환경에서도 DDS/텍스처 뷰어, AI 어시스턴트, 리소스 무결성 검사기, ZZMI 문법 지원 등 4종의 웹 호환 플러그인을 기본으로 사용할 수 있도록 정적 배포 구조 구축

### 기능 개선
- 플러그인 빌드 파이프라인 확장: npm run build:plugins 실행 시 웹 호환 플러그인 4종을 public/default-plugins에 자동 배치하고 매니페스트 인덱스(index.json)를 생성하여 배포 자동화
- GitHub Pages 배포 워크플로 트리거 보강: default-plugins 및 빌드 스크립트 수정 시 웹 앱이 자동 재배포되도록 경로 감지 추가

### 버그 수정
- 이전 버전 로컬 스토리지 잔여 데이터로 인한 유령 플러그인 표시 오류 수정: localStorage 내 구버전 기본 플러그인, 지원되지 않는 데스크톱 전용 플러그인(python-runner), 손상되거나 비어 있는 플러그인 항목을 자동으로 정제(Purge)
- 존재하지 않거나 삭제된 플러그인 ID가 migoto_plugins_enabled, migoto_plugin_order, migoto_plugins_collapsed에 잔존하던 동기화 버그 해결

---

## [0.10.0] - 2026-10-13

### 신규 기능
- this = 구문 리소스 바인딩 및 참조 추적: INI 파일 내 this = ResourceName 구문을 정밀 파싱하여 사용 중인 리소스로 인식하고, 선언되지 않은 리소스 지정 시 진단 경고를 발생하도록 지원
- 리소스 슬롯 자동완성 제안 확장: this = 구문 입력 시 현재 선언된 리소스 목록을 IntelliSense로 자동 완성 추천

### 기능 개선
- 미사용 리소스 및 변수 검출 기본 활성화: 기본 설정에서 lintUnusedItems 옵션을 켜짐으로 변경하여 사용되지 않는 리소스와 변수를 기본으로 감지
- 플러그인 린트 실시간 일괄 동기화: ZZMI 지원 등 플러그인 켜기/끄기 시 디바운스 대기 없이 열려 있는 모든 에디터 탭의 문법 진단 결과를 즉시 실시간으로 동기화
- 플러그인 관리자 인터페이스 간결화: 플러그인 목록 카드에서 불필요한 번호, 버전 배지, 접기 아이콘을 정리하여 여유롭고 깔끔한 작업 공간 제공
- 데스크톱 자동 업데이트 배포 워크플로 구성: 인스톨러 배포 시 Tauri updater 아티팩트 및 latest.json 생성을 활성화하여 안정적인 자동 업데이트 지원

### 버그 수정
- this = 구문 리소스 미사용 오탐 및 미선언 미감지 버그 수정
- 개발 모드(dev.ps1) 실행 중 불필요한 백그라운드 업데이트 확인 및 콘솔 에러 로그 발생 방지

---

## [0.9.4] - 2026-10-12

### 신규 기능
- AI 모딩 어시스턴트 Google Gemini 공식 연동 및 프리셋 추가: Google AI Studio(Gemini 1.5 Pro / Flash) 연동을 지원하고, 원클릭 프리셋 버튼(Google Gemini, OpenAI, 로컬 Ollama)을 통해 엔드포인트 URL 및 권장 모델명을 즉시 설정할 수 있도록 편의성 개선

### 기능 개선
- AI 어시스턴트 API 엔드포인트 자동 보정: Google Generative Language 엔드포인트 입력 시 누락된 /openai 경로를 자동으로 보정하여 전송하도록 개선
- 커뮤니티 배포 및 소개 가이드 문서 추가: 100% 인라인 스타일이 적용된 아카라이브 안내 글 초안(docs/arcalive-post-draft.html) 추가

### 버그 수정
- 불필요한 일회성 릴리스 노트 업데이트 깃허브 액션 워크플로 제거

---

## [0.9.3] - 2026-10-12

### 신규 기능
- 전체 파일 검색 및 바꾸기 (Ctrl+Shift+F): 액티비티 바에 돋보기 아이콘 버튼을 추가하고, 파일 탐색기 내 모든 파일(웹 및 데스크톱)을 대상으로 하는 글로벌 검색/바꾸기 사이드바 패널 구현. 대소문자 구분(Aa), 온전한 단어(\b), 정규식(.*), 포함/제외 필터 및 검색 결과 클릭 시 에디터 즉시 이동 지원
- 심볼 선언 위치 추적 및 바로 이동 (F12 / Ctrl+클릭): INI 섹션 헤더 및 변수($var, $\Namespace\Var)에 커서를 두고 F12 키를 누르면 선언된 라인으로 즉시 점프하며 대상 라인을 부드러운 하이라이트로 안내
- 참조 및 사용 위치 검색 (Shift+F12): 선택한 섹션 또는 변수가 사용된 모든 위치를 검색하여 전용 모달 창에서 파일명, 라인, 섹션 컨텍스트 및 코드 미리보기와 함께 나열하고 즉시 탐색 지원

### 기능 개선
- INI 섹션 단위 코드 접기/펴기 (Folding) 지원: 모든 [Section] 헤더에 코드 접기 범위를 등록하여 에디터 좌측 거터의 접기 버튼 및 '보기' 메뉴의 '모든 섹션 접기/펴기'가 섹션 단위로 정상 작동하도록 개선
- 편집 메뉴 및 우클릭 메뉴에 '선언으로 이동 (F12)' 및 '참조 및 사용 위치 찾기 (Shift+F12)' 추가

### 버그 수정

---

## [0.9.2] - 2026-10-12

### 신규 기능
- XXMI 네임스페이스 린트 규칙 지원: 모드 폴더 내 모든 INI 파일의 네임스페이스, [Constants] 변수, CommandList 함수를 자동 색인하여 $\Namespace\Var 및 CommandList\Namespace\Action 호출의 유효성을 실시간 검증하는 린트 규칙 추가

### 기능 개선
- 리소스 파일 검사기 플러그인 명칭 및 역할 개편: 플러그인 이름을 '커스텀 린트'로 변경하고 리소스 파일 실재성 검사 및 XXMI 네임스페이스 유효성 검사를 포괄하도록 확장
- 단일 INI 파일 린트 안내 문구 개선: 모드 폴더 없이 단일 INI만 열었을 때 미선언 변수/섹션에 대해 외부 네임스페이스에 정의된 요소인지 확인하도록 안내 메시지 보강

### 버그 수정
- XXMI 네임스페이스 변수 오경고 수정: 다른 INI 파일의 네임스페이스에서 불러온 변수나 함수를 현재 INI 내에서 찾지 못해 무조건 오류로 판정하던 문제 해결

---

## [0.9.1] - 2026-10-12

### 신규 기능
- 플러그인 자체 아이콘 모듈화: 각 플러그인 폴더 내에 icon.svg 및 icon.ts를 직접 포함하여 외부 의존성 없는 완전 모듈화 지원 (ZIP 플러그인 내 icon.svg 자동 인식 포함)

### 기능 개선
- 섹션 목록(Outline) 활성 탭 실시간 연동: 에디터에서 현재 보고 있는 활성 탭을 실시간 추적하여 표시하고, 여러 INI 탭 전환 시 즉시 동기화되도록 개선
- 액티비티 바(Activity Bar) 정리: 리소스 파일 검사기 및 ZZMI 지원 플러그인의 불필요한 독립 사이드바 탭을 제거하고 에디터 실시간 린터 및 템플릿 패널 연동으로 집중

### 버그 수정
- 텍스처(DDS/PNG) 또는 파일 비교(Diff) 뷰어 탭을 보고 있을 때 이전 INI 파일의 섹션 목록이 그대로 남아있던 문제 수정

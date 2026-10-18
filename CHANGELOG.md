# 릴리스 노트 (Release Notes)

## [다음 버전]

### 신규 기능

### 기능 개선

### 버그 수정

---

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

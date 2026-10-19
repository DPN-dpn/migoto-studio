# 릴리스 노트 (Release Notes)

## [0.12.10] - 2026-10-20

### 신규 기능
- 실시간 출력 콘솔창 (`ConsolePanel`) 및 상단 '보기' 메뉴 연동:
  - 에디터 상단 **[보기] -> [콘솔창 보기]**, 단축키 **`Ctrl+\``**, 또는 하단 상태바의 **[콘솔]** 버튼으로 열고 닫을 수 있는 출력 콘솔 패널 신설
  - 프로그램 런타임 로그, 전역 오류, 파일/작업영역 라이프사이클 이벤트 실시간 수집 및 출력
  - 레벨별 필터링(`전체`, `정보`, `경고`, `오류`), 소스별 필터링(App, File, Workspace, Search, Linter, 플러그인 등), 실시간 텍스트 검색 지원
  - 드래그 높이 조절 스플리터, 자동 스크롤(Auto-scroll) 토글, 클립보드 원클릭 복사, 로그 비우기(Clear), 상세 객체/스택트레이스 펼치기 지원
  - 상태바에 실시간 오류/경고 카운트 배지 및 하이라이트 표시 연동
- 플러그인 전용 로깅 API (`context.logger`):
  - 플러그인에서 `context.logger.info`, `warn`, `error`, `debug`를 호출하여 출력 콘솔에 플러그인 식별 태그(`[Plugin: 플러그인명]`)와 함께 실시간 전송 가능
- 플러그인 독립 서브 윈도우 생성 API (`context.ui.openSubWindow`):
  - 메인 에디터 화면에 구애받지 않고 독립 팝업 창을 띄워 마법사, 실시간 프리뷰, 전용 도구를 구성할 수 있는 API 신설
  - 창 크기(`width`, `height`, `minWidth`, `minHeight`) 및 크기 조절 가능 여부(`resizable`) 설정 지원
  - 3대 포커스 및 레이어 모드(`focusMode`) 지원:
    - `'alwaysOnTop'`: 화면 최상단 고정 유지
    - `'parentLinked'`: 메인 Migoto Studio 포커스 시 서브창 자동 전면 연동
    - `'independent'`: 메인 창과 완전히 분리된 독립 창 동작
  - 메인 창 테마(다크 모드 등) 및 CSS 스타일시트 자동 복제 주입
  - 플러그인 생명주기(`deactivate`) 및 앱 종료 시 열린 서브창 자동 정리 연동
  - 서브창을 별도 OS 창으로 분리(PiP)하는 기능, 하단 상태바 '열린 창' 드롭다운, 메인-보조 창 상태 동기화 지원
- 독립 OS 윈도우 API (`context.ui.openNativeWindow`) 및 워크스페이스 API 확장 (`findFiles`, `onDidChangeActiveFolder`)
- 플러그인 UI 빌더 위젯 추가:
  - `context.ui.createModal`: 제목/설명/본문/액션을 갖춘 모달 다이얼로그 (ESC·배경 클릭 닫기, 너비 프리셋)
  - `context.ui.createChipGroup`: 다중/단일 선택 칩 그룹
  - `context.ui.createIconButton` 및 `createButton`의 `icon`/`iconOnly` 옵션 (내장 아이콘 프리셋 지원)
  - `createToolbar`, `createToggleButton`, `createStatusBar`, 컴팩트 `createSelect`

### 기능 개선
- 코드 템플릿(코드 스니펫) 패널 즐겨찾기 및 분류별 아코디언 접기/펼치기 지원:
  - 각 스니펫 카드에 별(★) 아이콘 즐겨찾기 토글 버튼 추가 및 상단 '⭐ 즐겨찾기' 전용 그룹 최우선 노출
  - 그룹별 아코디언 접기/펼치기, 그룹 템플릿 개수 배지, 상단 '모든 분류 접기/펼치기' 일괄 제어 버튼 지원
  - 사용자의 즐겨찾기 및 그룹 접힘 상태 영구 저장(`localStorage`) 유지 및 검색 시 자동 펼침 지원
- 코드 템플릿 삽입 시 활성 탭 및 INI 에디터 검증 강화:
  - 현재 열린 활성 탭이 INI 텍스트 에디터 창일 때만 스니펫이 정상 삽입되도록 방어 로직 추가
  - 다른 탭(Diff 탭, 텍스처/커스텀 뷰어, 플러그인 웹뷰 탭 등)을 보고 있는 상태에서 스니펫 클릭 시 오작동하지 않고 안전하게 무시되도록 처리

- 모든 UI 빌더 위젯이 최상위 `HTMLElement`를 직접 반환하여 `toElement()` 없이 `append`로 바로 부착 가능 (기존 `.element` 호환 유지)
- 기본 플러그인 순서를 커스텀 린트 → ZZMI 지원 → DDS/텍스처 뷰어 → 파이썬 실행 → AI 모딩 에이전트로 변경, ZIP으로 설치한 플러그인은 맨 아래에 추가되며 상단 메뉴에도 같은 순서 반영
- 분할 영역 너비를 창 크기 비율로 유지하여 전체화면 전환 시에도 비율 보존
- 플러그인 관리 패널의 '기본 순서 초기화' 버튼 제거
- 기본 플러그인(ai-assistant, asset-viewer) 모듈화

### 버그 수정
- 마스터 창을 닫으면 모든 보조 OS 창이 함께 닫히도록 수정
- 네이티브 창 생성 시 WebView2 `0x8007139F` 오류 해결
- 서브창 PiP 분리 시 WebView2 내부 오류 방지 및 Tauri 창 권한 보강
- 네이티브 확인 대화상자를 앱 내 확인 모달로 교체
- 플러그인 모듈 링커에서 Three.js 중복 인스턴스 경고 자동 무음 처리

---

## [0.12.9] - 2026-10-19

### 기능 개선
- 에디터 인라인 Diff 검토 세션 탭별 격리:
  - 탭 전환 시 인라인 Diff와 상단 스티키 바를 해당 탭에만 독립적으로 표시하고, 다른 탭에서는 노출되지 않도록 격리
- 인라인 Diff 되돌리기 시 파일 수정(Dirty) 상태 복원:
  - 제안된 변경점을 취소하고 원본 코드로 복구했을 때 불필요하게 저장 확인 창이 뜨지 않도록 저장 상태 자동 동기화
- 인라인 변경 블록 액션 버튼 클릭 및 포인터 커서 반응성 개선

---

## [0.12.8] - 2026-10-18

### 신규 기능
- 에디터 인라인 Diff 검토 및 수락/되돌리기 API (`context.editor.proposeChanges`):
  - 별도 탭 이동 없이 에디터 내에서 코드 변경 사항을 대조 검토할 수 있는 인라인 리뷰 시스템 도입
  - 변경점 시각화: 삭제된 줄은 빨간색 취소선 블록으로, 추가된 줄은 초록색 하이라이트로 인라인 표시
  - 상단 스티키 바: 파일 전체의 변경 개수 배지와 함께 `[✓ 모두 수락 (Ctrl+Enter)]` 및 `[✕ 모두 되돌리기 (Esc)]` 일괄 확정/취소 지원
  - 인라인 변경 블록 액션: 변경된 줄 영역 상단에 `변경 #N [✓ 수락] [✕ 되돌리기]` 버튼을 제공하여 블록별 개별 적용/되돌리기 지원
- 플러그인 UI 빌더 신규 고수준 컴포넌트 추가:
  - 상태 배지 (`context.ui.createBadge`): 상태 태그 컴포넌트
  - 원클릭 복사 코드 블록 (`context.ui.createCodeBlock`): 코드 복사 버튼이 내장된 프리셋 뷰어
  - 모딩 리스트 아이템 (`context.ui.createListItem`): 제목, 부제목, 상태 배지, 클릭 액션이 결합된 아이템 컴포넌트
  - 파일 선택기 (`context.ui.createFilePicker`): 디렉터리 및 특정 확장자 파일 브라우징 지원 위젯

### 기능 개선
- Flex & Split 계층 높이 및 오버플로우 방어 내장:
  - `createSplitView`, `createTabs`, `createColumn` 중첩 시 내부 스크롤 컨테이너 높이 붕괴를 방지하도록 Flex 100% 레이아웃 및 `min-height: 0` 자동 적용
- 폼 입력 행 레이아웃 반응형 자동 줄바꿈:
  - 좁은 화면에서 라벨과 컨트롤이 잘리지 않도록 Flex-wrap 및 간격 자동 최적화 적용

### 버그 수정
- 줄 단위 Diff 알고리즘 (`computeLineDiff`) 도입으로 안정적인 변경 블록 분할 지원

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

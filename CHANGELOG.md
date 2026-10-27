# 릴리스 노트 (Release Notes)

## [다음 버전]

### 신규 기능

### 기능 개선

### 버그 수정

---

## [0.13.2] - 2026-10-27

### 기능 개선
- Tauri 데스크톱 실행 바이너리 및 패키지 명칭 변경 (`app.exe` → `migoto-studio.exe`):
  - Windows Defender 등 보안 소프트웨어의 모호한 파일명(`app.exe`) 기반 머신러닝 오탐(`Bearfoos.B!ml`) 방지를 위해 Cargo 패키지명과 빌드 바이너리 명칭을 고유한 `migoto-studio`로 변경
  - NSIS 설치 프로그램 바로가기 및 설치 타깃 바이너리 이름 동기화

---

## [0.13.1] - 2026-10-26

### 버그 수정
- 에디터 인라인 Diff 검토(`context.editor.proposeChanges`) 시 개별 청크 `[수락]`이 반영되지 않던 결함 수정:
  - 개별 청크 `[수락]` 클릭 시 기준 원본(`originalText`)에 수락 내용을 즉시 반영하도록 수정하여, Diff 재계산 시 해당 변경 블록이 정상 수락 처리되어 뷰존 액션 바가 사라지도록 개선
  - 개별 청크 `[되돌리기]` 시에도 정확한 줄 단위 복구와 에디터 뷰/스크롤 상태를 보존하도록 안정화
  - 모든 청크를 개별적으로 처리했을 때 최종 변경 수락 여부(`accepted`)를 정확히 판별하여 플러그인에 전달하도록 보완

---

## [0.13.0] - 2026-10-26

### 신규 기능
- 3DMigoto 대화형 키 바인딩 입력 도우미(`KeyHelperModal`):
  - 에디터 내 `key = ...` 구문 또는 플러그인 UI에서 직접 키보드를 눌러 키 입력을 감지(Key Capture)하고 3DMigoto 가상 키(VK) 코드로 자동 변환하는 전용 모달 제공
  - 수식키(`Ctrl`, `Alt`, `Shift`, `Win`)에 대한 세분화된 조건(긍정, 부정, 무관) 원클릭 설정 지원
  - 100개 이상의 3DMigoto 지원 가상 키(VK) 카테고리별 탐색 및 실시간 검색 지원
  - 생성된 키 바인딩 구문 실시간 미리보기 및 에디터 선택 줄 즉시 교체/삽입/값 복사 기능 제공
- 설치 프로그램(NSIS) 외부 GitHub 플러그인 선택 설치 옵션:
  - 셋업 설치 마법사에서 공식 지원 외부 플러그인(토글 키 매니저, 3D 모드 뷰어)을 체크박스로 선택하여 기본 설치할 수 있도록 지원
  - 설치 중 GitHub 최신 릴리스 Zip을 자동 다운로드 및 압축 해제하여 플러그인 디렉터리에 자동 배치

### 기능 개선
- 플러그인 비활성화/삭제 시 종속 플러그인 영향 경고 및 자동 비활성화:
  - 필수 종속성으로 사용 중인 플러그인을 비활성화하거나 삭제할 때 영향을 받는 종속 플러그인 목록을 경고 모달로 사전 안내하여 사용자 실수 방지
  - 필수 종속성이 비활성화되면 해당 종속성에 의존하던 활성 플러그인도 자동으로 비활성화 처리하여 런타임 오류 방지

### 버그 수정
- 종속성 미충족 오류가 발생한 플러그인을 다시 비활성화(OFF)할 때 플러그인 카드에 남아있던 오류 배너가 정상적으로 제거되지 않던 결함 수정

---

## [0.12.14] - 2026-10-25

### 기능 개선
- GitHub 플러그인 업데이트 감지 신뢰성 및 메타데이터 동기화 강화:
  - 데스크톱 환경에서 디스크 플러그인 로드 시 `.github-source.json` 메타데이터 파일이 숨김 파일 규칙에 의해 스캔에서 누락되던 결함을 수정하여, 브라우저 스토리지 초기화 시에도 GitHub 출처 정보가 온전히 복원되도록 보장
  - 플러그인 업데이트 검사 시 `localStorage`뿐만 아니라 로컬 디스크의 플러그인 폴더 내 `.github-source.json`에도 최신 릴리스 버전 및 검사 시각을 영구 동기화
  - 데스크톱 환경의 `fetchTextSafe` 네트워크 요청 시 불필요한 웹뷰 브라우저 `window.fetch` 폴백 호출 및 CORS 오류 발생 방지

### 버그 수정
- 디스크에 설치된 GitHub 출처 플러그인이 앱 재기동 후 업데이트 검사 대상에서 누락되거나 새 버전 뱃지가 갱신되지 않던 문제 해결

---

## [0.12.13] - 2026-10-25

### 신규 기능
- 플러그인 카드 종속성(Dependencies) 상세 정보 표시:
  - 플러그인 카드를 펼쳤을 때 매니페스트(`plugin.json`)에 정의된 종속 플러그인 ID, 요구 버전 및 충족 상태를 한눈에 파악할 수 있는 전용 UI 제공
- 텍스처 라이브러리(`texture-library`) 공개 API 및 알파 채널 무시 모드:
  - 타 플러그인(3D 뷰어 등)에서 고성능 DDS 디코더를 재사용할 수 있도록 `decodeDDS` 공개 API 제공 및 이전 `asset-viewer` 플러그인 자동 마이그레이션 지원
  - 텍스처 로드 시 알파 채널 무시(`ignoreAlpha`) 옵션 추가 및 텍스처 뷰어 기본 모드를 `RGB`로 설정하여 스펙큘러/글로우 마스크용 알파로 인한 투명화 방지

### 기능 개선
- 독립 OS 서브 윈도우 플러그인 API 및 슬롯 브릿지 연동:
  - 별도 OS 창으로 분리된 서브 윈도우에서도 메인 윈도우의 플러그인 공개 API(`context.plugins.getPluginApi`) 및 슬롯 분석 데이터(`context.slots`)를 실시간으로 안전하게 조회할 수 있도록 IPC 브릿지 구현
  - 텍스처 슬롯 패널을 사용자가 직접 열지 않아도 폴더 열기 및 리졸버 등록 시 백그라운드에서 자동으로 슬롯 분석 및 동기화 수행
- GitHub 플러그인 업데이트 감지 네트워크 안정성 강화:
  - 브라우저 CORS 제약 및 리다이렉트를 우회하는 `fetchTextSafe`를 적용하여 GitHub 플러그인의 원격 최신 버전 감지 신뢰도 향상

### 버그 수정
- BC7 텍스처 디코딩 비트 리딩 오류로 인해 픽셀에 색상 노이즈(빨강/초록/파랑 점)가 생기던 아티팩트 결함 수정
- INI 리소스 섹션 분석 시 `.ib`, `.buf` 등 바이너리 모델 버퍼 파일이 텍스처 목록으로 오인 수집되어 3D 뷰어에서 로드 오류(`{ isTrusted: true }`)를 일으키던 현상 원천 차단
- 플러그인 재로드 시 중복 활성화 및 상단 메뉴 아이템 중복 등록 방지

---

## [0.12.12] - 2026-10-24

### 신규 기능
- 플러그인 종속성 관리 및 버전 검사 시스템:
  - 플러그인 매니페스트(`plugin.json`)에 `dependencies` 필드 규격 추가
  - 시맨틱 버저닝 제약식(`^1.0.0`, `~1.2.0`, `>=1.0.0`, `*`, `1.2.3`) 및 GitHub URL(`https://github.com/owner/repo#>=1.0.0`) 종속성 선언 지원
  - 플러그인 로드 시 DFS 기반 위상 정렬(Topological Sort)을 수행하여 종속 플러그인이 항상 먼저 활성화되도록 순서 보장
  - 순환 종속성(Circular Dependency) 자동 감지 및 콘솔 경고 처리
  - 종속 플러그인이 미설치, 비활성화, 버전 불일치 상태인 경우 플러그인 활성화를 안전하게 대기하고 종속 플러그인이 활성화될 때 자동 재로드
  - 플러그인 간 공개 API 공유 지원 (`context.plugins.registerApi`, `context.plugins.getPluginApi`, `context.plugins.hasPluginApi`) 및 `activate()` 반환값 자동 등록 지원
  - 플러그인 종속성 검사 및 원격 설치 API 지원 (`context.plugins.checkDependencies`, `context.plugins.installDependency`)

### 기능 개선
- 내장 텍스처 뷰어 플러그인 리팩터링 및 명칭 변경:
  - 기존 `asset-viewer` 내장 플러그인의 식별자(ID) 및 명칭을 `texture-library` ("텍스처 라이브러리")로 직관적으로 변경
  - 플랫폼별 기본 플러그인 순서 목록(`DEFAULT_PLUGIN_ORDER`, `DEFAULT_WEB_PLUGINS`) 및 번들 빌드 파이프라인 동기화
- 모듈형 플러그인 공식 문서(`docs/plugin-api/`) 및 GitHub Wiki 문서 최신화

### 버그 수정
- NSIS 설치 패키징 빌드 시 변경된 플러그인 경로(`texture-library`) 미반영으로 인한 makensis 파일 누락 오류 해결
- 플러그인 매니저(`PluginManager`)의 린트 트리거(`lintTrigger`) 프로퍼티 선언 누락 타입 오류 수정

---

## [0.12.11] - 2026-10-25

### 신규 기능
- GitHub 플러그인 온라인 추가 및 자동 업데이트 검사:
  - 플러그인 관리 패널 상단에 **[GitHub 플러그인 추가]** 버튼 신설 (`openPromptModal` 모달 대화상자)
  - GitHub 저장소 링크(예: `https://github.com/owner/repo` 또는 `owner/repo`) 입력만으로 플러그인 자동 다운로드 및 설치
  - Tauri Rust 백엔드 네이티브 다운로드 커맨드(`download_file_bytes`)를 구현하여 브라우저 CORS 제약 및 302 리다이렉트(`codeload.github.com`)를 원천 우회
  - 플러그인 새로고침 시 저장된 GitHub 출처를 기반으로 백그라운드에서 최신 릴리스/버전을 비교하여 `NEW vX.Y.Z` 칩 및 업데이트 배너 표시
  - 원클릭 **[업데이트]** 버튼으로 최신 버전 즉시 교체 설치
  - 플러그인 카드에서 버전 배지(`vX.Y.Z`)에 마우스를 올리면 툴팁으로 저장소 링크를 표시하고, 클릭 시 기본 웹 브라우저로 저장소 페이지 자동 연결
  - 플러그인 API 확장: `context.plugins.installFromGitHub`, `context.plugins.checkUpdates`, `context.plugins.getGitHubSource`
- 3D 모델 및 텍스처 슬롯 매칭 엔진 & 전용 UI (`SlotMatchingPanel`):
  - 액티비티 바에 전용 **[3D 모델 및 텍스처 슬롯 매칭]** 패널 신설
  - 작업 폴더 내 INI 파일을 파싱하여 3D 모델 드로우콜(IB/VB) 및 텍스처 슬롯(`ps-t0`~`ps-t9`, `Resource...`) 자동 분석 및 매칭
  - 표준 3DMigoto 문법 및 ZZMI SlotFix 문법(`Resource\ZZMI\...`, `CommandList\SlotFix\...`) 자동 식별 지원
  - 하드코딩 없는 동적 파트 추론 알고리즘(`discoverModParts`): `PearlbodyA`, `PearlbodyB` 등 다양한 모더 정의 파트명을 정밀하게 식별
  - 부위(파트)명 수정 시 고정 드롭다운 대신 자유로운 직접 문자열 입력 UI 제공
  - 슬롯 분석 결과를 플러그인에서 활용할 수 있는 `context.slots` API (`getMatches`, `getUnmatchedSections`, `getDetectedTextureFiles`, `onDidChange`) 제공
- 워크스페이스 및 UI 이벤트 API 확장:
  - 파일 저장 이벤트 (`context.workspace.onDidSaveFile`)
  - 탭 닫힘 이벤트 (`context.workspace.onDidCloseTab`)
  - 작업 메모리 초기화 이벤트 (`context.workspace.onDidClearMemory`)
  - 테마 조회 및 변경 감지 (`context.ui.getTheme`, `context.ui.onDidChangeTheme`)
  - 플러그인 생명주기 이벤트 (`PluginLifecycleEvent`: `installed`, `activated`, `deactivated`, `uninstalled`) 구독 지원

### 기능 개선
- 플러그인 관리 패널 레이아웃 개선:
  - 플러그인 카드 펼침 시 긴 GitHub URL로 인해 패널 너비를 넘쳐 화면이 깨지던 문제 해결 (버전 배지 툴팁 및 클릭 연결로 일원화)
  - 메타 정보 행(`.plugin-meta-row`)에 자동 줄바꿈(`flex-wrap`) 및 간격 스타일 적용
- 플러그인 매니페스트(`plugin.json`) 규격에 `"location"`(주요 UI 배치 위치 설명) 필드 공식 문서화 및 반영

### 버그 수정
- 작업 폴더 닫힘 시 메모리 초기화 및 디스크 외부 변경 감지 시 편집 중이지 않은 탭의 자동 동기화 개선
- Windows UNC 경로 접두사(`\\?\`) 정규화로 `curl` 및 파일 I/O 실패 오류 원천 방지
- 데스크톱(Tauri) 환경에서 `window.prompt()` 차단 문제 해결 (`openPromptModal` 교체)

---

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

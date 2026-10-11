# 설계 결정 및 보류 요구사항

프로젝트 진행 중 확정된 결정과, 아직 구현하지 않은 요구사항을 기록합니다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 대상 | XXMI 중심 (3DMigoto 공통 문법 포함) |
| 라이선스 | GPL-3.0-or-later (원본 확장 `agmg.migoto-ini`가 GPL-3.0) |
| 공개 | 오픈소스, AI 바이브 코딩으로 제작되었음을 README에 명시 |
| 앱 셸 / 에디터 | Tauri 2 + Monaco Editor |
| 문법 | 원본 확장의 TextMate 문법을 수정 없이 `upstream/`에 보관, `scripts/sync-upstream.mjs`로 갱신 |
| OS | Windows 기본. 다른 OS는 제약이 생기면 포기 |
| 개발 환경 | 프로젝트 폴더 안(`.toolchain/`)에만 설치. 폴더 삭제로 제거 |
| 사용자 데이터 | OS 앱데이터 폴더의 `MigotoStudio` (Windows: `%APPDATA%\MigotoStudio`) |
| 개발 실행 중 데이터 | 프로젝트의 `data/` (실제 사용자 데이터를 건드리지 않음) |
| 포터블 모드 | 프로그램 옆에 `portable.txt`가 있으면 `data/`를 사용 |
| 백업 | 저장 전 이전 파일을 `<앱데이터>/backups`에 보관. 기본 7일, 파일당 10개 |
| 린트 | 고급 수준까지 검사하되 규칙별로 설정에서 켜고 끌 수 있음 |
| 설정 | 가능한 한 많은 기능을 설정에서 조절 가능하게 함 |
| 플러그인 | 좌측 액티비티 바(🧩) 통합. 순수 TS 플러그인 엔진 + Rust 백엔드 프로세스/바이너리 브릿지. 기본 3종 플러그인(Python 실행기, DDS 뷰어, AI 에이전트) 제공 |

## 구현 완료된 요구사항

### 설치 프로그램: 제거 시 앱데이터 삭제 옵션 (완료)
- **프로그램을 삭제할 때 앱데이터 폴더(`%APPDATA%\MigotoStudio`)를 함께 삭제할 수 있는 옵션이 있어야 한다.**
- 구현: Tauri NSIS 제거기의 기본 "앱 데이터 삭제" 체크박스 상태 변수(`$DeleteAppDataCheckboxState = 1`)를 `src-tauri/nsis-hooks.nsh`의 `NSIS_HOOK_POSTUNINSTALL` 훅에서 직접 참조합니다.
  - 번거로운 확인 팝업 없이, 제거 화면의 체크박스 선택 여부에 따라 `%APPDATA%\MigotoStudio` 폴더를 자동으로 삭제하거나 보존합니다.
- 포터블 모드는 프로그램 폴더를 지우면 데이터도 함께 삭제됩니다.

### 문맥 기반 스마트 자동 완성 (완료)
- **변수, 리소스 섹션, 커맨드 리스트를 문서에서 실시간 추출하여 문맥에 맞게 추천한다.**
- 구현: `src/symbols.ts`에서 문서 모델의 심볼을 파싱하고, `src/completions.ts`에서 Monaco 언어 CompletionItemProvider로 등록.
  - `$` 입력 시 문서 내 선언된 전역/키 순환 변수 제안.
  - `vb0 = `, `ib = `, `Resource = ` 등 슬롯 할당 시 정의된 `[Resource...]` 목록 및 `null` 제안.
  - `run = `, `post run = ` 입력 시 `[CommandList...]`, `[CustomShader...]` 제안.
  - `[` 입력 시 주요 섹션 스니펫 템플릿 제안.
  - `format = ` 입력 시 DXGI 버퍼 포맷 목록 제안.

### PWA(웹 앱 설치) 및 오프라인 지원 (완료)
- **웹 버전(GitHub Pages)에서도 브라우저 '앱으로 설치' 기능 및 완전 오프라인 사용을 지원한다.**
- 구현:
  - `public/manifest.webmanifest` 및 앱 아이콘(`192x192`, `512x512`, `SVG`) 구성.
  - `public/sw.js`: 코어 셸 프리캐싱, 네비게이션 시 네트워크 우선/캐시 폴백, 정적 리소스(JS/CSS/WASM/Font) 캐시 우선 전략 구현.
  - `src/pwa.ts`: 웹 브라우저 환경에서만 서비스 워커 등록 및 `beforeinstallprompt` 이벤트를 감지하여 상단 툴바에 '앱 설치' 버튼 노출. (Tauri 네이티브 앱에서는 비활성화)

### 데스크톱 인앱 자동 업데이트 (완료)
- **설치형 프로그램(NSIS)의 원클릭 자동 업데이트 및 포터블/웹 사용자 안내를 지원한다.**
- 구현:
  - Tauri 2 공식 업데이트 플러그인(`tauri-plugin-updater`) 및 GitHub Releases API 연동 이중화 구조.
  - 설치형 프로그램: `check()` 및 `downloadAndInstall()`을 통해 인앱에서 다운로드 진행률 확인 후 자동 설치 및 원클릭 재시작 지원.
  - 포터블 모드: `portable.txt` 환경을 감지하여 덮어쓰기 방지 및 최신 포터블 `.zip` 다운로드 안내 지원.
  - 시작 시 백그라운드 자동 확인 옵션 (설정 창에서 켜고 끌 수 있음) 및 도움말(`F1`) 화면의 '업데이트 확인' 수동 검사 지원.

### 다중 파일 탭(Multi-tab) 지원 (완료)
- **여러 .ini 파일을 동시에 열고 탭으로 전환하며 편집할 수 있어야 한다.**
- 구현:
  - `src/documents.ts`: 각 탭마다 독립된 Monaco ITextModel, 수정 상태(AlternativeVersionId), 실행 취소/다시 실행(Undo/Redo) 스택, 뷰 상태(스크롤 및 커서 위치)를 완벽 보존하는 `DocumentTab` 및 `DocumentManager` 다중 문서 아키텍처 구현.
  - `src/tabbar.ts`: 탭 전환, 닫기(`Ctrl+W`), 마우스 휠 클릭 닫기, 마우스 휠 가로 스크롤, 우클릭 컨텍스트 메뉴(닫기, 다른 탭 닫기, 오른쪽 탭 닫기, 저장)를 지원하는 탭 바 UI 컴포넌트 추가.
  - 수정된 탭은 점 표시(`●`)가 노출되며 마우스 호버 시 닫기(`×`) 버튼으로 전환.
  - 탭 닫기 또는 창 닫기 시 미저장 변경 사항에 대해 확인/저장 대화상자 연동.
  - 단축키: `Ctrl + N` (새 탭), `Ctrl + W` (현재 탭 닫기), `Ctrl + Tab` / `Ctrl + Shift + Tab` (다음/이전 탭 전환).

### 파일 트리 탐색기 (모드 폴더 탐색 및 일괄 관리) (완료)
- **개별 파일뿐만 아니라 모드 폴더 전체를 열어 하위 INI 파일과 에셋들을 계층적으로 탐색할 수 있어야 한다.**
- 구현:
  - 백엔드/플랫폼: Rust `files::read_directory` 명령어를 통해 지정된 폴더의 디렉터리 트리를 신속하게 스캔하며, 노이즈 폴더(`.git`, `node_modules` 등)를 자동 필터링. 웹 환경에서는 `showDirectoryPicker` API를 통해 동일한 트리 탐색 인터페이스 제공.
  - `src/explorer.ts`: 폴더 열기/닫기/새로고침, 하위 폴더 접기/펼치기, 파일/폴더 실시간 검색 필터, 마지막 열린 폴더 기억(`localStorage`), 클릭 시 에디터 탭으로 열기 연동.
  - 우클릭 컨텍스트 메뉴 (`#explorer-menu`):
    - 파일: 에디터에서 열기, 경로 복사, 파일 탐색기에서 보기(Windows `explorer /select`), 파일 삭제(확인 대화상자).
    - 폴더: 새 INI 파일 만들기, 폴더 경로 복사, 파일 탐색기에서 열기, 새로고침, 폴더 삭제.
    - 빈 영역: 새 INI 파일 만들기, 새로고침, 파일 탐색기에서 열기, 폴더 닫기.
  - 단축키: `Ctrl + Shift + O` (모드 폴더 열기), `Ctrl + Shift + E` (탐색기 열기).

### 데스크톱 메인 메뉴바 & 좌측 수직 액티비티 바 (VS Code 스타일 레이아웃) (완료)
- **상단 툴바에 무질서하게 나열되어 있던 기능들을 표준 데스크톱 메뉴(파일, 편집, 보기, 도움말)로 정돈하고, 좌측 사이드바 탭을 VS Code 스타일의 세로 액티비티 바로 분리한다.**
- 구현:
  - `src/menubar.ts`:
    - **파일**: 새 파일(`Ctrl+N`), 열기(`Ctrl+O`), 모드 폴더 열기(`Ctrl+Shift+O`), 최근 파일(서브메뉴 동적 로딩), 저장(`Ctrl+S`), 다른 이름으로 저장(`Ctrl+Shift+S`), 백업 복원, 현재 탭 닫기(`Ctrl+W`).
    - **편집**: 실행 취소(`Ctrl+Z`), 다시 실행(`Ctrl+Y`), 찾기(`Ctrl+F`), 바꾸기(`Ctrl+H`), 서식 정리(`Alt+Shift+F`), 스니펫 템플릿 삽입(그룹별 서브메뉴), 오류 검사(`F7`).
    - **보기**: 사이드바 토글(`Ctrl+B`), 탐색기 열기(`Ctrl+Shift+E`), 섹션 목록 열기, 모든 섹션 접기/펴기, 미니맵/자동 줄 바꿈/공백 표시 체크 토글.
    - **도움말**: 단축키 및 정보(`F1`), 환경설정(`Ctrl+,`), 업데이트 확인, GitHub 저장소 열기.
    - 호버 전환(메뉴가 열려있을 때 다른 메뉴 마우스 이동 시 즉시 전환) 및 화면 경계 보정 지원.
  - `src/activitybar.ts`:
    - 화면 맨 좌측에 48px 폭의 세로 액티비티 바 배치.
    - 상단: `📁 탐색기`, `📑 섹션 목록`, `🧩 코드 템플릿` (활성 아이콘 다시 클릭 시 사이드바 접기/펼치기 토글, 다른 아이콘 클릭 시 즉시 뷰 전환).
    - 하단: `⚙ 환경설정`, `❓ 도움말`.
  - 사이드바 스플릿 리사이저가 액티비티 바 폭을 고려하여 매끄럽게 계산되도록 연동.

### 코드 템플릿 탐색 패널 및 사용자 정의 템플릿 등록 (완료)
- **자주 쓰는 모딩 코드 조각 및 조건문을 사이드바 템플릿 탭에서 한눈에 탐색/검색하고, 사용자가 직접 새 템플릿을 등록/관리할 수 있어야 한다.**
- 구현:
  - `src/template-panel.ts`: 사이드바 3번째 탭으로 템플릿 전용 패널 제공. 템플릿 카드 클릭 시 현재 에디터 커서 위치에 즉시 스니펫 삽입.
  - 템플릿 추가/관리: 상단 `+ 추가` 버튼으로 모달을 띄워 템플릿 이름, 그룹/분류, 설명, 코드(플레이스홀더 포함)를 입력받아 `localStorage`에 영구 저장.
  - 사용자 등록 템플릿은 '사용자' 배지가 표시되며 삭제(`🗑`) 기능 지원.
  - 상단 메뉴바(`편집` -> `스니펫 템플릿 삽입`)와도 실시간 연동되어 등록한 커스텀 템플릿이 즉시 서브메뉴에 반영됨.

### 플러그인 및 확장 기능 시스템 (완료)
- **에디터 기능을 무한히 확장할 수 있는 플러그인 런타임과, 좌측 액티비티 바(🧩) 연동 및 기본 3대 플러그인을 제공한다.**
- 구현:
  - **백엔드 (`src-tauri/src/plugins.rs`, `src-tauri/src/lib.rs`)**:
    - `exec_process`: Windows 환경에서 콘솔 창 깜빡임이 없도록 `CREATE_NO_WINDOW (0x08000000)` 플래그를 적용하여 Python 등 외부 프로세스를 백그라운드로 안전하게 실행.
    - `read_binary_file`: 텍스처 파일(.dds 등) 바이트 스트림 로드.
    - `list_disk_plugins`, `save_disk_plugin`, `open_plugins_folder`: 앱데이터 `plugins/` 폴더 관리 및 동적 플러그인 스캔.
  - **플랫폼 추상화 계층 (`src/platform/`)**:
    - `Platform` 인터페이스에 플러그인 프로세스 실행 및 바이너리 파일 입출력 메서드 정의. 웹 환경을 위한 fallback 로직 구현.
  - **플러그인 코어 매니저 (`src/plugins/manager.ts`, `src/plugins/types.ts`)**:
    - 플러그인 수명주기(`activate`, `deactivate`), `localStorage` 활성화 상태 영구화, 샌드박스형 `PluginContext` API (문서 접근, 에디터 조작, 파일 트리 탐색, 모달/토스트 알림, 프로세스 실행, 사이드바 뷰 등록).
  - **기본 3대 내장 플러그인 (`src/plugins/builtin.ts`)**:
    1. **Python Runner (`python-runner`)**: 인라인 코드/스크립트 파일 실행, 실시간 stdin/stdout 콘솔 출력, 에디터 커서 결과 삽입.
    2. **Asset Viewer (`asset-viewer`)**: 현재 문서의 `filename = ` 텍스처 참조 자동 스캔, 외부 의존성 없는 자체 순수 TS DXT1/3/5/BGRA32 디코더(`src/plugins/dds-decoder.ts`)를 통한 체커보드 캔버스 렌더링.
    3. **AI Assistant (`ai-assistant`)**: OpenAI/Ollama 호환 엔드포인트 대화형 모딩 어시스턴트, 코드 원클릭 삽입.
  - **UI 통합 (`src/plugin-panel.ts`, `index.html`, `src/activitybar.ts`)**:
    - 좌측 액티비티 바 4번째 탭 `act-plugins` (`🧩`, `Ctrl+Shift+X`).
    - 상단 서브 탭(관리 목록 / 각 활성화된 플러그인의 전용 UI 뷰) 전환 및 토글 스위치 제공.


## 배포 방식 (설치형 + 웹, 둘 다 지원)

같은 소스에서 두 가지 결과물을 만든다.

| | 설치형 (Tauri) | 웹 (GitHub Pages) |
|---|---|---|
| 대상 | 일반 사용자 (기본 배포) | 설치 없이 바로 써 보기, 설치가 어려운 환경 |
| 파일 열기/저장 | OS 파일 대화상자, 원본 위치에 바로 저장 | File System Access API (Chrome/Edge). Firefox/Safari는 열기=업로드, 저장=다운로드 |
| 설정/백업 | `%APPDATA%\MigotoStudio` | 브라우저 저장소 (localStorage / IndexedDB) |
| CP949 | Rust(`encoding_rs`) | `TextDecoder('euc-kr')`로 읽기, 쓰기는 변환 표를 직접 생성 |
| 경로 검사(파일 존재 여부 등) | 가능 | 제한적 (폴더 접근 권한을 받은 경우만) |
| 업데이트 | GitHub Releases (아래) | 새로 배포하면 자동 반영 |

### 구조 방침: 플랫폼 계층 분리 (완료)
- 화면/에디터/문법/린트 코드는 `invoke`나 Tauri API를 직접 부르지 않고, `Platform` 인터페이스(`src/platform/types.ts`)를 통해 동작합니다.
- 데스크톱(`src/platform/desktop.ts`)과 웹(`src/platform/web.ts`) 구현이 분리되어 있어 동일한 비즈니스 로직으로 배포됩니다.
- 린트 엔진(`src/lint.ts`) 역시 독립적인 순수 로직으로 동작하여 모든 환경에서 일관되게 오류를 검사합니다.

### 설치형 업데이트 및 배포: GitHub Releases
- GitHub Actions 워크플로(`.github/workflows/release.yml`)가 태그(`v*`) 푸시 또는 수동 실행 시 Windows 설치 파일(NSIS `.exe`)과 무설치 포터블 압축 파일(`.zip`)을 빌드하여 GitHub Releases에 자동 등록합니다.
- 번들 대상을 NSIS(`"targets": ["nsis"]`)로 지정하여 불필요한 WiX `.msi` 생성과 CI 빌드 오버헤드를 없애고, 사용자에게 친숙한 단일 `.exe` 설치 프로그램을 배포합니다.
- 설치형은 NSIS 설치 프로그램을 기본으로 합니다 (제거 시 앱 데이터 삭제 옵션 훅 적용).
- 포터블 버전은 실행 파일과 `portable.txt`가 동봉되어 프로그램 폴더 내 `data/`에 데이터를 격리 보관합니다.
- 코드 서명 인증서가 없으면 Windows SmartScreen 경고가 뜰 수 있으므로 README에 안내하고, 추후 필요 시 도입을 검토합니다.

### 웹 배포: GitHub Pages
- GitHub Actions가 웹 빌드를 만들어 Pages에 배포한다. 같은 릴리스 태그에서 설치 파일과 웹이 함께 나간다.
- 정적 호스팅이라 서버가 필요 없고, 파일은 사용자 PC 밖으로 나가지 않는다 (브라우저 안에서만 처리). 이 점을 웹 화면에 명시한다.
- PWA 지원 완료: 웹 매니페스트와 서비스 워커(`sw.js`)를 통해 인터넷 연결이 끊겨도 오프라인에서 온전히 동작하며, 브라우저 주소창이나 상단 '앱 설치' 버튼을 통해 독립 창 앱으로 설치할 수 있습니다.

## 설정/최근 파일 저장 위치

- 설정과 최근 파일 목록은 **같은 파일 `settings.json`** 에 저장된다. 이 파일은 앱 데이터 폴더(`MigotoStudio`) 안에 있어 백업과 함께 한 곳에서 관리된다.
- 개발 실행 중에는 프로젝트의 `data/settings.json`이다.

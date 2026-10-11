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
| 플러그인 | JS/TS 우선. 외부 프로세스(Python 등)는 후속 (우선순위 낮음) |

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

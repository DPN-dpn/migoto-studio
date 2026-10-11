# Migoto Studio

XXMI / 3DMigoto `.ini` 파일을 위한 가벼운 에디터입니다.
메모장으로 ini를 고치던 분들이, VS Code와 확장 프로그램을 따로 설치하지 않고도 **색 구분, 자동 완성, 섹션 목록, 자동 백업**을 쓸 수 있도록 만들고 있습니다.

> [!NOTE]
> **AI로 만든 프로젝트입니다.** 이 프로젝트의 코드는 AI 코딩 도우미와 함께 작성한 "바이브 코딩" 결과물입니다. 사람이 방향을 정하고 결과를 확인하지만, 코드 전체를 한 줄씩 직접 검토한 것은 아닙니다. 중요한 파일은 항상 백업을 두고 사용해 주세요. (앱도 저장할 때 자동으로 백업합니다.)

> **릴리스 및 웹 버전**:
> - **데스크톱 앱 다운로드**: [GitHub Releases](https://github.com/DPN-dpn/migoto-studio/releases/latest)에서 설치형(`.exe`) 및 포터블(`.zip`) 버전을 다운로드할 수 있습니다.
> - **웹 버전 (설치 불필요)**: [Migoto Studio Web](https://dpn-dpn.github.io/migoto-studio/)에서 브라우저로 바로 사용할 수 있습니다.

## 주요 기능

- **구문 강조**: 섹션, 변수, 명령어, `if`/`endif`, 경로 등을 색으로 구분합니다.
- **스마트 자동 완성**:
  - `$` 입력 시 문서에 선언된 변수 목록과 초기값/설명을 팝업으로 추천합니다.
  - `vb0 = `, `ib = `, `Resource = ` 등 슬롯 할당 시 정의된 `[Resource...]` 목록 및 `null`을 자동완성합니다.
  - `run = `, `post run = ` 입력 시 `[CommandList...]` 및 `[CustomShader...]` 목록을 제안합니다.
  - `format = ` 입력 시 주요 DXGI 버퍼 포맷 목록을 보여줍니다.
  - 줄 맨 앞에서 `[` 입력 시 자주 쓰이는 섹션 템플릿(`[Constants]`, `[KeyToggle]`, `[Present]` 등)을 스니펫으로 삽입할 수 있습니다.
- **다중 파일 탭 (Multi-Tab)**:
  - 여러 `.ini` 파일을 동시에 열어두고 탭으로 자유롭게 전환하며 비교/편집할 수 있습니다.
  - 각 탭마다 독립된 실행 취소/다시 실행(Undo/Redo) 및 스크롤/커서 위치를 온전히 보존합니다.
  - 탭 닫기(`Ctrl+W`), 다음/이전 탭 전환(`Ctrl+Tab` / `Ctrl+Shift+Tab`), 마우스 휠 클릭 닫기, 우클릭 메뉴(다른 탭 닫기, 저장 등)를 지원합니다.
- **모드 폴더 파일 트리 탐색기 (Explorer)**:
  - 개별 파일뿐만 아니라 모드 폴더 전체를 열어 하위 폴더와 `.ini` 파일 목록을 계층적 트리로 탐색할 수 있습니다.
  - 파일 및 폴더 실시간 검색 필터, 폴더 접기/펼치기, 클릭 시 에디터 탭으로 즉시 열기를 지원합니다.
  - 사이드바 상단 탭(`[📁 탐색기]` / `[📑 섹션 목록]`)으로 모드 파일 탐색과 INI 섹션 목록을 원클릭으로 손쉽게 전환할 수 있습니다.
  - 툴바의 '폴더 열기' 버튼 또는 `Ctrl + Shift + O` 단축키로 모드 폴더를 바로 열 수 있습니다.
- **템플릿 삽입 메뉴**: 툴바의 '삽입' 버튼으로 `if` 조건문 및 섹션 템플릿을 한 번의 클릭으로 넣을 수 있습니다.
- **섹션 목록 패널**: `[Key…]`, `[Resource…]` 등을 종류별로 묶어 보여주고, 클릭하면 그 위치로 이동합니다.
- **안전한 저장**
  - 저장하기 전 이전 내용을 앱 데이터 폴더에 **자동 백업**합니다. (기본 7일, 파일당 10개) 원본 파일 옆에는 아무것도 만들지 않습니다.
  - **백업에서 복원**으로 이전 저장본을 불러올 수 있습니다.
  - 저장하지 않고 닫으려 하면 확인을 묻습니다.
- **실시간 오류 검사 (린트)**:
  - 닫히지 않은 `if`/`endif`, 누락된 `]` 대괄호, 중복 섹션 정의, 누락된 `[Resource]` 참조 등을 실시간으로 감지합니다.
  - 조건문 안에서 비교 시 실수로 `=`를 썼을 때(`if $x = 1`) `==` 비교 연산자 안내를 제공합니다.
  - 하단 상태 표시줄의 문제 버튼을 클릭하면 다음 오류/경고 위치로 바로 이동할 수 있습니다.
  - 설정의 **'오류 검사'** 탭에서 규칙별로 자유롭게 켜고 끌 수 있습니다.
- **툴바 편의 기능**: 섹션 목록 패널 및 미니맵을 아이콘 버튼으로 즉시 토글할 수 있습니다.
- **도움말 및 단축키 안내 (`F1` / `?` 버튼)**:
  - 툴바 우측의 `?` 아이콘이나 `F1` 키를 눌러 자주 쓰는 단축키 목록과 스마트 자동완성 팁을 한눈에 확인할 수 있습니다.
  - 프로그램 버전, 문법 엔진 정보, 라이선스 및 데이터 저장 위치를 쉽게 확인할 수 있습니다.
- **설정 탭**: 화면, 편집, 백업, 오류 검사 설정을 깔끔한 탭 형식으로 쉽게 조정할 수 있습니다.
- **웹 버전 및 데스크톱 둘 다 지원**:
  - 윈도우 설치형 프로그램(NSIS `.exe`) 및 무설치 포터블 압축 파일(`.zip`)을 GitHub Releases에서 제공합니다.
- **데스크톱 앱 자동 업데이트 & 확인 (`tauri-plugin-updater`)**:
  - 앱 시작 시 백그라운드에서 최신 버전을 감지하거나, 도움말(`F1`) 화면의 '업데이트 확인' 버튼으로 최신 버전을 확인할 수 있습니다.
  - 설치형 프로그램(NSIS)의 경우 새 버전 발견 시 원클릭으로 다운로드 및 자동 업데이트/재시작을 지원합니다.
  - 포터블(무설치) 버전 및 웹 버전에서도 최신 릴리스 정보와 다운로드 안내를 제공합니다.
  - 설정의 '화면' 탭에서 '시작 시 업데이트 자동 확인' 옵션을 자유롭게 켜고 끌 수 있습니다.

### 계획 중

- 플러그인/애드온 지원 (JS/TS 우선)

자세한 결정 사항은 [docs/DECISIONS.md](docs/DECISIONS.md)에 있습니다.

## 원본 확장과의 관계

구문 강조 문법은 VS Code 확장 [**3DMigoto INI** (`agmg.migoto-ini`)](https://open-vsx.org/extension/agmg/migoto-ini)의 TextMate 문법을 **수정 없이 그대로** 사용합니다. 확장이 업데이트되면 [`scripts/sync-upstream.mjs`](scripts/sync-upstream.mjs)로 최신 문법을 받아 반영합니다.

- 원본 저장소: <https://github.com/lupomikti/migoto-vscode>
- 현재 반영된 버전: `upstream/VERSION` 참고
- 원본이 GPL-3.0이므로 이 프로젝트도 **GPL-3.0-or-later**로 공개됩니다. 원본 저작자와 기여자에게 감사드립니다.

## 데이터 저장 위치

설정, 최근 파일 목록, 백업은 모두 **하나의 폴더**에서 관리됩니다.

| 환경 | 위치 |
|---|---|
| Windows | `%APPDATA%\MigotoStudio\` |
| macOS | `~/Library/Application Support/MigotoStudio/` |
| Linux | `~/.local/share/MigotoStudio/` |
| 개발 실행 (`dev.ps1`) | 프로젝트의 `data/` 폴더 |
| 포터블 모드 | 프로그램 옆에 `portable.txt`를 두면 프로그램 옆 `data/` 폴더 |

```
MigotoStudio/
├─ settings.json   # 설정 + 최근 파일 목록
├─ backups/        # 자동 백업
└─ webview2/       # 화면 엔진 캐시
```

기본적으로 백업 보존을 위해 프로그램을 삭제해도 이 폴더는 남겨둘 수 있으며, 프로그램 제거(삭제) 화면에서 **"앱 데이터 삭제" 체크박스**를 선택하면 앱 데이터 폴더까지 한 번에 깨끗하게 삭제됩니다.

## 개발

### 요구 사항
- Windows 10/11
- Visual Studio 또는 Build Tools의 **C++ 데스크톱 개발** 구성 요소 (Rust 컴파일에 필요)
- Git, PowerShell

Node.js와 Rust는 **프로젝트 폴더 안(`.toolchain/`)에만** 설치됩니다. 시스템 PATH나 레지스트리는 바뀌지 않습니다.

### 시작하기

```powershell
.\setup.ps1     # 처음 한 번: Node.js, Rust를 .toolchain/ 에 설치
.\dev.ps1       # 개발 실행 (처음에는 Rust 빌드로 몇 분 걸립니다)
```

```powershell
.\dev.ps1 npm test                                          # 유닛 테스트 실행 (16개 항목 검증)
.\dev.ps1 npm run build                                     # 프런트엔드 빌드 + 타입 검사
.\dev.ps1 cargo test --manifest-path src-tauri/Cargo.toml   # Rust 테스트
.\dev.ps1 node scripts/sync-upstream.mjs                  # 원본 확장의 최신 문법 가져오기
```

### 빌드 및 배포 방법

#### 1. 데스크톱 앱 정규 릴리스 배포 (GitHub Releases)
버전을 올리고 공식 릴리스를 배포할 때 사용합니다:
```powershell
# 1) 버전 일괄 올리기 (package.json, tauri.conf.json, Cargo.toml 3개 파일 동시 동기화)
.\dev.ps1 npm run bump:patch       # 패치 버전 올리기 (0.1.0 -> 0.1.1)
# 또는 .\dev.ps1 npm run bump:minor # 마이너 버전 올리기 (0.1.0 -> 0.2.0)
# 또는 .\dev.ps1 npm run bump 0.2.0 # 특정 버전 직접 지정

# 2) 변경사항 커밋 및 태그 푸시
git add .
git commit -m "릴리스 v0.1.1"
git push origin main
git tag v0.1.1
git push origin v0.1.1
```
- 푸시 즉시 GitHub Actions가 자동으로 실행되어 **설치형 인스톨러(`.exe`)**와 **무설치 포터블 압축 파일(`.zip`)**을 빌드하고, GitHub Releases 페이지에 다운로드 파일과 함께 릴리스를 등록합니다.
- *(참고: 로컬에서 버전 변경을 깜빡했더라도, GitHub Actions가 푸시된 태그 이름에 맞춰 모든 설정 파일의 버전을 자동으로 동기화한 후 빌드합니다.)*
- 태그 푸시 대신 깃허브 웹사이트의 **Actions > "Release Desktop App" > "Run workflow"**를 눌러 수동으로 즉시 릴리스를 빌드할 수도 있습니다.

#### 2. 웹 버전 배포 (GitHub Pages / PWA)
웹 소스(`src/`, `public/`, `index.html` 등)를 수정한 뒤 `main` 브랜치에 푸시하면 자동으로 배포됩니다:
```powershell
git push origin main          # 웹 앱 관련 파일 변경 시 GitHub Pages에 자동 반영
```

#### 3. 내 PC에서 로컬 직접 빌드
깃허브 서버를 거치지 않고 내 PC에서 바로 실행/설치 파일을 만들 때 사용합니다:
```powershell
.\dev.ps1 npm run build             # 웹 정적 파일 빌드 (dist/ 생성)
.\dev.ps1 npm run tauri build       # 윈도우 설치형 파일(.exe) 로컬 빌드
# 생성 위치: src-tauri\target\release\bundle\nsis\Migoto Studio_<버전>_x64-setup.exe
```

### 개발 환경 제거
프로젝트 폴더를 삭제하면 개발 도구가 모두 사라집니다. 개발 실행 중 생긴 데이터도 프로젝트의 `data/`에만 있습니다.

### 구조

```
upstream/     원본 확장에서 받은 문법/스니펫 (수정 금지, 자동 갱신)
src/          화면(TypeScript): 에디터, 설정, 섹션 목록, 삽입 메뉴 …
src-tauri/    Tauri(Rust): 파일 읽기/쓰기, 인코딩, 백업, 데이터 폴더
scripts/      원본 확장 동기화 스크립트
docs/         설계 결정 기록
```

기술 스택: [Tauri 2](https://tauri.app) + [Monaco Editor](https://microsoft.github.io/monaco-editor/) + TypeScript(Vite).

## 라이선스

[GPL-3.0-or-later](LICENSE)

# Migoto Studio

XXMI / 3DMigoto `.ini` 파일을 위한 가벼운 에디터입니다.
메모장으로 ini를 고치던 분들이, VS Code와 확장 프로그램을 따로 설치하지 않고도 **색 구분, 자동 완성, 섹션 목록, 자동 백업**을 쓸 수 있도록 만들고 있습니다.

> [!NOTE]
> **AI로 만든 프로젝트입니다.** 이 프로젝트의 코드는 AI 코딩 도우미와 함께 작성한 "바이브 코딩" 결과물입니다. 사람이 방향을 정하고 결과를 확인하지만, 코드 전체를 한 줄씩 직접 검토한 것은 아닙니다. 중요한 파일은 항상 백업을 두고 사용해 주세요. (앱도 저장할 때 자동으로 백업합니다.)

> 개발 중인 프로젝트입니다. 아직 설치 파일이나 웹 버전은 배포되지 않았습니다.

## 주요 기능

- **구문 강조**: 섹션, 변수, 명령어, `if`/`endif`, 경로 등을 색으로 구분합니다.
- **자동 완성 / 삽입 메뉴**: `if` 같은 조건문과 자주 쓰는 섹션(키 전환, TextureOverride, Resource 등)을 버튼으로 넣습니다.
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
- **설정 탭**: 화면, 편집, 백업, 오류 검사 설정을 깔끔한 탭 형식으로 쉽게 조정할 수 있습니다.
- **웹 버전 및 데스크톱 둘 다 지원**: 프로그램 설치 없이 브라우저(GitHub Pages)에서 바로 사용할 수 있으며, 설치형 프로그램으로도 사용할 수 있습니다.

### 계획 중

- 플러그인/애드온 지원 (JS/TS 우선)
- 데스크톱 설치 프로그램의 자동 업데이트 (GitHub Releases 연동)

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

프로그램을 삭제해도 이 폴더는 남습니다. 완전히 지우려면 폴더를 직접 삭제하세요. (설치 프로그램에 "앱 데이터도 삭제" 옵션을 넣을 예정입니다.)

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
.\dev.ps1 npm run build                                  # 프런트엔드 빌드 + 타입 검사
.\dev.ps1 cargo test --manifest-path src-tauri/Cargo.toml  # Rust 테스트
.\dev.ps1 node scripts/sync-upstream.mjs                 # 원본 확장의 최신 문법 가져오기
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

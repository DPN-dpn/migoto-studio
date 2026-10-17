# Migoto Studio 개발 에이전트 지침서 (Repository AGENTS.md)

이 문서는 Migoto Studio 코드베이스를 수정하거나 기능을 추가하는 AI 개발 에이전트를 위한 핵심 개발 및 협업 지침서입니다.

---

## 1. Git 브랜치 전략 및 작업 워크플로우 (필수 준수)

> [!IMPORTANT]
> **모든 개발 및 수정 작업은 반드시 `dev` 브랜치에서 진행해야 합니다.**

1. **`dev` 브랜치**:
   - 신규 기능 구현, 버그 수정, 플러그인 개발, 리팩터링, 문서 업데이트 등 모든 일상 작업은 `dev` 브랜치에서 수행합니다.
   - 작업을 시작하기 전 항상 `git branch`를 확인하고, `dev` 브랜치에 위치해 있는지 검증하세요 (`git checkout dev`).
2. **`main` 브랜치**:
   - `main` 브랜치는 정식 릴리스(`vX.Y.Z`)를 위한 안정 배포 전용 브랜치입니다.
   - `dev` 브랜치에서 테스트 및 기능 검증이 완전히 끝난 후, 정식 릴리스 절차(`npm run release` 또는 릴리스 커밋)를 통해서만 `main`으로 병합됩니다.
   - **`main` 브랜치에 직접 코드를 커밋하거나 푸시하지 마세요.**
3. **GitHub Wiki 저장소 (`migoto-studio.wiki`)**:
   - 위키 저장소 또한 `dev` 브랜치에서 문서를 수정한 후 `master` 브랜치로 병합하여 양쪽 브랜치를 동기화합니다.

---

## 2. 프로젝트 아키텍처 및 핵심 설계 원칙 (`DECISIONS.md`)

1. **코어 탈종속화 (Decoupled Core)**:
   - 코어 에디터는 플러그인에 종속되지 않습니다. 모든 플러그인이 제거되더라도 핵심 기능(에디터, 린터, 파일 탐색, Diff 등)은 온전히 작동해야 합니다.
   - 플러그인은 오직 공식 `PluginContext` API(`context.ui`, `context.editor`, `context.ini`, `context.workspace` 등)를 통해서만 상호작용합니다.
2. **독립 도구체계 (`.toolchain/`)**:
   - 개발 환경과 종속성은 시스템 전역을 오염시키지 않고 프로젝트 내 `.toolchain/`을 사용합니다.
3. **사용자 데이터 격리**:
   - 정식 배포판: `%APPDATA%\MigotoStudio`
   - 개발 및 로컬 테스트: 프로젝트 루트의 `data/` (실제 사용자 데이터를 침범하지 않음)
   - 포터블 모드: 실행 파일 옆에 `portable.txt`가 존재하면 `data/`를 앱데이터로 간주.
4. **INI 구조 보존 및 Monaco 히스토리 보호**:
   - INI 파일 조작 시 단순 문자열 치환 대신 `context.ini.upsertSection`, `context.ini.merge` 등을 활용하여 사용자의 기존 주석과 섹션 배치를 최대한 보존합니다.
   - Monaco 에디터 변경 시 `context.editor.setText()`를 사용하여 실행 취소(`Ctrl+Z`) 히스토리를 유지합니다.

---

## 3. 관련 문서 안내

- **설계 결정 및 이력**: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- **공식 플러그인 API 명세**: [`docs/PLUGIN_API.md`](docs/PLUGIN_API.md)
- **외부 AI 플러그인 제작 프롬프트 가이드**: [`docs/AGENTS.md`](docs/AGENTS.md)

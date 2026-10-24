# Migoto Studio 모듈형 플러그인 API 문서 (Modular Plugin API)

Migoto Studio 플러그인 개발 및 AI 어시스턴트(ChatGPT, Claude, Cursor 등) 연동 시 **토큰 낭비를 최소화하고 필요한 도메인만 즉시 참조**할 수 있도록 설계된 모듈형 API 문서 모음입니다.

---

## 📚 모듈별 문서 안내

| 모듈 문서 | 주요 다루는 내용 | 권장 사용 시나리오 | 예상 분량 |
| :--- | :--- | :--- | :---: |
| **[`01-structure-and-lifecycle.md`](./01-structure-and-lifecycle.md)** | `plugin.json` 매니페스트, 가상 모듈 링커(ESM 다중 파일), `activate` / `deactivate`, 자동 리소스 정리 | 플러그인 최초 생성, 파일 분할 및 생명주기 관리 | ~80줄 |
| **[`02-ui.md`](./02-ui.md)** | 선언형 폼 탭(`openFormTab`), 커스텀 탭(`openTab`), 서브 윈도우(`openSubWindow`), 네이티브 OS 창(`openNativeWindow`), UI 빌더 위젯(`createButton`, `createInput`, `createKeyInput`, `createChipGroup` 등), 테마 조회/감지 | GUI 패널, 마법사 폼, 3D/텍스처 프리뷰 창 제작 시 | ~1,000줄 |
| **[`03-ini.md`](./03-ini.md)** | 3DMigoto/XXMI 파싱, `formatKeyToggle`, `upsertSection`, `deleteSection`, Raw 섹션 조작, 고속 심볼 추출(`extractSymbols`) | INI 수정, 토글 키 생성, 단축키 변환 및 검사 시 | ~95줄 |
| **[`04-workspace.md`](./04-workspace.md)** | 파일/바이너리 읽기·쓰기, 디렉터리 순회, glob 고속 검색(`findFiles`), 전역 검색(`search`), 탭 제어, 저장/닫기/메모리 이벤트(`onDidSaveFile`, `onDidCloseTab`, `onDidClearMemory`) | 모드 파일 탐색, 캐시 동기화, 백업 생성 시 | ~100줄 |
| **[`05-editor.md`](./05-editor.md)** | Monaco 텍스트 읽기/쓰기(`getText`, `setText`), 커서 이동, 컨텍스트 메뉴 액션, 인라인 변경 제안(`proposeChanges`) | Monaco 에디터 직접 조작, 선택 영역 치환 시 | ~35줄 |
| **[`06-storage-and-system.md`](./06-storage-and-system.md)** | 격리 영구 스토리지(`context.storage`), 외부 프로세스 실행(`context.system.exec`), 전용 콘솔 로거(`context.logger`), `fetch` | 플러그인 설정 저장, Python/CLI 툴 연동, 디버그 로깅 시 | ~55줄 |
| **[`07-linter-and-templates.md`](./07-linter-and-templates.md)** | 전용 리소스/변수 화이트리스트 등록, 커스텀 린트 규칙(`registerRule`), 사후 진단 필터(`registerDiagnosticFilter`), 코드 템플릿 | 프레임워크 문법 검증 확장 및 자동완성 스니펫 등록 시 | ~95줄 |
| **[`08-examples-and-guides.md`](./08-examples-and-guides.md)** | 단일 파일 실전 플러그인 예제, 다중 파일 모듈화 플러그인 예제, `.zip` 패키징 및 설치 방법 | 완성형 플러그인 보일러플레이트 참조 시 | ~170줄 |
| **[`09-slots.md`](./09-slots.md)** | 3D 모델 및 텍스처 슬롯 매칭 API (`context.slots`), 부위별 슬롯 조회, 커스텀 텍스처 리졸버(`registerTextureSlotResolver`) | 부위별 모델/텍스처 추적, 게임별 슬롯픽스(ZZMI 등) 확장 시 | ~100줄 |

---

## 💡 AI 프롬프트 전달 시 토큰 절약 팁

- **전체 문서를 모두 전달하지 마세요**:  
  예전처럼 1,700줄이 넘는 단일 문서를 AI에 전부 넣으면 프롬프트 1회당 20,000~30,000 토큰이 소모됩니다.
- **필요한 모듈 파일만 조합하여 전달**:
  - 예: "토글 키 설정 폼 플러그인을 만들고 싶다" ➔ [`docs/AGENTS.md`](../AGENTS.md) + [`02-ui.md`](./02-ui.md) + [`03-ini.md`](./03-ini.md)만 첨부
  - 예: "모드 폴더 내 파일 변경과 캐시를 동기화하고 싶다" ➔ [`docs/AGENTS.md`](../AGENTS.md) + [`04-workspace.md`](./04-workspace.md)만 첨부
  - ➔ **프롬프트 토큰이 80~95% 절약**되며, AI의 답변 정확도와 집중도 또한 대폭 향상됩니다.

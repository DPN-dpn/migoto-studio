# Python 스크립트 실행기 플러그인 (Python Runner Plugin)

이 플러그인은 Migoto Studio의 플러그인 API 및 고수준 UI 빌더 API를 활용하는 표준 도구 플러그인 예제입니다.

## 개요
- **플러그인 ID**: `python-runner`
- **버전**: `1.0.0`
- **카테고리**: `tools`
- **위치**: 좌측 사이드바 탭 (PY)

## 디렉터리 구조
```
python-runner/
├── plugin.json       # 플러그인 매니페스트 (ID, 이름, 아이콘, 진입점)
├── index.ts          # 플러그인 생명주기 진입점 (플러그인 API 기반 구현)
└── README.md         # 플러그인 설명 문서
```

## 플러그인 API 활용
원시 HTML 문자열이나 복잡한 DOM 생성 코드 대신, Migoto Studio가 제공하는 타입 안전한 고수준 API로 UI와 기능을 구성합니다.

### 1. UI 빌더 API (`context.ui`)
- `context.ui.createPanelHeader(title)`: 일관된 스타일의 패널 섹션 헤더 생성
- `context.ui.createSelect(options)`: 라벨 및 이벤트 처리가 내장된 선택 드롭다운 생성
- `context.ui.createInput(options)`: 텍스트/비밀번호 입력 폼 필드 생성
- `context.ui.createCheckbox(options)`: 상태 제어 및 라벨 결합형 체크박스 생성
- `context.ui.createCodeEditor(options)`: 구문 편집용 텍스트 영역 및 값 읽기/쓰기 헬퍼
- `context.ui.createConsole(options)`: 실시간 로그 출력, 지우기 버튼이 포함된 콘솔 뷰어
- `context.ui.createButton(options)`: 테마에 맞는 버튼 생성 (`primary`, `secondary`, `small`)
- `context.ui.createButtonRow(buttons)`: 액션 버튼 그룹 레이아웃

### 2. 코어 시스템 및 에디터 API
- `context.system.exec(cmd, args, cwd)`: 외부 프로세스(Python 등) 비동기 실행 및 stdout/stderr 획득
- `context.editor.insertText(text)`: 실행 결과를 Monaco 에디터 커서 위치에 바로 삽입
- `context.storage.get(key, default)` / `set(key, value)`: 플러그인별 독립 설정 영속화
- `context.ui.showToast(message, type)`: 사용자 알림 토스트 출력

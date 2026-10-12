# AI 모딩 어시스턴트 플러그인 (AI Assistant Plugin)

이 플러그인은 Migoto Studio의 플러그인 API 및 LLM 통신(`context.fetch`), 고수준 UI 빌더 API를 활용하는 AI 에이전트 플러그인 예제입니다.

## 개요
- **플러그인 ID**: `ai-assistant`
- **버전**: `1.0.0`
- **카테고리**: `ai`
- **위치**: 좌측 사이드바 탭 (AI)

## 디렉터리 구조
```
ai-assistant/
├── plugin.json       # 플러그인 매니페스트 (ID, 이름, 아이콘, 진입점)
├── index.ts          # 플러그인 생명주기 진입점 (플러그인 API 기반 구현)
└── README.md         # 플러그인 설명 문서
```

## 플러그인 API 활용
복잡한 수동 DOM 조작 대신 타입 안전한 고수준 API로 대화창, 설정 패널, 코드 블록을 구성합니다.

### 1. UI 빌더 API (`context.ui`)
- `context.ui.createPanelHeader(title)`: 상단 타이틀 생성
- `context.ui.createDetails(options)`: 접을 수 있는 설정 박스(API URL, 키, 모델 설정) 생성
- `context.ui.createInput(options)`: 설정 및 프롬프트 입력 필드 생성
- `context.ui.createCheckbox(options)`: 현재 파일 첨부 여부 토글 체크박스 생성
- `context.ui.createButton(options)`: 퀵 액션 프롬프트 및 전송 버튼 생성
- `context.ui.createChatMessage(options)`: 마크다운 코드 블록 자동 파싱, '에디터에 삽입' 및 '복사' 버튼이 내장된 대화 버블 생성

### 2. 네트워크 및 에디터 컨텍스트 API
- `context.fetch(url, options)`: OpenAI / Ollama 호환 엔드포인트로 REST POST 호출
- `context.workspace.getCurrentFile()`: 현재 작업 중인 파일 이름 및 경로 획득
- `context.editor.getText()`: 에디터 내 현재 INI 코드 내용을 프롬프트 컨텍스트에 포함
- `context.editor.insertText(code)`: AI가 생성한 INI 코드 블록을 에디터에 원클릭 삽입

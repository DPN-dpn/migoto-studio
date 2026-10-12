# AI 모딩 어시스턴트 플러그인 (AI Assistant Plugin)

이 플러그인은 Migoto Studio의 사이드바 뷰, 네트워크 요청(`context.fetch`), 워크스페이스 컨텍스트 연동을 활용하는 AI 에이전트 플러그인 예제입니다.

## 개요
- **플러그인 ID**: `ai-assistant`
- **버전**: `1.0.0`
- **카테고리**: `ai`
- **위치**: 좌측 사이드바 탭 (AI)

## 디렉터리 구조
```
ai-assistant/
├── plugin.json       # 플러그인 매니페스트 (ID, 이름, 아이콘, 진입점)
├── index.ts          # 플러그인 생명주기 진입점 (사이드바 뷰 등록, 대화 UI 및 API 연동)
└── README.md         # 플러그인 설명 문서
```

## 주요 활용 API
1. **사이드바 뷰 등록**: `context.ui.registerSidebarView()`
   - 액티비티 바에 전용 탭 아이콘을 추가하고 사이드바 패널을 렌더링합니다.
2. **네트워크 호출**: `context.fetch()`
   - OpenAI 호환 엔드포인트(`https://api.openai.com/v1/chat/completions` 또는 로컬 Ollama)로 REST POST 요청을 보냅니다.
3. **현재 문서 컨텍스트 참조**:
   - `context.workspace.getCurrentFile()`: 현재 열려 있는 파일 이름 및 경로 획득.
   - `context.editor.getText()`: 에디터 내 현재 코드 내용을 프롬프트에 포함.
4. **결과 코드 에디터 반영**:
   - `context.editor.insertText()`: 생성된 INI 코드 블록을 에디터에 직접 삽입.

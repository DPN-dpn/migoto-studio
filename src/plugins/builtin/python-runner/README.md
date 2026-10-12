# Python 스크립트 실행기 플러그인 (Python Runner Plugin)

이 플러그인은 Migoto Studio의 사이드바 뷰 등록 및 서브프로세스 실행 API를 활용하는 도구 플러그인 예제입니다.

## 개요
- **플러그인 ID**: `python-runner`
- **버전**: `1.0.0`
- **카테고리**: `tools`
- **위치**: 좌측 사이드바 탭 (PY)

## 디렉터리 구조
```
python-runner/
├── plugin.json       # 플러그인 매니페스트 (ID, 이름, 아이콘, 진입점)
├── index.ts          # 플러그인 생명주기 진입점 (사이드바 뷰 등록 및 실행 로직)
└── README.md         # 플러그인 설명 문서
```

## 주요 활용 API
1. **사이드바 뷰 등록**: `context.ui.registerSidebarView()`
   - 액티비티 바에 전용 탭 아이콘을 추가하고 사이드바 패널을 렌더링합니다.
2. **외부 프로세스 실행**: `context.system.exec(cmd, args, cwd)`
   - 사용자의 파이썬 인터프리터(`python`, `py`, `python3`)를 호출하여 스크립트를 비동기로 실행합니다.
3. **에디터 상호작용**: `context.editor.insertText()`
   - 실행 결과 또는 스크립트 출력을 현재 Monaco 에디터 커서 위치에 바로 삽입합니다.
4. **설정 영속화**: `context.storage.get()`, `context.storage.set()`
   - 사용자가 작성한 코드 및 실행 옵션을 localStorage에 안전하게 보관합니다.

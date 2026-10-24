# Migoto Studio 플러그인 개발 가이드 및 API 레퍼런스 (Master Hub)

Migoto Studio는 개발자가 에디터의 기능을 자유롭게 확장하고 자체 도구를 구축할 수 있도록 강력한 플러그인 시스템을 제공합니다.

> [!TIP]
> **모듈형 문서 분할 안내 (토큰 대폭 절약)**  
> 플러그인 API 문서가 방대해짐에 따라, **외부 플러그인 개발이나 AI 어시스턴트(ChatGPT, Claude, Cursor 등)에게 컨텍스트를 전달할 때 필요한 부분만 선별하여 토큰을 절약**할 수 있도록 모든 상세 명세가 [**`docs/plugin-api/`**](./plugin-api/README.md) 디렉터리에 도메인별로 분할되어 있습니다.  
> 작업 목적에 맞는 모듈 문서만 선택하여 참조하거나 프롬프트에 첨부하세요.

---

## 📌 모듈별 상세 문서 바로가기

| 모듈 문서 | 주요 다루는 내용 및 핵심 API | 파일 링크 |
| :--- | :--- | :---: |
| **01. 플러그인 구조 & 생명주기** | `plugin.json` 매니페스트, 가상 모듈 링커(ESM 다중 파일), `activate` / `deactivate`, 자동 클린업 | [**01-structure-and-lifecycle.md**](./plugin-api/01-structure-and-lifecycle.md) |
| **02. UI 확장 & UI 빌더** | 선언형 폼 탭(`openFormTab`), 커스텀 탭(`openTab`), 서브 윈도우(`openSubWindow`), 네이티브 OS 창(`openNativeWindow`), UI 빌더 위젯(`createButton`, `createInput`, `createKeyInput` 등), 테마 조회/감지 | [**02-ui.md**](./plugin-api/02-ui.md) |
| **03. INI 파싱 & 스마트 조작** | 3DMigoto/XXMI 파싱, `formatKeyToggle`, `upsertSection`, `deleteSection`, Raw 섹션 조작, 고속 심볼 추출(`extractSymbols`) | [**03-ini.md**](./plugin-api/03-ini.md) |
| **04. 워크스페이스 & 파일 I/O** | 파일/바이너리 I/O, 디렉터리 순회, glob 검색(`findFiles`), 전역 검색(`search`), 탭 제어, 저장/닫기/메모리 이벤트(`onDidSaveFile`, `onDidCloseTab`, `onDidClearMemory`) | [**04-workspace.md**](./plugin-api/04-workspace.md) |
| **05. Monaco 에디터 제어** | 텍스트 읽기/쓰기(`getText`, `setText`), 커서 이동, 우클릭 메뉴 액션, 인라인 변경 제안(`proposeChanges`) | [**05-editor.md**](./plugin-api/05-editor.md) |
| **06. 스토리지, 시스템 & 로거** | 격리 영구 스토리지(`context.storage`), 외부 CLI 프로세스 실행(`context.system.exec`), 전용 콘솔 로거(`context.logger`), `fetch` | [**06-storage-and-system.md**](./plugin-api/06-storage-and-system.md) |
| **07. 린터 & 코드 템플릿** | 허용 리소스/변수 화이트리스트, 커스텀 린트 규칙(`registerRule`), 사후 진단 필터(`registerDiagnosticFilter`), 코드 템플릿 | [**07-linter-and-templates.md**](./plugin-api/07-linter-and-templates.md) |
| **08. 종합 실전 예제 & 배포** | 단일 파일 실전 예제, 다중 파일 분할 실전 예제, `.zip` 패키징 및 설치 방법 | [**08-examples-and-guides.md**](./plugin-api/08-examples-and-guides.md) |
| **09. 3D 모델 및 텍스처 슬롯 매칭** | 모드 부위별 슬롯 조회(`context.slots.getSlots`), 커스텀 텍스처 슬롯 리졸버(`registerTextureSlotResolver`), 텍스처 수동 수정, ZZMI SlotFix 연동 | [**09-slots.md**](./plugin-api/09-slots.md) |
| **10. 플러그인 생명주기 및 상태 관리** | 플러그인 목록 및 상태 조회(`context.plugins.getPlugins`, `isEnabled`), 활성화/비활성화/설치/삭제 이벤트 감지(`onDidChangePlugins`) | [**10-plugins.md**](./plugin-api/10-plugins.md) |

---

## ⚡ 1분 퀵스타트 (핵심 코드 요약)

### 1. 기본 플러그인 구조 (`plugin.json` + `index.js`)

```json
// plugin.json
{
  "id": "my-plugin",
  "name": "내 커스텀 플러그인",
  "version": "1.0.0",
  "author": "Modder",
  "icon": "🎛️",
  "category": "tools",
  "location": "좌측 사이드바 탭",
  "main": "index.js"
}
```

```javascript
// index.js (ES Module, 번들러 불필요)
export default {
  activate(context) {
    // 상단 [플러그인] 메뉴에 등록
    context.ui.registerMenuItem({
      label: '내 도구 열기',
      shortcut: 'Ctrl+Shift+T',
      action: () => {
        openMyForm(context);
      },
    });
  },

  deactivate() {
    // 언로드 시 추가 정리 로직 (UI 및 이벤트 리스너는 코어가 자동 정리)
  },
};
```

---

### 2. 주요 네임스페이스 한눈에 보기

#### ① UI 확장 (`context.ui`) ➔ [상세 문서](./plugin-api/02-ui.md)
```typescript
// 선언형 폼 탭 열기 (초간단 마법사 GUI)
context.ui.openFormTab({
  id: 'my-wizard',
  title: '토글 키 마법사',
  icon: '🎛️',
  form: {
    title: '토글 키 설정',
    fields: [
      { id: 'section', type: 'text', label: '섹션명', default: 'KeyToggleOutfit' },
      { id: 'key', type: 'key', label: '단축키', default: 'VK_F4' }, // 실시간 키 감지 지원
    ],
    onSubmit: (values) => {
      context.ini.upsertSection(values.section, { key: values.key });
      context.ui.showToast('적용 완료!', 'info');
    },
  },
});

// 테마 감지
const currentTheme = context.ui.getTheme(); // 'dark' | 'light'
context.ui.onDidChangeTheme(({ theme }) => console.log('테마 변경:', theme));
```

#### ② INI 파싱 및 조작 (`context.ini`) ➔ [상세 문서](./plugin-api/03-ini.md)
```typescript
// 기존 주석/배치 보존 스마트 섹션 갱신
context.ini.upsertSection('KeyToggleDress', {
  key: 'no_modifiers alt VK_F4',
  type: 'cycle',
  '$dress': '0, 1',
});

// 화면 표시용 단축키 정제 ('no_modifiers alt VK_F4' -> 'Alt + F4')
const label = context.ini.formatDisplayKey('no_modifiers alt VK_F4');

// 심볼 고속 추출 (변수, 리소스, CommandList 목록)
const symbols = context.ini.extractSymbols();
```

#### ③ 워크스페이스 & 파일 제어 (`context.workspace`) ➔ [상세 문서](./plugin-api/04-workspace.md)
```typescript
// 파일 I/O 및 glob 검색
const iniFiles = await context.workspace.findFiles('**/*.ini');
const text = await context.workspace.readTextFile('d:/mods/Roxy/mod.ini');
await context.workspace.writeTextFile('d:/mods/Roxy/mod.ini', updatedText);

// 파일 저장 감지 (에디터 Ctrl+S 또는 외부 저장)
context.workspace.onDidSaveFile(({ path, name }) => {
  myPluginState.reloadCache(path);
});

// 작업 영역 초기화 / 모드 폴더 닫기 감지 (플러그인 자체 캐시 비우기)
context.workspace.onDidClearMemory(({ reason }) => {
  myPluginState.clearCache();
});
```

#### ④ Monaco 에디터 제어 (`context.editor`) ➔ [상세 문서](./plugin-api/05-editor.md)
```typescript
// Monaco 실행 취소(Ctrl+Z) 히스토리를 보존하며 텍스트 갱신
context.editor.setText(newText);

// 인라인 변경 제안 모달 (사용자가 차이점을 대조하고 수락/취소)
const result = await context.editor.proposeChanges(modifiedCode);
```

#### ⑤ 격리 스토리지 및 로거 (`context.storage`, `context.logger`) ➔ [상세 문서](./plugin-api/06-storage-and-system.md)
```typescript
// 플러그인 전용 격리 영구 설정 저장
context.storage.set('myConfig', { mode: 'fast' });
const config = context.storage.get('myConfig', { mode: 'fast' });

// 에디터 하단 [출력 콘솔](Ctrl+`)에 플러그인 태그와 함께 출력
context.logger.info('작업 완료', { itemsCount: 42 });
```

---

## 🤖 AI 어시스턴트(Cursor / Claude / ChatGPT)와 협업할 때

다른 AI에게 Migoto Studio 플러그인 개발을 요청할 때는 [`docs/AGENTS.md`](./AGENTS.md) 지침서를 기본 프롬프트로 제공하세요.  
그 후 해당 플러그인이 실제로 사용하는 [**`docs/plugin-api/`**](./plugin-api/README.md)의 특정 모듈 파일만 골라서 전달하면 최소한의 토큰으로 최고 수준의 결과물을 얻을 수 있습니다.

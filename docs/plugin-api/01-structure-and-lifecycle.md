# 1. 플러그인 구조 및 생명주기 (Plugin Structure & Lifecycle)

Migoto Studio 플러그인은 독립된 하나의 폴더이며, 단일 파일 또는 여러 파일로 자유롭게 구성할 수 있습니다.

---

## 1. 파일 구조

### A. 단일 파일 구조
```
my-custom-plugin/
├── plugin.json       # 플러그인 메타데이터 매니페스트 (필수)
└── index.js          # 플러그인 메인 스크립트 (ES Module, 필수)
```

### B. 다중 파일 분할 구조 (Multi-File Plugins - 번들러 불필요)
코드의 가독성과 모듈화를 위해 코드를 여러 파일로 분리할 수 있습니다.  
Migoto Studio 코어의 **가상 모듈 링커(Virtual Module Linker)** 가 상대 경로 `import`(`import ... from './ui.js'`)를 런타임에 자동으로 해석하고 연결하므로, Vite나 esbuild 같은 별도의 번들러 없이 순수 JS/ESM으로 여러 파일에 코드를 나누어 작성할 수 있습니다.

```
my-advanced-plugin/
├── plugin.json       # 플러그인 매니페스트
├── index.js          # 엔트리 스크립트 (activate / deactivate 내보내기)
├── ui.js             # UI 빌더 및 컴포넌트 로직
├── constants.js      # 상수 및 디폴트 설정
├── config.json       # JSON 데이터 (import config from './config.json' 지원)
└── style.css         # 전용 스타일시트 (import './style.css' 시 자동 주입 및 플러그인 언로드 시 자동 정리)
```

---

## 2. `plugin.json` 매니페스트 규격

```json
{
  "id": "my-custom-plugin",
  "name": "내 커스텀 플러그인",
  "version": "1.0.0",
  "description": "Migoto Studio를 위한 맞춤형 확장 도구입니다.",
  "author": "제작자명",
  "icon": "🎛️",
  "category": "tools",
  "main": "index.js"
}
```

- `id`: 플러그인 고유 식별자 (영소문자, 숫자, 하이픈 권장)
- `main`: 플러그인의 엔트리 스크립트 경로 (생략 시 `index.js`, `plugin.js`, `main.js` 순으로 자동 탐색)
- `icon`: 이모지(`🎛️`), SVG 마크업 문자열(`<svg>...</svg>`), 이미지 URL 또는 Base64 Data URI를 지원합니다.
- `category`: `'tools'` | `'assets'` | `'ai'` | `'general'`

---

## 3. 플러그인 생명주기 (Lifecycle)

플러그인 메인 스크립트는 ES Module 규격으로 작성하며, `activate(context)`와 선택적인 `deactivate()`를 내보냅니다.

```javascript
export default {
  activate(context) {
    console.log(`${context.manifest.name} 활성화됨`);

    // 상단 툴바 메뉴 등록
    context.ui.registerMenuItem({
      label: '도구 열기',
      shortcut: 'Ctrl+Shift+T',
      action: () => {
        openMyTab(context);
      },
    });
  },

  deactivate() {
    console.log('플러그인 비활성화됨');
    // 필요한 경우 추가 리소스 정리
  },
};
```

> [!TIP]
> **자동 정리(Auto Cleanup)**  
> 플러그인이 `context.ui.openTab`, `context.ui.registerMenuItem`, `context.ui.registerSidebarView`, `context.workspace.onDidChangeActiveFile`, `context.workspace.onDidSaveFile` 등을 통해 등록한 UI 요소나 이벤트 리스너는 플러그인이 비활성화되거나 언로드될 때 코어 플랫폼에 의해 자동으로 정리됩니다.

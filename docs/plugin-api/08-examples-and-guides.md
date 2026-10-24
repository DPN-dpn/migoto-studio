# 플러그인 종합 실전 예제 및 배포 가이드


### 10.1 단일 파일 플러그인 예제

```javascript
// index.js
export default {
  activate(context) {
    // 1. 상단 메뉴바의 [플러그인] 메뉴에 등록
    context.ui.registerMenuItem({
      label: '모드 설정 패널 열기',
      shortcut: 'Ctrl+Shift+M',
      action: () => {
        openStudioTab(context);
      },
    });

    // 2. 단축키 안내 토스트
    context.ui.showToast(`${context.manifest.name}이 활성화되었습니다. [플러그인] 메뉴에서 열 수 있습니다.`, 'info');
  },
};

function openStudioTab(context) {
  context.ui.openTab({
    id: 'studio-control-tab',
    title: '모드 컨트롤러',
    icon: '🎮',
    render(container) {
      container.innerHTML = `
        <div style="padding: 24px; max-width: 900px; margin: 0 auto; color: var(--fg); font-family: sans-serif;">
          <h2>🎮 모드 비주얼 컨트롤러</h2>
          <p style="color: var(--fg-dim);">현재 열린 모드의 INI 설정을 손쉽게 관리할 수 있습니다.</p>
          <hr style="border: none; border-top: 1px solid var(--border); margin: 16px 0;" />
          <div id="status-view"></div>
          <button id="btn-save" class="primary" style="margin-top: 16px;">설정 적용</button>
        </div>
      `;

      const currentFile = context.workspace.getCurrentFile();
      const statusView = container.querySelector('#status-view');
      statusView.textContent = currentFile ? `현재 파일: ${currentFile.location}` : '열려 있는 INI 파일이 없습니다.';

      const btnSave = container.querySelector('#btn-save');
      btnSave.addEventListener('click', () => {
        context.ui.showToast('설정이 적용되었습니다!', 'info');
      });

      return () => {
        console.log('컨트롤러 탭이 정리되었습니다.');
      };
    },
  });
}
```

### 10.2 다중 파일 모듈 분할 예제 (Multi-File Plugins)

번들러 빌드 없이 코드를 기능별로 분할하여 작성할 수 있습니다.

#### `plugin.json`
```json
{
  "id": "multi-file-sample",
  "name": "다중 파일 샘플 플러그인",
  "version": "1.0.0",
  "description": "Virtual Module Linker로 연동되는 다중 파일 플러그인 예제입니다.",
  "author": "Modder",
  "icon": "🧩",
  "category": "tools",
  "main": "index.js"
}
```

#### `constants.js`
```javascript
export const DEFAULT_SECTION = 'KeyToggleOutfit';
export const DEFAULT_KEY = 'VK_F4';
export const DEFAULT_TYPE = 'cycle';
```

#### `config.json`
```json
{
  "themeColor": "#3b82f6",
  "maxStates": 4
}
```

#### `style.css`
```css
.sample-card-title {
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 8px;
}
.sample-badge {
  background: var(--bg-card);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}
```

#### `ui.js`
```javascript
import { DEFAULT_SECTION, DEFAULT_KEY, DEFAULT_TYPE } from './constants.js';
import config from './config.json';
import './style.css'; // 플러그인 로드 시 자동 스타일 주입

export function openSampleTab(context) {
  context.ui.openFormTab({
    id: 'sample-form-tab',
    title: '샘플 폼 마법사',
    icon: '🧩',
    config: {
      title: '다중 파일 토글 키 생성기',
      description: `기본 상태 개수: ${config.maxStates}개`,
      fields: [
        { id: 'section', label: '섹션명', type: 'text', default: DEFAULT_SECTION, required: true },
        { id: 'key', label: '토글 키', type: 'key', default: DEFAULT_KEY, required: true },
        { id: 'type', label: '모드', type: 'select', default: DEFAULT_TYPE, options: ['cycle', 'hold'] },
      ],
      onSubmit: (values) => {
        context.ini.upsertSection(values.section, {
          key: values.key,
          type: values.type,
        });
        context.ui.showToast(`[${values.section}] 섹션이 저장되었습니다!`, 'info');
      },
    },
  });
}
```

#### `index.js`
```javascript
import { openSampleTab } from './ui.js';

export default {
  activate(context) {
    context.ui.registerMenuItem({
      label: '다중 파일 샘플 열기',
      shortcut: 'Ctrl+Shift+U',
      action: () => {
        openSampleTab(context);
      },
    });

    context.ui.showToast(`${context.manifest.name} 활성화 완료!`, 'info');
  },

  deactivate() {
    console.log('샘플 플러그인 비활성화');
  },
};
```

---

## 11. 플러그인 설치 및 배포

### 1) 데스크톱 환경 직접 복사
1. 액티비티 바 하단 **[플러그인]** 탭(`Ctrl+Shift+P`)으로 이동합니다.
2. 상단 액션 바의 **[플러그인 폴더 열기]** 버튼을 클릭합니다.
3. 열린 폴더(`%APPDATA%\MigotoStudio\plugins\`) 아래에 플러그인 폴더(예: `my-plugin/`)를 생성하고 `plugin.json`과 `index.js`(다중 파일 플러그인인 경우 관련 파일들 모두)를 복사합니다.
4. 플러그인 관리자에서 새로고침하거나 플러그인을 활성화합니다.

### 2) `.zip` 압축 파일로 설치
1. 플러그인 폴더 내부 파일들(`plugin.json`, `index.js`, 서브 모듈 파일들)이 루트에 오도록 `.zip`으로 압축합니다.
2. 플러그인 관리 상단의 **[플러그인 설치]** 버튼을 눌러 해당 `.zip` 파일을 선택하면 즉시 설치 및 활성화됩니다. (데스크톱 및 웹 환경 모두 지원)

---

## 12. AI 코딩 어시스턴트 활용 (ChatGPT / Claude / Cursor)

다른 AI(ChatGPT, Claude, Cursor 등)에게 Migoto Studio 플러그인 개발을 요청할 때는 [`docs/AGENTS.md`](./AGENTS.md) 지침서를 시스템 프롬프트로 제공하세요.
내부 코드를 일일이 설명할 필요 없이 선언형 폼 빌더(`openFormTab`)와 `context.ini` API, 그리고 가상 모듈 링커 기반 다중 파일 구조를 활용한 고품질 플러그인을 단번에 작성할 수 있습니다.

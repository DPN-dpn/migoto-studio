import { openModal } from './modal';
import { platform } from './platform';
import { upstreamGrammarVersion } from './grammar';
import { CURRENT_APP_VERSION, runUpdateCheck } from './updater';

interface ShortcutItem {
  label: string;
  keys: string;
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    title: '파일 및 기본 동작',
    items: [
      { label: '저장', keys: 'Ctrl + S' },
      { label: '다른 이름으로 저장', keys: 'Ctrl + Shift + S' },
      { label: '파일 열기', keys: 'Ctrl + O' },
      { label: '새 파일 만들기 (새 탭)', keys: 'Ctrl + N' },
      { label: '현재 탭 닫기', keys: 'Ctrl + W' },
      { label: '다음 / 이전 탭 전환', keys: 'Ctrl + Tab / Ctrl + Shift + Tab' },
      { label: '설정 열기', keys: 'Ctrl + ,' },
      { label: '도움말 및 단축키', keys: 'F1' },
    ],
  },
  {
    title: '검색 및 편집',
    items: [
      { label: '찾기', keys: 'Ctrl + F' },
      { label: '찾기 및 바꾸기', keys: 'Ctrl + H' },
      { label: '줄 번호로 이동', keys: 'Ctrl + G' },
      { label: '줄 주석 토글 (;)', keys: 'Ctrl + /' },
      { label: '자동완성 창 수동 호출', keys: 'Ctrl + Space' },
      { label: '현재 줄 위/아래 이동', keys: 'Alt + ↑ / ↓' },
      { label: '같은 단어 다중 선택 (멀티 커서)', keys: 'Ctrl + D' },
    ],
  },
  {
    title: '스마트 자동완성 팁',
    items: [
      { label: '전역 / 키 순환 변수 추천', keys: '$' },
      { label: '리소스 섹션 및 null 추천', keys: 'vb0 = / ib = / Resource =' },
      { label: '커맨드 리스트 / 셰이더 추천', keys: 'run = / post run =' },
      { label: '주요 섹션 스니펫 템플릿', keys: '[ (줄 맨 앞)' },
      { label: 'DXGI 버퍼 포맷 목록', keys: 'format =' },
    ],
  },
];

let lastTab: 'shortcuts' | 'about' = 'shortcuts';

export async function openHelp() {
  const body = document.createElement('div');
  body.className = 'help-dialog';

  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  tabs.setAttribute('role', 'tablist');

  const panel = document.createElement('div');
  panel.className = 'help-panel';
  panel.setAttribute('role', 'tabpanel');

  let activeTab = lastTab;

  const render = () => {
    lastTab = activeTab;
    tabs.replaceChildren();

    const tabList: { id: 'shortcuts' | 'about'; label: string }[] = [
      { id: 'shortcuts', label: '단축키 안내' },
      { id: 'about', label: '프로그램 정보' },
    ];

    for (const t of tabList) {
      const btn = document.createElement('button');
      btn.className = 'tab' + (activeTab === t.id ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(activeTab === t.id));
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        activeTab = t.id;
        render();
      });
      tabs.append(btn);
    }

    panel.replaceChildren();
    if (activeTab === 'shortcuts') {
      panel.append(renderShortcuts());
    } else {
      panel.append(renderAbout());
    }
  };

  body.append(tabs, panel);
  render();

  openModal('도움말 및 정보', body);
}

function renderShortcuts(): HTMLElement {
  const container = document.createElement('div');

  for (const cat of SHORTCUTS) {
    const sec = document.createElement('section');
    sec.className = 'help-section';

    const h3 = document.createElement('h3');
    h3.textContent = cat.title;
    sec.append(h3);

    const grid = document.createElement('div');
    grid.className = 'shortcut-grid';

    for (const item of cat.items) {
      const row = document.createElement('div');
      row.className = 'shortcut-row';

      const label = document.createElement('span');
      label.className = 'shortcut-label';
      label.textContent = item.label;

      const badge = document.createElement('kbd');
      badge.className = 'shortcut-key';
      badge.textContent = item.keys;

      row.append(label, badge);
      grid.append(row);
    }

    sec.append(grid);
    container.append(sec);
  }

  return container;
}

function renderAbout(): HTMLElement {
  const container = document.createElement('div');

  const hero = document.createElement('div');
  hero.className = 'about-hero';

  const h1 = document.createElement('h1');
  h1.textContent = 'Migoto Studio';

  const verRow = document.createElement('div');
  verRow.style.display = 'flex';
  verRow.style.alignItems = 'center';
  verRow.style.justifyContent = 'center';
  verRow.style.gap = '8px';
  verRow.style.marginTop = '6px';

  const ver = document.createElement('span');
  ver.className = 'version-tag';
  ver.textContent = `v${CURRENT_APP_VERSION}`;

  const checkBtn = document.createElement('button');
  checkBtn.style.fontSize = '11px';
  checkBtn.style.padding = '2px 8px';
  checkBtn.style.borderColor = 'var(--border)';
  checkBtn.textContent = '업데이트 확인';
  checkBtn.onclick = () => {
    checkBtn.disabled = true;
    checkBtn.textContent = '확인 중...';
    runUpdateCheck(false).finally(() => {
      checkBtn.disabled = false;
      checkBtn.textContent = '업데이트 확인';
    });
  };

  verRow.append(ver, checkBtn);

  const desc = document.createElement('p');
  desc.className = 'hint';
  desc.style.marginTop = '8px';
  desc.textContent = 'XXMI / 3DMigoto INI 파일을 위한 가벼운 스마트 에디터';

  hero.append(h1, verRow, desc);

  const details = document.createElement('div');
  details.className = 'about-details';

  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.margin = '0';

  const addItem = (title: string, content: string | HTMLElement) => {
    const li = document.createElement('li');
    li.style.padding = '6px 0';
    li.style.borderBottom = '1px solid var(--border)';
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';

    const strong = document.createElement('strong');
    strong.textContent = title;
    strong.style.fontWeight = '500';

    const val = document.createElement('span');
    if (typeof content === 'string') {
      val.textContent = content;
    } else {
      val.append(content);
    }
    val.style.color = 'var(--fg-dim)';

    li.append(strong, val);
    list.append(li);
  };

  addItem('문법 엔진', `3DMigoto INI v${upstreamGrammarVersion}`);
  addItem('라이선스', 'GPL-3.0-or-later');

  const ghLink = document.createElement('a');
  ghLink.href = 'https://github.com/DPN-dpn/migoto-studio';
  ghLink.target = '_blank';
  ghLink.rel = 'noreferrer';
  ghLink.textContent = 'GitHub 저장소 방문';
  addItem('소스 코드', ghLink);

  const dataLocationEl = document.createElement('span');
  dataLocationEl.textContent = '확인 중...';
  addItem('데이터 폴더', dataLocationEl);

  platform().dataLocation().then((loc) => {
    dataLocationEl.textContent = loc;
    dataLocationEl.title = loc;
  }).catch(() => {
    dataLocationEl.textContent = '브라우저 내부 저장소';
  });

  details.append(list);

  const note = document.createElement('div');
  note.style.marginTop = '16px';
  note.style.fontSize = '12px';
  note.style.color = 'var(--fg-dim)';
  note.style.lineHeight = '1.6';
  note.innerHTML = '💡 <strong>자동 백업 보호</strong>: 파일을 저장할 때마다 이전 내용이 앱 데이터 폴더에 자동으로 안전하게 백업됩니다. 문제 발생 시 툴바의 <strong>백업 복원</strong>으로 이전 버전을 되돌릴 수 있습니다.';

  container.append(hero, details, note);
  return container;
}

import type { PluginManager } from './plugins';

export class PluginPanel {
  private activeSubViewId: string = 'manage'; // 'manage' or viewId

  constructor(
    private root: HTMLElement,
    private manager: PluginManager,
  ) {
    this.manager.onChange(() => this.render());
    this.render();
  }

  switchToView(viewId: string) {
    this.activeSubViewId = viewId;
    this.render();
  }

  private render() {
    this.root.replaceChildren();

    const plugins = this.manager.getPlugins();
    const views = this.manager.getSidebarViews();

    // 1. Header Row
    const header = document.createElement('div');
    header.className = 'panel-header';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = '플러그인 / 애드온';

    const actions = document.createElement('div');
    actions.className = 'panel-actions';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'icon-btn';
    refreshBtn.title = '플러그인 새로고침';
    refreshBtn.setAttribute('aria-label', '새로고침');
    refreshBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"></path>
      </svg>
    `;
    refreshBtn.onclick = () => this.manager.init();

    const openFolderBtn = document.createElement('button');
    openFolderBtn.className = 'icon-btn';
    openFolderBtn.title = '플러그인 폴더 열기';
    openFolderBtn.setAttribute('aria-label', '폴더 열기');
    openFolderBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    openFolderBtn.onclick = () => this.manager.openPluginsFolder();

    actions.append(refreshBtn, openFolderBtn);
    header.append(title, actions);
    this.root.append(header);

    // 2. Sub-tabs navigation bar
    const tabNav = document.createElement('div');
    tabNav.className = 'plugin-subtabs-nav';

    const createTabItem = (id: string, label: string, icon: string) => {
      const tab = document.createElement('button');
      tab.className = `plugin-subtab-btn${this.activeSubViewId === id ? ' active' : ''}`;
      tab.innerHTML = `<span class="tab-icon">${icon}</span> <span class="tab-text">${label}</span>`;
      tab.onclick = () => {
        this.activeSubViewId = id;
        this.render();
      };
      return tab;
    };

    // 'Manage' tab
    tabNav.append(createTabItem('manage', '목록', '⚙'));

    // Dynamic views registered by active plugins
    for (const view of views) {
      tabNav.append(createTabItem(view.id, view.title, view.icon));
    }

    this.root.append(tabNav);

    // 3. Content Area
    const contentArea = document.createElement('div');
    contentArea.className = 'plugin-content-area';

    if (this.activeSubViewId === 'manage') {
      this.renderManageView(contentArea, plugins);
    } else {
      const targetView = views.find((v) => v.id === this.activeSubViewId);
      if (targetView) {
        targetView.render(contentArea);
      } else {
        // Fallback to manage
        this.activeSubViewId = 'manage';
        this.renderManageView(contentArea, plugins);
      }
    }

    this.root.append(contentArea);
  }

  private renderManageView(container: HTMLElement, plugins: ReturnType<PluginManager['getPlugins']>) {
    const listWrap = document.createElement('div');
    listWrap.className = 'plugin-manage-list';

    const activeCount = plugins.filter((p) => p.enabled).length;
    const statsHint = document.createElement('div');
    statsHint.className = 'plugin-stats-hint';
    statsHint.textContent = `설치된 플러그인 ${plugins.length}개 (${activeCount}개 활성화됨)`;
    listWrap.append(statsHint);

    for (const p of plugins) {
      const card = document.createElement('div');
      card.className = `plugin-card${p.enabled ? ' is-enabled' : ''}`;

      const topRow = document.createElement('div');
      topRow.className = 'plugin-card-top';

      const iconName = document.createElement('div');
      iconName.className = 'plugin-card-title';
      iconName.innerHTML = `
        <span class="plugin-icon">${p.manifest.icon || '🧩'}</span>
        <strong class="plugin-name">${p.manifest.name}</strong>
        <span class="plugin-version">v${p.manifest.version}</span>
      `;

      // Toggle switch
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'switch';
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = p.enabled;
      toggleInput.onchange = () => {
        this.manager.togglePlugin(p.manifest.id, toggleInput.checked);
      };
      const slider = document.createElement('span');
      slider.className = 'slider';
      toggleLabel.append(toggleInput, slider);

      topRow.append(iconName, toggleLabel);

      const desc = document.createElement('p');
      desc.className = 'plugin-desc';
      desc.textContent = p.manifest.description || '설명이 없습니다.';

      const metaRow = document.createElement('div');
      metaRow.className = 'plugin-meta-row';
      metaRow.innerHTML = `
        <span class="plugin-author">제작: ${p.manifest.author}</span>
        ${p.isBuiltin ? '<span class="plugin-badge">내장</span>' : '<span class="plugin-badge user">사용자</span>'}
      `;

      card.append(topRow, desc, metaRow);

      if (p.error) {
        const errEl = document.createElement('div');
        errEl.className = 'plugin-error-notice';
        errEl.textContent = `오류: ${p.error}`;
        card.append(errEl);
      }

      listWrap.append(card);
    }

    // Guide Box
    const guideBox = document.createElement('div');
    guideBox.className = 'plugin-guide-box';
    guideBox.innerHTML = `
      <div class="guide-title">💡 나만의 플러그인 만들기</div>
      <p class="guide-desc">
        상단의 <strong>폴더 열기</strong> 버튼을 눌러 플러그인 폴더에 새 디렉터리를 만들고,
        <code>plugin.json</code>과 <code>main.js</code>를 작성하면 자동으로 인식됩니다.
      </p>
    `;
    listWrap.append(guideBox);

    container.append(listWrap);
  }
}

import type { PluginManager, PluginInstance } from '../plugins';

export class PluginPanel {
  private searchQuery: string = '';
  private showCreateForm: boolean = false;

  constructor(
    private root: HTMLElement,
    private manager: PluginManager,
  ) {
    this.manager.onChange(() => this.render());
    this.render();
  }

  private render() {
    this.root.replaceChildren();

    const plugins = this.manager.getPlugins();

    // 1. Header Row
    const header = document.createElement('div');
    header.className = 'panel-header';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = '플러그인 관리';

    const actions = document.createElement('div');
    actions.className = 'panel-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'icon-btn';
    addBtn.title = '새 플러그인 추가';
    addBtn.setAttribute('aria-label', '새 플러그인 추가');
    addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    addBtn.onclick = () => {
      this.showCreateForm = !this.showCreateForm;
      this.render();
    };

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

    actions.append(addBtn, refreshBtn, openFolderBtn);
    header.append(title, actions);
    this.root.append(header);

    // 2. Main Container
    const container = document.createElement('div');
    container.className = 'plugin-manage-container';

    // 2.1 Info Notice banner
    const notice = document.createElement('div');
    notice.className = 'plugin-notice-banner';
    notice.innerHTML = `
      <div class="plugin-notice-title">🧩 플러그인 생태계</div>
      <div class="plugin-notice-body">
        활성화된 플러그인은 기능에 따라 좌측 툴바에 전용 탭(🐍 Python, 🤖 AI)으로 추가되거나, 탐색기(🖼️ DDS/이미지 미리보기)에 자동 연동됩니다.
      </div>
    `;
    container.append(notice);

    // 2.2 Create New Plugin Inline Form
    if (this.showCreateForm) {
      const createBox = document.createElement('div');
      createBox.className = 'plugin-create-box';

      const createTitle = document.createElement('div');
      createTitle.className = 'plugin-create-title';
      createTitle.textContent = '새 플러그인 생성 (JavaScript)';

      const idInput = document.createElement('input');
      idInput.type = 'text';
      idInput.className = 'plugin-input';
      idInput.placeholder = '플러그인 ID (예: my-custom-tool)';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'plugin-input';
      nameInput.placeholder = '플러그인 이름 (예: 내 맞춤 도구)';

      const btnRow = document.createElement('div');
      btnRow.className = 'plugin-create-btn-row';

      const submitBtn = document.createElement('button');
      submitBtn.className = 'small-btn primary';
      submitBtn.textContent = '만들기';
      submitBtn.onclick = async () => {
        const id = idInput.value.trim();
        const name = nameInput.value.trim();
        if (!id) {
          this.manager.showToast('플러그인 ID를 입력해주세요.', 'warn');
          return;
        }
        submitBtn.disabled = true;
        const ok = await this.manager.createPluginTemplate(id, name);
        if (ok) {
          this.showCreateForm = false;
          this.render();
        } else {
          submitBtn.disabled = false;
        }
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'small-btn';
      cancelBtn.textContent = '취소';
      cancelBtn.onclick = () => {
        this.showCreateForm = false;
        this.render();
      };

      btnRow.append(submitBtn, cancelBtn);
      createBox.append(createTitle, idInput, nameInput, btnRow);
      container.append(createBox);
    }

    // 2.3 Search bar & Stats
    const searchWrap = document.createElement('div');
    searchWrap.className = 'plugin-search-wrap';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'plugin-search-input';
    searchInput.placeholder = '플러그인 검색…';
    searchInput.value = this.searchQuery;
    searchInput.oninput = () => {
      this.searchQuery = searchInput.value.trim().toLowerCase();
      this.renderPluginList(listWrap, plugins);
    };

    const activeCount = plugins.filter((p) => p.enabled).length;
    const statsHint = document.createElement('div');
    statsHint.className = 'plugin-stats-hint';
    statsHint.textContent = `전체 ${plugins.length}개 중 ${activeCount}개 활성화`;

    searchWrap.append(searchInput, statsHint);
    container.append(searchWrap);

    // 2.4 Plugin Cards List
    const listWrap = document.createElement('div');
    listWrap.className = 'plugin-manage-list';
    this.renderPluginList(listWrap, plugins);
    container.append(listWrap);

    this.root.append(container);
  }

  private renderPluginList(container: HTMLElement, plugins: PluginInstance[]) {
    container.replaceChildren();

    const filtered = plugins.filter((p) => {
      if (!this.searchQuery) return true;
      const q = this.searchQuery;
      return (
        p.manifest.name.toLowerCase().includes(q) ||
        p.manifest.id.toLowerCase().includes(q) ||
        (p.manifest.description && p.manifest.description.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'plugin-empty-hint';
      empty.textContent = '검색 조건과 일치하는 플러그인이 없습니다.';
      container.append(empty);
      return;
    }

    // Group: Built-in first, then User
    const builtinPlugins = filtered.filter((p) => p.isBuiltin);
    const userPlugins = filtered.filter((p) => !p.isBuiltin);

    if (builtinPlugins.length > 0) {
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'plugin-section-header';
      sectionTitle.textContent = `기본 내장 플러그인 (${builtinPlugins.length})`;
      container.append(sectionTitle);

      for (const p of builtinPlugins) {
        container.append(this.createPluginCard(p));
      }
    }

    if (userPlugins.length > 0) {
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'plugin-section-header';
      sectionTitle.textContent = `사용자 추가 플러그인 (${userPlugins.length})`;
      container.append(sectionTitle);

      for (const p of userPlugins) {
        container.append(this.createPluginCard(p));
      }
    }
  }

  private createPluginCard(p: PluginInstance): HTMLElement {
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

    // Right controls: toggle switch + (delete button if not builtin)
    const rightControls = document.createElement('div');
    rightControls.className = 'plugin-card-right';

    if (!p.isBuiltin) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn delete-plugin-btn';
      deleteBtn.title = '플러그인 삭제';
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`플러그인 "${p.manifest.name}"을(를) 삭제하시겠습니까?`)) {
          await this.manager.deletePlugin(p.manifest.id);
        }
      };
      rightControls.append(deleteBtn);
    }

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
    rightControls.append(toggleLabel);

    topRow.append(iconName, rightControls);

    const desc = document.createElement('p');
    desc.className = 'plugin-desc';
    desc.textContent = p.manifest.description || '설명이 없습니다.';

    const metaRow = document.createElement('div');
    metaRow.className = 'plugin-meta-row';
    metaRow.innerHTML = `
      <span class="plugin-author">제작: ${p.manifest.author || '알 수 없음'}</span>
      ${p.isBuiltin ? '<span class="plugin-badge">내장</span>' : '<span class="plugin-badge user">사용자</span>'}
      ${p.enabled ? '<span class="plugin-status-badge enabled">활성</span>' : '<span class="plugin-status-badge disabled">비활성</span>'}
    `;

    card.append(topRow, desc, metaRow);

    if (p.error) {
      const errEl = document.createElement('div');
      errEl.className = 'plugin-error-notice';
      errEl.textContent = `오류: ${p.error}`;
      card.append(errEl);
    }

    return card;
  }
}

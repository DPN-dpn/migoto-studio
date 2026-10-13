import { platform } from '../platform';
import { type PluginManager, type PluginInstance, renderPluginIcon } from '../plugins';

export class PluginPanel {
  private searchQuery: string = '';
  private showCreateForm: boolean = false;
  private collapsedPlugins: Set<string> = new Set();

  constructor(
    private root: HTMLElement,
    private manager: PluginManager,
  ) {
    try {
      const stored = localStorage.getItem('migoto_plugins_collapsed');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.collapsedPlugins = new Set(parsed);
        }
      }
    } catch {}

    this.manager.onChange(() => this.render());
    this.render();
  }

  private toggleCollapse(id: string) {
    if (this.collapsedPlugins.has(id)) {
      this.collapsedPlugins.delete(id);
    } else {
      this.collapsedPlugins.add(id);
    }
    this.saveCollapsedState();
    this.render();
  }

  private toggleAllCollapse(plugins: PluginInstance[]) {
    if (this.collapsedPlugins.size >= plugins.length) {
      this.collapsedPlugins.clear();
    } else {
      this.collapsedPlugins = new Set(plugins.map((p) => p.manifest.id));
    }
    this.saveCollapsedState();
    this.render();
  }

  private saveCollapsedState() {
    try {
      localStorage.setItem('migoto_plugins_collapsed', JSON.stringify(Array.from(this.collapsedPlugins)));
    } catch {}
  }

  private render() {
    this.root.replaceChildren();

    const plugins = this.manager.getPlugins();
    const isDesktop = platform().kind === 'desktop';

    // Prune collapsed states for plugins that no longer exist
    const currentIds = new Set(plugins.map((p) => p.manifest.id));
    let collapsedChanged = false;
    for (const id of Array.from(this.collapsedPlugins)) {
      if (!currentIds.has(id)) {
        this.collapsedPlugins.delete(id);
        collapsedChanged = true;
      }
    }
    if (collapsedChanged) {
      this.saveCollapsedState();
    }

    // 1. Header Row (Actions)
    const header = document.createElement('div');
    header.className = 'panel-header';

    const actions = document.createElement('div');
    actions.className = 'panel-actions';

    // [+] 버튼: 압축 파일(.zip)로부터 플러그인 추가 설치 (웹 & 데스크톱 모두 지원)
    const addZipBtn = document.createElement('button');
    addZipBtn.className = 'icon-btn';
    addZipBtn.title = '다른 플러그인 추가 (.zip 압축파일)';
    addZipBtn.setAttribute('aria-label', '플러그인 추가');
    addZipBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    addZipBtn.onclick = async () => {
      await this.manager.installPluginFromZip();
    };
    actions.append(addZipBtn);

    // 새 플러그인 템플릿 직접 만들기 버튼 (데스크톱 전용)
    if (isDesktop) {
      const createBtn = document.createElement('button');
      createBtn.className = 'icon-btn';
      createBtn.title = '새 플러그인 직접 만들기';
      createBtn.setAttribute('aria-label', '플러그인 만들기');
      createBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      createBtn.onclick = () => {
        this.showCreateForm = !this.showCreateForm;
        this.render();
      };
      actions.append(createBtn);
    }

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
    actions.append(refreshBtn);

    if (isDesktop) {
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
      actions.append(openFolderBtn);
    }

    header.append(actions);
    this.root.append(header);

    // 2. Main Container
    const container = document.createElement('div');
    container.className = 'plugin-manage-container';

    // 2.1 Info Notice banner
    const notice = document.createElement('div');
    notice.className = 'plugin-notice-banner';
    if (isDesktop) {
      notice.innerHTML = `
        <div class="plugin-notice-title">플러그인 생태계</div>
        <div class="plugin-notice-body">
          활성화된 플러그인은 기능에 따라 좌측 툴바에 전용 탭으로 추가되거나, 탐색기 및 에디터 탭에 연동됩니다. <strong>+ 버튼</strong>으로 새 플러그인 압축파일(.zip)을 설치할 수 있습니다.
        </div>
      `;
    } else {
      notice.innerHTML = `
        <div class="plugin-notice-title">웹 플러그인 생태계</div>
        <div class="plugin-notice-body">
          웹 버전에서도 <strong>+ 버튼</strong>으로 플러그인 압축파일(.zip)을 추가해 사용할 수 있습니다. 외부 Python 실행 등 로컬 시스템 권한이 필요한 기능은 데스크톱 앱 버전을 이용해 주세요.
        </div>
      `;
    }
    container.append(notice);

    // 2.2 Create New Plugin Inline Form (데스크톱 전용)
    if (isDesktop && this.showCreateForm) {
      const createBox = document.createElement('div');
      createBox.className = 'plugin-create-box';

      const createTitle = document.createElement('div');
      createTitle.className = 'plugin-create-title';
      createTitle.textContent = '새 플러그인 직접 만들기';

      const idInput = document.createElement('input');
      idInput.type = 'text';
      idInput.className = 'plugin-input';
      idInput.placeholder = '플러그인 ID (영문/숫자, 예: my-tool)';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'plugin-input';
      nameInput.placeholder = '플러그인 이름 (예: 내 맞춤 도구)';

      const iconRow = document.createElement('div');
      iconRow.className = 'plugin-form-row';
      const iconLabel = document.createElement('label');
      iconLabel.textContent = '아이콘:';
      const iconInput = document.createElement('input');
      iconInput.type = 'text';
      iconInput.className = 'plugin-input';
      iconInput.value = 'puzzle';
      iconInput.placeholder = '이모지, SVG 또는 프리셋(sparkles, python, image 등)';
      iconRow.append(iconLabel, iconInput);

      const authorRow = document.createElement('div');
      authorRow.className = 'plugin-form-row';
      const authorLabel = document.createElement('label');
      authorLabel.textContent = '제작자:';
      const authorInput = document.createElement('input');
      authorInput.type = 'text';
      authorInput.className = 'plugin-input';
      authorInput.value = '사용자';
      authorInput.placeholder = '제작자 이름';
      authorRow.append(authorLabel, authorInput);

      const locRow = document.createElement('div');
      locRow.className = 'plugin-form-row';
      const locLabel = document.createElement('label');
      locLabel.textContent = '위치:';
      const locInput = document.createElement('input');
      locInput.type = 'text';
      locInput.className = 'plugin-input';
      locInput.value = '좌측 사이드바 탭';
      locInput.placeholder = '예: 좌측 사이드바 탭, 에디터 탭';
      locRow.append(locLabel, locInput);

      const descInput = document.createElement('input');
      descInput.type = 'text';
      descInput.className = 'plugin-input';
      descInput.placeholder = '플러그인 간단 설명';

      const btnRow = document.createElement('div');
      btnRow.className = 'plugin-create-btn-row';

      const submitBtn = document.createElement('button');
      submitBtn.className = 'small-btn primary';
      submitBtn.textContent = '만들기';
      submitBtn.onclick = async () => {
        const id = idInput.value.trim();
        const name = nameInput.value.trim();
        const icon = iconInput.value.trim() || 'PLG';
        const author = authorInput.value.trim() || '사용자';
        const location = locInput.value.trim() || '좌측 사이드바 탭';
        const description = descInput.value.trim();

        if (!id) {
          this.manager.showToast('플러그인 ID를 입력해주세요.', 'warn');
          return;
        }
        submitBtn.disabled = true;
        const ok = await this.manager.createPluginTemplate({
          id,
          name,
          icon,
          author,
          location,
          description,
        });
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
      createBox.append(
        createTitle,
        idInput,
        nameInput,
        iconRow,
        authorRow,
        locRow,
        descInput,
        btnRow,
      );
      container.append(createBox);
    }

    // 2.3 Search bar & Stats Row
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
    const statsRow = document.createElement('div');
    statsRow.className = 'plugin-stats-row';

    const statsHint = document.createElement('div');
    statsHint.className = 'plugin-stats-hint';
    statsHint.textContent = `전체 ${plugins.length}개 중 ${activeCount}개 활성화`;

    const isAllCollapsed = plugins.length > 0 && this.collapsedPlugins.size >= plugins.length;
    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.className = 'plugin-toggle-all-btn';
    toggleAllBtn.textContent = isAllCollapsed ? '모두 펼치기' : '모두 접기';
    toggleAllBtn.title = isAllCollapsed ? '모든 플러그인 상세 내용 표시' : '모든 플러그인을 한 줄로 간략히 보기';
    toggleAllBtn.onclick = () => this.toggleAllCollapse(plugins);

    statsRow.append(statsHint, toggleAllBtn);
    searchWrap.append(searchInput, statsRow);
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

    filtered.forEach((p, index) => {
      container.append(this.createPluginCard(p, index, filtered.length));
    });
  }

  private createPluginCard(p: PluginInstance, index: number, total: number): HTMLElement {
    const isCollapsed = this.collapsedPlugins.has(p.manifest.id);
    const card = document.createElement('div');
    card.className = `plugin-card${p.enabled ? ' is-enabled' : ''}${isCollapsed ? ' is-collapsed' : ''}`;

    const topRow = document.createElement('div');
    topRow.className = 'plugin-card-top';

    const iconName = document.createElement('div');
    iconName.className = 'plugin-card-title';

    const titleClickArea = document.createElement('span');
    titleClickArea.className = 'plugin-title-content';
    titleClickArea.style.cursor = 'pointer';
    titleClickArea.title = isCollapsed ? '클릭하여 상세 정보 펼치기' : '클릭하여 간략히 접기';
    titleClickArea.innerHTML = `
      <span class="plugin-icon">${renderPluginIcon(p.manifest.icon)}</span>
      <strong class="plugin-name">${p.manifest.name}</strong>
    `;
    titleClickArea.onclick = () => this.toggleCollapse(p.manifest.id);
    iconName.append(titleClickArea);

    // Right controls: order buttons + toggle switch + (delete button if not builtin)
    const rightControls = document.createElement('div');
    rightControls.className = 'plugin-card-right';

    // Up / Down order buttons (combined stepper control)
    const reorderWrap = document.createElement('div');
    reorderWrap.className = 'plugin-order-controls';

    const upBtn = document.createElement('button');
    upBtn.className = 'plugin-order-btn up-btn';
    upBtn.title = '위로 이동 (툴바 순서)';
    upBtn.setAttribute('aria-label', '위로 이동');
    upBtn.innerHTML = `
      <svg viewBox="0 0 8 5" width="7" height="4.5" fill="currentColor">
        <polygon points="4,0 8,5 0,5"/>
      </svg>
    `;
    upBtn.disabled = index === 0;
    upBtn.onclick = (e) => {
      e.stopPropagation();
      this.manager.movePluginOrder(p.manifest.id, 'up');
    };

    const downBtn = document.createElement('button');
    downBtn.className = 'plugin-order-btn down-btn';
    downBtn.title = '아래로 이동 (툴바 순서)';
    downBtn.setAttribute('aria-label', '아래로 이동');
    downBtn.innerHTML = `
      <svg viewBox="0 0 8 5" width="7" height="4.5" fill="currentColor">
        <polygon points="0,0 8,0 4,5"/>
      </svg>
    `;
    downBtn.disabled = index === total - 1;
    downBtn.onclick = (e) => {
      e.stopPropagation();
      this.manager.movePluginOrder(p.manifest.id, 'down');
    };

    reorderWrap.append(upBtn, downBtn);
    rightControls.append(reorderWrap);

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

    // Card Body (hidden when collapsed)
    const cardBody = document.createElement('div');
    cardBody.className = 'plugin-card-body';

    const desc = document.createElement('p');
    desc.className = 'plugin-desc';
    desc.textContent = p.manifest.description || '설명이 없습니다.';

    const locRow = document.createElement('div');
    locRow.className = 'plugin-location-badge';
    locRow.innerHTML = `
      <span class="plugin-location-label">위치:</span>
      <span class="plugin-location-val">${p.manifest.location || '좌측 사이드바 탭'}</span>
    `;

    const metaRow = document.createElement('div');
    metaRow.className = 'plugin-meta-row';
    metaRow.innerHTML = `
      <span class="plugin-author">제작: ${p.manifest.author || '알 수 없음'}</span>
      <span class="plugin-badge user">v${p.manifest.version || '1.0.0'}</span>
      ${p.enabled ? '<span class="plugin-status-badge enabled">활성</span>' : '<span class="plugin-status-badge disabled">비활성</span>'}
    `;

    cardBody.append(desc, locRow, metaRow);

    if (p.error) {
      const errEl = document.createElement('div');
      errEl.className = 'plugin-error-notice';
      errEl.textContent = `오류: ${p.error}`;
      cardBody.append(errEl);
    }

    card.append(topRow, cardBody);

    return card;
  }
}

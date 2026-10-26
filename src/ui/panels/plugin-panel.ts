import { platform } from '../../platform';
import { type PluginManager, type PluginInstance, renderPluginIcon } from '../../plugins';
import { openConfirmModal, openPromptModal } from '../modals/confirm-ui';
import { openExternalUrl } from '../../updater/updater';

const CHEVRON_SVG = `
  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 4 10 8 6 12"></polyline>
  </svg>
`;

export class PluginPanel {
  private searchQuery: string = '';
  private showCreateForm: boolean = false;
  // 기본값: 모든 플러그인 접힌 상태 (펼쳐진 플러그인 ID 집합을 추적)
  private expandedPlugins: Set<string> = new Set();

  constructor(
    private root: HTMLElement,
    private manager: PluginManager,
  ) {
    try {
      const stored = localStorage.getItem('migoto_plugins_expanded');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.expandedPlugins = new Set(
            parsed.map((id: string) => (id === 'resource-checker' ? 'custom-lint' : id)),
          );
        }
      }
    } catch { }

    this.manager.onChange(() => this.render());
    this.render();
  }

  private toggleCollapse(id: string) {
    if (this.expandedPlugins.has(id)) {
      this.expandedPlugins.delete(id);
    } else {
      this.expandedPlugins.add(id);
    }
    this.saveExpandedState();
    this.render();
  }

  private toggleAllCollapse(plugins: PluginInstance[]) {
    const anyExpanded = plugins.some((p) => this.expandedPlugins.has(p.manifest.id));
    if (anyExpanded) {
      this.expandedPlugins.clear();
    } else {
      this.expandedPlugins = new Set(plugins.map((p) => p.manifest.id));
    }
    this.saveExpandedState();
    this.render();
  }

  private saveExpandedState() {
    try {
      localStorage.setItem('migoto_plugins_expanded', JSON.stringify(Array.from(this.expandedPlugins)));
      localStorage.removeItem('migoto_plugins_collapsed');
    } catch { }
  }

  private render() {
    this.root.replaceChildren();

    const plugins = this.manager.getPlugins();
    const isDesktop = platform().kind === 'desktop';

    // Prune expanded states for plugins that no longer exist
    const currentIds = new Set(plugins.map((p) => p.manifest.id));
    let expandedChanged = false;
    for (const id of Array.from(this.expandedPlugins)) {
      if (!currentIds.has(id)) {
        this.expandedPlugins.delete(id);
        expandedChanged = true;
      }
    }
    if (expandedChanged) {
      this.saveExpandedState();
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

    // [GitHub] 버튼: GitHub 링크로부터 플러그인 추가 설치
    const addGithubBtn = document.createElement('button');
    addGithubBtn.className = 'icon-btn';
    addGithubBtn.title = 'GitHub 링크로부터 플러그인 추가';
    addGithubBtn.setAttribute('aria-label', 'GitHub 플러그인 추가');
    addGithubBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    `;
    addGithubBtn.onclick = async () => {
      const url = await openPromptModal({
        title: 'GitHub 플러그인 추가',
        message: '설치할 플러그인의 GitHub 저장소 또는 Release 링크를 입력하세요:',
        placeholder: 'https://github.com/owner/repo 또는 owner/repo',
        confirmText: '설치',
        cancelText: '취소',
      });
      if (url && url.trim()) {
        await this.manager.installPluginFromGitHub(url.trim());
      }
    };
    actions.append(addGithubBtn);

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
    refreshBtn.title = '플러그인 및 GitHub 버전 새로고침';
    refreshBtn.setAttribute('aria-label', '새로고침');
    refreshBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"></path>
      </svg>
    `;
    refreshBtn.onclick = async () => {
      if (refreshBtn.disabled) return;
      refreshBtn.disabled = true;
      refreshBtn.classList.add('is-spinning');
      try {
        await this.manager.reloadPlugins({ checkUpdates: true, showToast: true });
      } catch (err: any) {
        console.error('[PluginPanel] 새로고침 실패:', err);
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('is-spinning');
      }
    };
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

    const anyExpanded = plugins.length > 0 && plugins.some((p) => this.expandedPlugins.has(p.manifest.id));
    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.className = 'plugin-toggle-all-btn';
    toggleAllBtn.textContent = anyExpanded ? '모두 접기' : '모두 펼치기';
    toggleAllBtn.title = anyExpanded ? '모든 플러그인을 한 줄로 간략히 접기' : '모든 플러그인 상세 내용 표시';
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
    const isCollapsed = !this.expandedPlugins.has(p.manifest.id);
    const githubSource = this.manager.getGitHubSource(p.manifest.id);
    const hasUpdate = Boolean(githubSource?.updateAvailable);

    const card = document.createElement('div');
    card.className = `plugin-card${p.enabled ? ' is-enabled' : ''}${isCollapsed ? ' is-collapsed' : ''}${hasUpdate ? ' has-update' : ''}`;

    const topRow = document.createElement('div');
    topRow.className = 'plugin-card-top';

    const iconName = document.createElement('div');
    iconName.className = 'plugin-card-title';

    const titleClickArea = document.createElement('span');
    titleClickArea.className = 'plugin-title-content';
    titleClickArea.style.cursor = 'pointer';
    titleClickArea.title = isCollapsed ? '클릭하여 상세 정보 펼치기' : '클릭하여 간략히 접기';
    titleClickArea.innerHTML = `
      <span class="plugin-chevron">${CHEVRON_SVG}</span>
      <span class="plugin-icon">${renderPluginIcon(p.manifest.icon)}</span>
      <strong class="plugin-name">${p.manifest.name}</strong>
      ${hasUpdate ? `<span class="plugin-update-chip" title="새 버전(v${githubSource?.lastCheckedVersion}) 업데이트 가능">NEW v${githubSource?.lastCheckedVersion}</span>` : ''}
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
    upBtn.title = '위로 이동 (툴바 및 상단 메뉴 순서)';
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
    downBtn.title = '아래로 이동 (툴바 및 상단 메뉴 순서)';
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
      const dependents = this.manager.getDependents(p.manifest.id);
      let message = `플러그인 "${p.manifest.name}"을(를) 삭제하시겠습니까?`;
      if (dependents.length > 0) {
        const depNames = dependents.map((d) => `• ${d.manifest.name}`).join('\n');
        message += `\n\n경고: 이 플러그인을 필수 종속성으로 요구하는 다음 플러그인의 작동이 중단되거나 오류가 발생할 수 있습니다:\n\n${depNames}\n\n그래도 삭제하시겠습니까?`;
      }
      const ok = await openConfirmModal({
        title: dependents.length > 0 ? '종속 플러그인 영향 경고 및 삭제' : '플러그인 삭제',
        message,
        confirmText: '삭제',
        cancelText: '취소',
        variant: 'danger',
      });
      if (ok) {
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
    toggleInput.onchange = async () => {
      const willEnable = toggleInput.checked;
      if (!willEnable) {
        const activeDeps = this.manager.getActiveDependents(p.manifest.id);
        if (activeDeps.length > 0) {
          const depNames = activeDeps.map((d) => `• ${d.manifest.name}`).join('\n');
          const ok = await openConfirmModal({
            title: '종속 플러그인 작동 중단 경고',
            message: `"${p.manifest.name}" 플러그인을 비활성화하면, 이를 필수 종속성으로 사용하는 다음 플러그인의 작동이 중단됩니다:\n\n${depNames}\n\n그래도 비활성화하시겠습니까?`,
            confirmText: '비활성화',
            cancelText: '취소',
            variant: 'danger',
          });
          if (!ok) {
            toggleInput.checked = true;
            return;
          }
        }
      }
      await this.manager.togglePlugin(p.manifest.id, willEnable);
    };
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggleLabel.append(toggleInput, slider);
    rightControls.append(toggleLabel);

    topRow.append(iconName, rightControls);

    // Card Body (hidden when collapsed)
    const cardBody = document.createElement('div');
    cardBody.className = 'plugin-card-body';

    // GitHub 업데이트 배너
    if (hasUpdate) {
      const banner = document.createElement('div');
      banner.className = 'plugin-update-banner';
      banner.innerHTML = `
        <div class="plugin-update-info">
          <span>새 버전 <b>v${githubSource?.lastCheckedVersion}</b> 사용 가능</span>
        </div>
        <button class="plugin-btn-update" title="최신 릴리스로 즉시 업데이트">업데이트</button>
      `;
      banner.querySelector('.plugin-btn-update')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.manager.updatePluginFromGitHub(p.manifest.id);
      });
      cardBody.append(banner);
    }

    const desc = document.createElement('p');
    desc.className = 'plugin-desc';
    desc.textContent = p.manifest.description || '설명이 없습니다.';

    const locRow = document.createElement('div');
    locRow.className = 'plugin-location-badge';
    locRow.innerHTML = `
      <span class="plugin-location-label">위치:</span>
      <span class="plugin-location-val">${p.manifest.location || '좌측 사이드바 탭'}</span>
    `;

    const versionTooltip = githubSource
      ? `${githubSource.url}\n(클릭하여 브라우저에서 열기)`
      : `v${p.manifest.version || '1.0.0'}`;
    const versionGithubClass = githubSource ? ' github' : '';
    const versionGithubIcon = githubSource
      ? `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" style="vertical-align: -1px; margin-right: 3px;"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`
      : '';

    const metaRow = document.createElement('div');
    metaRow.className = 'plugin-meta-row';

    const authorSpan = document.createElement('span');
    authorSpan.className = 'plugin-author';
    authorSpan.textContent = `제작: ${p.manifest.author || '알 수 없음'}`;

    const versionSpan = document.createElement('span');
    versionSpan.className = `plugin-badge user${versionGithubClass}`;
    versionSpan.title = versionTooltip;
    versionSpan.innerHTML = `${versionGithubIcon}v${p.manifest.version || '1.0.0'}`;

    if (githubSource) {
      versionSpan.onclick = (e) => {
        e.stopPropagation();
        openExternalUrl(githubSource.url);
      };
    }

    const statusSpan = document.createElement('span');
    statusSpan.className = `plugin-status-badge ${p.enabled ? 'enabled' : 'disabled'}`;
    statusSpan.textContent = p.enabled ? '활성' : '비활성';

    metaRow.append(authorSpan, versionSpan, statusSpan);

    cardBody.append(desc, locRow, metaRow);

    // 종속 플러그인(Dependencies) 상세 정보 섹션
    if (p.manifest.dependencies && Object.keys(p.manifest.dependencies).length > 0) {
      const depResults = this.manager.checkPluginDependencies(p.manifest.id);
      const depSection = document.createElement('div');
      depSection.className = 'plugin-dependencies-section';

      const depHeader = document.createElement('div');
      depHeader.className = 'plugin-dependencies-header';
      depHeader.innerHTML = `
        <span class="plugin-dependencies-title">필수 종속 플러그인</span>
        <span class="plugin-dependencies-count">${depResults.length}개</span>
      `;
      depSection.append(depHeader);

      const depList = document.createElement('div');
      depList.className = 'plugin-dependencies-list';

      depResults.forEach((dep) => {
        const depItem = document.createElement('div');
        depItem.className = `plugin-dependency-item status-${dep.status}`;

        const depInfo = document.createElement('div');
        depInfo.className = 'plugin-dep-info';

        const targetPlg = this.manager.getPlugin(dep.id);
        const displayName = targetPlg?.manifest.name || dep.id;
        const constraint = dep.parsed?.versionConstraint || '*';

        depInfo.innerHTML = `
          <strong class="plugin-dep-name" title="${dep.id}">${displayName}</strong>
          <code class="plugin-dep-constraint">${constraint}</code>
        `;

        const depStatusWrap = document.createElement('div');
        depStatusWrap.className = 'plugin-dep-status-wrap';

        let badgeText = '';
        let badgeClass = '';
        if (dep.satisfied || dep.status === 'ok') {
          badgeText = `✔ 충족 (v${dep.installedVersion || targetPlg?.manifest.version || '?'})`;
          badgeClass = 'satisfied';
        } else if (dep.status === 'missing') {
          badgeText = '❌ 미설치';
          badgeClass = 'missing';
        } else if (dep.status === 'disabled') {
          badgeText = '⚠️ 비활성화됨';
          badgeClass = 'disabled';
        } else if (dep.status === 'version_mismatch') {
          badgeText = `❌ 버전 불일치 (현재: v${dep.installedVersion || '?'})`;
          badgeClass = 'mismatch';
        } else {
          badgeText = `❌ ${dep.status}`;
          badgeClass = 'missing';
        }

        depStatusWrap.innerHTML = `<span class="plugin-dep-badge ${badgeClass}">${badgeText}</span>`;

        const githubUrl = dep.parsed?.gitHubUrl;
        if (dep.status === 'missing' && githubUrl) {
          const installBtn = document.createElement('button');
          installBtn.className = 'plugin-dep-install-btn';
          installBtn.textContent = '설치';
          installBtn.title = `GitHub에서 ${dep.id} 플러그인 설치`;
          installBtn.onclick = async (e) => {
            e.stopPropagation();
            await this.manager.installPluginFromGitHub(githubUrl);
          };
          depStatusWrap.append(installBtn);
        }

        depItem.append(depInfo, depStatusWrap);
        depList.append(depItem);
      });

      depSection.append(depList);
      cardBody.append(depSection);
    }

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

import { platform, type DirEntry, type FileRef } from './platform';
import type { DocumentManager } from './documents';

const STORAGE_LAST_FOLDER = 'migoto_last_folder';

export interface FolderRef {
  name: string;
  id: string;
}

/**
 * File tree explorer for XXMI / 3DMigoto mod folders.
 * Allows modders to open a mod directory, view nested folders and INI files,
 * search/filter files, and click any INI file to open it in a tab.
 */
export class FileExplorer {
  private currentFolder: FolderRef | null = null;
  private entries: DirEntry[] = [];
  private collapsedDirs = new Set<string>();
  private filter = '';
  private activeFilePath: string | null = null;
  private isLoading = false;

  constructor(
    private root: HTMLElement,
    private doc: DocumentManager,
    private onFolderChange?: (folder: FolderRef | null) => void,
  ) {
    this.doc.onChange(() => {
      const curId = this.doc.file?.id ?? null;
      if (curId !== this.activeFilePath) {
        this.activeFilePath = curId;
        this.updateActiveItem();
      }
    });

    this.activeFilePath = this.doc.file?.id ?? null;
    this.render();
    this.tryRestoreLastFolder();
  }

  get hasFolder(): boolean {
    return this.currentFolder !== null;
  }

  get folderName(): string {
    return this.currentFolder?.name ?? '';
  }

  private async tryRestoreLastFolder() {
    if (platform().kind !== 'desktop') return;
    try {
      const saved = localStorage.getItem(STORAGE_LAST_FOLDER);
      if (saved) {
        const name = saved.split(/[\\/]/).filter(Boolean).pop() ?? saved;
        await this.openFolder({ id: saved, name });
      }
    } catch {}
  }

  async openFolderDialog(): Promise<void> {
    try {
      const picked = await platform().pickDirectory();
      if (picked) {
        await this.openFolder(picked);
      }
    } catch (e) {
      await platform().showError('폴더 열기 실패', String(e));
    }
  }

  async openFolder(folder: FolderRef): Promise<void> {
    this.currentFolder = folder;
    this.collapsedDirs.clear();
    this.filter = '';
    try {
      localStorage.setItem(STORAGE_LAST_FOLDER, folder.id);
    } catch {}
    this.onFolderChange?.(folder);
    await this.reload();
  }

  closeFolder(): void {
    this.currentFolder = null;
    this.entries = [];
    this.collapsedDirs.clear();
    this.filter = '';
    try {
      localStorage.removeItem(STORAGE_LAST_FOLDER);
    } catch {}
    this.onFolderChange?.(null);
    this.render();
  }

  async reload(): Promise<void> {
    if (!this.currentFolder) return;
    this.isLoading = true;
    this.render();
    try {
      this.entries = await platform().readDirectory(this.currentFolder.id);
    } catch (e) {
      this.entries = [];
      console.warn('[explorer] Failed to read directory:', e);
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private updateActiveItem() {
    const prev = this.root.querySelector('.tree-node.active');
    if (prev) prev.classList.remove('active');

    if (!this.activeFilePath) return;
    const target = this.root.querySelector(`.tree-node[data-path="${CSS.escape(this.activeFilePath)}"]`);
    if (target) {
      target.classList.add('active');
    }
  }

  private filterEntries(entries: DirEntry[], query: string): DirEntry[] {
    if (!query) return entries;
    const q = query.toLowerCase();
    const result: DirEntry[] = [];

    for (const entry of entries) {
      if (entry.isDir) {
        const filteredChildren = entry.children ? this.filterEntries(entry.children, query) : [];
        if (entry.name.toLowerCase().includes(q) || filteredChildren.length > 0) {
          result.push({
            ...entry,
            children: filteredChildren,
          });
        }
      } else if (entry.name.toLowerCase().includes(q)) {
        result.push(entry);
      }
    }

    return result;
  }

  private render() {
    this.root.replaceChildren();

    if (!this.currentFolder) {
      const empty = document.createElement('div');
      empty.className = 'explorer-empty';

      const icon = document.createElement('div');
      icon.className = 'explorer-empty-icon';
      icon.innerHTML = `
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      empty.append(icon);

      const msg = document.createElement('p');
      msg.className = 'hint';
      msg.textContent = '모드 폴더를 열어 하위 INI 파일과 에셋들을 한눈에 탐색하고 전환하세요.';
      empty.append(msg);

      const btn = document.createElement('button');
      btn.className = 'primary open-folder-btn';
      btn.textContent = '폴더 열기';
      btn.addEventListener('click', () => this.openFolderDialog());
      empty.append(btn);

      this.root.append(empty);
      return;
    }

    // ---- Explorer Header ----
    const header = document.createElement('div');
    header.className = 'explorer-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'explorer-title-row';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'explorer-folder-name';
    titleSpan.textContent = this.currentFolder.name;
    titleSpan.title = this.currentFolder.id;
    titleRow.append(titleSpan);

    const actions = document.createElement('div');
    actions.className = 'explorer-actions';

    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'icon-btn';
    reloadBtn.title = '새로고침 (F5)';
    reloadBtn.setAttribute('aria-label', '새로고침');
    reloadBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    `;
    reloadBtn.addEventListener('click', () => this.reload());
    actions.append(reloadBtn);

    const changeBtn = document.createElement('button');
    changeBtn.className = 'icon-btn';
    changeBtn.title = '다른 폴더 열기';
    changeBtn.setAttribute('aria-label', '다른 폴더 열기');
    changeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="11" x2="12" y2="17"></line>
        <line x1="9" y1="14" x2="15" y2="14"></line>
      </svg>
    `;
    changeBtn.addEventListener('click', () => this.openFolderDialog());
    actions.append(changeBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.title = '폴더 닫기';
    closeBtn.setAttribute('aria-label', '폴더 닫기');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', () => this.closeFolder());
    actions.append(closeBtn);

    titleRow.append(actions);
    header.append(titleRow);

    // Search filter
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = '파일/폴더 검색…';
    search.value = this.filter;
    search.setAttribute('aria-label', '파일 검색');
    search.addEventListener('input', () => {
      this.filter = search.value.trim();
      this.renderTreeContainer();
    });
    header.append(search);

    this.root.append(header);

    // ---- Tree Container ----
    const treeContainer = document.createElement('div');
    treeContainer.id = 'explorer-tree-container';
    treeContainer.className = 'tree-container';
    this.root.append(treeContainer);

    this.renderTreeContainer();
  }

  private renderTreeContainer() {
    const container = this.root.querySelector('#explorer-tree-container');
    if (!container) return;
    container.replaceChildren();

    if (this.isLoading) {
      const loading = document.createElement('p');
      loading.className = 'hint loading';
      loading.textContent = '폴더 내용을 불러오는 중…';
      container.append(loading);
      return;
    }

    const filtered = this.filterEntries(this.entries, this.filter);
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = this.filter ? '검색 결과가 없습니다' : '폴더가 비어 있습니다';
      container.append(empty);
      return;
    }

    this.appendTreeNodes(container, filtered, 0);
  }

  private appendTreeNodes(parent: Element, entries: DirEntry[], depth: number) {
    for (const entry of entries) {
      const entryKey = entry.id || entry.path;
      const node = document.createElement('div');
      node.className = `tree-node${entry.isDir ? ' is-dir' : ' is-file'}`;
      node.setAttribute('data-path', entryKey);
      node.style.paddingLeft = `${depth * 14 + 10}px`;

      if (entry.isDir) {
        const isCollapsed = this.collapsedDirs.has(entryKey) && !this.filter;

        const chevron = document.createElement('span');
        chevron.className = `tree-chevron${isCollapsed ? ' collapsed' : ''}`;
        chevron.innerHTML = `
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 4 10 8 6 12"></polyline>
          </svg>
        `;
        node.append(chevron);

        const icon = document.createElement('span');
        icon.className = 'tree-icon dir-icon';
        icon.innerHTML = isCollapsed ? '📁' : '📂';
        node.append(icon);

        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = entry.name;
        node.append(label);

        node.addEventListener('click', () => {
          if (this.collapsedDirs.has(entryKey)) {
            this.collapsedDirs.delete(entryKey);
          } else {
            this.collapsedDirs.add(entryKey);
          }
          this.renderTreeContainer();
        });

        parent.append(node);

        if (!isCollapsed && entry.children && entry.children.length > 0) {
          this.appendTreeNodes(parent, entry.children, depth + 1);
        }
      } else {
        const isIni = /\.(ini|3dm|migoto)$/i.test(entry.name);
        const isActive = entryKey === this.activeFilePath;
        if (isActive) node.classList.add('active');

        // Spacer to align with directory chevrons
        const spacer = document.createElement('span');
        spacer.className = 'tree-chevron-spacer';
        node.append(spacer);

        const icon = document.createElement('span');
        icon.className = `tree-icon file-icon${isIni ? ' is-ini' : ''}`;
        icon.innerHTML = isIni ? '📄' : '📝';
        node.append(icon);

        const label = document.createElement('span');
        label.className = `tree-label${isIni ? ' ini-file' : ''}`;
        label.textContent = entry.name;
        node.append(label);

        if (isIni) {
          const badge = document.createElement('span');
          badge.className = 'tree-badge';
          badge.textContent = 'INI';
          node.append(badge);
        }

        node.title = entry.path || entry.name;

        node.addEventListener('click', () => {
          const ref: FileRef = platform().refFromId(entryKey);
          this.doc.openFile(ref);
        });

        parent.append(node);
      }
    }
  }
}

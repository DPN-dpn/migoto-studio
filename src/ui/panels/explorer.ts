import { platform, type DirEntry, type FileRef } from '../../platform';
import type { DocumentManager } from '../../core/workspace/documents';
import { showToast } from '../common/toast';
import { promptFolderTrust } from '../modals/trust-modal';
import { isFolderTrusted } from '../../core/workspace/trust';

const STORAGE_LAST_FOLDER = 'migoto_last_folder';

export interface FolderRef {
  name: string;
  id: string;
}

const CHEVRON_SVG = `
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 4 10 8 6 12"></polyline>
  </svg>
`;

const DIR_CLOSED_SVG = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
`;

const DIR_OPEN_SVG = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"></path>
    <path d="M2 14l2.5-6h15l-2.5 6H2z"></path>
  </svg>
`;

const FILE_INI_SVG = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
  </svg>
`;

const FILE_IMAGE_SVG = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
`;

const FILE_GENERIC_SVG = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
  </svg>
`;

/**
 * File tree explorer for XXMI / 3DMigoto mod folders.
 * Allows modders to open a mod directory, view nested folders and INI files,
 * search/filter files, and click any INI file to open it in a tab.
 * Includes a right-click context menu for quick file/folder actions.
 */
export class FileExplorer {
  private currentFolder: FolderRef | null = null;
  private entries: DirEntry[] = [];
  private expandedDirs = new Set<string>();
  private filter = '';
  private activeFilePath: string | null = null;
  private isLoading = false;
  private menuEl: HTMLElement;
  private compareCandidate: DirEntry | null = null;

  constructor(
    private root: HTMLElement,
    private doc: DocumentManager,
    menuEl?: HTMLElement,
    private onFolderChange?: (folder: FolderRef | null) => void,
  ) {
    this.menuEl = menuEl || document.getElementById('explorer-menu') || document.createElement('ul');

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
    this.bindGlobalEvents();
  }

  get hasFolder(): boolean {
    return this.currentFolder !== null;
  }

  get folderName(): string {
    return this.currentFolder?.name ?? '';
  }

  hasFile(relativePath: string): boolean {
    if (!this.currentFolder) return false;
    let clean = relativePath.trim().replace(/^["']|["']$/g, '').trim().replace(/\\/g, '/').toLowerCase();
    if (clean.startsWith('./')) clean = clean.slice(2);
    if (!clean) return false;

    const baseName = clean.split('/').pop() || clean;

    const searchTree = (list: DirEntry[], prefix = ''): boolean => {
      for (const entry of list) {
        const curRel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const curLower = curRel.toLowerCase().replace(/\\/g, '/');
        if (curLower === clean) return true;
        if (curLower.endsWith(`/${clean}`)) return true;
        if (!entry.isDir && entry.name.toLowerCase() === baseName && !clean.includes('/')) {
          return true;
        }
        if (entry.isDir && entry.children) {
          if (searchTree(entry.children, curRel)) return true;
        }
      }
      return false;
    };

    return searchTree(this.entries);
  }

  getAllFilePaths(): string[] {
    const result: string[] = [];
    const traverse = (list: DirEntry[], prefix = '') => {
      for (const entry of list) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDir && entry.children) {
          traverse(entry.children, rel);
        } else if (!entry.isDir) {
          result.push(rel);
        }
      }
    };
    traverse(this.entries);
    return result;
  }

  private bindGlobalEvents() {
    document.addEventListener('click', () => this.closeMenu());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeMenu();
    });
  }

  private closeMenu() {
    this.menuEl.hidden = true;
  }

  private async tryRestoreLastFolder() {
    if (platform().kind !== 'desktop') return;
    try {
      const saved = localStorage.getItem(STORAGE_LAST_FOLDER);
      if (saved) {
        const name = saved.split(/[\\/]/).filter(Boolean).pop() ?? saved;
        const folder = { id: saved, name };
        if (isFolderTrusted(folder.id)) {
          await this.openFolder(folder, true);
        }
      }
    } catch {}
  }

  async openFolderDialog(): Promise<void> {
    try {
      const picked = await platform().pickDirectory();
      if (picked) {
        const trusted = await promptFolderTrust(picked);
        if (trusted) {
          await this.openFolder(picked, true);
        }
      }
    } catch (e) {
      await platform().showError('폴더 열기 실패', String(e));
    }
  }

  async openFolder(folder: FolderRef, skipTrustCheck = false): Promise<void> {
    if (!skipTrustCheck && !isFolderTrusted(folder.id)) {
      const trusted = await promptFolderTrust(folder);
      if (!trusted) return;
    }
    this.currentFolder = folder;
    this.expandedDirs.clear();
    this.filter = '';
    try {
      localStorage.setItem(STORAGE_LAST_FOLDER, folder.id);
    } catch {}
    this.onFolderChange?.(folder);
    await this.reload();

    // Auto-expand if the root has only 1 or 2 subdirectories
    const dirCount = this.entries.filter((e) => Boolean(e.isDir || (e as any).is_dir)).length;
    if (dirCount <= 2) {
      for (const e of this.entries) {
        if (e.isDir || (e as any).is_dir) {
          this.expandedDirs.add(e.id || e.path);
        }
      }
      this.renderTreeContainer();
    }
  }

  collapseAll(): void {
    this.expandedDirs.clear();
    this.renderTreeContainer();
  }

  expandAll(): void {
    const collect = (items: DirEntry[]) => {
      for (const it of items) {
        if (it.isDir || (it as any).is_dir) {
          this.expandedDirs.add(it.id || it.path);
          if (it.children) collect(it.children);
        }
      }
    };
    collect(this.entries);
    this.renderTreeContainer();
  }

  closeFolder(): void {
    this.currentFolder = null;
    this.entries = [];
    this.expandedDirs.clear();
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
      const emptyState = document.createElement('div');
      emptyState.className = 'explorer-empty';

      const icon = document.createElement('div');
      icon.className = 'explorer-empty-icon';
      icon.innerHTML = `
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      `;

      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = '열린 모드 폴더가 없습니다.\n모드 폴더를 열어 파일을 탐색하세요.';

      const btn = document.createElement('button');
      btn.className = 'primary open-folder-btn';
      btn.textContent = '모드 폴더 열기';
      btn.addEventListener('click', () => this.openFolderDialog());

      emptyState.append(icon, hint, btn);
      this.root.append(emptyState);
      return;
    }

    // ---- Explorer Header ----
    const header = document.createElement('div');
    header.className = 'explorer-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'explorer-title-row';

    const folderTitle = document.createElement('span');
    folderTitle.className = 'explorer-folder-name';
    folderTitle.textContent = this.currentFolder.name;
    folderTitle.title = this.currentFolder.id;
    titleRow.append(folderTitle);

    const actions = document.createElement('div');
    actions.className = 'explorer-actions';

    // Expand all button
    const expandAllBtn = document.createElement('button');
    expandAllBtn.className = 'icon-btn';
    expandAllBtn.title = '모든 폴더 펼치기';
    expandAllBtn.setAttribute('aria-label', '모두 펼치기');
    expandAllBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"></polyline>
        <polyline points="9 21 3 21 3 15"></polyline>
        <line x1="21" y1="3" x2="14" y2="10"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
    `;
    expandAllBtn.addEventListener('click', () => this.expandAll());

    // Collapse all button
    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.className = 'icon-btn';
    collapseAllBtn.title = '모든 폴더 접기';
    collapseAllBtn.setAttribute('aria-label', '모두 접기');
    collapseAllBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="14" y1="10" x2="21" y2="3"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
    `;
    collapseAllBtn.addEventListener('click', () => this.collapseAll());

    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'icon-btn';
    refreshBtn.title = '폴더 새로고침';
    refreshBtn.setAttribute('aria-label', '새로고침');
    refreshBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"></path>
      </svg>
    `;
    refreshBtn.addEventListener('click', () => this.reload());

    // Close folder button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.title = '폴더 닫기';
    closeBtn.setAttribute('aria-label', '폴더 닫기');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', () => this.closeFolder());

    actions.append(expandAllBtn, collapseAllBtn, refreshBtn, closeBtn);
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

    // Right click on empty tree space
    treeContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e);
    });

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
      const isDir = Boolean(entry.isDir || (entry as any).is_dir);
      const node = document.createElement('div');
      node.className = `tree-node${isDir ? ' is-dir' : ' is-file'}`;
      node.setAttribute('data-path', entryKey);
      node.style.paddingLeft = `${depth * 14 + 10}px`;

      if (isDir) {
        const isExpanded = this.filter ? true : this.expandedDirs.has(entryKey);

        const chevron = document.createElement('span');
        chevron.className = `tree-chevron${isExpanded ? ' expanded' : ' collapsed'}`;
        chevron.innerHTML = CHEVRON_SVG;
        node.append(chevron);

        const icon = document.createElement('span');
        icon.className = `tree-icon dir-icon${isExpanded ? ' is-open' : ''}`;
        icon.innerHTML = isExpanded ? DIR_OPEN_SVG : DIR_CLOSED_SVG;
        node.append(icon);

        const label = document.createElement('span');
        label.className = 'tree-label dir-label';
        label.textContent = entry.name;
        node.append(label);

        node.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (this.expandedDirs.has(entryKey)) {
            this.expandedDirs.delete(entryKey);
          } else {
            this.expandedDirs.add(entryKey);
            if (!entry.children || entry.children.length === 0) {
              try {
                const sub = await platform().readDirectory(entry.path || entryKey);
                if (sub && sub.length > 0) {
                  entry.children = sub;
                }
              } catch {}
            }
          }
          this.renderTreeContainer();
        });

        // Right-click context menu on folder
        node.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(e, entry);
        });

        parent.append(node);

        if (isExpanded) {
          if (entry.children && entry.children.length > 0) {
            this.appendTreeNodes(parent, entry.children, depth + 1);
          } else if (entry.children && entry.children.length === 0) {
            const emptyNode = document.createElement('div');
            emptyNode.className = 'tree-node tree-empty-hint';
            emptyNode.style.paddingLeft = `${(depth + 1) * 14 + 10}px`;
            emptyNode.textContent = '(빈 폴더)';
            parent.append(emptyNode);
          }
        }
      } else {
        const isIni = /\.(ini|3dm|migoto)$/i.test(entry.name);
        const isDds = /\.dds$/i.test(entry.name);
        const isImage = /\.(dds|png|jpe?g|bmp|webp|gif)$/i.test(entry.name);
        const isActive = entryKey === this.activeFilePath;
        if (isActive) node.classList.add('active');

        // Spacer to align with directory chevrons
        const spacer = document.createElement('span');
        spacer.className = 'tree-chevron-spacer';
        node.append(spacer);

        const icon = document.createElement('span');
        icon.className = `tree-icon file-icon${isIni ? ' is-ini' : isImage ? ' is-img' : ''}`;
        icon.innerHTML = isIni ? FILE_INI_SVG : isImage ? FILE_IMAGE_SVG : FILE_GENERIC_SVG;
        node.append(icon);

        const label = document.createElement('span');
        label.className = `tree-label${isIni ? ' ini-file' : isImage ? ' img-file' : ''}`;
        label.textContent = entry.name;
        node.append(label);

        if (isIni) {
          const badge = document.createElement('span');
          badge.className = 'tree-badge';
          badge.textContent = 'INI';
          node.append(badge);
        } else if (isImage) {
          const badge = document.createElement('span');
          badge.className = 'tree-badge img-badge';
          badge.textContent = isDds ? 'DDS' : 'IMG';
          node.append(badge);
        }

        node.title = entry.path || entry.name;

        node.addEventListener('click', () => {
          const ref: FileRef = platform().refFromId(entryKey);
          this.doc.openFile(ref);
        });

        // Right-click context menu on file
        node.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(e, entry);
        });

        parent.append(node);
      }
    }
  }

  private showContextMenu(e: MouseEvent, entry?: DirEntry) {
    this.menuEl.replaceChildren();

    const addItem = (label: string, action?: () => void, isDestructive = false) => {
      const li = document.createElement('li');
      li.textContent = label;
      if (isDestructive) li.style.color = '#ef4444';
      if (action) {
        li.addEventListener('click', () => {
          this.closeMenu();
          action();
        });
      } else {
        li.className = 'empty';
      }
      this.menuEl.append(li);
    };

    const addDivider = () => {
      const sep = document.createElement('li');
      sep.className = 'group';
      sep.textContent = '─';
      sep.style.fontSize = '9px';
      sep.style.padding = '2px 10px';
      sep.style.opacity = '0.35';
      this.menuEl.append(sep);
    };

    const isDesktop = platform().kind === 'desktop';

    if (entry) {
      const entryKey = entry.id || entry.path;
      const isDir = Boolean(entry.isDir || (entry as any).is_dir);

      if (!isDir) {
        addItem('열기', () => {
          const ref: FileRef = platform().refFromId(entryKey);
          this.doc.openFile(ref);
        });

        addItem('비교할 파일로 선택', () => {
          this.compareCandidate = entry;
          showToast(`'${entry.name}' 파일이 비교 대상으로 선택되었습니다.`, 'info');
        });

        if (this.compareCandidate && (this.compareCandidate.id || this.compareCandidate.path) !== entryKey) {
          addItem(`선택한 파일과 비교 ('${this.compareCandidate.name}')`, async () => {
            try {
              const candRef = platform().refFromId(this.compareCandidate!.id || this.compareCandidate!.path);
              const targetRef = platform().refFromId(entryKey);
              const fileA = await platform().readFile(candRef);
              const fileB = await platform().readFile(targetRef);
              this.doc.compareTwoFiles(
                { name: `${this.compareCandidate!.name} (원본)`, text: fileA.text },
                { name: `${entry.name} (비교본)`, text: fileB.text },
              );
              this.compareCandidate = null;
            } catch (err) {
              await platform().showError('파일 비교 실패', String(err));
            }
          });
        }

        addItem('경로 복사', () => {
          navigator.clipboard.writeText(entry.path || entry.name).catch(() => {});
        });

        if (isDesktop && entry.path) {
          addItem('파일 탐색기에서 보기', () => {
            platform().showInFolder?.(entry.path);
          });
        }

        addDivider();

        addItem('삭제', async () => {
          if (!confirm(`'${entry.name}' 파일을 삭제하시겠습니까?`)) return;
          try {
            await platform().deleteEntry?.(entry.path);
            await this.reload();
          } catch (err) {
            await platform().showError('삭제 실패', String(err));
          }
        }, true);
      } else {
        // Folder item
        addItem('새 INI 파일 만들기…', async () => {
          const input = prompt('새 INI 파일 이름을 입력하세요:', 'mod.ini');
          if (!input) return;
          const cleanName = input.trim().endsWith('.ini') ? input.trim() : `${input.trim()}.ini`;
          try {
            const ref = await platform().createFile?.(entry.path, cleanName);
            await this.reload();
            if (ref) await this.doc.openFile(ref);
          } catch (err) {
            await platform().showError('파일 생성 실패', String(err));
          }
        });

        const isExpanded = this.expandedDirs.has(entryKey);
        if (isExpanded) {
          addItem('폴더 접기', () => {
            this.expandedDirs.delete(entryKey);
            this.renderTreeContainer();
          });
        } else {
          addItem('폴더 펼치기', async () => {
            this.expandedDirs.add(entryKey);
            if (!entry.children || entry.children.length === 0) {
              try {
                const sub = await platform().readDirectory(entry.path || entryKey);
                if (sub && sub.length > 0) entry.children = sub;
              } catch {}
            }
            this.renderTreeContainer();
          });
        }

        addItem('폴더 경로 복사', () => {
          navigator.clipboard.writeText(entry.path || entry.name).catch(() => {});
        });

        if (isDesktop && entry.path) {
          addItem('파일 탐색기에서 열기', () => {
            platform().showInFolder?.(entry.path);
          });
        }

        addItem('새로고침', () => this.reload());

        addDivider();

        addItem('폴더 삭제', async () => {
          if (!confirm(`'${entry.name}' 폴더와 내부 파일들을 모두 삭제하시겠습니까?`)) return;
          try {
            await platform().deleteEntry?.(entry.path);
            await this.reload();
          } catch (err) {
            await platform().showError('폴더 삭제 실패', String(err));
          }
        }, true);
      }
    } else if (this.currentFolder) {
      // Empty area of tree
      addItem('새 INI 파일 만들기…', async () => {
        if (!this.currentFolder) return;
        const input = prompt('새 INI 파일 이름을 입력하세요:', 'mod.ini');
        if (!input) return;
        const cleanName = input.trim().endsWith('.ini') ? input.trim() : `${input.trim()}.ini`;
        try {
          const ref = await platform().createFile?.(this.currentFolder.id, cleanName);
          await this.reload();
          if (ref) await this.doc.openFile(ref);
        } catch (err) {
          await platform().showError('파일 생성 실패', String(err));
        }
      });

      addItem('새로고침', () => this.reload());

      if (isDesktop && this.currentFolder.id) {
        addItem('파일 탐색기에서 열기', () => {
          if (this.currentFolder) platform().showInFolder?.(this.currentFolder.id);
        });
      }

      addDivider();

      addItem('폴더 닫기', () => this.closeFolder());
    }

    const menuWidth = 180;
    const posX = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const posY = Math.min(e.clientY, window.innerHeight - 200);
    this.menuEl.style.left = `${Math.max(8, posX)}px`;
    this.menuEl.style.top = `${Math.max(8, posY)}px`;
    this.menuEl.hidden = false;
  }
}

import type { DocumentManager, DocumentTab } from '../core/documents';
import { platform } from '../platform';
import { showToast } from './toast';

/**
 * Manages the horizontal tab strip for multi-document editing.
 * Supports switching, closing, middle-click close, right-click context menu,
 * and mouse-wheel horizontal scrolling.
 */
export class TabBar {
  private activeMenuTabId: string | null = null;
  private selectedForCompareTabId: string | null = null;

  constructor(
    private doc: DocumentManager,
    private container: HTMLElement,
    private newTabBtn: HTMLElement,
    private menuEl: HTMLElement,
  ) {
    this.doc.onChange(() => this.render());
    this.setupEvents();
    this.render();
  }

  private setupEvents() {
    this.newTabBtn.addEventListener('click', () => {
      this.doc.newFile();
    });

    // Mouse wheel horizontal scrolling
    this.container.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY !== 0 && !e.shiftKey) {
          this.container.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      },
      { passive: false },
    );

    // Global listener to close context menu
    document.addEventListener('click', () => this.closeMenu());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeMenu();
    });
  }

  private closeMenu() {
    this.menuEl.hidden = true;
    this.activeMenuTabId = null;
  }

  private showContextMenu(e: MouseEvent, tab: DocumentTab) {
    e.preventDefault();
    e.stopPropagation();
    this.activeMenuTabId = tab.id;

    this.menuEl.replaceChildren();

    const addMenuItem = (label: string, shortcut: string | undefined, action: () => void, disabled = false) => {
      const li = document.createElement('li');
      li.className = disabled ? 'empty' : 'menu-item';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      li.append(labelSpan);

      if (shortcut) {
        const keySpan = document.createElement('small');
        keySpan.textContent = shortcut;
        keySpan.style.marginLeft = 'auto';
        keySpan.style.opacity = '0.6';
        li.append(keySpan);
      }

      if (!disabled) {
        li.addEventListener('click', () => {
          this.closeMenu();
          action();
        });
      }
      this.menuEl.append(li);
    };

    const hasOthers = this.doc.allTabs.length > 1;
    const tabIdx = this.doc.allTabs.findIndex((t) => t.id === tab.id);
    const hasRight = tabIdx >= 0 && tabIdx < this.doc.allTabs.length - 1;

    addMenuItem('닫기', 'Ctrl+W', () => this.doc.closeTab(tab.id));
    if (tab.kind === 'text') {
      addMenuItem('저장', 'Ctrl+S', () => this.doc.save(tab.id));
    }

    if (tab.kind === 'text') {
      const sep = document.createElement('li');
      sep.className = 'group';
      sep.textContent = '─';
      sep.style.fontSize = '9px';
      sep.style.padding = '2px 10px';
      sep.style.opacity = '0.4';
      this.menuEl.append(sep);

      if (tab.file) {
        addMenuItem('디스크 저장본과 비교', undefined, () => this.doc.compareWithDisk(tab.id));
        addMenuItem('최근 백업본과 비교…', undefined, async () => {
          if (!tab.file) return;
          try {
            const backups = await platform().listBackups(tab.file);
            if (backups.length === 0) {
              showToast('이 파일의 이전 백업본이 없습니다.', 'warn');
              return;
            }
            const latest = backups[0];
            const text = await platform().readBackup(latest);
            await this.doc.compareWithBackup(text, latest.timestamp, tab.id);
          } catch (err) {
            showToast(`백업 비교 실패: ${err}`, 'error');
          }
        });
      }
      addMenuItem('클립보드와 비교', undefined, () => this.doc.compareWithClipboard(tab.id));

      addMenuItem('비교할 탭으로 선택', undefined, () => {
        this.selectedForCompareTabId = tab.id;
        showToast(`'${tab.title}' 탭이 비교 대상으로 선택되었습니다.`, 'info');
      });

      if (this.selectedForCompareTabId && this.selectedForCompareTabId !== tab.id) {
        const other = this.doc.allTabs.find((t) => t.id === this.selectedForCompareTabId);
        if (other && other.kind === 'text') {
          addMenuItem(`선택한 탭과 비교 ('${other.title}')`, undefined, () => {
            this.doc.compareTwoFiles(
              { name: `${other.title} (원본)`, text: other.model.getValue() },
              { name: `${tab.title} (비교본)`, text: tab.model.getValue() },
            );
            this.selectedForCompareTabId = null;
          });
        }
      }
    }

    if (hasOthers) {
      const sep = document.createElement('li');
      sep.className = 'group';
      sep.textContent = '─';
      sep.style.fontSize = '9px';
      sep.style.padding = '2px 10px';
      sep.style.opacity = '0.4';
      this.menuEl.append(sep);

      addMenuItem('다른 탭 닫기', undefined, () => this.doc.closeOtherTabs(tab.id));
      if (hasRight) {
        addMenuItem('오른쪽 탭 닫기', undefined, () => this.doc.closeTabsToTheRight(tab.id));
      }
    }

    const menuWidth = 200;
    const posX = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const posY = Math.min(e.clientY, window.innerHeight - 200);
    this.menuEl.style.left = `${Math.max(8, posX)}px`;
    this.menuEl.style.top = `${posY}px`;
    this.menuEl.hidden = false;
  }

  private render() {
    this.container.replaceChildren();
    const activeTab = this.doc.activeTab;

    for (const tab of this.doc.allTabs) {
      const isActive = tab.id === activeTab.id;
      const isDirty = this.doc.isTabDirty(tab);

      const el = document.createElement('div');
      el.className = `tab-item${isActive ? ' active' : ''}${isDirty ? ' dirty' : ''}`;
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', String(isActive));
      el.setAttribute('data-tab-id', tab.id);
      el.title = tab.file?.location ?? tab.title;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'tab-icon';
      iconSpan.style.display = 'inline-flex';
      iconSpan.style.alignItems = 'center';
      iconSpan.style.flexShrink = '0';
      if (tab.kind === 'diff') {
        iconSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 11V3m0 0L1.5 5.5M4 3l2.5 2.5M12 5v8m0 0l2.5-2.5M12 13l-2.5-2.5"/></svg>`;
      } else if (tab.kind === 'custom') {
        iconSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1.5"/><path d="M14 11l-3.5-3.5L3 14"/></svg>`;
      } else {
        iconSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 2h6.5L13 5.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><polyline points="9 2 9 6 13 6"/></svg>`;
      }
      el.append(iconSpan);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = tab.title;
      el.append(titleSpan);

      const dirtySpan = document.createElement('span');
      dirtySpan.className = 'tab-dirty';
      dirtySpan.textContent = '●';
      dirtySpan.title = '수정됨 (저장되지 않음)';
      el.append(dirtySpan);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.type = 'button';
      closeBtn.title = '닫기 (Ctrl+W)';
      closeBtn.setAttribute('aria-label', `${tab.title} 닫기`);
      closeBtn.innerHTML = `
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <line x1="3.5" y1="3.5" x2="12.5" y2="12.5"></line>
          <line x1="12.5" y1="3.5" x2="3.5" y2="12.5"></line>
        </svg>
      `;

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.doc.closeTab(tab.id);
      });
      el.append(closeBtn);

      // Left click to switch tab
      el.addEventListener('click', () => {
        this.doc.switchTab(tab.id);
      });

      // Middle click to close tab
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.doc.closeTab(tab.id);
        }
      });

      // Right click context menu
      el.addEventListener('contextmenu', (e) => {
        this.showContextMenu(e, tab);
      });

      this.container.append(el);

      if (isActive) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
      }
    }
  }
}

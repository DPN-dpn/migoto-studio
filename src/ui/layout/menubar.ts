import { monaco } from '../../core/editor/monaco';
import { platform } from '../../platform';
import { getSettings, updateSettings } from '../../core/workspace/settings';
import type { DocumentManager } from '../../core/workspace/documents';
import type { FileExplorer } from '../panels/explorer';
import type { ActivityBar } from './activitybar';
import type { PluginManager } from '../../plugins/manager';
import { getAllTemplates, insertTemplate } from '../../core/ini/templates';
import { openSettings } from '../modals/settings-ui';
import { openHelp } from '../modals/help-ui';
import { openRestore } from '../modals/restore-ui';
import { openCompareDialog } from '../modals/diff-dialog';
import { openKeyHelperModal } from '../modals/key-helper';
import { runUpdateCheck, openExternalUrl } from '../../updater/updater';
import type { ConsolePanel } from '../panels/console-panel';

export interface MenuBarCallbacks {
  doc: DocumentManager;
  editor: monaco.editor.IStandaloneCodeEditor;
  explorer: FileExplorer;
  activityBar: ActivityBar;
  pluginManager?: PluginManager;
  consolePanel?: ConsolePanel;
  onJumpLint: () => void;
  onGoToDefinition: () => void;
  onFindReferences: () => void;
  onFindInFiles: () => void;
}

interface MenuItemDef {
  label?: string;
  shortcut?: string;
  divider?: boolean;
  checked?: () => boolean;
  action?: () => void;
  submenu?: () => MenuItemDef[];
}

interface TopMenuDef {
  id: string;
  label: string;
  items: () => MenuItemDef[];
  visible?: () => boolean;
}

export class MenuBar {
  private activeMenuId: string | null = null;
  private rootEl: HTMLElement;
  private openDropdownEl: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    private cb: MenuBarCallbacks,
  ) {
    this.rootEl = container;
    this.render();
    this.bindGlobalEvents();

    if (this.cb.pluginManager?.onChange) {
      this.cb.pluginManager.onChange(() => {
        this.render();
      });
    }
  }

  private getMenus(): TopMenuDef[] {
    return [
      {
        id: 'file',
        label: '파일',
        items: () => [
          {
            label: '새 파일',
            shortcut: 'Ctrl+N',
            action: () => this.cb.doc.newFile(),
          },
          {
            label: '파일 열기…',
            shortcut: 'Ctrl+O',
            action: () => this.cb.doc.openDialog(),
          },
          {
            label: '모드 폴더 열기…',
            shortcut: 'Ctrl+Shift+O',
            action: async () => {
              this.cb.activityBar.switchTo('explorer');
              await this.cb.explorer.openFolderDialog();
            },
          },
          {
            label: '모드 폴더 닫기',
            action: async () => {
              await this.cb.explorer.closeFolder();
            },
            disabled: !this.cb.explorer.hasFolder,
          },
          { divider: true },
          {
            label: '최근 파일',
            submenu: () => {
              const recent = getSettings().recentFiles;
              if (recent.length === 0) {
                return [{ label: '(최근에 연 파일 없음)' }];
              }
              return recent.map((filePath) => ({
                label: filePath.split(/[\\/]/).pop() || filePath,
                action: () => this.cb.doc.openFile(platform().refFromId(filePath)),
              }));
            },
          },
          { divider: true },
          {
            label: '저장',
            shortcut: 'Ctrl+S',
            action: () => this.cb.doc.save(),
          },
          {
            label: '다른 이름으로 저장…',
            shortcut: 'Ctrl+Shift+S',
            action: () => this.cb.doc.saveAs(),
          },
          {
            label: '백업 복원…',
            action: () => openRestore(this.cb.doc),
          },
          { divider: true },
          {
            label: '파일 비교 (Diff)…',
            shortcut: 'Ctrl+K D',
            action: () => openCompareDialog(this.cb.doc),
          },
          {
            label: '디스크 저장본과 비교',
            action: () => this.cb.doc.compareWithDisk(),
          },
          {
            label: '클립보드와 비교',
            action: () => this.cb.doc.compareWithClipboard(),
          },
          { divider: true },
          {
            label: '현재 탭 닫기',
            shortcut: 'Ctrl+W',
            action: () => this.cb.doc.closeActiveTab(),
          },
        ],
      },
      {
        id: 'edit',
        label: '편집',
        items: () => [
          {
            label: '실행 취소',
            shortcut: 'Ctrl+Z',
            action: () => this.cb.editor.trigger('menu', 'undo', null),
          },
          {
            label: '다시 실행',
            shortcut: 'Ctrl+Y',
            action: () => this.cb.editor.trigger('menu', 'redo', null),
          },
          { divider: true },
          {
            label: '찾기',
            shortcut: 'Ctrl+F',
            action: () => this.cb.editor.getAction('actions.find')?.run(),
          },
          {
            label: '바꾸기',
            shortcut: 'Ctrl+H',
            action: () => this.cb.editor.getAction('editor.action.startFindReplaceAction')?.run(),
          },
          {
            label: '전체 파일에서 찾기',
            shortcut: 'Ctrl+Shift+F',
            action: () => this.cb.onFindInFiles(),
          },
          { divider: true },
          {
            label: '선언으로 이동',
            shortcut: 'F12',
            action: () => this.cb.onGoToDefinition(),
          },
          {
            label: '참조 및 사용 위치 찾기…',
            shortcut: 'Shift+F12',
            action: () => this.cb.onFindReferences(),
          },
          { divider: true },
          {
            label: '문서 서식 정리 (포맷팅)',
            shortcut: 'Alt+Shift+F',
            action: () => this.cb.editor.getAction('editor.action.formatDocument')?.run(),
          },
          {
            label: '스니펫 템플릿 삽입',
            submenu: () => {
              return getAllTemplates().map((t) => ({
                label: `[${t.group}] ${t.label}`,
                action: () => insertTemplate(this.cb.editor, t),
              }));
            },
          },
          {
            label: '키 입력 도우미…',
            shortcut: 'Ctrl+Shift+K',
            action: () => openKeyHelperModal(this.cb.editor),
          },
          {
            label: '오류 검사 (다음 문제로 이동)',
            shortcut: 'F7',
            action: () => this.cb.onJumpLint(),
          },
        ],
      },
      {
        id: 'view',
        label: '보기',
        items: () => {
          const s = getSettings();
          return [
            {
              label: '사이드바 표시',
              shortcut: 'Ctrl+B',
              checked: () => s.showOutline,
              action: () => this.cb.activityBar.toggleSidebar(),
            },
            {
              label: '콘솔창 표시',
              shortcut: 'Ctrl+`',
              checked: () => Boolean(this.cb.consolePanel?.isOpen()),
              action: () => this.cb.consolePanel?.toggle(),
            },
            { divider: true },
            {
              label: '탐색기 열기',
              shortcut: 'Ctrl+Shift+E',
              action: () => this.cb.activityBar.switchTo('explorer'),
            },
            {
              label: '섹션 목록 열기',
              action: () => this.cb.activityBar.switchTo('outline'),
            },
            {
              label: '코드 템플릿 열기',
              action: () => this.cb.activityBar.switchTo('templates'),
            },
            { divider: true },
            {
              label: '미니맵',
              checked: () => s.minimap,
              action: () => updateSettings({ minimap: !s.minimap }),
            },
            {
              label: '자동 줄 바꿈',
              checked: () => s.wordWrap,
              action: () => updateSettings({ wordWrap: !s.wordWrap }),
            },
            {
              label: '공백 문자 표시',
              checked: () => s.whitespace !== 'none',
              action: () =>
                updateSettings({ whitespace: s.whitespace === 'none' ? 'all' : 'none' }),
            },
          ];
        },
      },
      {
        id: 'plugins',
        label: '플러그인',
        items: () => {
          const items: MenuItemDef[] = [
            {
              label: '플러그인 관리…',
              shortcut: 'Ctrl+Shift+X',
              action: () => {
                this.cb.activityBar.switchTo('plugins');
              },
            },
            {
              label: '플러그인 폴더 열기…',
              action: () => {
                this.cb.pluginManager?.openPluginsFolder();
              },
            },
          ];

          const groups = this.cb.pluginManager?.getPluginMenuItems() ?? [];
          if (groups.length > 0) {
            items.push({ divider: true });
            for (const group of groups) {
              if (group.items.length === 1) {
                const singleItem = group.items[0];
                items.push({
                  label: singleItem.label,
                  shortcut: singleItem.shortcut,
                  action: singleItem.action,
                });
              } else if (group.items.length > 1) {
                items.push({
                  label: group.pluginName,
                  submenu: () => {
                    return group.items.map((subItem) => ({
                      label: subItem.label,
                      shortcut: subItem.shortcut,
                      action: subItem.action,
                    }));
                  },
                });
              }
            }
          }
          return items;
        },
      },
      {
        id: 'help',
        label: '도움말',
        items: () => [
          {
            label: '단축키 및 정보',
            shortcut: 'F1',
            action: () => openHelp(),
          },
          {
            label: '환경설정',
            shortcut: 'Ctrl+,',
            action: () => openSettings(),
          },
          { divider: true },
          {
            label: '업데이트 확인…',
            action: () => runUpdateCheck(false),
          },
          {
            label: 'GitHub 저장소 열기',
            action: () => openExternalUrl('https://github.com/DPN-dpn/migoto-studio'),
          },
        ],
      },
    ];
  }

  private render() {
    this.closeAll();
    this.rootEl.replaceChildren();

    for (const menu of this.getMenus()) {
      if (menu.visible && !menu.visible()) {
        continue;
      }

      const container = document.createElement('div');
      container.className = 'menubar-item';
      container.dataset.menuId = menu.id;

      const btn = document.createElement('button');
      btn.className = 'menubar-btn';
      btn.textContent = menu.label;
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.activeMenuId === menu.id) {
          this.closeAll();
        } else {
          this.openMenu(menu.id, container);
        }
      });

      btn.addEventListener('mouseenter', () => {
        if (this.activeMenuId && this.activeMenuId !== menu.id) {
          this.openMenu(menu.id, container);
        }
      });

      container.append(btn);
      this.rootEl.append(container);
    }
  }

  private openMenu(menuId: string, container: HTMLElement) {
    this.closeAll();
    this.activeMenuId = menuId;

    const btn = container.querySelector('.menubar-btn');
    btn?.classList.add('active');
    btn?.setAttribute('aria-expanded', 'true');

    const menuDef = this.getMenus().find((m) => m.id === menuId);
    if (!menuDef) return;

    const dropdown = this.createDropdown(menuDef.items());
    dropdown.className = 'menu-dropdown';
    container.append(dropdown);
    this.openDropdownEl = dropdown;

    // Boundary check so dropdown doesn't spill off screen
    const rect = dropdown.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      dropdown.style.left = 'auto';
      dropdown.style.right = '0px';
    }
  }

  private createDropdown(items: MenuItemDef[]): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'menu-list';

    for (const item of items) {
      if (item.divider) {
        const div = document.createElement('li');
        div.className = 'menu-divider';
        list.append(div);
        continue;
      }

      const li = document.createElement('li');
      li.className = 'menu-entry';

      if (!item.action && !item.submenu) {
        li.classList.add('disabled');
      }

      const left = document.createElement('div');
      left.className = 'menu-entry-left';

      // Checkmark icon for toggleable items
      const isChecked = item.checked?.();
      const checkSpan = document.createElement('span');
      checkSpan.className = 'menu-check-icon';
      checkSpan.textContent = isChecked ? '✓' : '';
      left.append(checkSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'menu-label';
      labelSpan.textContent = item.label || '';
      left.append(labelSpan);

      li.append(left);

      if (item.shortcut) {
        const kbd = document.createElement('kbd');
        kbd.className = 'menu-shortcut';
        kbd.textContent = item.shortcut;
        li.append(kbd);
      } else if (item.submenu) {
        li.classList.add('has-submenu');
        const arrow = document.createElement('span');
        arrow.className = 'menu-submenu-arrow';
        arrow.textContent = '▶';
        li.append(arrow);

        let subEl: HTMLElement | null = null;
        li.addEventListener('mouseenter', () => {
          if (!subEl) {
            const subItems = item.submenu!();
            subEl = this.createDropdown(subItems);
            subEl.classList.add('menu-submenu');
            li.append(subEl);

            const subRect = subEl.getBoundingClientRect();
            if (subRect.right > window.innerWidth) {
              subEl.style.left = 'auto';
              subEl.style.right = '100%';
            }
          }
        });

        li.addEventListener('mouseleave', () => {
          if (subEl) {
            subEl.remove();
            subEl = null;
          }
        });
      }

      if (item.action) {
        li.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeAll();
          item.action!();
        });
      }

      list.append(li);
    }

    return list;
  }

  closeAll() {
    if (this.openDropdownEl) {
      this.openDropdownEl.remove();
      this.openDropdownEl = null;
    }
    const btns = this.rootEl.querySelectorAll('.menubar-btn');
    btns.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-expanded', 'false');
    });
    this.activeMenuId = null;
  }

  private bindGlobalEvents() {
    document.addEventListener('click', () => {
      if (this.activeMenuId) this.closeAll();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeMenuId) {
        this.closeAll();
        this.cb.editor.focus();
      }
    });
  }
}

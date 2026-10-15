import { getSettings, updateSettings, onSettingsChange } from '../../core/workspace/settings';
import type { OutlinePanel } from '../panels/outline';
import { renderPluginIcon } from '../../plugins/types';

export type ActivityPanel = 'explorer' | 'search' | 'outline' | 'templates' | 'plugins' | string;

export interface DynamicTab {
  id: string;
  icon: string;
  title: string;
  panelEl: HTMLElement;
}

/**
 * VS Code-style vertical Activity Bar on the far left.
 * Lets users switch between Explorer, Outline, Templates, Plugins, and dynamic plugin tabs,
 * or toggle the entire sidebar by clicking the active icon.
 * Bottom icons provide quick access to Settings and Help.
 */
export class ActivityBar {
  private activePanel: ActivityPanel = 'explorer';
  private dynamicTabs: Map<string, DynamicTab & { btnEl: HTMLElement }> = new Map();

  constructor(
    private barEl: HTMLElement,
    private explorerBtn: HTMLElement,
    private searchBtn: HTMLElement,
    private outlineBtn: HTMLElement,
    private templatesBtn: HTMLElement,
    private pluginsBtn: HTMLElement,
    private panelExplorer: HTMLElement,
    private panelSearch: HTMLElement,
    private panelOutline: HTMLElement,
    private panelTemplates: HTMLElement,
    private panelPlugins: HTMLElement,
    private outline: OutlinePanel,
    private onOpenSettings: () => void,
  ) {
    this.bindEvents();
    this.updateActiveUi();

    onSettingsChange(() => {
      this.syncWithSidebarVisibility();
    });
  }

  registerDynamicTab(tab: DynamicTab): { dispose: () => void } {
    if (this.dynamicTabs.has(tab.id)) {
      this.unregisterDynamicTab(tab.id);
    }

    const btn = document.createElement('button');
    btn.className = 'activity-bar-btn';
    btn.id = `act-${tab.id}`;
    btn.title = tab.title;
    btn.setAttribute('aria-label', tab.title);
    btn.innerHTML = `<span>${renderPluginIcon(tab.icon)}</span>`;
    btn.addEventListener('click', () => this.handlePanelClick(tab.id));

    // Place into custom plugins container in activity-bar-top (below explorer/plugins with separator)
    let container = this.barEl.querySelector<HTMLElement>('#act-plugins-custom');
    let separator = this.barEl.querySelector<HTMLElement>('#act-plugins-separator');

    if (!container) {
      const actTop = this.barEl.querySelector<HTMLElement>('.activity-bar-top');
      if (actTop) {
        if (!separator) {
          separator = document.createElement('div');
          separator.id = 'act-plugins-separator';
          separator.className = 'activity-bar-separator';
          actTop.appendChild(separator);
        }
        container = document.createElement('div');
        container.id = 'act-plugins-custom';
        container.className = 'activity-bar-custom-plugins';
        actTop.appendChild(container);
      } else {
        container = this.barEl;
      }
    }

    container.appendChild(btn);
    if (separator) {
      separator.hidden = false;
    }

    this.dynamicTabs.set(tab.id, { ...tab, btnEl: btn });
    this.updateActiveUi();

    return {
      dispose: () => this.unregisterDynamicTab(tab.id),
    };
  }

  unregisterDynamicTab(id: string) {
    const entry = this.dynamicTabs.get(id);
    if (!entry) return;
    entry.btnEl.remove();
    this.dynamicTabs.delete(id);

    if (this.dynamicTabs.size === 0) {
      const separator = this.barEl.querySelector<HTMLElement>('#act-plugins-separator');
      if (separator) {
        separator.hidden = true;
      }
    }

    if (this.activePanel === id) {
      this.switchTo('explorer');
    } else {
      this.updateActiveUi();
    }
  }

  reorderDynamicTabs(order: string[]) {
    const container = this.barEl.querySelector<HTMLElement>('#act-plugins-custom');
    if (!container) return;
    for (const id of order) {
      const entry = this.dynamicTabs.get(id);
      if (entry && entry.btnEl) {
        container.appendChild(entry.btnEl);
      }
    }
  }

  get currentPanel(): ActivityPanel {
    return this.activePanel;
  }

  get isSidebarVisible(): boolean {
    return getSettings().showOutline;
  }

  private bindEvents() {
    this.explorerBtn.addEventListener('click', () => this.handlePanelClick('explorer'));
    this.searchBtn.addEventListener('click', () => this.handlePanelClick('search'));
    this.outlineBtn.addEventListener('click', () => this.handlePanelClick('outline'));
    this.templatesBtn.addEventListener('click', () => this.handlePanelClick('templates'));
    this.pluginsBtn.addEventListener('click', () => this.handlePanelClick('plugins'));

    const settingsBtn = this.barEl.querySelector('#act-settings');
    settingsBtn?.addEventListener('click', () => this.onOpenSettings());
  }

  handlePanelClick(panel: ActivityPanel) {
    const isShowing = getSettings().showOutline;

    if (isShowing && this.activePanel === panel) {
      // Toggle sidebar off (VS Code behavior: clicking active tab collapses sidebar)
      updateSettings({ showOutline: false });
    } else {
      // Switch panel and ensure sidebar is visible
      this.activePanel = panel;
      if (!isShowing) {
        updateSettings({ showOutline: true });
      } else {
        this.updateActiveUi();
      }
    }
  }

  switchTo(panel: ActivityPanel) {
    this.activePanel = panel;
    if (!getSettings().showOutline) {
      updateSettings({ showOutline: true });
    } else {
      this.updateActiveUi();
    }
  }

  toggleSidebar() {
    updateSettings({ showOutline: !getSettings().showOutline });
  }

  private syncWithSidebarVisibility() {
    this.updateActiveUi();
  }

  private updateActiveUi() {
    const isShowing = getSettings().showOutline;

    const isExp = isShowing && this.activePanel === 'explorer';
    const isSrc = isShowing && this.activePanel === 'search';
    const isOut = isShowing && this.activePanel === 'outline';
    const isTpl = isShowing && this.activePanel === 'templates';
    const isPlg = isShowing && this.activePanel === 'plugins';

    this.explorerBtn.classList.toggle('active', isExp);
    this.explorerBtn.setAttribute('aria-pressed', String(isExp));

    this.searchBtn.classList.toggle('active', isSrc);
    this.searchBtn.setAttribute('aria-pressed', String(isSrc));

    this.outlineBtn.classList.toggle('active', isOut);
    this.outlineBtn.setAttribute('aria-pressed', String(isOut));

    this.templatesBtn.classList.toggle('active', isTpl);
    this.templatesBtn.setAttribute('aria-pressed', String(isTpl));

    this.pluginsBtn.classList.toggle('active', isPlg);
    this.pluginsBtn.setAttribute('aria-pressed', String(isPlg));

    // Show/hide sub-panels inside the sidebar
    this.panelExplorer.hidden = this.activePanel !== 'explorer';
    this.panelSearch.hidden = this.activePanel !== 'search';
    this.panelOutline.hidden = this.activePanel !== 'outline';
    this.panelTemplates.hidden = this.activePanel !== 'templates';
    this.panelPlugins.hidden = this.activePanel !== 'plugins';

    // Show/hide dynamic tabs
    for (const [id, tab] of this.dynamicTabs) {
      const isActive = isShowing && this.activePanel === id;
      tab.btnEl.classList.toggle('active', isActive);
      tab.btnEl.setAttribute('aria-pressed', String(isActive));
      tab.panelEl.hidden = this.activePanel !== id;
    }
  }
}

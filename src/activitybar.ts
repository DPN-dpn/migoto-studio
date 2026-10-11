import { getSettings, updateSettings, onSettingsChange } from './settings';
import type { OutlinePanel } from './outline';

export type ActivityPanel = 'explorer' | 'outline' | 'templates' | 'plugins';

/**
 * VS Code-style vertical Activity Bar on the far left.
 * Lets users switch between Explorer, Outline, Templates, and Plugins,
 * or toggle the entire sidebar by clicking the active icon.
 * Bottom icons provide quick access to Settings and Help.
 */
export class ActivityBar {
  private activePanel: ActivityPanel = 'explorer';

  constructor(
    private barEl: HTMLElement,
    private explorerBtn: HTMLElement,
    private outlineBtn: HTMLElement,
    private templatesBtn: HTMLElement,
    private pluginsBtn: HTMLElement,
    private panelExplorer: HTMLElement,
    private panelOutline: HTMLElement,
    private panelTemplates: HTMLElement,
    private panelPlugins: HTMLElement,
    private outline: OutlinePanel,
    private onOpenSettings: () => void,
    private onOpenHelp: () => void,
  ) {
    this.bindEvents();
    this.updateActiveUi();

    onSettingsChange(() => {
      this.syncWithSidebarVisibility();
    });
  }

  get currentPanel(): ActivityPanel {
    return this.activePanel;
  }

  get isSidebarVisible(): boolean {
    return getSettings().showOutline;
  }

  private bindEvents() {
    this.explorerBtn.addEventListener('click', () => this.handlePanelClick('explorer'));
    this.outlineBtn.addEventListener('click', () => this.handlePanelClick('outline'));
    this.templatesBtn.addEventListener('click', () => this.handlePanelClick('templates'));
    this.pluginsBtn.addEventListener('click', () => this.handlePanelClick('plugins'));

    const settingsBtn = this.barEl.querySelector('#act-settings');
    settingsBtn?.addEventListener('click', () => this.onOpenSettings());

    const helpBtn = this.barEl.querySelector('#act-help');
    helpBtn?.addEventListener('click', () => this.onOpenHelp());
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
    const isOut = isShowing && this.activePanel === 'outline';
    const isTpl = isShowing && this.activePanel === 'templates';
    const isPlg = isShowing && this.activePanel === 'plugins';

    this.explorerBtn.classList.toggle('active', isExp);
    this.explorerBtn.setAttribute('aria-pressed', String(isExp));

    this.outlineBtn.classList.toggle('active', isOut);
    this.outlineBtn.setAttribute('aria-pressed', String(isOut));

    this.templatesBtn.classList.toggle('active', isTpl);
    this.templatesBtn.setAttribute('aria-pressed', String(isTpl));

    this.pluginsBtn.classList.toggle('active', isPlg);
    this.pluginsBtn.setAttribute('aria-pressed', String(isPlg));

    // Show/hide sub-panels inside the sidebar
    this.panelExplorer.hidden = this.activePanel !== 'explorer';
    this.panelOutline.hidden = this.activePanel !== 'outline';
    this.panelTemplates.hidden = this.activePanel !== 'templates';
    this.panelPlugins.hidden = this.activePanel !== 'plugins';
  }
}

import { monaco } from '../editor/monaco';
import { platform, type Encoding, type FileRef } from '../../platform';
import { getSettings, updateSettings } from './settings';
import { LANGUAGE_ID } from '../editor/grammar';
import { showToast } from '../../ui/common/toast';
export type { Encoding };
export type TabKind = 'text' | 'custom' | 'diff';

export interface CustomViewerDefinition {
  id: string;
  name: string;
  extensions: string[];
  render(
    container: HTMLElement,
    file: { name: string; path: string; bytes: Uint8Array },
  ): (() => void) | void;
}

export const ENCODING_LABELS: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 (BOM)',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  cp949: 'CP949 (한글 ANSI)',
};

const BINARY_EXTENSIONS = new Set([
  'dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'tga', 'ico', 'tiff', 'psd',
  'exe', 'dll', 'bin', 'dat', 'zip', '7z', 'rar', 'tar', 'gz',
  'buf', 'ib', 'vb',
]);

export interface DiffTabInfo {
  originalTitle: string;
  modifiedTitle: string;
  originalModel: monaco.editor.ITextModel;
  modifiedModel: monaco.editor.ITextModel;
  sourceTabId?: string;
}

export interface OpenDiffOptions {
  title?: string;
  originalTitle: string;
  modifiedTitle: string;
  originalText: string;
  modifiedText: string;
  languageId?: string;
  sourceTabId?: string;
  file?: FileRef | null;
}

export interface DiffViewerHandler {
  showDiffTab(tab: DocumentTab): void;
}

export interface DocumentTab {
  id: string;
  file: FileRef | null;
  kind: TabKind;
  encoding: Encoding;
  model: monaco.editor.ITextModel;
  savedVersion: number;
  viewState: monaco.editor.ICodeEditorViewState | null;
  title: string;
  icon?: string;
  customViewerId?: string;
  customBytes?: Uint8Array;
  customCleanup?: (() => void) | void;
  customRenderer?: (container: HTMLElement) => void | (() => void);
  customElement?: HTMLElement;
  savedScrolls?: Map<HTMLElement, { top: number; left: number }>;
  diffInfo?: DiffTabInfo;
}

export interface CustomViewerProvider {
  getCustomViewer(ext: string): CustomViewerDefinition | undefined;
}

/**
 * Manages multiple open documents (tabs) being edited:
 * - Each tab has its own Monaco text model, undo/redo history, saved version, and view state.
 * - Supports rich custom tabs (registered dynamically via CustomViewerProvider) alongside INI text tabs.
 * - Switching tabs swaps models or custom viewers and restores scroll/cursor location.
 * - Dirty state uses Monaco's alternative version ID for accurate undo-to-clean detection.
 */
export class DocumentManager {
  private tabs: DocumentTab[] = [];
  private activeTabId = '';
  private tabSeq = 0;
  private untitledSeq = 0;
  private listeners = new Set<() => void>();
  private beforeSwitchHandlers = new Set<(fromTabId: string, toTabId: string) => void>();
  private viewerProvider?: CustomViewerProvider;
  private diffViewer?: DiffViewerHandler;

  constructor(
    private editor: monaco.editor.IStandaloneCodeEditor,
    private customViewerContainer?: HTMLElement,
  ) {
    if (!this.customViewerContainer) {
      this.customViewerContainer = document.getElementById('custom-viewer-container') ?? undefined;
    }
    const initialDummy = this.editor.getModel();
    const firstTab = this.createTab();
    this.tabs.push(firstTab);
    this.activeTabId = firstTab.id;
    this.editor.setModel(firstTab.model);
    initialDummy?.dispose();
  }

  setViewerProvider(provider: CustomViewerProvider) {
    this.viewerProvider = provider;
  }

  setDiffViewer(dv: DiffViewerHandler) {
    this.diffViewer = dv;
  }

  get allTabs(): readonly DocumentTab[] {
    return this.tabs;
  }

  get activeTab(): DocumentTab {
    const found = this.tabs.find((t) => t.id === this.activeTabId);
    return found ?? this.tabs[0];
  }

  get currentTabId(): string {
    return this.activeTabId;
  }

  isTabDirty(tab: DocumentTab): boolean {
    if (tab.kind === 'custom' || tab.kind === 'diff') return false;
    return tab.model.getAlternativeVersionId() !== tab.savedVersion;
  }

  get isDirty(): boolean {
    return this.isTabDirty(this.activeTab);
  }

  get file(): FileRef | null {
    return this.activeTab?.file ?? null;
  }

  get fileName(): string {
    return this.activeTab?.title ?? '이름 없음';
  }

  get encoding(): Encoding {
    return this.activeTab?.encoding ?? 'utf-8';
  }

  get eol(): '\r\n' | '\n' {
    return (this.activeTab?.model.getEOL() as '\r\n' | '\n') ?? '\r\n';
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onBeforeSwitchTab(handler: (fromTabId: string, toTabId: string) => void): () => void {
    this.beforeSwitchHandlers.add(handler);
    return () => this.beforeSwitchHandlers.delete(handler);
  }

  markTabClean(tabId: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (tab && tab.kind === 'text') {
      tab.savedVersion = tab.model.getAlternativeVersionId();
      this.emit();
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private createTab(opts?: {
    file?: FileRef;
    title?: string;
    text?: string;
    encoding?: Encoding;
  }): DocumentTab {
    const id = `tab_${Date.now()}_${++this.tabSeq}`;
    const title =
      opts?.title ??
      (this.tabs.length === 0 && this.untitledSeq === 0
        ? '이름 없음'
        : `이름 없음 ${++this.untitledSeq || 2}`);

    const uri = monaco.Uri.parse(`inifile:///tab-${id}/${encodeURIComponent(title)}.ini`);
    const model = monaco.editor.createModel(opts?.text ?? '', LANGUAGE_ID, uri);
    model.pushEOL(monaco.editor.EndOfLineSequence.CRLF);

    const tab: DocumentTab = {
      id,
      file: opts?.file ?? null,
      kind: 'text',
      encoding: opts?.encoding ?? 'utf-8',
      model,
      savedVersion: model.getAlternativeVersionId(),
      viewState: null,
      title,
    };

    model.onDidChangeContent(() => this.emit());
    return tab;
  }

  setEncoding(enc: Encoding, tabId?: string) {
    const target = tabId ? this.tabs.find((t) => t.id === tabId) : this.activeTab;
    if (!target) return;
    target.encoding = enc;
    this.emit();
  }

  toggleEol(tabId?: string) {
    const target = tabId ? this.tabs.find((t) => t.id === tabId) : this.activeTab;
    if (!target) return;
    target.model.pushEOL(
      target.model.getEOL() === '\r\n'
        ? monaco.editor.EndOfLineSequence.LF
        : monaco.editor.EndOfLineSequence.CRLF,
    );
    this.emit();
  }

  switchTab(tabId: string, force = false) {
    if (!force && this.activeTabId === tabId) return;
    const target = this.tabs.find((t) => t.id === tabId);
    if (!target) return;

    const prevTabId = this.activeTabId;
    this.beforeSwitchHandlers.forEach((handler) => {
      try {
        handler(prevTabId, target.id);
      } catch (err) {
        console.warn('[DocumentManager] beforeSwitchHandler error:', err);
      }
    });

    if (this.activeTab && this.activeTab.kind === 'text') {
      this.activeTab.viewState = this.editor.saveViewState();
    } else if (this.activeTab && this.activeTab.kind === 'custom' && this.activeTab.customElement) {
      if (typeof this.activeTab.customElement.querySelectorAll === 'function') {
        const scrolls = new Map<HTMLElement, { top: number; left: number }>();
        const scrollables = this.activeTab.customElement.querySelectorAll(
          '.plugin-scroll-container, .migoto-scroll-container, [data-scrollable="true"]'
        );
        scrollables.forEach((el) => {
          const h = el as HTMLElement;
          if (h.scrollTop > 0 || h.scrollLeft > 0) {
            scrolls.set(h, { top: h.scrollTop, left: h.scrollLeft });
          }
        });
        this.activeTab.savedScrolls = scrolls;
      }
    }

    this.activeTabId = target.id;
    const editorEl = document.getElementById('editor');
    const customContainer = this.customViewerContainer;
    const diffContainer = document.getElementById('diff-container');

    if (target.kind === 'diff') {
      if (editorEl) editorEl.style.display = 'none';
      if (customContainer) customContainer.hidden = true;
      if (diffContainer) diffContainer.hidden = false;
      this.diffViewer?.showDiffTab(target);
    } else if (target.kind === 'custom') {
      if (diffContainer) diffContainer.hidden = true;
      if (editorEl) editorEl.style.display = 'none';
      if (customContainer) {
        customContainer.hidden = false;

        // 다른 커스텀 탭들의 엘리먼트는 숨김 처리(DOM 트리는 온전히 보존)
        for (const t of this.tabs) {
          if (t.id !== target.id && t.customElement) {
            t.customElement.hidden = true;
            t.customElement.style.display = 'none';
          }
        }

        if (target.customElement) {
          target.customElement.hidden = false;
          target.customElement.style.display = 'flex';

          if (target.savedScrolls && target.savedScrolls.size > 0) {
            const restoreCustomScrolls = () => {
              target.savedScrolls?.forEach((pos, el) => {
                if (el) {
                  el.scrollTop = pos.top;
                  el.scrollLeft = pos.left;
                }
              });
            };
            if (typeof requestAnimationFrame === 'function') {
              requestAnimationFrame(restoreCustomScrolls);
            } else {
              restoreCustomScrolls();
            }
          }
        } else {
          const wrapper = document.createElement('div');
          wrapper.className = 'migoto-custom-tab-host';
          wrapper.style.cssText =
            'height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden; position: relative; box-sizing: border-box; flex: 1 1 0; min-height: 0; min-width: 0;';

          customContainer.appendChild(wrapper);
          target.customElement = wrapper;

          if (target.customRenderer) {
            try {
              const cleanup = target.customRenderer(wrapper);
              if (typeof cleanup === 'function') {
                target.customCleanup = cleanup;
              }
            } catch (err) {
              console.error('Failed to render custom tab:', err);
            }
          } else {
            const ext = target.file?.name.split('.').pop()?.toLowerCase() ?? '';
            const viewer = this.viewerProvider?.getCustomViewer(ext);
            if (viewer) {
              target.customCleanup = viewer.render(wrapper, {
                name: target.title,
                path: target.file?.location ?? target.title,
                bytes: target.customBytes ?? new Uint8Array(),
              });
            } else {
              const placeholder = document.createElement('div');
              placeholder.className = 'binary-file-placeholder';
              placeholder.innerHTML = `
                <div class="binary-placeholder-icon">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <div class="binary-placeholder-title">${target.title}</div>
                <div class="binary-placeholder-desc">바이너리 파일이거나 열 수 있는 전용 뷰어가 없습니다.</div>
              `;
              wrapper.append(placeholder);
            }
          }
        }
      }
    } else {
      if (diffContainer) diffContainer.hidden = true;
      if (customContainer) {
        customContainer.hidden = true;
        for (const t of this.tabs) {
          if (t.customElement) {
            t.customElement.hidden = true;
            t.customElement.style.display = 'none';
          }
        }
      }
      if (editorEl) {
        editorEl.style.display = 'block';
        this.editor.layout();
      }
      this.editor.setModel(target.model);
      if (target.viewState) {
        this.editor.restoreViewState(target.viewState);
      }
      this.editor.focus();

      const syncEditorLayout = () => {
        if (this.activeTabId === target.id) {
          this.editor.layout();
          if (target.viewState) {
            this.editor.restoreViewState(target.viewState);
          }
        }
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(syncEditorLayout);
      } else {
        syncEditorLayout();
      }
    }

    this.emit();
  }

  nextTab() {
    if (this.tabs.length <= 1) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const nextIdx = (idx + 1) % this.tabs.length;
    this.switchTab(this.tabs[nextIdx].id);
  }

  prevTab() {
    if (this.tabs.length <= 1) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const prevIdx = (idx - 1 + this.tabs.length) % this.tabs.length;
    this.switchTab(this.tabs[prevIdx].id);
  }

  newFile(initialText = ''): DocumentTab {
    const tab = this.createTab({ text: initialText });
    this.tabs.push(tab);
    this.switchTab(tab.id);
    return tab;
  }

  async closeActiveTab(): Promise<boolean> {
    return this.closeTab(this.activeTabId);
  }

  async closeTab(tabId: string): Promise<boolean> {
    const idx = this.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return true;
    const target = this.tabs[idx];

    if (this.isTabDirty(target)) {
      if (target.file && target.kind === 'text') {
        try {
          const loaded = await platform().readFile(target.file);
          if (loaded.text === target.model.getValue()) {
            target.savedVersion = target.model.getAlternativeVersionId();
            this.emit();
          }
        } catch {
          // ignore read error and proceed to ask
        }
      }
    }

    if (this.isTabDirty(target)) {
      this.switchTab(target.id);
      const choice = await platform().askSaveChanges(target.title);
      if (choice === 'save') {
        const saved = await this.saveTab(target);
        if (!saved) return false;
      } else if (choice === 'cancel') {
        return false;
      }
    }

    if (target.kind === 'custom') {
      if (typeof target.customCleanup === 'function') {
        try { target.customCleanup(); } catch {}
      }
      target.customCleanup = undefined;
      if (target.customElement) {
        target.customElement.remove();
        target.customElement = undefined;
      }
      target.savedScrolls = undefined;
    }

    if (target.kind === 'diff' && target.diffInfo) {
      target.diffInfo.originalModel.dispose();
      target.diffInfo.modifiedModel.dispose();
    }

    const wasActive = target.id === this.activeTabId;
    this.tabs.splice(idx, 1);
    target.model.dispose();

    if (this.tabs.length === 0) {
      this.newFile();
      return true;
    }

    if (wasActive) {
      const nextIdx = Math.min(idx, this.tabs.length - 1);
      const nextTab = this.tabs[nextIdx];
      this.switchTab(nextTab.id, true);
    }

    this.emit();
    return true;
  }

  async closeOtherTabs(tabId: string): Promise<boolean> {
    const toClose = this.tabs.filter((t) => t.id !== tabId);
    for (const t of toClose) {
      const ok = await this.closeTab(t.id);
      if (!ok) return false;
    }
    return true;
  }

  async closeTabsToTheRight(tabId: string): Promise<boolean> {
    const idx = this.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return true;
    const toClose = this.tabs.slice(idx + 1);
    for (const t of toClose) {
      const ok = await this.closeTab(t.id);
      if (!ok) return false;
    }
    return true;
  }

  async confirmDiscard(): Promise<boolean> {
    return this.promptSaveDirty();
  }

  async closeAllTabs(): Promise<boolean> {
    const list = [...this.tabs];
    for (const t of list) {
      const ok = await this.closeTab(t.id);
      if (!ok) return false;
    }
    return true;
  }

  async promptSaveDirty(): Promise<boolean> {
    const dirty = this.tabs.filter((t) => this.isTabDirty(t));
    for (const tab of dirty) {
      this.switchTab(tab.id);
      const choice = await platform().askSaveChanges(tab.title);
      if (choice === 'save') {
        const saved = await this.saveTab(tab);
        if (!saved) return false;
      } else if (choice === 'cancel') {
        return false;
      }
    }
    return true;
  }

  async restoreText(text: string) {
    if (!this.activeTab) return;
    this.editor.pushUndoStop();
    this.editor.executeEdits('restore-backup', [
      { range: this.activeTab.model.getFullModelRange(), text },
    ]);
    this.editor.pushUndoStop();
  }

  async openDialog() {
    try {
      const ref = await platform().pickOpen();
      if (ref) await this.openFile(ref);
    } catch (e) {
      await platform().showError('파일 열기 실패', String(e));
    }
  }

  async openFile(ref: FileRef): Promise<void> {
    const ext = ref.name.split('.').pop()?.toLowerCase() ?? '';
    const customViewer = this.viewerProvider?.getCustomViewer(ext);

    if (customViewer) {
      return this.openCustomViewerFile(ref, customViewer);
    }

    if (BINARY_EXTENSIONS.has(ext)) {
      return this.openCustomViewerFile(ref);
    }

    // 1. If already open in any tab, switch to it
    const existing = this.tabs.find((t) => t.file?.id === ref.id);
    if (existing) {
      this.switchTab(existing.id);
      return;
    }

    try {
      const loaded = await platform().readFile(ref);

      // 2. If current active tab is untouched, empty and untitled, reuse it
      if (
        this.tabs.length === 1 &&
        !this.activeTab.file &&
        !this.isTabDirty(this.activeTab) &&
        this.activeTab.kind === 'text' &&
        this.activeTab.model.getValue().length === 0
      ) {
        this.activeTab.file = ref;
        this.activeTab.title = ref.name;
        this.activeTab.encoding = loaded.encoding;
        this.activeTab.model.setValue(loaded.text);
        this.activeTab.savedVersion = this.activeTab.model.getAlternativeVersionId();
        this.editor.setScrollPosition({ scrollTop: 0 });
        this.editor.setPosition({ lineNumber: 1, column: 1 });
        await this.rememberRecent(ref);
        this.emit();
        return;
      }

      // 3. Otherwise, create a new tab and switch to it
      const newTab = this.createTab({
        file: ref,
        title: ref.name,
        text: loaded.text,
        encoding: loaded.encoding,
      });
      this.tabs.push(newTab);
      this.switchTab(newTab.id);
      this.editor.setScrollPosition({ scrollTop: 0 });
      this.editor.setPosition({ lineNumber: 1, column: 1 });
      await this.rememberRecent(ref);
    } catch (e) {
      await platform().showError('파일을 열 수 없습니다', String(e));
    }
  }

  async openCustomViewerFile(ref: FileRef, viewer?: CustomViewerDefinition): Promise<void> {
    const existing = this.tabs.find((t) => t.file?.id === ref.id);
    if (existing) {
      this.switchTab(existing.id);
      return;
    }

    try {
      let bytes = new Uint8Array();
      if (platform().readBinaryFile) {
        try {
          const loaded = await platform().readBinaryFile!(ref.id);
          bytes = new Uint8Array(loaded.buffer as ArrayBuffer, loaded.byteOffset, loaded.byteLength);
        } catch {}
      }
      const id = `custom_tab_${Date.now()}_${++this.tabSeq}`;
      const uri = monaco.Uri.parse(`customfile:///tab-${id}/${encodeURIComponent(ref.name)}`);
      const dummyModel = monaco.editor.createModel('', 'plaintext', uri);

      if (
        this.tabs.length === 1 &&
        !this.activeTab.file &&
        !this.isTabDirty(this.activeTab) &&
        this.activeTab.kind === 'text' &&
        this.activeTab.model.getValue().length === 0
      ) {
        this.activeTab.kind = 'custom';
        this.activeTab.file = ref;
        this.activeTab.title = ref.name;
        this.activeTab.customBytes = bytes;
        this.activeTab.customViewerId = viewer?.id;
        this.activeTab.model = dummyModel;
        this.switchTab(this.activeTab.id, true);
        await this.rememberRecent(ref);
        this.emit();
        return;
      }

      const tab: DocumentTab = {
        id,
        file: ref,
        kind: 'custom',
        encoding: 'utf-8',
        model: dummyModel,
        savedVersion: 1,
        viewState: null,
        title: ref.name,
        customBytes: bytes,
        customViewerId: viewer?.id,
      };

      this.tabs.push(tab);
      this.switchTab(tab.id, true);
      await this.rememberRecent(ref);
    } catch (e) {
      await platform().showError('파일을 열 수 없습니다', String(e));
    }
  }

  openCustomTab(options: {
    id: string;
    title: string;
    icon?: string;
    render: (container: HTMLElement) => void | (() => void);
  }): DocumentTab {
    const existing = this.tabs.find((t) => t.id === options.id);
    if (existing) {
      existing.title = options.title;
      if (options.icon !== undefined) existing.icon = options.icon;
      this.switchTab(existing.id);
      return existing;
    }

    const dummyModel = monaco.editor.createModel(
      '',
      'plaintext',
      monaco.Uri.parse(`plugin-tab:///${encodeURIComponent(options.id)}`),
    );

    if (
      this.tabs.length === 1 &&
      !this.activeTab.file &&
      !this.isTabDirty(this.activeTab) &&
      this.activeTab.kind === 'text' &&
      this.activeTab.model.getValue().length === 0
    ) {
      this.activeTab.id = options.id;
      this.activeTab.kind = 'custom';
      this.activeTab.file = null;
      this.activeTab.title = options.title;
      this.activeTab.icon = options.icon;
      this.activeTab.customRenderer = options.render;
      this.activeTab.model.dispose();
      this.activeTab.model = dummyModel;
      this.activeTabId = options.id;
      this.switchTab(this.activeTab.id, true);
      this.emit();
      return this.activeTab;
    }

    const tab: DocumentTab = {
      id: options.id,
      file: null,
      kind: 'custom',
      encoding: 'utf-8',
      model: dummyModel,
      savedVersion: 1,
      viewState: null,
      title: options.title,
      icon: options.icon,
      customRenderer: options.render,
    };

    this.tabs.push(tab);
    this.switchTab(tab.id, true);
    this.emit();
    return tab;
  }

  async save(tabId?: string): Promise<boolean> {
    const target = tabId ? this.tabs.find((t) => t.id === tabId) : this.activeTab;
    if (!target) return false;
    if (!target.file) return this.saveAs(target.id);
    return this.writeTab(target, target.file);
  }

  async saveAs(tabId?: string): Promise<boolean> {
    const target = tabId ? this.tabs.find((t) => t.id === tabId) : this.activeTab;
    if (!target) return false;
    const ref = await platform().pickSave(target.file);
    if (!ref) return false;
    return this.writeTab(target, ref);
  }

  private async saveTab(tab: DocumentTab): Promise<boolean> {
    if (!tab.file) {
      const ref = await platform().pickSave(null);
      if (!ref) return false;
      return this.writeTab(tab, ref);
    }
    return this.writeTab(tab, tab.file);
  }

  private async writeTab(tab: DocumentTab, ref: FileRef): Promise<boolean> {
    if (tab.kind === 'custom') return true;
    try {
      const s = getSettings();
      await platform().writeFile(ref, tab.model.getValue(), tab.encoding, {
        enabled: s.backupOnSave,
        keepDays: s.backupKeepDays,
        maxPerFile: s.backupMaxPerFile,
      });
      tab.file = ref;
      tab.title = ref.name;
      tab.savedVersion = tab.model.getAlternativeVersionId();
      await this.rememberRecent(ref);
      this.emit();
      return true;
    } catch (e) {
      await platform().showError('저장하지 못했습니다', String(e));
      return false;
    }
  }

  private async rememberRecent(ref: FileRef) {
    if (!platform().capabilities.recentFiles) return;
    const recent = [ref.id, ...getSettings().recentFiles.filter((p) => p !== ref.id)].slice(0, 10);
    await updateSettings({ recentFiles: recent });
  }

  openDiffTab(options: OpenDiffOptions): DocumentTab {
    const lang = options.languageId ?? LANGUAGE_ID;
    const tabId = `diff_tab_${Date.now()}_${++this.tabSeq}`;
    const origUri = monaco.Uri.parse(`diff-orig:///tab-${tabId}/${encodeURIComponent(options.originalTitle)}`);
    const modUri = monaco.Uri.parse(`diff-mod:///tab-${tabId}/${encodeURIComponent(options.modifiedTitle)}`);

    const originalModel = monaco.editor.createModel(options.originalText, lang, origUri);
    const modifiedModel = monaco.editor.createModel(options.modifiedText, lang, modUri);

    const title = options.title ?? `${options.originalTitle} ↔ ${options.modifiedTitle}`;

    const tab: DocumentTab = {
      id: tabId,
      file: options.file ?? null,
      kind: 'diff',
      encoding: 'utf-8',
      model: modifiedModel,
      savedVersion: modifiedModel.getAlternativeVersionId(),
      viewState: null,
      title,
      diffInfo: {
        originalTitle: options.originalTitle,
        modifiedTitle: options.modifiedTitle,
        originalModel,
        modifiedModel,
        sourceTabId: options.sourceTabId,
      },
    };

    this.tabs.push(tab);
    this.switchTab(tab.id);
    return tab;
  }

  applyDiffToSource(diffTabId: string): boolean {
    const diffTab = this.tabs.find((t) => t.id === diffTabId);
    if (!diffTab || diffTab.kind !== 'diff' || !diffTab.diffInfo?.sourceTabId) return false;

    const sourceTab = this.tabs.find((t) => t.id === diffTab.diffInfo!.sourceTabId);
    if (!sourceTab || sourceTab.kind !== 'text') return false;

    const newText = diffTab.diffInfo.modifiedModel.getValue();
    const fullRange = sourceTab.model.getFullModelRange();
    sourceTab.model.pushEditOperations(
      [],
      [{ range: fullRange, text: newText }],
      () => null,
    );

    this.switchTab(sourceTab.id);
    this.closeTab(diffTabId);
    return true;
  }

  async compareWithDisk(tabId?: string): Promise<void> {
    const target = tabId ? this.tabs.find((t) => t.id === tabId) : this.activeTab;
    if (!target || !target.file) {
      await platform().showInfo('디스크 비교 불가', '파일로 저장되어 있지 않은 임시 문서입니다.');
      return;
    }

    try {
      const disk = await platform().readFile(target.file);
      const currentText = target.model.getValue();
      const fileName = target.file.name;

      if (disk.text === currentText) {
        showToast('디스크 저장본과 현재 내용이 완전히 일치합니다.', 'info');
        return;
      }

      this.openDiffTab({
        title: `${fileName} (디스크 ↔ 에디터)`,
        originalTitle: `${fileName} (디스크 저장본)`,
        modifiedTitle: `${fileName} (현재 에디터)`,
        originalText: disk.text,
        modifiedText: currentText,
        sourceTabId: target.id,
        file: target.file,
      });
    } catch (err) {
      await platform().showError('디스크 파일 읽기 실패', String(err));
    }
  }

  async compareWithClipboard(tabId?: string): Promise<void> {
    const target = tabId ? this.tabs.find((t) => t.id === tabId) : this.activeTab;
    if (!target) return;

    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || clipText.trim().length === 0) {
        showToast('클립보드가 비어 있습니다.', 'warn');
        return;
      }

      const currentText = target.model.getValue();
      const fileName = target.title;

      if (clipText === currentText) {
        showToast('클립보드 내용과 현재 문서 내용이 완전히 일치합니다.', 'info');
        return;
      }

      this.openDiffTab({
        title: `${fileName} ↔ 클립보드`,
        originalTitle: `${fileName} (현재 문서)`,
        modifiedTitle: '클립보드 내용 (수정안)',
        originalText: currentText,
        modifiedText: clipText,
        sourceTabId: target.id,
        file: target.file,
      });
    } catch (err) {
      showToast('클립보드 내용을 읽을 수 없습니다.', 'warn');
    }
  }

  async compareWithBackup(backupText: string, backupTimestamp: number, tabId?: string): Promise<void> {
    const target = tabId ? this.tabs.find((t) => t.id === tabId) : this.activeTab;
    if (!target) return;

    const currentText = target.model.getValue();
    const fileName = target.title;
    const timeStr = new Date(backupTimestamp).toLocaleString('ko-KR');

    this.openDiffTab({
      title: `${fileName} (${timeStr} 백업 ↔ 현재)`,
      originalTitle: `${fileName} (${timeStr} 백업본)`,
      modifiedTitle: `${fileName} (현재 에디터)`,
      originalText: backupText,
      modifiedText: currentText,
      sourceTabId: target.id,
      file: target.file,
    });
  }

  compareTwoFiles(fileA: { name: string; text: string }, fileB: { name: string; text: string }): DocumentTab {
    return this.openDiffTab({
      title: `${fileA.name} ↔ ${fileB.name}`,
      originalTitle: fileA.name,
      modifiedTitle: fileB.name,
      originalText: fileA.text,
      modifiedText: fileB.text,
    });
  }
}

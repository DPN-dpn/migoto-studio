import { monaco } from './monaco';
import { platform, type Encoding, type FileRef } from '../platform';
import { getSettings, updateSettings } from './settings';
import { LANGUAGE_ID } from './grammar';
import type { CustomViewerDefinition } from '../plugins/types';

export type { Encoding };
export type TabKind = 'text' | 'custom';

export const ENCODING_LABELS: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 (BOM)',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  cp949: 'CP949 (한글 ANSI)',
};

export interface DocumentTab {
  id: string;
  file: FileRef | null;
  kind: TabKind;
  encoding: Encoding;
  model: monaco.editor.ITextModel;
  savedVersion: number;
  viewState: monaco.editor.ICodeEditorViewState | null;
  title: string;
  customViewerId?: string;
  customBytes?: Uint8Array;
  customCleanup?: (() => void) | void;
}

export interface PluginViewerProvider {
  getCustomViewer(ext: string): CustomViewerDefinition | undefined;
}

/**
 * Manages multiple open documents (tabs) being edited:
 * - Each tab has its own Monaco text model, undo/redo history, saved version, and view state.
 * - Supports rich custom tabs (registered dynamically by plugins) alongside INI text tabs.
 * - Switching tabs swaps models or custom viewers and restores scroll/cursor location.
 * - Dirty state uses Monaco's alternative version ID for accurate undo-to-clean detection.
 */
export class DocumentManager {
  private tabs: DocumentTab[] = [];
  private activeTabId = '';
  private tabSeq = 0;
  private untitledSeq = 0;
  private listeners = new Set<() => void>();
  private pluginManager?: PluginViewerProvider;

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

  setPluginManager(pm: PluginViewerProvider) {
    this.pluginManager = pm;
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
    if (tab.kind === 'custom') return false;
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

    if (this.activeTab && this.activeTab.kind === 'text') {
      this.activeTab.viewState = this.editor.saveViewState();
    } else if (this.activeTab && this.activeTab.kind === 'custom') {
      if (typeof this.activeTab.customCleanup === 'function') {
        try { this.activeTab.customCleanup(); } catch {}
      }
      this.activeTab.customCleanup = undefined;
    }

    this.activeTabId = target.id;
    const editorEl = document.getElementById('editor');

    if (target.kind === 'custom') {
      if (editorEl) editorEl.style.display = 'none';
      if (this.customViewerContainer) {
        this.customViewerContainer.hidden = false;
        this.customViewerContainer.replaceChildren();

        const ext = target.file?.name.split('.').pop()?.toLowerCase() ?? '';
        const viewer = this.pluginManager?.getCustomViewer(ext);
        if (viewer) {
          target.customCleanup = viewer.render(this.customViewerContainer, {
            name: target.title,
            path: target.file?.location ?? target.title,
            bytes: target.customBytes ?? new Uint8Array(),
          });
        }
      }
    } else {
      if (this.customViewerContainer) {
        this.customViewerContainer.hidden = true;
        this.customViewerContainer.replaceChildren();
      }
      if (editorEl) editorEl.style.display = 'block';
      this.editor.setModel(target.model);
      if (target.viewState) {
        this.editor.restoreViewState(target.viewState);
      }
      this.editor.focus();
      this.editor.layout();
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
      this.switchTab(target.id);
      const choice = await platform().askSaveChanges(target.title);
      if (choice === 'save') {
        const saved = await this.saveTab(target);
        if (!saved) return false;
      } else if (choice === 'cancel') {
        return false;
      }
    }

    if (target.kind === 'custom' && typeof target.customCleanup === 'function') {
      try { target.customCleanup(); } catch {}
      target.customCleanup = undefined;
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
    const customViewer = this.pluginManager?.getCustomViewer(ext);

    if (customViewer) {
      return this.openCustomViewerFile(ref, customViewer);
    }

    if (/\.(dds|png|jpe?g|bmp|webp|gif)$/i.test(ref.name)) {
      await platform().showInfo(
        '플러그인 필요',
        `"${ref.name}" 파일을 미리보려면 좌측 [플러그인 관리]에서 'DDS / 텍스처 뷰어' 플러그인을 활성화해주세요.`,
      );
      return;
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

  async openCustomViewerFile(ref: FileRef, viewer: CustomViewerDefinition): Promise<void> {
    const existing = this.tabs.find((t) => t.file?.id === ref.id);
    if (existing) {
      this.switchTab(existing.id);
      return;
    }

    try {
      if (!platform().readBinaryFile) {
        await platform().showError('지원되지 않음', '이 환경에서는 바이너리 파일 열기가 지원되지 않습니다.');
        return;
      }
      const bytes = await platform().readBinaryFile!(ref.id);
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
        this.activeTab.customViewerId = viewer.id;
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
        customViewerId: viewer.id,
      };

      this.tabs.push(tab);
      this.switchTab(tab.id, true);
      await this.rememberRecent(ref);
    } catch (e) {
      await platform().showError('파일을 열 수 없습니다', String(e));
    }
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
}

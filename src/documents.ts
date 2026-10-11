import { monaco } from './monaco';
import { platform, type Encoding, type FileRef } from './platform';
import { getSettings, updateSettings } from './settings';
import { LANGUAGE_ID } from './grammar';

export type { Encoding };

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
  encoding: Encoding;
  model: monaco.editor.ITextModel;
  savedVersion: number;
  viewState: monaco.editor.ICodeEditorViewState | null;
  title: string;
}

/**
 * Manages multiple open documents (tabs) being edited:
 * - Each tab has its own Monaco text model, undo/redo history, saved version, and view state.
 * - Switching tabs swaps models and restores scroll position and cursor location.
 * - Dirty state uses Monaco's alternative version ID for accurate undo-to-clean detection.
 */
export class DocumentManager {
  private tabs: DocumentTab[] = [];
  private activeTabId = '';
  private tabSeq = 0;
  private untitledSeq = 0;
  private listeners = new Set<() => void>();

  constructor(private editor: monaco.editor.IStandaloneCodeEditor) {
    const initialDummy = this.editor.getModel();
    const firstTab = this.createTab();
    this.tabs.push(firstTab);
    this.activeTabId = firstTab.id;
    this.editor.setModel(firstTab.model);
    initialDummy?.dispose();
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

  get eol(): 'CRLF' | 'LF' {
    if (!this.activeTab) return 'CRLF';
    return this.activeTab.model.getEOL() === '\r\n' ? 'CRLF' : 'LF';
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private createTab(opts?: {
    file?: FileRef | null;
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

  switchTab(tabId: string) {
    if (this.activeTabId === tabId) return;
    const target = this.tabs.find((t) => t.id === tabId);
    if (!target) return;

    if (this.activeTab) {
      this.activeTab.viewState = this.editor.saveViewState();
    }

    this.activeTabId = target.id;
    this.editor.setModel(target.model);
    if (target.viewState) {
      this.editor.restoreViewState(target.viewState);
    }
    this.editor.focus();
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
      this.activeTabId = nextTab.id;
      this.editor.setModel(nextTab.model);
      if (nextTab.viewState) {
        this.editor.restoreViewState(nextTab.viewState);
      }
      this.editor.focus();
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
    const dirty = this.tabs.filter((t) => this.isTabDirty(t));
    if (dirty.length === 0) return true;

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

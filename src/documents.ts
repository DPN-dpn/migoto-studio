import { monaco } from './monaco';
import { platform, type Encoding, type FileRef } from './platform';
import { getSettings, updateSettings } from './settings';

export type { Encoding };

export const ENCODING_LABELS: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 (BOM)',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  cp949: 'CP949 (한글 ANSI)',
};

/**
 * Tracks the single document being edited: file reference, on-disk encoding and unsaved changes.
 * Dirty state uses Monaco's alternative version id, so undoing back to the saved text is "clean" again.
 */
export class DocumentManager {
  file: FileRef | null = null;
  encoding: Encoding = 'utf-8';
  private savedVersion: number;
  private listeners = new Set<() => void>();

  constructor(private editor: monaco.editor.IStandaloneCodeEditor) {
    this.savedVersion = this.model.getAlternativeVersionId();
    this.model.onDidChangeContent(() => this.emit());
  }

  private get model() { return this.editor.getModel()!; }

  get isDirty() { return this.model.getAlternativeVersionId() !== this.savedVersion; }
  get fileName() { return this.file?.name ?? '이름 없음'; }
  get eol() { return this.model.getEOL() === '\r\n' ? 'CRLF' : 'LF'; }

  onChange(fn: () => void) { this.listeners.add(fn); }
  private emit() { this.listeners.forEach((fn) => fn()); }

  setEncoding(enc: Encoding) {
    this.encoding = enc;
    this.emit();
  }

  toggleEol() {
    this.model.pushEOL(this.model.getEOL() === '\r\n' ? monaco.editor.EndOfLineSequence.LF : monaco.editor.EndOfLineSequence.CRLF);
    this.emit();
  }

  /** Asks what to do with unsaved changes. Returns false if the user cancelled. */
  async confirmDiscard(): Promise<boolean> {
    if (!this.isDirty) return true;
    const choice = await platform().askSaveChanges(this.fileName);
    if (choice === 'save') return this.save();
    return choice === 'discard';
  }

  /** Replace the editor content with a backup's text. Undoable (Ctrl+Z); the file on disk changes only when saved. */
  async restoreText(text: string) {
    this.editor.pushUndoStop();
    this.editor.executeEdits('restore-backup', [{ range: this.model.getFullModelRange(), text }]);
    this.editor.pushUndoStop();
  }

  async newFile() {
    if (!(await this.confirmDiscard())) return;
    this.model.setValue('');
    this.model.pushEOL(monaco.editor.EndOfLineSequence.CRLF);
    this.file = null;
    this.encoding = 'utf-8';
    this.markSaved();
  }

  async openDialog() {
    const ref = await platform().pickOpen();
    if (ref) await this.openFile(ref);
  }

  async openFile(ref: FileRef) {
    if (!(await this.confirmDiscard())) return;
    try {
      const loaded = await platform().readFile(ref);
      this.model.setValue(loaded.text);
      this.file = ref;
      this.encoding = loaded.encoding;
      this.editor.setScrollPosition({ scrollTop: 0 });
      this.editor.setPosition({ lineNumber: 1, column: 1 });
      this.markSaved();
      await this.rememberRecent(ref);
    } catch (e) {
      await platform().showError('파일을 열 수 없습니다', String(e));
    }
  }

  async save(): Promise<boolean> {
    if (!this.file) return this.saveAs();
    return this.write(this.file);
  }

  async saveAs(): Promise<boolean> {
    const ref = await platform().pickSave(this.file);
    if (!ref) return false;
    return this.write(ref);
  }

  private async write(ref: FileRef): Promise<boolean> {
    try {
      const s = getSettings();
      await platform().writeFile(ref, this.model.getValue(), this.encoding, {
        enabled: s.backupOnSave,
        keepDays: s.backupKeepDays,
        maxPerFile: s.backupMaxPerFile,
      });
      this.file = ref;
      this.markSaved();
      await this.rememberRecent(ref);
      return true;
    } catch (e) {
      await platform().showError('저장하지 못했습니다', String(e));
      return false;
    }
  }

  private markSaved() {
    this.savedVersion = this.model.getAlternativeVersionId();
    this.emit();
  }

  private async rememberRecent(ref: FileRef) {
    if (!platform().capabilities.recentFiles) return;
    const recent = [ref.id, ...getSettings().recentFiles.filter((p) => p !== ref.id)].slice(0, 10);
    await updateSettings({ recentFiles: recent });
  }
}

import { invoke } from '@tauri-apps/api/core';
import { message, open, save } from '@tauri-apps/plugin-dialog';
import { monaco } from './monaco';
import { getSettings, updateSettings } from './settings';

export type Encoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'cp949';

export const ENCODING_LABELS: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 (BOM)',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  cp949: 'CP949 (한글 ANSI)',
};

const FILE_FILTERS = [
  { name: 'INI 파일', extensions: ['ini', '3dm', 'migoto'] },
  { name: '모든 파일', extensions: ['*'] },
];

interface OpenedFile { text: string; encoding: Encoding }

/**
 * Tracks the single document being edited: file path, on-disk encoding and unsaved changes.
 * Dirty state uses Monaco's alternative version id, so undoing back to the saved text is "clean" again.
 */
export class DocumentManager {
  path: string | null = null;
  encoding: Encoding = 'utf-8';
  private savedVersion: number;
  private listeners = new Set<() => void>();

  constructor(private editor: monaco.editor.IStandaloneCodeEditor) {
    this.savedVersion = this.model.getAlternativeVersionId();
    this.model.onDidChangeContent(() => this.emit());
  }

  private get model() { return this.editor.getModel()!; }

  get isDirty() { return this.model.getAlternativeVersionId() !== this.savedVersion; }
  get fileName() { return this.path ? this.path.split(/[\\/]/).pop()! : '이름 없음'; }
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
    const answer = await message(`"${this.fileName}"에 저장하지 않은 변경 사항이 있습니다.`, {
      title: 'Migoto Studio',
      kind: 'warning',
      buttons: { yes: '저장', no: '저장 안 함', cancel: '취소' },
    });
    if (answer === '저장') return this.save();
    return answer === '저장 안 함';
  }

  /** Replace the editor content with a backup's text. Undoable (Ctrl+Z); the file on disk changes only when saved. */
  async restoreFromBackup(backupPath: string) {
    const file = await invoke<OpenedFile>('open_file', { path: backupPath });
    this.editor.pushUndoStop();
    this.editor.executeEdits('restore-backup', [{ range: this.model.getFullModelRange(), text: file.text }]);
    this.editor.pushUndoStop();
  }

  async newFile() {
    if (!(await this.confirmDiscard())) return;
    this.model.setValue('');
    this.model.pushEOL(monaco.editor.EndOfLineSequence.CRLF);
    this.path = null;
    this.encoding = 'utf-8';
    this.markSaved();
  }

  async openDialog() {
    const picked = await open({ multiple: false, directory: false, filters: FILE_FILTERS });
    if (typeof picked === 'string') await this.openPath(picked);
  }

  async openPath(path: string) {
    if (!(await this.confirmDiscard())) return;
    try {
      const file = await invoke<OpenedFile>('open_file', { path });
      this.model.setValue(file.text);
      this.path = path;
      this.encoding = file.encoding;
      this.editor.setScrollPosition({ scrollTop: 0 });
      this.editor.setPosition({ lineNumber: 1, column: 1 });
      this.markSaved();
      await this.rememberRecent(path);
    } catch (e) {
      await message(String(e), { title: '파일을 열 수 없습니다', kind: 'error' });
    }
  }

  async save(): Promise<boolean> {
    if (!this.path) return this.saveAs();
    return this.write(this.path);
  }

  async saveAs(): Promise<boolean> {
    const picked = await save({ filters: FILE_FILTERS, defaultPath: this.path ?? undefined });
    if (!picked) return false;
    return this.write(picked);
  }

  private async write(path: string): Promise<boolean> {
    try {
      const s = getSettings();
      await invoke('save_file', {
        path,
        text: this.model.getValue(),
        encoding: this.encoding,
        backup: s.backupOnSave,
        keepDays: s.backupKeepDays,
        maxPerFile: s.backupMaxPerFile,
      });
      this.path = path;
      this.markSaved();
      await this.rememberRecent(path);
      return true;
    } catch (e) {
      await message(String(e), { title: '저장하지 못했습니다', kind: 'error' });
      return false;
    }
  }

  private markSaved() {
    this.savedVersion = this.model.getAlternativeVersionId();
    this.emit();
  }

  private async rememberRecent(path: string) {
    const recent = [path, ...getSettings().recentFiles.filter((p) => p !== path)].slice(0, 10);
    await updateSettings({ recentFiles: recent });
  }
}

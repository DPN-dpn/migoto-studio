/**
 * Everything the UI needs from the outside world (files, settings storage, backups, dialogs, window).
 * The editor, settings screen, outline, lint, plugins … only talk to this interface, so the same
 * code runs as the Tauri desktop app (`desktop.ts`) and as a GitHub Pages web app (`web.ts`).
 */

export type Encoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'cp949';

/** Opaque reference to a file. Desktop: `id` is the full path. Web: `id` identifies a file handle. */
export interface FileRef {
  id: string;
  /** Short name for titles and menus, e.g. `mod.ini`. */
  name: string;
  /** Longer text for tooltips (full path on desktop). */
  location: string;
}

export interface LoadedFile { text: string; encoding: Encoding }

export interface BackupPolicy {
  enabled: boolean;
  keepDays: number;
  maxPerFile: number;
}

export interface BackupEntry {
  /** Opaque id passed back to `readBackup`. */
  id: string;
  /** Milliseconds since the Unix epoch. */
  timestamp: number;
  size: number;
}

export type SaveChoice = 'save' | 'discard' | 'cancel';

export interface DirEntry {
  name: string;
  path: string;
  id?: string;
  isDir: boolean;
  size?: number;
  children?: DirEntry[];
}

export interface Platform {
  readonly kind: 'desktop' | 'web';

  readonly capabilities: {
    /** Recent files can be reopened without asking the user again. */
    recentFiles: boolean;
    /** Files can be saved in place (otherwise "save" downloads a copy). */
    saveInPlace: boolean;
    /** Can open and read local directory tree */
    directories: boolean;
  };

  // ---- files & directories ----
  pickOpen(): Promise<FileRef | null>;
  pickSave(suggested?: FileRef | null): Promise<FileRef | null>;
  refFromId(id: string): FileRef;
  readFile(ref: FileRef): Promise<LoadedFile>;
  /** Writes the file. When `backup.enabled`, the previous contents are stored as a backup first. */
  writeFile(ref: FileRef, text: string, encoding: Encoding, backup: BackupPolicy): Promise<void>;
  pickDirectory(): Promise<{ name: string; id: string } | null>;
  readDirectory(id: string): Promise<DirEntry[]>;
  showInFolder?(path: string): Promise<void>;
  createFile?(dirPath: string, fileName: string): Promise<FileRef | null>;
  deleteEntry?(path: string): Promise<void>;

  // ---- backups ----
  listBackups(ref: FileRef): Promise<BackupEntry[]>;
  readBackup(entry: BackupEntry): Promise<string>;
  pruneBackups(policy: Pick<BackupPolicy, 'keepDays' | 'maxPerFile'>): Promise<void>;

  // ---- user data ----
  /** Raw settings JSON, empty string if none saved yet. */
  loadSettingsText(): Promise<string>;
  saveSettingsText(json: string): Promise<void>;
  /** Human readable place where settings and backups are kept. */
  dataLocation(): Promise<string>;

  // ---- dialogs / window ----
  askSaveChanges(fileName: string): Promise<SaveChoice>;
  showError(title: string, message: string): Promise<void>;
  showInfo(title: string, message: string): Promise<void>;
  setTitle(title: string): void;
  /** Called when the user drops a file onto the window. Returns the "dragging" state through `onHover`. */
  onFileDrop(handler: (ref: FileRef) => void, onHover: (hovering: boolean) => void): Promise<void>;
  /** Registered handler decides whether the window may close (return true to close). */
  onCloseRequest(handler: () => Promise<boolean>): Promise<void>;

  // ---- plugins & system ----
  getPluginsDir?(): Promise<string>;
  openPluginsFolder?(): Promise<void>;
  readBinaryFile?(path: string): Promise<Uint8Array>;
  writeBinaryFile?(path: string, bytes: Uint8Array): Promise<void>;
  launchInstallerAndExit?(path: string): Promise<void>;
  execProcess?(command: string, args: string[], cwd?: string): Promise<ProcessOutput>;
  listDiskPlugins?(): Promise<DiskPlugin[]>;
  saveDiskPlugin?(id: string, manifestJson: string, scriptContent: string): Promise<void>;
}

export interface ProcessOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DiskPlugin {
  id: string;
  path: string;
  manifestJson: string;
  scriptContent: string;
}


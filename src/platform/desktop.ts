import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { message, open, save } from '@tauri-apps/plugin-dialog';
import type { BackupEntry, BackupPolicy, DirEntry, DiskPlugin, Encoding, FileRef, LoadedFile, Platform, ProcessOutput, SaveChoice } from './types';

const FILE_FILTERS = [
  { name: 'INI 파일', extensions: ['ini', '3dm', 'migoto'] },
  { name: '모든 파일', extensions: ['*'] },
];

const refFromPath = (path: string): FileRef => ({
  id: path,
  name: path.split(/[\\/]/).pop() ?? path,
  location: path,
});

interface RustBackup { path: string; timestamp_ms: number; size: number }

/** Tauri desktop implementation: real files, backups and settings in the OS app-data folder (see src-tauri). */
export const desktop: Platform = {
  kind: 'desktop',
  capabilities: { recentFiles: true, saveInPlace: true, directories: true },

  async pickOpen() {
    const picked = await open({ multiple: false, directory: false, filters: FILE_FILTERS });
    return typeof picked === 'string' ? refFromPath(picked) : null;
  },

  async pickSave(suggested) {
    const picked = await save({ filters: FILE_FILTERS, defaultPath: suggested?.id });
    return picked ? refFromPath(picked) : null;
  },

  async pickDirectory() {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked !== 'string') return null;
    return {
      id: picked,
      name: picked.split(/[\\/]/).filter(Boolean).pop() ?? picked,
    };
  },

  async readDirectory(id: string): Promise<DirEntry[]> {
    const raw = await invoke<any[]>('read_directory', { path: id, maxDepth: 8 });
    const mapEntry = (e: any): DirEntry => ({
      name: e.name,
      path: e.path,
      id: e.id || e.path,
      isDir: Boolean(e.isDir ?? e.is_dir),
      size: typeof e.size === 'number' ? e.size : 0,
      children: Array.isArray(e.children) ? e.children.map(mapEntry) : undefined,
    });
    return Array.isArray(raw) ? raw.map(mapEntry) : [];
  },

  async showInFolder(path: string) {
    await invoke('show_in_folder', { path });
  },

  async createFile(dirPath: string, fileName: string): Promise<FileRef | null> {
    const sep = dirPath.includes('/') ? '/' : '\\';
    const cleanDir = dirPath.replace(/[\\/]+$/, '');
    const fullPath = `${cleanDir}${sep}${fileName}`;
    await invoke('create_file', { path: fullPath });
    return refFromPath(fullPath);
  },

  async deleteEntry(path: string) {
    await invoke('delete_entry', { path });
  },

  isPathDir: (path: string) => invoke<boolean>('is_directory', { path }),

  refFromId: refFromPath,

  readFile: (ref) => invoke<LoadedFile>('open_file', { path: ref.id }),

  async writeFile(ref: FileRef, text: string, encoding: Encoding, backup: BackupPolicy) {
    await invoke('save_file', {
      path: ref.id,
      text,
      encoding,
      backup: backup.enabled,
      keepDays: backup.keepDays,
      maxPerFile: backup.maxPerFile,
    });
  },

  async listBackups(ref): Promise<BackupEntry[]> {
    const list = await invoke<RustBackup[]>('list_backups', { path: ref.id });
    return list.map((b) => ({ id: b.path, timestamp: b.timestamp_ms, size: b.size }));
  },

  async readBackup(entry) {
    return (await invoke<LoadedFile>('open_file', { path: entry.id })).text;
  },

  async pruneBackups(policy) {
    await invoke('cleanup_backups', { keepDays: policy.keepDays, maxPerFile: policy.maxPerFile });
  },

  loadSettingsText: () => invoke<string>('load_settings'),
  saveSettingsText: (json) => invoke('save_settings', { json }),
  loadTemplatesText: () => invoke<string>('load_templates'),
  saveTemplatesText: (json) => invoke('save_templates', { json }),
  dataLocation: () => invoke<string>('get_data_dir'),

  async askSaveChanges(fileName): Promise<SaveChoice> {
    const answer = await message(`"${fileName}"에 저장하지 않은 변경 사항이 있습니다.`, {
      title: 'Migoto Studio',
      kind: 'warning',
      buttons: { yes: '저장', no: '저장 안 함', cancel: '취소' },
    });
    return answer === '저장' ? 'save' : answer === '저장 안 함' ? 'discard' : 'cancel';
  },

  async showError(title, text) { await message(text, { title, kind: 'error' }); },
  async showInfo(title, text) { await message(text, { title }); },

  setTitle(title) { getCurrentWindow().setTitle(title).catch(() => {}); },

  async onFileDrop(handler, onHover) {
    await getCurrentWebview().onDragDropEvent((event) => {
      const p = event.payload;
      onHover(p.type === 'enter' || p.type === 'over');
      if (p.type === 'drop' && p.paths.length > 0) handler(refFromPath(p.paths[0]));
    });
  },

  async onCloseRequest(handler) {
    const win = getCurrentWindow();
    await win.onCloseRequested(async (event) => {
      event.preventDefault();
      if (await handler()) await win.destroy();
    });
  },

  getPluginsDir: () => invoke<string>('get_plugins_dir'),
  openPluginsFolder: () => invoke('open_plugins_folder'),
  readBinaryFile: async (path: string) => {
    const bytes = await invoke<number[]>('read_binary_file', { path });
    return new Uint8Array(bytes);
  },
  writeBinaryFile: (path: string, bytes: Uint8Array) =>
    invoke('write_binary_file', { path, bytes: Array.from(bytes) }),
  launchInstallerAndExit: (path: string) =>
    invoke('launch_installer_and_exit', { path }),
  execProcess: (command: string, args: string[], cwd?: string) =>
    invoke<ProcessOutput>('exec_process', { command, args, cwd }),
  listDiskPlugins: async () => {
    const list = await invoke<any[]>('list_disk_plugins');
    return list.map((p) => ({
      id: p.id,
      path: p.path,
      manifestJson: p.manifest_json,
      scriptContent: p.script_content,
    }));
  },
  saveDiskPlugin: (id: string, manifestJson: string, scriptContent: string) =>
    invoke('save_disk_plugin', { id, manifestJson, scriptContent }),
  pickPluginZip: async () => {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [{ name: '플러그인 압축 파일 (*.zip)', extensions: ['zip'] }],
    });
    if (typeof picked !== 'string') return null;
    const bytes = await invoke<number[]>('read_binary_file', { path: picked });
    return new Uint8Array(bytes);
  },
};

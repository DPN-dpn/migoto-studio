import type { BackupEntry, BackupPolicy, DirEntry, Encoding, FileRef, LoadedFile, Platform, SaveChoice } from './types.ts';
import { openModal } from '../ui/modals/modal.ts';

const DB_NAME = 'MigotoStudioWeb';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('backups')) {
        const store = db.createObjectStore('backups', { keyPath: 'id' });
        store.createIndex('fileId', 'fileId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// In-memory registry of opened File / FileSystemFileHandle instances
const fileHandles = new Map<string, FileSystemFileHandle | File>();
const directoryHandles = new Map<string, any>();

async function scanDirHandle(handle: any, depth: number, basePath: string): Promise<DirEntry[]> {
  const entries: DirEntry[] = [];
  try {
    for await (const [name, entry] of handle.entries()) {
      if (name.startsWith('.') || name === 'node_modules' || name === '$RECYCLE.BIN') continue;
      const currentPath = basePath ? `${basePath}/${name}` : name;
      const isDir = entry.kind === 'directory';
      if (isDir) {
        const children = depth > 0 ? await scanDirHandle(entry, depth - 1, currentPath) : undefined;
        entries.push({
          name,
          path: currentPath,
          id: currentPath,
          isDir: true,
          children,
        });
      } else {
        const fileId = generateId();
        fileHandles.set(fileId, entry);
        let size = 0;
        try {
          const file = await entry.getFile();
          size = file.size;
        } catch {}
        entries.push({
          name,
          path: currentPath,
          id: fileId,
          isDir: false,
          size,
        });
      }
    }
  } catch (e) {
    console.warn('[web] readDirectory error:', e);
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  return entries;
}

function generateId(): string {
  return 'file_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

const virtualDirectoryEntries = new Map<string, DirEntry[]>();

function buildTreeFromFiles(files: FileList, rootId: string): { rootName: string; entries: DirEntry[] } {
  if (files.length === 0) return { rootName: 'folder', entries: [] };
  const firstPath = files[0].webkitRelativePath || files[0].name;
  const rootName = firstPath.split('/')[0] || 'folder';

  interface InternalNode {
    name: string;
    path: string;
    isDir: boolean;
    size: number;
    file?: File;
    children?: Map<string, InternalNode>;
  }

  const rootDir: Map<string, InternalNode> = new Map();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    const subParts = parts.length > 1 ? parts.slice(1) : parts;
    if (subParts.length === 0) continue;

    if (subParts.some((p) => p.startsWith('.') || p === 'node_modules' || p === '$RECYCLE.BIN')) {
      continue;
    }

    let currentMap = rootDir;
    let currentPath = '';

    for (let j = 0; j < subParts.length; j++) {
      const part = subParts[j];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = j === subParts.length - 1;

      if (isFile) {
        currentMap.set(part, {
          name: part,
          path: currentPath,
          isDir: false,
          size: file.size,
          file,
        });
      } else {
        let dirNode = currentMap.get(part);
        if (!dirNode) {
          dirNode = {
            name: part,
            path: currentPath,
            isDir: true,
            size: 0,
            children: new Map(),
          };
          currentMap.set(part, dirNode);
        }
        currentMap = dirNode.children!;
      }
    }
  }

  function convert(map: Map<string, InternalNode>): DirEntry[] {
    const res: DirEntry[] = [];
    for (const node of map.values()) {
      if (node.isDir) {
        res.push({
          name: node.name,
          path: node.path,
          id: `${rootId}:${node.path}`,
          isDir: true,
          children: node.children ? convert(node.children) : [],
        });
      } else {
        const fileId = generateId();
        if (node.file) fileHandles.set(fileId, node.file);
        res.push({
          name: node.name,
          path: node.path,
          id: fileId,
          isDir: false,
          size: node.size,
        });
      }
    }
    res.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    return res;
  }

  return { rootName, entries: convert(rootDir) };
}

function pickDirectoryWithInput(): Promise<{ name: string; id: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    input.style.display = 'none';
    input.onchange = () => {
      const files = input.files;
      input.remove();
      if (!files || files.length === 0) return resolve(null);
      const id = generateId();
      const { rootName, entries } = buildTreeFromFiles(files, id);
      virtualDirectoryEntries.set(id, entries);
      resolve({ name: rootName, id });
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    document.body.append(input);
    input.click();
  });
}

function decodeBuffer(buf: ArrayBuffer): LoadedFile {
  const bytes = new Uint8Array(buf);
  // UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8-bom' };
  }
  // UTF-16 LE
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  // UTF-16 BE
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }
  // Standard UTF-8 check
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'utf-8' };
  } catch {
    // Legacy Korean CP949 / EUC-KR fallback
    try {
      const text = new TextDecoder('euc-kr').decode(bytes);
      return { text, encoding: 'cp949' };
    } catch {
      return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
    }
  }
}

function encodeText(text: string, encoding: Encoding): Uint8Array {
  if (encoding === 'utf-8-bom') {
    const utf8 = new TextEncoder().encode(text);
    const res = new Uint8Array(utf8.length + 3);
    res[0] = 0xef;
    res[1] = 0xbb;
    res[2] = 0xbf;
    res.set(utf8, 3);
    return res;
  }
  if (encoding === 'utf-16le') {
    const buf = new Uint8Array(text.length * 2 + 2);
    buf[0] = 0xff;
    buf[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      buf[2 + i * 2] = code & 0xff;
      buf[2 + i * 2 + 1] = (code >> 8) & 0xff;
    }
    return buf;
  }
  if (encoding === 'utf-16be') {
    const buf = new Uint8Array(text.length * 2 + 2);
    buf[0] = 0xfe;
    buf[1] = 0xff;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      buf[2 + i * 2] = (code >> 8) & 0xff;
      buf[2 + i * 2 + 1] = code & 0xff;
    }
    return buf;
  }
  // Fallback to UTF-8 for cp949 in web version if unmappable, or standard UTF-8
  return new TextEncoder().encode(text);
}

function triggerDownload(fileName: string, data: Uint8Array) {
  const blob = new Blob([data as unknown as BlobPart], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pickOpenWithFileInput(): Promise<FileRef | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ini,.3dm,.migoto,.txt';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      const id = generateId();
      fileHandles.set(id, file);
      resolve({ id, name: file.name, location: file.name });
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    document.body.append(input);
    input.click();
  });
}

const hasFSAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

export const DEFAULT_WEB_PLUGINS = [
  'asset-viewer',
  'ai-assistant',
  'resource-checker',
  'zzmi-support',
];

export const STORAGE_WEB_PLUGINS = 'migoto_studio_web_plugins';
export const STORAGE_DELETED_DEFAULTS = 'migoto_web_deleted_defaults';

export const web: Platform = {
  kind: 'web',
  capabilities: {
    recentFiles: false, // Browser security prevents opening stored file paths arbitrarily
    saveInPlace: hasFSAccess,
    directories: typeof window !== 'undefined',
  },

  async pickOpen(): Promise<FileRef | null> {
    if (hasFSAccess) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'INI 파일',
              accept: { 'text/plain': ['.ini', '.3dm', '.migoto', '.txt'] },
            },
          ],
        });
        if (!handle) return null;
        const id = generateId();
        fileHandles.set(id, handle);
        return { id, name: handle.name, location: handle.name };
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        // When browser security blocks system/Program Files folders (SecurityError),
        // automatically fall back to classic file input
        console.warn('[web] showOpenFilePicker blocked or failed, falling back to file input:', err);
        return pickOpenWithFileInput();
      }
    }

    // Fallback: file input element
    return pickOpenWithFileInput();
  },

  async pickSave(suggested): Promise<FileRef | null> {
    const suggestedName = suggested?.name || 'untitled.ini';
    if (hasFSAccess) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: 'INI 파일',
              accept: { 'text/plain': ['.ini', '.3dm', '.migoto'] },
            },
          ],
        });
        if (!handle) return null;
        const id = generateId();
        fileHandles.set(id, handle);
        return { id, name: handle.name, location: handle.name };
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        throw err;
      }
    }

    // Browser download fallback - simulate ref
    const id = generateId();
    return { id, name: suggestedName, location: suggestedName };
  },

  async pickDirectory(): Promise<{ name: string; id: string } | null> {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (!dirHandle) return null;
        const id = generateId();
        directoryHandles.set(id, dirHandle);
        return { name: dirHandle.name, id };
      } catch (e: any) {
        if (e.name === 'AbortError') return null;
        console.warn('[web] showDirectoryPicker failed, attempting file input fallback:', e);
        try {
          const fallback = await pickDirectoryWithInput();
          if (fallback) return fallback;
        } catch {}
        if (e.name === 'NotFoundError') {
          throw new Error('선택한 폴더를 브라우저에서 찾을 수 없습니다. 바로가기, 네트워크 경로, 또는 클라우드 전용(OneDrive 등) 가상 폴더 대신 로컬 드라이브의 실제 폴더를 선택해 주세요.');
        }
        if (e.name === 'SecurityError') {
          throw new Error('브라우저 보안 정책에 의해 시스템 민감 폴더(Windows, Program Files 등)는 접근이 제한됩니다. 다른 작업 폴더를 선택해 주세요.');
        }
        throw e;
      }
    }

    return pickDirectoryWithInput();
  },

  async readDirectory(id: string): Promise<DirEntry[]> {
    if (virtualDirectoryEntries.has(id)) {
      return virtualDirectoryEntries.get(id)!;
    }
    const handle = directoryHandles.get(id);
    if (!handle) throw new Error('폴더를 찾을 수 없습니다.');
    return scanDirHandle(handle, 4, '');
  },

  async showInFolder(_path: string): Promise<void> {},

  async isPathDir(path: string): Promise<boolean> {
    return directoryHandles.has(path) || virtualDirectoryEntries.has(path);
  },

  refFromId(id: string): FileRef {
    const handle = fileHandles.get(id);
    const name = handle ? (handle as any).name || 'document.ini' : 'document.ini';
    return { id, name, location: name };
  },

  async readFile(ref: FileRef): Promise<LoadedFile> {
    const handle = fileHandles.get(ref.id);
    let file: File;
    if (handle && 'getFile' in handle) {
      file = await handle.getFile();
    } else if (handle instanceof File) {
      file = handle;
    } else {
      throw new Error('파일 핸들이 유효하지 않습니다.');
    }
    const buf = await file.arrayBuffer();
    return decodeBuffer(buf);
  },

  async writeFile(ref: FileRef, text: string, encoding: Encoding, backup: BackupPolicy): Promise<void> {
    const handle = fileHandles.get(ref.id);
    const encoded = encodeText(text, encoding);

    // Create IndexedDB backup if enabled
    if (backup.enabled) {
      try {
        const db = await openDb();
        const tx = db.transaction('backups', 'readwrite');
        const store = tx.objectStore('backups');
        const backupEntry = {
          id: `${ref.name}_${Date.now()}`,
          fileId: ref.name,
          timestamp: Date.now(),
          size: encoded.length,
          text,
        };
        store.put(backupEntry);
      } catch (e) {
        console.warn('Backup creation failed in IndexedDB:', e);
      }
    }

    if (handle && 'createWritable' in handle) {
      const writable = await (handle as any).createWritable();
      await writable.write(encoded);
      await writable.close();
      return;
    }

    // Direct download trigger fallback
    triggerDownload(ref.name, encoded);
  },

  async listBackups(ref: FileRef): Promise<BackupEntry[]> {
    try {
      const db = await openDb();
      return new Promise((resolve) => {
        const tx = db.transaction('backups', 'readonly');
        const store = tx.objectStore('backups');
        const index = store.index('fileId');
        const req = index.getAll(ref.name);
        req.onsuccess = () => {
          const items = (req.result || []) as Array<{ id: string; timestamp: number; size: number }>;
          items.sort((a, b) => b.timestamp - a.timestamp);
          resolve(items.map((i) => ({ id: i.id, timestamp: i.timestamp, size: i.size })));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  },

  async readBackup(entry: BackupEntry): Promise<string> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('backups', 'readonly');
      const store = tx.objectStore('backups');
      const req = store.get(entry.id);
      req.onsuccess = () => {
        if (req.result) resolve(req.result.text);
        else reject(new Error('백업을 찾을 수 없습니다.'));
      };
      req.onerror = () => reject(req.error);
    });
  },

  async pruneBackups(policy: Pick<BackupPolicy, 'keepDays' | 'maxPerFile'>): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction('backups', 'readwrite');
      const store = tx.objectStore('backups');
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as Array<{ id: string; fileId: string; timestamp: number }>;
        const now = Date.now();
        const maxAge = policy.keepDays * 24 * 60 * 60 * 1000;
        const byFile = new Map<string, typeof items>();

        for (const item of items) {
          if (now - item.timestamp > maxAge) {
            store.delete(item.id);
            continue;
          }
          const list = byFile.get(item.fileId) || [];
          list.push(item);
          byFile.set(item.fileId, list);
        }

        for (const [, list] of byFile) {
          list.sort((a, b) => b.timestamp - a.timestamp);
          if (list.length > policy.maxPerFile) {
            for (const expired of list.slice(policy.maxPerFile)) {
              store.delete(expired.id);
            }
          }
        }
      };
    } catch (e) {
      console.warn('Pruning web backups failed:', e);
    }
  },

  async loadSettingsText(): Promise<string> {
    return localStorage.getItem('migoto_studio_settings') || '';
  },

  async saveSettingsText(json: string): Promise<void> {
    localStorage.setItem('migoto_studio_settings', json);
  },

  async loadTemplatesText(): Promise<string> {
    return localStorage.getItem('migoto_custom_templates') || '';
  },

  async saveTemplatesText(json: string): Promise<void> {
    localStorage.setItem('migoto_custom_templates', json);
  },

  async dataLocation(): Promise<string> {
    return '브라우저 로컬 저장소 (IndexedDB / localStorage)';
  },

  askSaveChanges(fileName: string): Promise<SaveChoice> {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = `"${fileName}"에 저장하지 않은 변경 사항이 있습니다. 저장하시겠습니까?`;
      body.append(p);

      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.gap = '8px';
      footer.style.justifyContent = 'flex-end';
      footer.style.marginTop = '16px';

      const btnSave = document.createElement('button');
      btnSave.className = 'primary';
      btnSave.textContent = '저장';

      const btnDiscard = document.createElement('button');
      btnDiscard.textContent = '저장 안 함';

      const btnCancel = document.createElement('button');
      btnCancel.textContent = '취소';

      footer.append(btnSave, btnDiscard, btnCancel);
      body.append(footer);

      const close = openModal('변경 사항 저장', body);

      btnSave.onclick = () => { close(); resolve('save'); };
      btnDiscard.onclick = () => { close(); resolve('discard'); };
      btnCancel.onclick = () => { close(); resolve('cancel'); };
    });
  },

  async showError(title: string, message: string): Promise<void> {
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = message;
    body.append(p);
    openModal(title, body);
  },

  async showInfo(title: string, message: string): Promise<void> {
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = message;
    body.append(p);
    openModal(title, body);
  },

  setTitle(title: string): void {
    document.title = title;
  },

  async onFileDrop(handler: (ref: FileRef) => void, onHover: (hovering: boolean) => void): Promise<void> {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      onHover(true);
    });
    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      onHover(false);
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      onHover(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        const id = generateId();
        fileHandles.set(id, file);
        handler({ id, name: file.name, location: file.name });
      }
    });
  },

  async onCloseRequest(handler: () => Promise<boolean>): Promise<void> {
    window.addEventListener('beforeunload', (e) => {
      // Browsers restrict async calls in beforeunload, standard prompt triggers
      e.preventDefault();
      return (e.returnValue = '');
    });
  },

  deleteEntry: async (path: string) => {
    try {
      const cleanId = path
        .replace(/^default-plugins\//, '')
        .replace(/^web:\/\/default-plugins\//, '')
        .trim();

      // If user deletes a default plugin on web, remember so it stays removed across reloads
      if (DEFAULT_WEB_PLUGINS.includes(cleanId)) {
        const deleted: string[] = JSON.parse(
          localStorage.getItem(STORAGE_DELETED_DEFAULTS) || '[]',
        );
        if (!deleted.includes(cleanId)) {
          deleted.push(cleanId);
          localStorage.setItem(STORAGE_DELETED_DEFAULTS, JSON.stringify(deleted));
        }
      }

      const stored = JSON.parse(localStorage.getItem(STORAGE_WEB_PLUGINS) || '{}');
      if (stored[cleanId] || stored[path]) {
        delete stored[cleanId];
        delete stored[path];
        localStorage.setItem(STORAGE_WEB_PLUGINS, JSON.stringify(stored));
      }
    } catch {}
  },

  getPluginsDir: async () => '브라우저 로컬 저장소 (localStorage)',
  openPluginsFolder: async () => {},
  readBinaryFile: async (path: string) => {
    const handle = fileHandles.get(path);
    if (handle) {
      try {
        if ('getFile' in handle) {
          const file = await (handle as any).getFile();
          return new Uint8Array(await file.arrayBuffer());
        } else if (handle instanceof File) {
          return new Uint8Array(await handle.arrayBuffer());
        }
      } catch {}
    }
    return new Uint8Array();
  },
  execProcess: async () => ({
    stdout: '',
    stderr: '웹 브라우저 환경에서는 로컬 프로세스 실행이 지원되지 않습니다. 데스크톱 앱을 사용해 주세요.',
    exitCode: 1,
  }),
  listDiskPlugins: async () => {
    // 1. Clean up legacy / obsolete / corrupt plugins from localStorage
    const customPlugins: any[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_WEB_PLUGINS);
      if (raw) {
        const stored = JSON.parse(raw);
        let changed = false;

        for (const [key, val] of Object.entries(stored)) {
          const p = val as any;
          const id = p?.id || key;

          // Prune desktop-only plugins (python-runner) or default plugins left over in localStorage
          if (id === 'python-runner' || DEFAULT_WEB_PLUGINS.includes(id)) {
            delete stored[key];
            changed = true;
            continue;
          }

          // Prune corrupted or incomplete plugins
          if (!p?.manifestJson || !p?.scriptContent || typeof p.manifestJson !== 'string') {
            delete stored[key];
            changed = true;
            continue;
          }

          try {
            const manifest = JSON.parse(p.manifestJson);
            if (!manifest?.id || !manifest?.name) {
              delete stored[key];
              changed = true;
              continue;
            }
          } catch {
            delete stored[key];
            changed = true;
            continue;
          }

          customPlugins.push({
            id: p.id || key,
            path: p.path || key,
            manifestJson: p.manifestJson,
            scriptContent: p.scriptContent,
          });
        }

        if (changed) {
          localStorage.setItem(STORAGE_WEB_PLUGINS, JSON.stringify(stored));
        }
      }
    } catch {
      try {
        localStorage.removeItem(STORAGE_WEB_PLUGINS);
      } catch {}
    }

    // 2. Fetch web-compatible default plugins from public static assets
    const defaultPlugins: any[] = [];
    const deletedDefaults: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_DELETED_DEFAULTS) || '[]');
      } catch {
        return [];
      }
    })();

    const resolvePluginUrl = (relPath: string): string => {
      try {
        if (typeof window !== 'undefined' && window.location && window.location.href) {
          const u = new URL(window.location.href);
          if (!u.pathname.endsWith('/')) {
            const lastSlash = u.pathname.lastIndexOf('/');
            u.pathname = u.pathname.substring(0, lastSlash + 1);
          }
          u.search = '';
          u.hash = '';
          return new URL(relPath, u.href).href;
        }
      } catch {}
      return relPath.startsWith('/') ? relPath : `./${relPath}`;
    };

    for (const id of DEFAULT_WEB_PLUGINS) {
      if (deletedDefaults.includes(id)) continue;

      try {
        const manifestUrl = resolvePluginUrl(`default-plugins/${id}/plugin.json`);
        const scriptUrl = resolvePluginUrl(`default-plugins/${id}/plugin.js`);

        const [mRes, sRes] = await Promise.all([
          fetch(manifestUrl),
          fetch(scriptUrl),
        ]);

        if (mRes.ok && sRes.ok) {
          const manifestJson = await mRes.text();
          const scriptContent = await sRes.text();
          defaultPlugins.push({
            id,
            path: `default-plugins/${id}`,
            manifestJson,
            scriptContent,
          });
        }
      } catch (err) {
        console.warn(`[web] Could not load default plugin "${id}":`, err);
      }
    }

    return [...defaultPlugins, ...customPlugins];
  },
  saveDiskPlugin: async (id: string, manifestJson: string, scriptContent: string) => {
    try {
      // If user installs or reinstalls a default plugin, restore it from deleted list
      const deletedDefaults: string[] = JSON.parse(
        localStorage.getItem(STORAGE_DELETED_DEFAULTS) || '[]',
      );
      if (deletedDefaults.includes(id)) {
        const updated = deletedDefaults.filter((d) => d !== id);
        localStorage.setItem(STORAGE_DELETED_DEFAULTS, JSON.stringify(updated));
      }

      // If custom plugin, persist to localStorage
      if (!DEFAULT_WEB_PLUGINS.includes(id)) {
        const stored = JSON.parse(localStorage.getItem(STORAGE_WEB_PLUGINS) || '{}');
        stored[id] = { id, path: id, manifestJson, scriptContent };
        localStorage.setItem(STORAGE_WEB_PLUGINS, JSON.stringify(stored));
      }
    } catch {}
  },
  pickPluginZip: async () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,application/zip';
      input.style.display = 'none';
      input.onchange = async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return resolve(null);
        try {
          const buf = await file.arrayBuffer();
          resolve(new Uint8Array(buf));
        } catch {
          resolve(null);
        }
      };
      input.oncancel = () => {
        input.remove();
        resolve(null);
      };
      document.body.append(input);
      input.click();
    });
  },
};

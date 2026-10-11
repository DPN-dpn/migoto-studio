import type { BackupEntry, BackupPolicy, Encoding, FileRef, LoadedFile, Platform, SaveChoice } from './types';
import { openModal } from '../modal';

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

function generateId(): string {
  return 'file_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
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

const hasFSAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

export const web: Platform = {
  kind: 'web',
  capabilities: {
    recentFiles: false, // Browser security prevents opening stored file paths arbitrarily
    saveInPlace: hasFSAccess,
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
        throw err;
      }
    }

    // Fallback: file input element
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
};

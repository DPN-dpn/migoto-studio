/**
 * Workspace and Folder Author Trust Management.
 * Manages trusted folders to protect users when opening external mod directories.
 */

const STORAGE_TRUSTED_FOLDERS = 'migoto_trusted_folders';

export function normalizePath(p: string): string {
  if (!p) return '';
  return p
    .replace(/\\/g, '/')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}

export function getTrustedFolders(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_TRUSTED_FOLDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isFolderTrusted(folderPath: string): boolean {
  if (!folderPath) return false;
  const target = normalizePath(folderPath);
  const list = getTrustedFolders().map(normalizePath);

  return list.some((trusted) => {
    if (!trusted) return false;
    return target === trusted || target.startsWith(trusted + '/');
  });
}

export function addTrustedFolder(folderPath: string): void {
  if (!folderPath) return;
  const norm = normalizePath(folderPath);
  const current = getTrustedFolders();
  if (!current.some((p) => normalizePath(p) === norm)) {
    current.push(folderPath);
    try {
      localStorage.setItem(STORAGE_TRUSTED_FOLDERS, JSON.stringify(current));
    } catch {}
  }
}

export function removeTrustedFolder(folderPath: string): void {
  const norm = normalizePath(folderPath);
  const filtered = getTrustedFolders().filter((p) => normalizePath(p) !== norm);
  try {
    localStorage.setItem(STORAGE_TRUSTED_FOLDERS, JSON.stringify(filtered));
  } catch {}
}

export function clearTrustedFolders(): void {
  try {
    localStorage.removeItem(STORAGE_TRUSTED_FOLDERS);
  } catch {}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePath,
  isFolderTrusted,
  addTrustedFolder,
  removeTrustedFolder,
  clearTrustedFolders,
  getTrustedFolders,
} from '../src/core/trust.ts';

// Mock localStorage for node test environment
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  length: 0,
};

test('normalizePath standardizes Windows and Unix paths', () => {
  assert.equal(
    normalizePath('D:\\Games\\3DMigoto\\Mods\\'),
    'd:/games/3dmigoto/mods'
  );
  assert.equal(
    normalizePath('d:/Games/3DMigoto/Mods'),
    'd:/games/3dmigoto/mods'
  );
  assert.equal(normalizePath(''), '');
});

test('isFolderTrusted validates exact match and nested subdirectories', () => {
  clearTrustedFolders();

  const rootModDir = 'D:\\Games\\3DMigoto\\Mods';
  addTrustedFolder(rootModDir);

  // Exact root
  assert.equal(isFolderTrusted('D:\\Games\\3DMigoto\\Mods'), true);
  assert.equal(isFolderTrusted('d:/games/3dmigoto/mods/'), true);

  // Subfolder (e.g. Raiden Shogun mod)
  assert.equal(
    isFolderTrusted('D:\\Games\\3DMigoto\\Mods\\RaidenShogun'),
    true
  );
  assert.equal(
    isFolderTrusted('d:/games/3dmigoto/mods/furina/costume1'),
    true
  );

  // Sibling directory (untrusted)
  assert.equal(isFolderTrusted('D:\\Games\\OtherGame\\Mods'), false);
  assert.equal(isFolderTrusted('D:\\Games\\3DMigoto\\ShaderFixes'), false);

  // Parent directory of root (not trusted just because child is trusted)
  assert.equal(isFolderTrusted('D:\\Games\\3DMigoto'), false);
});

test('removeTrustedFolder removes path from trusted list', () => {
  clearTrustedFolders();

  addTrustedFolder('D:\\Mods\\A');
  addTrustedFolder('D:\\Mods\\B');
  assert.equal(getTrustedFolders().length, 2);

  removeTrustedFolder('d:/mods/a');
  assert.equal(getTrustedFolders().length, 1);
  assert.equal(isFolderTrusted('D:\\Mods\\A'), false);
  assert.equal(isFolderTrusted('D:\\Mods\\B'), true);
});

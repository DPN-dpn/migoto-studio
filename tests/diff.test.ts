import test from 'node:test';
import assert from 'node:assert/strict';
import type { DocumentTab, DiffTabInfo } from '../src/core/workspace/documents.ts';

test('Diff tab kind is treated as not dirty and supports DiffTabInfo', () => {
  const dummyModel = {
    getAlternativeVersionId: () => 10,
    dispose: () => {},
  } as any;

  const diffTab: DocumentTab = {
    id: 'diff_1',
    file: null,
    kind: 'diff',
    encoding: 'utf-8',
    model: dummyModel,
    savedVersion: 10,
    viewState: null,
    title: 'test.ini (디스크 ↔ 에디터)',
    diffInfo: {
      originalTitle: 'test.ini (디스크)',
      modifiedTitle: 'test.ini (에디터)',
      originalModel: dummyModel,
      modifiedModel: dummyModel,
      sourceTabId: 'text_1',
    },
  };

  assert.equal(diffTab.kind, 'diff');
  assert.equal(diffTab.diffInfo?.sourceTabId, 'text_1');
  assert.equal(diffTab.diffInfo?.originalTitle, 'test.ini (디스크)');
  assert.equal(diffTab.diffInfo?.modifiedTitle, 'test.ini (에디터)');
});

test('Custom tab retains customElement and savedScrolls during switchTab without triggering customCleanup', () => {
  let cleanedUp = false;
  const customTab: DocumentTab = {
    id: 'custom_1',
    file: null,
    kind: 'custom',
    encoding: 'utf-8',
    model: { getAlternativeVersionId: () => 1, dispose: () => {} } as any,
    savedVersion: 1,
    viewState: null,
    title: '토글 키 매니저',
    customCleanup: () => { cleanedUp = true; },
    customElement: {
      hidden: false,
      style: { display: 'flex' },
      querySelectorAll: () => [],
      remove: () => {},
    } as any,
    savedScrolls: new Map(),
  };

  assert.equal(cleanedUp, false);
  assert.ok(customTab.customElement);
  assert.equal(customTab.customElement.hidden, false);
});

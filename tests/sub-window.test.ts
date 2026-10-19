import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock window environment before importing module
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    screenX: 100,
    screenY: 100,
    outerWidth: 1920,
    outerHeight: 1080,
    addEventListener: () => {},
    removeEventListener: () => {},
    open: (_url: string, _target: string, _features: string) => {
      const mockWin = {
        closed: false,
        document: {
          title: '',
          head: { appendChild: () => {} },
          body: {
            style: {},
            appendChild: () => {},
          },
          createElement: (tag: string) => ({
            tagName: tag,
            style: {},
            appendChild: () => {},
          }),
          documentElement: { className: '', style: {} },
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        focus: () => {},
        close: () => { mockWin.closed = true; },
        resizeTo: () => {},
      };
      return mockWin;
    },
  };
  (globalThis as any).document = {
    head: { querySelectorAll: () => [] },
    documentElement: { className: '', style: {} },
  };
}

const { SubWindowManager } = await import('../src/window/sub-window.ts');

describe('SubWindowManager', () => {
  test('SubWindowManager initializes and controls sub-windows cleanly', () => {
    const manager = new SubWindowManager();
    assert.ok(manager, 'Manager instance created');

    let cleanupCalled = false;
    let renderCalled = false;

    const handle = manager.openSubWindow('test-plugin', {
      id: 'my-win',
      title: '테스트 서브창',
      width: 500,
      height: 400,
      focusMode: 'alwaysOnTop',
      render: (container, subWin) => {
        renderCalled = true;
        assert.ok(container, 'container element provided');
        assert.ok(subWin, 'subWin handle provided');
        return () => {
          cleanupCalled = true;
        };
      },
    });

    assert.strictEqual(renderCalled, true, 'Render function called');
    assert.strictEqual(handle.isOpen(), true, 'Window is open');

    handle.setTitle('새 제목');
    handle.setFocusMode('parentLinked');
    assert.strictEqual(typeof handle.setInitialData, 'function', 'setInitialData method exists');
    assert.strictEqual(typeof handle.postMessage, 'function', 'postMessage method exists');
    assert.strictEqual(typeof handle.onMessage, 'function', 'onMessage method exists');
    handle.setInitialData({ folder: 'd:/test/folder' });
    handle.postMessage({ type: 'TEST' });
    const unlisten = handle.onMessage(() => {});
    assert.strictEqual(typeof unlisten, 'function', 'onMessage returns unsubscribe function');
    unlisten();
    handle.close();

    assert.strictEqual(handle.isOpen(), false, 'Window is closed');
    assert.strictEqual(cleanupCalled, true, 'Cleanup called on close');
  });
});

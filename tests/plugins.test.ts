import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDDS } from '../src/plugins/dds-decoder.ts';
import { BUILTIN_PLUGINS } from '../src/plugins/builtin.ts';
import { validatePluginZip } from '../src/plugins/zip.ts';
import { zipSync, strToU8 } from 'fflate';

test('BUILTIN_PLUGINS registers 3 default plugins with unique IDs', () => {
  assert.equal(BUILTIN_PLUGINS.length, 3);
  const ids = BUILTIN_PLUGINS.map((p) => p.manifest.id);
  assert.deepEqual(ids, ['python-runner', 'asset-viewer', 'ai-assistant']);

  for (const p of BUILTIN_PLUGINS) {
    assert.ok(p.manifest.name);
    assert.ok(p.manifest.description);
    assert.ok(p.manifest.version);
    assert.ok(p.manifest.location, `Plugin ${p.manifest.id} must have location specified`);
    assert.ok(typeof p.createPlugin === 'function');
  }
});

test('decodeDDS throws on invalid magic buffer', () => {
  const invalid = new Uint8Array([0, 1, 2, 3]);
  assert.throws(() => decodeDDS(invalid), /유효한 DDS 파일이 아닙니다/);
});

test('decodeDDS correctly parses valid mock DDS header', () => {
  // Construct minimal valid DDS header for 4x4 DXT1
  // Total size: 128 header + 8 bytes (1 block)
  const buf = new Uint8Array(128 + 8);
  const view = new DataView(buf.buffer);

  // Magic 'DDS ' = 0x20534444
  view.setUint32(0, 0x20534444, true);
  // Header size = 124
  view.setUint32(4, 124, true);
  // Height = 4
  view.setUint32(12, 4, true);
  // Width = 4
  view.setUint32(16, 4, true);
  // PixelFormat Size = 32
  view.setUint32(76, 32, true);
  // FourCC = 'DXT1' = 0x31545844
  view.setUint32(84, 0x31545844, true);

  // Block data (white 4x4 block)
  view.setUint16(128, 0xffff, true); // c0 = white
  view.setUint16(130, 0x0000, true); // c1 = black
  view.setUint32(132, 0x00000000, true); // code = all color 0 (white)

  const decoded = decodeDDS(buf);
  assert.equal(decoded.width, 4);
  assert.equal(decoded.height, 4);
  assert.equal(decoded.format, 'DXT1 (BC1)');
  assert.equal(decoded.rgba.length, 4 * 4 * 4); // 64 bytes
  assert.equal(decoded.rgba[0], 255); // Red
  assert.equal(decoded.rgba[1], 255); // Green
  assert.equal(decoded.rgba[2], 255); // Blue
  assert.equal(decoded.rgba[3], 255); // Alpha
});

test('builtin plugins activate with expected behavior', () => {
  const registeredViews: any[] = [];
  const registeredCustomViewers: any[] = [];
  const mockContext: any = {
    ui: {
      registerSidebarView: (v: any) => registeredViews.push(v),
      showToast: () => {},
    },
    editor: {
      getText: () => '',
      insertText: () => {},
      registerCustomViewer: (v: any) => registeredCustomViewers.push(v),
    },
    workspace: { getCurrentFolder: () => null, readBinaryFile: async () => new Uint8Array() },
    storage: { get: () => null, set: () => {} },
  };

  const py = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'python-runner')!;
  py.createPlugin().activate(mockContext);
  assert.equal(registeredViews.length, 1);
  assert.equal(registeredViews[0].id, 'python-runner');
  assert.equal(registeredViews[0].icon, '🐍');

  registeredViews.length = 0;
  const ai = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'ai-assistant')!;
  ai.createPlugin().activate(mockContext);
  assert.equal(registeredViews.length, 1);
  assert.equal(registeredViews[0].id, 'ai-assistant');
  assert.equal(registeredViews[0].icon, '🤖');

  registeredViews.length = 0;
  const asset = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'asset-viewer')!;
  asset.createPlugin().activate(mockContext);
  // Asset viewer should NOT register sidebar views (opens directly in editor tabs via registerCustomViewer)
  assert.equal(registeredViews.length, 0);
  assert.equal(registeredCustomViewers.length, 1);
  assert.deepEqual(registeredCustomViewers[0].extensions, ['dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif']);
});

test('validatePluginZip successfully extracts valid plugin zip', () => {
  const zip = zipSync({
    'manifest.json': strToU8(JSON.stringify({ id: 'custom-tool', name: 'Custom Tool', location: '사이드바' })),
    'plugin.js': strToU8('export default { activate() {} };'),
    'readme.txt': strToU8('Some readme file'),
  });

  const res = validatePluginZip(zip);
  assert.equal(res.manifest.id, 'custom-tool');
  assert.equal(res.manifest.name, 'Custom Tool');
  assert.equal(res.manifest.location, '사이드바');
  assert.ok(res.scriptContent.includes('activate'));
  assert.ok(res.files['plugin.json']);
  assert.ok(res.files['main.js']);
});

test('validatePluginZip successfully extracts nested root folder zip', () => {
  const zip = zipSync({
    'my-plugin/plugin.json': strToU8(JSON.stringify({ id: 'nested-tool', name: 'Nested Tool' })),
    'my-plugin/main.js': strToU8('console.log("nested");'),
  });

  const res = validatePluginZip(zip);
  assert.equal(res.manifest.id, 'nested-tool');
  assert.equal(res.manifest.name, 'Nested Tool');
  assert.ok(res.scriptContent.includes('nested'));
});

test('validatePluginZip throws when manifest is missing', () => {
  const zip = zipSync({
    'main.js': strToU8('console.log(1);'),
  });
  assert.throws(() => validatePluginZip(zip), /manifest\.json.*설정 파일이 없습니다/);
});

test('validatePluginZip throws when script is missing', () => {
  const zip = zipSync({
    'manifest.json': strToU8(JSON.stringify({ id: 'no-script', name: 'No Script' })),
  });
  assert.throws(() => validatePluginZip(zip), /실행 스크립트.*없습니다/);
});


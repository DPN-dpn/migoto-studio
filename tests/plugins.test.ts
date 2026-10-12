import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDDS } from '../src/plugins/builtin/asset-viewer/dds-decoder.ts';
import { BUILTIN_PLUGINS } from '../src/plugins/builtin.ts';
import { validatePluginZip } from '../src/plugins/zip.ts';
import { definePlugin } from '../src/plugins/api.ts';
import { resolvePluginIcon } from '../src/plugins/icons.ts';
import { zipSync, strToU8 } from 'fflate';

test('definePlugin returns identical plugin definition with type inference', () => {
  const plugin = definePlugin({
    activate(ctx) {},
    deactivate() {},
  });
  assert.equal(typeof plugin.activate, 'function');
  assert.equal(typeof plugin.deactivate, 'function');
});

test('PluginContext contract supports extended editor and workspace capabilities', () => {
  let invoked = false;
  const plugin = definePlugin({
    activate(context) {
      assert.equal(typeof context.editor.setText, 'function');
      assert.equal(typeof context.editor.getLine, 'function');
      assert.equal(typeof context.editor.getLineCount, 'function');
      assert.equal(typeof context.editor.onDidChangeText, 'function');
      assert.equal(typeof context.editor.onDidChangeCursor, 'function');
      assert.equal(typeof context.editor.registerContextMenuAction, 'function');
      assert.equal(typeof context.workspace.writeTextFile, 'function');
      assert.equal(typeof context.workspace.writeBinaryFile, 'function');
      assert.equal(typeof context.workspace.readDirectory, 'function');
      assert.equal(typeof context.workspace.pickFile, 'function');
      assert.equal(typeof context.workspace.showInFolder, 'function');
      assert.equal(typeof context.workspace.onDidChangeActiveFile, 'function');
      invoked = true;
    },
  });

  const mockContext: any = {
    editor: {
      setText: () => {},
      getLine: () => '',
      getLineCount: () => 1,
      onDidChangeText: () => () => {},
      onDidChangeCursor: () => () => {},
      registerContextMenuAction: () => () => {},
    },
    workspace: {
      writeTextFile: async () => {},
      writeBinaryFile: async () => {},
      readDirectory: async () => [],
      pickFile: async () => null,
      showInFolder: async () => {},
      onDidChangeActiveFile: () => () => {},
    },
  };

  plugin.activate(mockContext);
  assert.ok(invoked);
});

test('BUILTIN_PLUGINS registers 5 default plugins with unique IDs', () => {
  assert.equal(BUILTIN_PLUGINS.length, 5);
  const ids = BUILTIN_PLUGINS.map((p) => p.manifest.id);
  assert.deepEqual(ids, ['python-runner', 'asset-viewer', 'ai-assistant', 'resource-checker', 'zzmi-support']);

  for (const p of BUILTIN_PLUGINS) {
    assert.ok(p.manifest.name);
    assert.ok(p.manifest.description);
    assert.ok(p.manifest.version);
    assert.ok(p.manifest.location, `Plugin ${p.manifest.id} must have location specified`);
    assert.ok(typeof p.createPlugin === 'function');
  }

  const asset = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'asset-viewer')!;
  assert.equal(asset.manifest.version, '1.1.1');
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

test('decodeDDS correctly parses DX10 header with BC7, BC1, BC3, and handles sRGB vs Linear', () => {
  // Construct DDS with DX10 header (128 + 20 = 148 bytes header + 16 bytes data)
  const buf = new Uint8Array(148 + 16);
  const view = new DataView(buf.buffer);

  // Magic 'DDS '
  view.setUint32(0, 0x20534444, true);
  view.setUint32(4, 124, true);
  view.setUint32(12, 4, true); // height = 4
  view.setUint32(16, 4, true); // width = 4
  view.setUint32(76, 32, true);
  view.setUint32(84, 0x30315844, true); // FourCC 'DX10'

  // DX10 Header at offset 128: DXGI_FORMAT_BC7_UNORM_SRGB (99)
  view.setUint32(128, 99, true); // dxgiFormat = 99
  view.setUint32(132, 3, true); // D3D10_RESOURCE_DIMENSION_TEXTURE2D

  // BC7 Mode 6 block: all white (64 bits of lowChunk except bits 0..5, highChunk all 1s)
  const lowChunk = (~0x3fn) & 0xffffffffffffffffn;
  const highChunk = 0xffffffffffffffffn;
  view.setBigUint64(148, lowChunk, true);
  view.setBigUint64(156, highChunk, true);

  const decodedSRGB = decodeDDS(buf);
  assert.equal(decodedSRGB.format, 'BC7 (sRGB)');
  assert.equal(decodedSRGB.isSRGB, true);
  assert.equal(decodedSRGB.dxgiFormat, 99);
  assert.equal(decodedSRGB.width, 4);
  assert.equal(decodedSRGB.height, 4);
  assert.equal(decodedSRGB.rgba[0], 255);
  assert.equal(decodedSRGB.rgba[1], 255);
  assert.equal(decodedSRGB.rgba[2], 255);
  assert.equal(decodedSRGB.rgba[3], 255);

  // Switch to DXGI_FORMAT_BC7_UNORM (98) - Linear
  view.setUint32(128, 98, true);
  const decodedLinear = decodeDDS(buf);
  assert.equal(decodedLinear.format, 'BC7 (Linear)');
  assert.equal(decodedLinear.isSRGB, false);
  assert.equal(decodedLinear.dxgiFormat, 98);

  // Test DXGI_FORMAT_BC1_UNORM_SRGB (72)
  view.setUint32(128, 72, true);
  view.setUint16(148, 0xffff, true);
  view.setUint16(150, 0x0000, true);
  view.setUint32(152, 0x00000000, true);
  const decodedBC1SRGB = decodeDDS(buf);
  assert.equal(decodedBC1SRGB.format, 'BC1 (sRGB)');
  assert.equal(decodedBC1SRGB.isSRGB, true);

  // Test DXGI_FORMAT_BC3_UNORM_SRGB (78)
  view.setUint32(128, 78, true);
  const decodedBC3SRGB = decodeDDS(buf);
  assert.equal(decodedBC3SRGB.format, 'BC3 (sRGB)');
  assert.equal(decodedBC3SRGB.isSRGB, true);

  // Test DXGI_FORMAT_BC5_UNORM (83)
  view.setUint32(128, 83, true);
  const decodedBC5 = decodeDDS(buf);
  assert.equal(decodedBC5.format, 'BC5 (Linear)');
  assert.equal(decodedBC5.isSRGB, false);
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
  assert.equal(registeredViews[0].icon, 'python');

  registeredViews.length = 0;
  const ai = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'ai-assistant')!;
  ai.createPlugin().activate(mockContext);
  assert.equal(registeredViews.length, 1);
  assert.equal(registeredViews[0].id, 'ai-assistant');
  assert.equal(registeredViews[0].icon, 'sparkles');

  registeredViews.length = 0;
  const asset = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'asset-viewer')!;
  asset.createPlugin().activate(mockContext);
  // Asset viewer should NOT register sidebar views (opens directly in editor tabs via registerCustomViewer)
  assert.equal(registeredViews.length, 0);
  assert.equal(registeredCustomViewers.length, 1);
  assert.deepEqual(registeredCustomViewers[0].extensions, ['dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif']);
});

test('resolvePluginIcon resolves SVG presets, custom SVGs, emojis and fallbacks', () => {
  // Preset names
  assert.ok(resolvePluginIcon('sparkles').startsWith('<svg'));
  assert.ok(resolvePluginIcon('python').startsWith('<svg'));
  assert.ok(resolvePluginIcon('image').startsWith('<svg'));
  assert.ok(resolvePluginIcon('file-check').startsWith('<svg'));
  assert.ok(resolvePluginIcon('gamepad').startsWith('<svg'));

  // Case-insensitive legacy codes
  assert.ok(resolvePluginIcon('AI').startsWith('<svg'));
  assert.ok(resolvePluginIcon('PY').startsWith('<svg'));
  assert.ok(resolvePluginIcon('IMG').startsWith('<svg'));
  assert.ok(resolvePluginIcon('CHK').startsWith('<svg'));
  assert.ok(resolvePluginIcon('ZZMI').startsWith('<svg'));

  // Custom raw SVG
  const customSvg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>';
  assert.equal(resolvePluginIcon(customSvg), customSvg);

  // Custom emoji
  assert.equal(resolvePluginIcon('🤖'), '🤖');
  assert.equal(resolvePluginIcon('🐍'), '🐍');

  // Fallbacks
  assert.equal(resolvePluginIcon(''), 'PLG');
  assert.equal(resolvePluginIcon(undefined), 'PLG');
  assert.equal(resolvePluginIcon('custom-text'), 'custom-text');
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

test('resource-checker plugin activates and registers lint rule without sidebar view', async () => {
  const def = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'resource-checker')!;
  assert.ok(def);
  const plugin = def.createPlugin();

  let registeredRule: any = null;
  let registeredView: any = null;

  const mockContext: any = {
    manifest: def.manifest,
    linter: {
      registerRule: (rule: any) => {
        registeredRule = rule;
      },
    },
    ui: {
      registerSidebarView: (view: any) => {
        registeredView = view;
      },
    },
    workspace: {
      getCurrentFolder: () => 'D:/Mods/Test',
      getCurrentFile: () => ({ name: 'test.ini', path: 'D:/Mods/Test/test.ini', location: 'disk' }),
      readDirectory: async () => [],
    },
    editor: {
      getText: () => 'filename = Meshes/NotExist.buf\n',
      setCursor: () => {},
    },
  };

  plugin.activate(mockContext);
  assert.ok(registeredRule);
  assert.equal(registeredRule.id, 'missing-resource-files');
  assert.equal(registeredView, null);

  // Test rule check execution
  const diags = await registeredRule.check({
    model: {
      getLineCount: () => 1,
      getLineContent: () => 'filename = Meshes/NotExist.buf',
    },
    folder: 'D:/Mods/Test',
    fileExists: async () => false,
  });
  assert.equal(diags.length, 1);
  assert.equal(diags[0].severity, 'warning');
  assert.ok(diags[0].message.includes('Meshes/NotExist.buf'));

  // Test when file exists
  const diagsOk = await registeredRule.check({
    model: {
      getLineCount: () => 1,
      getLineContent: () => 'filename = Meshes/Exists.buf',
    },
    folder: 'D:/Mods/Test',
    fileExists: async () => true,
  });
  assert.equal(diagsOk.length, 0);
});

test('zzmi-support plugin activates and registers allowed resource and code template without sidebar view', () => {
  const def = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'zzmi-support')!;
  assert.ok(def);
  const plugin = def.createPlugin();

  const allowedResources: any[] = [];
  let registeredTemplate: any = null;
  let registeredView: any = null;

  const mockContext: any = {
    manifest: def.manifest,
    linter: {
      registerAllowedResource: (pattern: any) => {
        allowedResources.push(pattern);
      },
    },
    templates: {
      registerTemplate: (template: any) => {
        registeredTemplate = template;
      },
    },
    ui: {
      registerSidebarView: (view: any) => {
        registeredView = view;
      },
    },
    editor: {
      insertText: () => {},
    },
  };

  plugin.activate(mockContext);
  assert.ok(allowedResources.length >= 2);
  assert.ok(registeredTemplate);
  assert.equal(registeredTemplate.id, 'zzmi_slot_fix');
  assert.ok(registeredTemplate.body.includes('CommandList\\ZZMI\\SetTextures'));
  assert.ok(registeredTemplate.body.includes('Resource\\ZZMI\\WEngineFX'));
  assert.equal(registeredView, null);
});



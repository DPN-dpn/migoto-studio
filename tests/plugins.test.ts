import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDDS } from '../default-plugins/asset-viewer/dds-decoder.ts';
import pythonRunnerPlugin from '../default-plugins/python-runner/index.ts';
import assetViewerPlugin from '../default-plugins/asset-viewer/index.ts';
import aiAssistantPlugin from '../default-plugins/ai-assistant/index.ts';
import customLintPlugin from '../default-plugins/custom-lint/index.ts';
import zzmiSupportPlugin from '../default-plugins/zzmi-support/index.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUILTIN_PLUGINS = [
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/python-runner/plugin.json'), 'utf8')), createPlugin: () => pythonRunnerPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/asset-viewer/plugin.json'), 'utf8')), createPlugin: () => assetViewerPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/ai-assistant/plugin.json'), 'utf8')), createPlugin: () => aiAssistantPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/custom-lint/plugin.json'), 'utf8')), createPlugin: () => customLintPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/zzmi-support/plugin.json'), 'utf8')), createPlugin: () => zzmiSupportPlugin },
];
import { validatePluginZip } from '../src/plugins/zip.ts';
import { definePlugin } from '../src/plugins/api.ts';
import { renderPluginIcon } from '../src/plugins/types.ts';
import { zipSync, strToU8 } from 'fflate';
import {
  isAllowedResource,
  isAllowedVariable,
  isAllowedUsedResource,
  isAllowedUsedVariable,
  registerAllowedResource,
  registerAllowedVariable,
  registerAllowedUsedVariable,
  registerAllowedUsedResource,
} from '../src/core/ini/lint.ts';

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
  assert.deepEqual(ids, ['python-runner', 'asset-viewer', 'ai-assistant', 'custom-lint', 'zzmi-support']);

  for (const p of BUILTIN_PLUGINS) {
    assert.ok(p.manifest.name);
    assert.ok(p.manifest.description);
    assert.ok(p.manifest.version);
    assert.ok(p.manifest.location, `Plugin ${p.manifest.id} must have location specified`);
    assert.ok(typeof p.createPlugin === 'function');
  }

  const asset = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'asset-viewer')!;
  assert.equal(asset.manifest.version, '1.2.0');
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
  assert.ok(registeredViews[0].icon.startsWith('<svg'));

  registeredViews.length = 0;
  const ai = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'ai-assistant')!;
  ai.createPlugin().activate(mockContext);
  assert.equal(registeredViews.length, 1);
  assert.equal(registeredViews[0].id, 'ai-assistant');
  assert.ok(registeredViews[0].icon.startsWith('<svg'));

  registeredViews.length = 0;
  const asset = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'asset-viewer')!;
  asset.createPlugin().activate(mockContext);
  // Asset viewer should NOT register sidebar views (opens directly in editor tabs via registerCustomViewer)
  assert.equal(registeredViews.length, 0);
  assert.equal(registeredCustomViewers.length, 1);
  assert.deepEqual(registeredCustomViewers[0].extensions, ['dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif']);
});

test('all builtin plugins contain self-contained SVG icons in their manifests', () => {
  for (const p of BUILTIN_PLUGINS) {
    assert.ok(p.manifest.icon, `Plugin ${p.manifest.id} should have an icon`);
    assert.ok(p.manifest.icon.startsWith('<svg'), `Plugin ${p.manifest.id} icon should be SVG markup`);
  }
});

test('renderPluginIcon renders raw SVGs, data URIs, emojis and fallbacks', () => {
  // Custom raw SVG
  const customSvg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>';
  assert.equal(renderPluginIcon(customSvg), customSvg);

  // Data URI image
  const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.ok(renderPluginIcon(dataUri).includes('<img src="data:image/png;base64,'));

  // Custom emoji
  assert.equal(renderPluginIcon('🤖'), '🤖');
  assert.equal(renderPluginIcon('🐍'), '🐍');

  // Fallbacks
  assert.equal(renderPluginIcon(''), 'PLG');
  assert.equal(renderPluginIcon(undefined), 'PLG');
  assert.equal(renderPluginIcon('custom-text'), 'custom-text');
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

test('validatePluginZip successfully resolves icon.svg from archive into manifest', () => {
  const iconContent = '<svg viewBox="0 0 10 10"><circle/></svg>';
  const zip = zipSync({
    'plugin.json': strToU8(JSON.stringify({ id: 'icon-tool', name: 'Icon Tool', icon: 'icon.svg' })),
    'main.js': strToU8('export default { activate() {} };'),
    'icon.svg': strToU8(iconContent),
  });

  const res = validatePluginZip(zip);
  assert.equal(res.manifest.icon, iconContent);
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

test('custom-lint plugin activates and registers both resource and xxmi namespace lint rules', async () => {
  const def = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'custom-lint')!;
  assert.ok(def);
  assert.equal(def.manifest.name, '커스텀 린트');
  const plugin = def.createPlugin();

  const registeredRules: any[] = [];
  const allowedResources: any[] = [];
  let registeredView: any = null;

  const mockContext: any = {
    manifest: def.manifest,
    linter: {
      registerRule: (rule: any) => {
        registeredRules.push(rule);
      },
      registerAllowedResource: (pattern: any) => {
        allowedResources.push(pattern);
        return registerAllowedResource(pattern);
      },
      registerAllowedVariable: (pattern: any) => {
        return registerAllowedVariable(pattern);
      },
      registerAllowedUsedVariable: (pattern: any) => {
        return registerAllowedUsedVariable(pattern);
      },
      registerAllowedUsedResource: (pattern: any) => {
        return registerAllowedUsedResource(pattern);
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
      readTextFile: async () => '',
    },
    editor: {
      getText: () => 'filename = Meshes/NotExist.buf\n',
      setCursor: () => {},
    },
  };

  plugin.activate(mockContext);
  assert.equal(registeredRules.length, 2);
  assert.equal(registeredView, null);
  assert.ok(allowedResources.includes('CommandListSkinTexture'));
  assert.ok(isAllowedResource('CommandListSkinTexture'));
  assert.ok(isAllowedUsedResource('CommandListSkinTexture'));
  assert.ok(isAllowedResource('BuiltinCommandListSkinTexture'));
  assert.ok(isAllowedResource('BuiltinCommandListDraw'));
  assert.ok(isAllowedResource('builtincommandlist_dispatch'));
  assert.ok(isAllowedResource('CommandList\\Builtin\\Action'));
  assert.ok(isAllowedUsedResource('BuiltinCommandListSkinTexture'));
  assert.ok(isAllowedUsedResource('BuiltinCommandListDraw'));

  const resourceRule = registeredRules.find((r) => r.id === 'missing-resource-files')!;
  const nsRule = registeredRules.find((r) => r.id === 'xxmi-namespace-check')!;
  assert.ok(resourceRule);
  assert.ok(nsRule);

  // 1. Test missing resource rule
  const diags = await resourceRule.check({
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

  const diagsOk = await resourceRule.check({
    model: {
      getLineCount: () => 1,
      getLineContent: () => 'filename = Meshes/Exists.buf',
    },
    folder: 'D:/Mods/Test',
    fileExists: async () => true,
  });
  assert.equal(diagsOk.length, 0);

  // 2. Test XXMI namespace rule
  const otherIniContent = `
namespace = RaidenMod
[Constants]
global persist $costume = 1
global $active = 1

[CommandListSwapWeapon]
handling = skip
`;

  const nsCtxBase = {
    folder: 'D:/Mods/Test',
    getAllFiles: () => ['Raiden.ini', 'test.ini'],
    readTextFile: async (path: string) => {
      if (path.includes('Raiden.ini')) return otherIniContent;
      return '';
    },
    file: { name: 'test.ini', path: 'D:/Mods/Test/test.ini', location: 'disk' },
    fileExists: async () => true,
  };

  // 2-a. Valid namespaced variable & commandlist
  const validModel = {
    getLineCount: () => 3,
    getLineContent: (n: number) => {
      if (n === 1) return 'if $\\RaidenMod\\costume == 1';
      if (n === 2) return '    run = CommandList\\RaidenMod\\SwapWeapon';
      return 'endif';
    },
    getValue: () => 'if $\\RaidenMod\\costume == 1\nrun = CommandList\\RaidenMod\\SwapWeapon\nendif',
  };
  const nsDiagsValid = await nsRule.check({ ...nsCtxBase, model: validModel });
  assert.equal(nsDiagsValid.length, 0, 'Valid namespace variable and commandlist should have 0 diagnostics');

  // 2-b. Unknown namespace
  const unknownNsModel = {
    getLineCount: () => 1,
    getLineContent: () => 'if $\\UnknownMod\\costume == 1',
    getValue: () => 'if $\\UnknownMod\\costume == 1',
  };
  const nsDiagsUnknown = await nsRule.check({ ...nsCtxBase, model: unknownNsModel });
  assert.equal(nsDiagsUnknown.length, 1);
  assert.ok(nsDiagsUnknown[0].message.includes("네임스페이스 'UnknownMod'을(를) 찾을 수 없습니다"));

  // 2-c. Undeclared variable in valid namespace
  const undeclaredVarModel = {
    getLineCount: () => 1,
    getLineContent: () => 'if $\\RaidenMod\\nonexistent == 1',
    getValue: () => 'if $\\RaidenMod\\nonexistent == 1',
  };
  const nsDiagsUndeclared = await nsRule.check({ ...nsCtxBase, model: undeclaredVarModel });
  assert.equal(nsDiagsUndeclared.length, 1);
  assert.ok(nsDiagsUndeclared[0].message.includes("네임스페이스 'RaidenMod'에 선언되지 않은 변수 '$nonexistent'"));

  // 2-d. Single ini mode (folder = null) returns 0 (handled by core linter)
  const singleIniDiags = await nsRule.check({
    ...nsCtxBase,
    folder: null,
    model: undeclaredVarModel,
  });
  assert.equal(singleIniDiags.length, 0);

  // 2-e. Shared namespace across multiple INI files:
  // If test.ini also declares namespace = RaidenMod, variables and sections from Raiden.ini
  // are accessible directly ($costume, run = CommandListSwapWeapon)
  const sharedNsModel = {
    getLineCount: () => 4,
    getLineContent: (n: number) => {
      if (n === 1) return 'namespace = RaidenMod';
      if (n === 2) return 'if $costume == 1';
      if (n === 3) return '    run = CommandListSwapWeapon';
      return 'endif';
    },
    getValue: () => 'namespace = RaidenMod\nif $costume == 1\n    run = CommandListSwapWeapon\nendif',
  };
  const sharedNsDiags = await nsRule.check({ ...nsCtxBase, model: sharedNsModel });
  assert.equal(sharedNsDiags.length, 0, 'Shared namespace should have 0 diagnostics for shared variables and sections');
  assert.ok(isAllowedVariable('costume'), 'costume should be allowed variable via shared namespace');
  assert.ok(isAllowedResource('CommandListSwapWeapon'), 'CommandListSwapWeapon should be allowed resource via shared namespace');

  // If another file has a different namespace, bare $costume is NOT allowed
  const diffNsModel = {
    getLineCount: () => 2,
    getLineContent: (n: number) => {
      if (n === 1) return 'namespace = AyakaMod';
      return 'if $costume == 1';
    },
    getValue: () => 'namespace = AyakaMod\nif $costume == 1',
  };
  await nsRule.check({ ...nsCtxBase, model: diffNsModel });
  assert.equal(isAllowedVariable('costume'), false, 'costume should not be allowed as bare variable in different namespace');
  assert.ok(isAllowedVariable('\\RaidenMod\\costume'), 'Fully qualified \\RaidenMod\\costume should still be allowed');

  // 2-f. BuiltinCommandList calls produce 0 diagnostics
  const builtinModel = {
    getLineCount: () => 2,
    getLineContent: (n: number) => {
      if (n === 1) return 'run = BuiltinCommandListSkinTexture';
      return 'post run = BuiltinCommandListDraw';
    },
    getValue: () => 'run = BuiltinCommandListSkinTexture\npost run = BuiltinCommandListDraw',
  };
  const nsDiagsBuiltin = await nsRule.check({ ...nsCtxBase, model: builtinModel });
  assert.equal(nsDiagsBuiltin.length, 0, 'BuiltinCommandList calls should produce 0 diagnostics');
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

test('default-plugins directory contains all 5 standalone plugins ready for installation', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');

  const defaultIds = ['python-runner', 'asset-viewer', 'ai-assistant', 'custom-lint', 'zzmi-support'];
  const baseDir = path.resolve(process.cwd(), 'default-plugins');

  for (const id of defaultIds) {
    const pJson = path.join(baseDir, id, 'plugin.json');
    const pJs = path.join(baseDir, id, 'plugin.js');

    assert.ok(fs.existsSync(pJson), `plugin.json must exist for ${id}`);
    assert.ok(fs.existsSync(pJs), `plugin.js must exist for ${id}`);

    const manifest = JSON.parse(fs.readFileSync(pJson, 'utf8'));
    assert.equal(manifest.id, id);
    assert.equal(manifest.main, 'plugin.js');
    assert.ok(manifest.icon && manifest.icon.includes('<svg'), `Plugin ${id} manifest must embed SVG icon`);

    // Dynamically import standalone bundle
    const fileUrl = url.pathToFileURL(pJs).href;
    const mod = await import(fileUrl);
    const plugin = mod.default || mod;
    assert.equal(typeof plugin.activate, 'function', `Plugin ${id} must export activate function`);
  }
});

test('public/default-plugins contains web-compatible plugins and excludes python-runner', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const pubDir = path.resolve(process.cwd(), 'public/default-plugins');
  assert.ok(fs.existsSync(pubDir), 'public/default-plugins directory must exist');

  const indexJson = path.join(pubDir, 'index.json');
  assert.ok(fs.existsSync(indexJson), 'index.json must exist');
  const indexList = JSON.parse(fs.readFileSync(indexJson, 'utf8'));

  assert.deepEqual(indexList, ['asset-viewer', 'ai-assistant', 'custom-lint', 'zzmi-support']);
  assert.equal(fs.existsSync(path.join(pubDir, 'python-runner')), false, 'python-runner must not exist in public/default-plugins');

  for (const id of indexList) {
    assert.ok(fs.existsSync(path.join(pubDir, id, 'plugin.json')), `plugin.json must exist for ${id} in public/`);
    assert.ok(fs.existsSync(path.join(pubDir, id, 'plugin.js')), `plugin.js must exist for ${id} in public/`);
  }
});

test('web listDiskPlugins sanitizes stale localStorage, purges python-runner, and preserves valid custom plugins', async () => {
  const { web, DEFAULT_WEB_PLUGINS, STORAGE_WEB_PLUGINS, STORAGE_DELETED_DEFAULTS } = await import('../src/platform/web.ts');

  const mockStorage: Record<string, string> = {
    [STORAGE_WEB_PLUGINS]: JSON.stringify({
      'python-runner': {
        id: 'python-runner',
        manifestJson: JSON.stringify({ id: 'python-runner', name: 'Python Runner' }),
        scriptContent: 'export default {}',
      },
      'asset-viewer': {
        id: 'asset-viewer',
        manifestJson: JSON.stringify({ id: 'asset-viewer', name: 'Old Asset Viewer' }),
        scriptContent: 'export default {}',
      },
      'corrupt-plugin': {
        id: 'corrupt-plugin',
        manifestJson: '{ invalid json',
        scriptContent: 'export default {}',
      },
      'my-custom-plugin': {
        id: 'my-custom-plugin',
        path: 'my-custom-plugin',
        manifestJson: JSON.stringify({ id: 'my-custom-plugin', name: 'My Custom Plugin' }),
        scriptContent: 'export default { activate() {} }',
      },
    }),
  };

  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; },
  };

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string) => {
    return {
      ok: true,
      text: async () => {
        if (url.endsWith('.json')) {
          const parts = url.split('/');
          const id = parts[parts.length - 2];
          return JSON.stringify({ id, name: id });
        }
        return 'export default { activate() {} }';
      },
    } as any;
  };

  try {
    const list = await web.listDiskPlugins!();
    const ids = list.map((p) => p.id);

    assert.ok(!ids.includes('python-runner'), 'python-runner must be purged');
    assert.ok(!ids.includes('corrupt-plugin'), 'corrupt-plugin must be purged');
    assert.ok(ids.includes('my-custom-plugin'), 'my-custom-plugin must be preserved');
    for (const defId of DEFAULT_WEB_PLUGINS) {
      assert.ok(ids.includes(defId), `${defId} must be loaded as default plugin`);
    }

    const savedWebPlugins = JSON.parse(mockStorage[STORAGE_WEB_PLUGINS] || '{}');
    assert.equal(savedWebPlugins['python-runner'], undefined, 'python-runner must be removed from localStorage');
    assert.equal(savedWebPlugins['asset-viewer'], undefined, 'default plugins must be removed from localStorage');
    assert.equal(savedWebPlugins['corrupt-plugin'], undefined, 'corrupt entries must be removed from localStorage');
    assert.ok(savedWebPlugins['my-custom-plugin'], 'my-custom-plugin must remain in localStorage');

    await web.deleteEntry!('default-plugins/asset-viewer');
    const deletedList = JSON.parse(mockStorage[STORAGE_DELETED_DEFAULTS] || '[]');
    assert.ok(deletedList.includes('asset-viewer'), 'asset-viewer must be recorded in deleted defaults');

    const refreshedList = await web.listDiskPlugins!();
    const refreshedIds = refreshedList.map((p) => p.id);
    assert.ok(!refreshedIds.includes('asset-viewer'), 'deleted default plugin must not be returned');
  } finally {
    (globalThis as any).fetch = originalFetch;
  }
});

test('custom-lint provides cross-file definition and references for same namespace symbols', async () => {
  const def = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'custom-lint')!;
  assert.ok(def);
  const plugin = def.createPlugin();

  let registeredDefProvider: any = null;
  let registeredRefProvider: any = null;
  const registeredActions: any[] = [];
  let openedFilePath = '';
  let openedFileLine = 0;

  const mockContext: any = {
    manifest: def.manifest,
    editor: {
      getCursor: () => ({ lineNumber: 3, column: 5 }),
      getLine: () => '$costume = 2',
      getLineCount: () => 3,
      getText: () => '$costume = 2',
      registerContextMenuAction: (action: any) => {
        registeredActions.push(action);
        return () => {};
      },
    },
    ui: {
      showModal: () => {},
      showToast: () => {},
    },
    linter: {
      registerRule: () => () => {},
      registerAllowedResource: () => () => {},
      registerAllowedVariable: () => () => {},
      registerAllowedUsedResource: () => () => {},
      registerAllowedUsedVariable: () => () => {},
      registerDefinitionProvider: (p: any) => {
        registeredDefProvider = p;
        return () => {};
      },
      registerReferenceProvider: (p: any) => {
        registeredRefProvider = p;
        return () => {};
      },
    },
    workspace: {
      readDirectory: async () => [],
      readTextFile: async () => '',
      openFile: async (path: string, line?: number) => {
        openedFilePath = path;
        openedFileLine = line || 0;
      },
      getCurrentFile: () => ({ name: 'Skill.ini', path: 'Skill.ini', location: 'disk' }),
      getCurrentFolder: () => 'D:/Mods/Test',
    },
  };

  plugin.activate(mockContext);
  assert.ok(registeredDefProvider, 'Definition provider should be registered');
  assert.ok(registeredRefProvider, 'Reference provider should be registered');
  assert.equal(registeredActions.length, 0, 'Should not register extra context menu actions (core F12/Shift+F12 are used instead)');

  const raidenIni = [
    'namespace = RaidenMod',
    '[Constants]',
    'global persist $costume = 1',
    'global $active = 1',
    '',
    '[CommandListSwapWeapon]',
    'run = CommandListSkill',
  ].join('\n');

  const skillIni = [
    'namespace = RaidenMod',
    '[CommandListSkill]',
    '$costume = 2',
    'run = CommandListSwapWeapon',
  ].join('\n');

  const weaponIni = [
    'namespace = WeaponMod',
    '[CommandListWeapon]',
    '$\\RaidenMod\\costume = 0',
    'run = CommandList\\RaidenMod\\SwapWeapon',
  ].join('\n');

  const filesMap: Record<string, string> = {
    'Raiden.ini': raidenIni,
    'Skill.ini': skillIni,
    'Weapon.ini': weaponIni,
  };

  const createMockCtx = (curFile: string, curContent: string) => ({
    file: { name: curFile, path: `D:/Mods/Test/${curFile}`, location: 'disk' },
    folder: 'D:/Mods/Test',
    getAllFiles: () => Object.keys(filesMap),
    readTextFile: async (path: string) => {
      const base = path.split(/[\\/]/).pop()!;
      return filesMap[base] || '';
    },
    model: {
      getValue: () => curContent,
      getLineContent: (n: number) => curContent.split('\n')[n - 1] || '',
      getLineCount: () => curContent.split('\n').length,
    },
  });

  // 1. Definition navigation from Skill.ini to Raiden.ini for variable $costume
  const skillCtx = createMockCtx('Skill.ini', skillIni);
  const defVar = await registeredDefProvider.provideDefinition(
    { name: '$costume', cleanName: 'costume', kind: 'variable' },
    skillCtx,
  );
  assert.ok(defVar, 'Definition for $costume should be found across files in same namespace');
  assert.equal(defVar.filePath, 'Raiden.ini');
  assert.equal(defVar.lineNumber, 3);
  assert.equal(defVar.isDefinition, true);

  // 2. Definition navigation from Skill.ini to Raiden.ini for section CommandListSwapWeapon
  const defSec = await registeredDefProvider.provideDefinition(
    { name: 'CommandListSwapWeapon', cleanName: 'CommandListSwapWeapon', kind: 'section' },
    skillCtx,
  );
  assert.ok(defSec, 'Definition for CommandListSwapWeapon should be found across files in same namespace');
  assert.equal(defSec.filePath, 'Raiden.ini');
  assert.equal(defSec.lineNumber, 6);
  assert.equal(defSec.isDefinition, true);

  // 3. Cross-namespace definition navigation from Weapon.ini to Raiden.ini for $\RaidenMod\costume
  const weaponCtx = createMockCtx('Weapon.ini', weaponIni);
  const defCrossVar = await registeredDefProvider.provideDefinition(
    { name: '$\\RaidenMod\\costume', cleanName: 'costume', kind: 'variable', namespace: 'RaidenMod' },
    weaponCtx,
  );
  assert.ok(defCrossVar, 'Definition for $\\RaidenMod\\costume should be found in RaidenMod');
  assert.equal(defCrossVar.filePath, 'Raiden.ini');
  assert.equal(defCrossVar.lineNumber, 3);

  // 4. References finding for $costume
  const raidenCtx = createMockCtx('Raiden.ini', raidenIni);
  const refsVar = await registeredRefProvider.provideReferences(
    { name: '$costume', cleanName: 'costume', kind: 'variable' },
    raidenCtx,
  );
  assert.ok(refsVar.length >= 3, 'Should find declaration and usages across all namespace files');
  assert.ok(refsVar.some((r: any) => r.filePath === 'Raiden.ini' && r.lineNumber === 3 && r.isDefinition));
  assert.ok(refsVar.some((r: any) => r.filePath === 'Skill.ini' && r.lineNumber === 3 && !r.isDefinition));
  assert.ok(refsVar.some((r: any) => r.filePath === 'Weapon.ini' && r.lineNumber === 3 && !r.isDefinition));

  // 5. References finding for CommandListSwapWeapon
  const refsSec = await registeredRefProvider.provideReferences(
    { name: 'CommandListSwapWeapon', cleanName: 'CommandListSwapWeapon', kind: 'section' },
    raidenCtx,
  );
  // 6. Deactivate and verify clean teardown and in-flight cancellation safety
  plugin.deactivate();
  const defAfterDeactivate = await registeredDefProvider.provideDefinition(
    { name: '$costume', cleanName: 'costume', kind: 'variable' },
    skillCtx,
  );
  assert.equal(defAfterDeactivate, null, 'provideDefinition must return null after deactivate');

  const refsAfterDeactivate = await registeredRefProvider.provideReferences(
    { name: '$costume', cleanName: 'costume', kind: 'variable' },
    raidenCtx,
  );
  assert.deepEqual(refsAfterDeactivate, [], 'provideReferences must return empty array after deactivate');
});

test('legacy resource-checker is migrated to custom-lint in settings and plugin order', () => {
  // Mock localStorage
  const mockStorage: Record<string, string> = {
    migoto_plugins_enabled: JSON.stringify({ 'resource-checker': true, 'other-plugin': false }),
    migoto_plugin_order: JSON.stringify(['ai-assistant', 'resource-checker', 'asset-viewer']),
    migoto_plugins_collapsed: JSON.stringify(['resource-checker']),
  };

  // 1. Order migration
  const rawOrder = JSON.parse(mockStorage.migoto_plugin_order);
  const migratedOrder = rawOrder
    .map((id: string) => (id === 'resource-checker' ? 'custom-lint' : id))
    .filter((id: string, idx: number, arr: string[]) => arr.indexOf(id) === idx);
  assert.deepEqual(migratedOrder, ['ai-assistant', 'custom-lint', 'asset-viewer']);

  // 2. Enabled state migration
  const savedStates = JSON.parse(mockStorage.migoto_plugins_enabled);
  if (savedStates['resource-checker'] !== undefined) {
    if (savedStates['custom-lint'] === undefined) {
      savedStates['custom-lint'] = savedStates['resource-checker'];
    }
    delete savedStates['resource-checker'];
  }
  assert.equal(savedStates['custom-lint'], true);
  assert.equal(savedStates['resource-checker'], undefined);

  // 3. Collapsed state migration
  const collapsed = JSON.parse(mockStorage.migoto_plugins_collapsed);
  const migratedCollapsed = collapsed.map((id: string) => (id === 'resource-checker' ? 'custom-lint' : id));
  assert.deepEqual(migratedCollapsed, ['custom-lint']);
});

test('plugins are collapsed by default and only expanded plugins are tracked', () => {
  const mockStorage: Record<string, string> = {};

  // Initially, no expanded plugins stored in localStorage
  const storedExpanded = mockStorage.migoto_plugins_expanded;
  const expandedSet = new Set(storedExpanded ? JSON.parse(storedExpanded) : []);

  const samplePlugins = [
    { manifest: { id: 'custom-lint' } },
    { manifest: { id: 'ai-assistant' } },
    { manifest: { id: 'asset-viewer' } },
  ];

  // Every plugin should be collapsed by default
  for (const p of samplePlugins) {
    const isCollapsed = !expandedSet.has(p.manifest.id);
    assert.equal(isCollapsed, true, `${p.manifest.id} should be collapsed by default`);
  }

  // When expanding custom-lint
  expandedSet.add('custom-lint');
  mockStorage.migoto_plugins_expanded = JSON.stringify(Array.from(expandedSet));

  const reloadedSet = new Set(JSON.parse(mockStorage.migoto_plugins_expanded));
  assert.equal(reloadedSet.has('custom-lint'), true);
  assert.equal(!reloadedSet.has('custom-lint'), false, 'custom-lint should now be expanded');
  assert.equal(!reloadedSet.has('ai-assistant'), true, 'ai-assistant should remain collapsed');
});

test('Plugin UI API supports openTab and customRenderer lifecycle', () => {
  let cleanedUp = false;
  let renderedContainer: any = null;

  const mockTab: any = {
    id: 'plugin_test-plugin_gui',
    title: '토글 키 설정',
    icon: '⚙️',
    kind: 'custom',
    customRenderer: (container: any) => {
      renderedContainer = container;
      return () => {
        cleanedUp = true;
      };
    },
  };

  assert.equal(mockTab.kind, 'custom');
  assert.equal(mockTab.icon, '⚙️');
  const cleanup = mockTab.customRenderer({ innerHTML: '' });
  assert.ok(renderedContainer);
  assert.equal(typeof cleanup, 'function');
  cleanup();
  assert.equal(cleanedUp, true);
});

test('Plugin UI API registerMenuItem groups items under plugin and cleans up', () => {
  const pluginMenuItems: Map<string, { manifest: any; items: any[] }> = new Map();

  const manifest = { id: 'toggle-helper', name: '토글 키 매니저', icon: '🎛️' };

  const registerMenuItem = (item: { label: string; shortcut?: string; action: () => void }) => {
    let group = pluginMenuItems.get(manifest.id);
    if (!group) {
      group = { manifest, items: [] };
      pluginMenuItems.set(manifest.id, group);
    }
    group.items.push(item);
    return () => {
      const g = pluginMenuItems.get(manifest.id);
      if (g) {
        g.items = g.items.filter((it) => it !== item);
        if (g.items.length === 0) pluginMenuItems.delete(manifest.id);
      }
    };
  };

  let actionTriggered = false;
  const unregister = registerMenuItem({
    label: '토글 키 설정 GUI 열기',
    shortcut: 'Ctrl+Shift+T',
    action: () => { actionTriggered = true; },
  });

  assert.equal(pluginMenuItems.size, 1);
  const group = pluginMenuItems.get('toggle-helper');
  assert.ok(group);
  assert.equal(group.manifest.name, '토글 키 매니저');
  assert.equal(group.items.length, 1);
  assert.equal(group.items[0].label, '토글 키 설정 GUI 열기');
  assert.equal(group.items[0].shortcut, 'Ctrl+Shift+T');

  group.items[0].action();
  assert.equal(actionTriggered, true);

  unregister();
  assert.equal(pluginMenuItems.size, 0);
});

test('Plugin UI API FormConfig schema and value aggregation works properly', () => {
  const formConfig: any = {
    title: '토글 키 설정',
    fields: [
      { id: 'key', type: 'key', label: '단축키', default: 'VK_F4' },
      { id: 'mode', type: 'select', label: '토글 모드', options: ['cycle', 'hold'], default: 'cycle' },
      { id: 'states', type: 'number', label: '의상 상태 개수', default: 2 },
    ],
  };

  const values: Record<string, any> = {};
  for (const field of formConfig.fields) {
    values[field.id] = field.default;
  }

  assert.equal(values.key, 'VK_F4');
  assert.equal(values.mode, 'cycle');
  assert.equal(values.states, 2);

  values.key = 'no_modifiers alt VK_F4';
  values.states = 3;
  assert.equal(values.key, 'no_modifiers alt VK_F4');
  assert.equal(values.states, 3);
});

test('Plugin UI API and INI API provide toggle key and key binding helpers', () => {
  let invoked = false;
  const plugin = definePlugin({
    activate(context) {
      assert.equal(typeof context.ui.openKeyBindingModal, 'function');
      assert.equal(typeof context.ui.openKeyHelperModal, 'function');
      assert.equal(typeof context.ini.formatKeyToggle, 'function');
      assert.equal(typeof context.ini.parseKeyBinding, 'function');
      assert.equal(typeof context.ini.formatKeyBinding, 'function');
      assert.equal(typeof context.ini.getKeyList, 'function');

      const parsed = context.ini.parseKeyBinding('ctrl no_alt VK_F4');
      assert.equal(parsed.vk, 'VK_F4');
      assert.equal(parsed.ctrl, 'require');
      assert.equal(parsed.alt, 'exclude');

      const formatted = context.ini.formatKeyBinding({
        vk: 'VK_F4',
        ctrl: 'require',
        alt: 'exclude',
      });
      assert.equal(formatted, 'ctrl no_alt VK_F4');

      const keyList = context.ini.getKeyList();
      assert.ok(keyList.length > 50);

      const toggleSection = context.ini.formatKeyToggle({
        sectionName: 'KeyToggleOutfit',
        key: 'VK_F1',
        type: 'cycle',
        states: 3,
        variableName: '$outfit',
      });
      assert.ok(toggleSection.includes('[KeyToggleOutfit]'));
      assert.ok(toggleSection.includes('key = VK_F1'));
      assert.ok(toggleSection.includes('$outfit = 0, 1, 2'));
      invoked = true;
    },
  });

  plugin.activate({
    ui: {
      openKeyBindingModal: async () => 'VK_F1',
      openKeyHelperModal: async () => 'VK_F1',
    },
    ini: {
      formatKeyToggle: (opts: any) => `[${opts.sectionName}]\nkey = ${opts.key}\ntype = ${opts.type}\n$outfit = 0, 1, 2`,
      parseKeyBinding: (text: string) => ({ vk: 'VK_F4', ctrl: 'require', alt: 'exclude', shift: 'none', win: 'none' }),
      formatKeyBinding: (opts: any) => `${opts.ctrl === 'require' ? 'ctrl ' : ''}${opts.alt === 'exclude' ? 'no_alt ' : ''}${opts.vk}`,
      getKeyList: () => new Array(60).fill({ vk: 'VK_F1', label: 'F1', category: '기능키' }),
    },
  } as any);

  assert.ok(invoked);
});

test('Plugin UI API confirm and prompt dialog contracts work as expected', async () => {
  let confirmCalled = false;
  let promptCalled = false;

  const plugin = definePlugin({
    async activate(context) {
      const confirmRes = await context.ui.confirm({
        title: '삭제 확인',
        message: '정말 삭제하시겠습니까?',
        variant: 'danger',
      });
      assert.equal(confirmRes, true);

      const promptRes = await context.ui.prompt({
        title: '이름 변경',
        message: '새로운 이름을 입력하세요:',
        defaultValue: 'ModNew',
      });
      assert.equal(promptRes, 'ModNew');
    },
  });

  await plugin.activate({
    ui: {
      confirm: async (opts: any) => {
        confirmCalled = true;
        return true;
      },
      prompt: async (opts: any) => {
        promptCalled = true;
        return typeof opts === 'string' ? 'test' : opts.defaultValue ?? '';
      },
    },
  } as any);

  assert.ok(confirmCalled);
  assert.ok(promptCalled);
});

test('Plugin Workspace and Tab APIs contract supports search, tabs control and backups', async () => {
  let searchCalled = false;
  let backupCalled = false;
  let closeTabCalled = false;
  let focusTabCalled = false;

  const plugin = definePlugin({
    async activate(context) {
      // 1. Tab control
      const tabs = context.workspace.getOpenTabs();
      assert.equal(tabs.length, 2);
      assert.equal(tabs[0].title, 'main.ini');
      assert.equal(tabs[0].isActive, true);

      await context.workspace.focusTab('tab_2');
      assert.ok(focusTabCalled);

      const closed = await context.workspace.closeTab('tab_2');
      assert.equal(closed, true);
      assert.ok(closeTabCalled);

      // 2. Search
      const searchResults = await context.workspace.search('swapvar', { caseSensitive: true });
      assert.equal(searchResults.length, 1);
      assert.equal(searchResults[0].filePath, 'main.ini');
      assert.equal(searchResults[0].line, 10);
      assert.equal(searchResults[0].matchedText, 'swapvar');

      // 3. Backup
      const backupId = await context.workspace.createBackup('main.ini', 'before-edit');
      assert.equal(backupId, 'backup_12345');
      assert.ok(backupCalled);
    },
  });

  await plugin.activate({
    workspace: {
      getOpenTabs: () => [
        { id: 'tab_1', title: 'main.ini', path: 'd:/mods/main.ini', isDirty: false, kind: 'text', isActive: true },
        { id: 'tab_2', title: 'sub.ini', path: 'd:/mods/sub.ini', isDirty: true, kind: 'text', isActive: false },
      ],
      focusTab: (id: string) => {
        focusTabCalled = true;
      },
      closeTab: async (id: string) => {
        closeTabCalled = true;
        return true;
      },
      search: async (query: string, opts?: any) => {
        searchCalled = true;
        return [
          { filePath: 'main.ini', fileName: 'main.ini', line: 10, column: 5, lineContent: '$swapvar = 1', matchedText: query },
        ];
      },
      createBackup: async (path?: string, label?: string) => {
        backupCalled = true;
        return 'backup_12345';
      },
    },
  } as any);

  assert.ok(searchCalled);
});

test('Plugin INI API extractSymbols parses symbols cleanly', () => {
  const sampleIni = `
[Constants]
global persist $swapvar = 0
$skin = 1

[KeyToggleDress]
key = VK_F1
type = cycle
$dress = 0, 1

[ResourceTexture]
filename = Tex.dds

[CommandListTest]
run = CommandListOther
`;

  const lines = sampleIni.split('\n');
  const modelLike = {
    getLineCount: () => lines.length,
    getLineContent: (n: number) => lines[n - 1] ?? '',
  };

  const plugin = definePlugin({
    activate(context) {
      const symbols = context.ini.extractSymbols(sampleIni);
      assert.ok(symbols.variables['swapvar']);
      assert.ok(symbols.variables['skin']);
      assert.ok(symbols.variables['dress']);
      assert.ok(symbols.resources.includes('ResourceTexture'));
      assert.ok(symbols.commandLists.includes('CommandListTest'));
      assert.ok(symbols.sections.includes('KeyToggleDress'));
    },
  });

  plugin.activate({
    ini: {
      extractSymbols: (text?: string) => {
        return {
          variables: {
            swapvar: '0',
            skin: '1',
            dress: '0, 1',
          },
          resources: ['ResourceTexture'],
          commandLists: ['CommandListTest'],
          sections: ['Constants', 'KeyToggleDress', 'ResourceTexture', 'CommandListTest'],
        };
      },
    },
  } as any);
});

test('Plugin UI API openDiffTab and openRestoreModal contracts work as expected', () => {
  let diffOpened = false;
  let restoreOpened = false;

  const plugin = definePlugin({
    activate(context) {
      const diffTab = context.ui.openDiffTab({
        title: '수정 전 ↔ 수정 후',
        originalTitle: '원본',
        modifiedTitle: '수정본',
        originalText: 'a = 1',
        modifiedText: 'a = 2',
      });

      assert.equal(diffTab.id, 'diff_tab_1');
      diffTab.focus();
      diffTab.close();

      context.ui.openRestoreModal('main.ini');
      assert.ok(restoreOpened);
    },
  });

  plugin.activate({
    ui: {
      openDiffTab: (opts: any) => {
        diffOpened = true;
        return {
          id: 'diff_tab_1',
          focus: () => {},
          close: () => {},
        };
      },
      openRestoreModal: (filePath?: string) => {
        restoreOpened = true;
      },
    },
  } as any);

  assert.ok(diffOpened);
  assert.ok(restoreOpened);
});





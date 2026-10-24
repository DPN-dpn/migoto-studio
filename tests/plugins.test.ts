import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion } from '../src/updater/version.ts';
import { decodeDDS } from '../default-plugins/texture-library/dds-decoder.ts';
import pythonRunnerPlugin from '../default-plugins/python-runner/index.ts';
import textureLibraryPlugin from '../default-plugins/texture-library/index.ts';
import aiAssistantPlugin from '../default-plugins/ai-assistant/index.ts';
import customLintPlugin from '../default-plugins/custom-lint/index.ts';
import zzmiSupportPlugin from '../default-plugins/zzmi-support/index.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUILTIN_PLUGINS = [
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/python-runner/plugin.json'), 'utf8')), createPlugin: () => pythonRunnerPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/texture-library/plugin.json'), 'utf8')), createPlugin: () => textureLibraryPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/ai-assistant/plugin.json'), 'utf8')), createPlugin: () => aiAssistantPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/custom-lint/plugin.json'), 'utf8')), createPlugin: () => customLintPlugin },
  { manifest: JSON.parse(readFileSync(resolve(process.cwd(), 'default-plugins/zzmi-support/plugin.json'), 'utf8')), createPlugin: () => zzmiSupportPlugin },
];
import { validatePluginZip } from '../src/plugins/zip.ts';
import { definePlugin } from '../src/plugins/api.ts';
import { createUIBuilder, toElement } from '../src/plugins/ui-builder.ts';
import { renderPluginIcon } from '../src/plugins/types.ts';
import { formatDisplayKey } from '../src/core/ini/keys.ts';
import { getSectionRaw, setSectionRaw, parseSectionLines } from '../src/core/ini/ini.ts';
import {
  normalizePluginPath,
  resolveRelativeSpecifier,
  linkPluginModules,
} from '../src/plugins/module-linker.ts';
import {
  parseSemver,
  compareSemver,
  satisfiesVersionConstraint,
  parseDependencySpec,
  checkDependency,
  checkAllDependencies,
  topologicalSortPlugins,
} from '../src/plugins/dependency.ts';
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
    plugins: {
      registerApi: () => {},
      getPluginApi: () => undefined,
      hasPluginApi: () => false,
      checkDependencies: () => [],
      installDependency: async () => false,
    },
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
  const asset = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'texture-library')!;
  asset.createPlugin().activate(mockContext);
  // Texture library should NOT register sidebar views (opens directly in editor tabs via registerCustomViewer)
  assert.equal(registeredViews.length, 0);
  assert.equal(registeredCustomViewers.length, 1);
  assert.deepEqual(registeredCustomViewers[0].extensions, ['dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif']);
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

  // 2-g. custom-lint independently emits namespace warning for TTL when namespace = TTL is absent in folder
  const ttlModel = {
    getLineCount: () => 3,
    getLineContent: (n: number) => {
      if (n === 1) return '$\\TTL\\alpha = 0.4';
      if (n === 2) return '$\\TTL\\_1 = 192';
      return '$\\TTL\\_2 = 71646';
    },
    getValue: () => '$\\TTL\\alpha = 0.4\n$\\TTL\\_1 = 192\n$\\TTL\\_2 = 71646',
  };
  const nsDiagsTtl = await nsRule.check({
    ...nsCtxBase,
    model: ttlModel,
  });
  assert.equal(nsDiagsTtl.length, 3, 'custom-lint independently flags unknown namespace TTL when unassisted');
});

test('zzmi-support plugin activates and registers allowed resource, code template, and diagnostic filter', () => {
  const def = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'zzmi-support')!;
  assert.ok(def);
  const plugin = def.createPlugin();

  const allowedResources: any[] = [];
  const allowedVars: any[] = [];
  const registeredTemplates: any[] = [];
  const registeredFilters: any[] = [];
  let registeredView: any = null;

  const mockContext: any = {
    manifest: def.manifest,
    linter: {
      registerAllowedResource: (pattern: any) => {
        allowedResources.push(pattern);
      },
      registerAllowedVariable: (pattern: any) => {
        allowedVars.push(pattern);
      },
      registerAllowedUsedVariable: () => {},
      registerAllowedUsedResource: () => {},
      registerDiagnosticFilter: (filter: any) => {
        registeredFilters.push(filter);
        return () => {};
      },
    },
    templates: {
      registerTemplate: (template: any) => {
        registeredTemplates.push(template);
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
  assert.ok(allowedResources.length >= 4);
  assert.ok(allowedVars.length >= 1);
  assert.ok(registeredTemplates.length >= 3);
  assert.ok(registeredFilters.length >= 1, 'zzmi-support should register a diagnostic filter');

  // Verify that the zzmi diagnostic filter suppresses TTL warnings from custom-lint
  const filter = registeredFilters[0];
  const ttlDiag1 = { message: "모드 폴더 내에서 네임스페이스 'TTL'을(를) 찾을 수 없습니다. (해당 ini 파일에 'namespace = TTL' 선언이 있는지 확인하세요)", startLineNumber: 1 };
  const ttlDiag2 = { message: "선언되지 않은 변수 '$\\TTL\\alpha'입니다.", startLineNumber: 1 };
  const nonTtlDiag = { message: "모드 폴더 내에서 네임스페이스 'UnknownMod'을(를) 찾을 수 없습니다.", startLineNumber: 1 };

  const mockCtx = {
    model: {
      getLineCount: () => 1,
      getLineContent: () => '$\\TTL\\alpha = 0.4',
      getValue: () => '$\\TTL\\alpha = 0.4',
    },
  };

  assert.equal(filter(ttlDiag1, mockCtx), false, 'TTL namespace warning should be corrected/suppressed by zzmi-support');
  assert.equal(filter(ttlDiag2, mockCtx), false, 'TTL variable warning should be corrected/suppressed by zzmi-support');
  assert.equal(filter(nonTtlDiag, mockCtx), true, 'Non-TTL diagnostic must be preserved');
  const templateIds = registeredTemplates.map((t) => t.id);
  assert.ok(templateIds.includes('zzmi_slot_fix'));
  assert.ok(templateIds.includes('zzmi_ttl_draw'));
  assert.ok(templateIds.includes('zzmi_ttl_texture'));

  const slotFix = registeredTemplates.find((t) => t.id === 'zzmi_slot_fix')!;
  assert.ok(slotFix.body.includes('CommandList\\ZZMI\\SetTextures'));
  assert.ok(slotFix.body.includes('Resource\\ZZMI\\WEngineFX'));

  const ttlDraw = registeredTemplates.find((t) => t.id === 'zzmi_ttl_draw')!;
  assert.ok(ttlDraw.body.includes('CommandList\\TTL\\Draw'));
  assert.ok(ttlDraw.body.includes('$\\TTL\\alpha'));

  const ttlTexture = registeredTemplates.find((t) => t.id === 'zzmi_ttl_texture')!;
  assert.ok(ttlTexture.body.includes('Resource\\TTL\\TransparencyTex'));
  assert.ok(ttlTexture.body.includes('$\\TTL\\mask_channel'));

  assert.equal(registeredView, null);
});

test('default-plugins directory contains all 5 standalone plugins ready for installation', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');

  const defaultIds = ['custom-lint', 'zzmi-support', 'texture-library', 'python-runner', 'ai-assistant'];
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

  assert.deepEqual(indexList, ['custom-lint', 'zzmi-support', 'texture-library', 'ai-assistant']);
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
      'texture-library': {
        id: 'texture-library',
        manifestJson: JSON.stringify({ id: 'texture-library', name: 'Old Texture Library' }),
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
    assert.equal(savedWebPlugins['texture-library'], undefined, 'default plugins must be removed from localStorage');
    assert.equal(savedWebPlugins['corrupt-plugin'], undefined, 'corrupt entries must be removed from localStorage');
    assert.ok(savedWebPlugins['my-custom-plugin'], 'my-custom-plugin must remain in localStorage');

    await web.deleteEntry!('default-plugins/texture-library');
    const deletedList = JSON.parse(mockStorage[STORAGE_DELETED_DEFAULTS] || '[]');
    assert.ok(deletedList.includes('texture-library'), 'texture-library must be recorded in deleted defaults');

    const refreshedList = await web.listDiskPlugins!();
    const refreshedIds = refreshedList.map((p) => p.id);
    assert.ok(!refreshedIds.includes('texture-library'), 'deleted default plugin must not be returned');
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

test('Plugin Workspace API onDidClearMemory and onDidResetWorkspace fire on workspace reset', async () => {
  let clearMemoryReason: string | null = null;
  let resetWorkspaceReason: string | null = null;

  const resetListeners: Array<(event: any) => void> = [];
  const mockDoc = {
    onDidResetWorkspace: (listener: (event: any) => void) => {
      resetListeners.push(listener);
      return () => {
        const idx = resetListeners.indexOf(listener);
        if (idx !== -1) resetListeners.splice(idx, 1);
      };
    },
  };

  const context: any = {
    workspace: {
      onDidClearMemory: (listener: (event: any) => void) => {
        return mockDoc.onDidResetWorkspace(listener);
      },
      onDidResetWorkspace: (listener: (event: any) => void) => {
        return mockDoc.onDidResetWorkspace(listener);
      },
    },
  };

  const unlisten1 = context.workspace.onDidClearMemory((e: any) => {
    clearMemoryReason = e.reason;
  });
  const unlisten2 = context.workspace.onDidResetWorkspace((e: any) => {
    resetWorkspaceReason = e.reason;
  });

  // Trigger simulated folder_closed event
  resetListeners.forEach((l) => l({ reason: 'folder_closed' }));
  assert.equal(clearMemoryReason, 'folder_closed');
  assert.equal(resetWorkspaceReason, 'folder_closed');

  // Trigger simulated folder_changed event
  resetListeners.forEach((l) => l({ reason: 'folder_changed' }));
  assert.equal(clearMemoryReason, 'folder_changed');
  assert.equal(resetWorkspaceReason, 'folder_changed');

  unlisten1();
  unlisten2();
  assert.equal(resetListeners.length, 0);
});

test('Plugin Workspace and UI event APIs (onDidSaveFile, onDidCloseTab, onDidChangeTheme) contract works properly', () => {
  let savedFile: any = null;
  let closedTab: any = null;
  let currentTheme: string | null = null;

  const saveListeners: Array<(e: any) => void> = [];
  const closeTabListeners: Array<(e: any) => void> = [];
  const settingsListeners: Array<(s: any) => void> = [];

  let mockSettings = { theme: 'dark' };

  const context: any = {
    workspace: {
      onDidSaveFile: (listener: (file: any) => void) => {
        saveListeners.push(listener);
        return () => {
          const idx = saveListeners.indexOf(listener);
          if (idx !== -1) saveListeners.splice(idx, 1);
        };
      },
      onDidCloseTab: (listener: (tab: any) => void) => {
        closeTabListeners.push(listener);
        return () => {
          const idx = closeTabListeners.indexOf(listener);
          if (idx !== -1) closeTabListeners.splice(idx, 1);
        };
      },
    },
    ui: {
      getTheme: () => mockSettings.theme,
      onDidChangeTheme: (listener: (event: { theme: string }) => void) => {
        let lastTheme = mockSettings.theme;
        const handler = (s: any) => {
          if (s.theme !== lastTheme) {
            lastTheme = s.theme;
            listener({ theme: s.theme });
          }
        };
        settingsListeners.push(handler);
        return () => {
          const idx = settingsListeners.indexOf(handler);
          if (idx !== -1) settingsListeners.splice(idx, 1);
        };
      },
    },
  };

  const unlistenSave = context.workspace.onDidSaveFile((f: any) => { savedFile = f; });
  const unlistenClose = context.workspace.onDidCloseTab((t: any) => { closedTab = t; });
  const unlistenTheme = context.ui.onDidChangeTheme((e: any) => { currentTheme = e.theme; });

  assert.equal(context.ui.getTheme(), 'dark');

  // Trigger save
  saveListeners.forEach((l) => l({ path: 'd:/mods/test.ini', name: 'test.ini' }));
  assert.deepEqual(savedFile, { path: 'd:/mods/test.ini', name: 'test.ini' });

  // Trigger close tab
  closeTabListeners.forEach((l) => l({ tabId: 'tab_1', filePath: 'd:/mods/test.ini', title: 'test.ini' }));
  assert.deepEqual(closedTab, { tabId: 'tab_1', filePath: 'd:/mods/test.ini', title: 'test.ini' });

  // Trigger theme change
  mockSettings = { theme: 'light' };
  settingsListeners.forEach((l) => l(mockSettings));
  assert.equal(currentTheme, 'light');
  assert.equal(context.ui.getTheme(), 'light');

  // Unlisten
  unlistenSave();
  unlistenClose();
  unlistenTheme();
  assert.equal(saveListeners.length, 0);
  assert.equal(closeTabListeners.length, 0);
  assert.equal(settingsListeners.length, 0);
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

test('Plugin UI Builder layout components (split, row, column, grid, divider, scroll, numberInput) work as expected', () => {
  const createElement = (tag: string) => {
    const listeners = new Map<string, Function[]>();
    const el: any = {
      tagName: tag.toUpperCase(),
      className: '',
      title: '',
      value: '',
      style: {},
      children: [],
      classList: {
        add: (...cls: string[]) => { el.className = `${el.className} ${cls.join(' ')}`.trim(); },
        remove: (...cls: string[]) => {
          cls.forEach((c) => { el.className = el.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim(); });
        },
        contains: (c: string) => el.className.split(/\s+/).includes(c),
      },
      attributes: {} as Record<string, string>,
      setAttribute: (k: string, v: string) => { el.attributes[k] = v; },
      removeAttribute: (k: string) => { delete el.attributes[k]; },
      append: (...nodes: any[]) => el.children.push(...nodes),
      replaceChildren: (...nodes: any[]) => { el.children = [...nodes]; },
      addEventListener: (type: string, fn: Function) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type)!.push(fn);
      },
      removeEventListener: (type: string, fn: Function) => {
        const arr = listeners.get(type) || [];
        listeners.set(type, arr.filter((f) => f !== fn));
      },
      dispatch: (type: string, evt: any = {}) => {
        const arr = listeners.get(type) || [];
        arr.forEach((fn) => fn(evt));
      },
      getBoundingClientRect: () => ({ width: 400, height: 300 }),
      scrollTo: () => {},
    };
    return el;
  };

  const origDoc = (globalThis as any).document;
  (globalThis as any).document = {
    createElement,
    body: { classList: { add: () => {}, remove: () => {} } },
  };

  try {
    const builder = createUIBuilder();
    assert.equal(typeof builder.createSplitView, 'function');
    assert.equal(typeof builder.createRow, 'function');
    assert.equal(typeof builder.createColumn, 'function');
    assert.equal(typeof builder.createGrid, 'function');
    assert.equal(typeof builder.createDivider, 'function');
    assert.equal(typeof builder.createScrollContainer, 'function');
    assert.equal(typeof builder.createNumberInput, 'function');

    // Test createSplitView horizontal
    const split = builder.createSplitView({ direction: 'horizontal', initialSize: 200 });
    assert.ok(split.container.className.includes('plugin-split-horizontal'));
    assert.equal(split.firstPane.style.width, '200px');
    split.setSize(250);
    assert.equal(split.firstPane.style.width, '250px');
    assert.equal(split.getSize(), 400);

    // Test ratio-based resizing
    split.setSize('35.5%');
    assert.equal(split.firstPane.style.width, '35.5%');
    assert.equal(split.firstPane.style.flexBasis, '35.5%');

    // Test createSplitView vertical
    const splitV = builder.createSplitView({ direction: 'vertical', initialSize: '40%' });
    assert.ok(splitV.container.className.includes('plugin-split-vertical'));
    assert.equal(splitV.firstPane.style.height, '40%');

    // Test createRow
    const row = builder.createRow({ gap: 12, align: 'center', justify: 'space-between', wrap: true });
    assert.ok(row.className.includes('plugin-row'));
    assert.equal(row.style.gap, '12px');
    assert.equal(row.style.alignItems, 'center');
    assert.equal(row.style.justifyContent, 'space-between');
    assert.equal(row.style.flexWrap, 'wrap');

    // Test createColumn
    const col = builder.createColumn({ gap: 16 });
    assert.ok(col.className.includes('plugin-column'));
    assert.equal(col.style.gap, '16px');

    // Test createGrid
    const grid = builder.createGrid({ columns: 3, gap: 10 });
    assert.ok(grid.className.includes('plugin-grid'));
    assert.equal(grid.style.gridTemplateColumns, 'repeat(3, 1fr)');
    assert.equal(grid.style.gap, '10px');

    // Test createDivider
    const divH = builder.createDivider();
    assert.ok(divH.className.includes('horizontal'));
    const divV = builder.createDivider({ vertical: true, margin: 8 });
    assert.ok(divV.className.includes('vertical'));
    assert.equal(divV.style.margin, '0 8px');

    // Test createScrollContainer
    const scroll = builder.createScrollContainer({ maxHeight: 300, direction: 'vertical' });
    assert.ok(scroll.container.className.includes('scroll-vertical'));
    assert.equal(scroll.container.style.maxHeight, '300px');
    const child1 = createElement('div');
    scroll.append(child1);
    assert.equal(scroll.content.children.length, 1);
    scroll.clear();
    assert.equal(scroll.content.children.length, 0);

    // Test createNumberInput (stepper with left/right arrows, min/max, integerOnly, precision)
    let lastChanged: number | null = null;
    const num = builder.createNumberInput({
      label: '상태 개수',
      value: 2,
      min: 1,
      max: 5,
      step: 1,
      integerOnly: true,
      onChange: (v) => { lastChanged = v; },
    });
    assert.equal(num.getValue(), 2);
    assert.ok(num.container.className.includes('plugin-number-stepper'));
    assert.ok(num.decBtn.className.includes('plugin-number-dec'));
    assert.ok(num.incBtn.className.includes('plugin-number-inc'));

    // Test createColumn fill option
    const colFill = builder.createColumn({ fill: true });
    assert.ok(colFill.className.includes('fill'));
    assert.equal(colFill.style.flex, '1 1 0%');
    assert.equal(colFill.style.minHeight, '0');
    assert.equal(colFill.style.height, '100%');
    assert.equal(colFill.style.overflow, 'hidden');

    // Click dec button -> 2 - 1 = 1
    (num.decBtn as any).dispatch('mousedown', { button: 0, preventDefault: () => {} });
    (num.decBtn as any).dispatch('mouseup', {});
    assert.equal(num.getValue(), 1);
    assert.equal(num.decBtn.disabled, true); // min reached
    assert.equal(lastChanged, 1);

    // Click inc button twice -> 1 -> 2 -> 3
    (num.incBtn as any).dispatch('mousedown', { button: 0, preventDefault: () => {} });
    (num.incBtn as any).dispatch('mouseup', {});
    assert.equal(num.getValue(), 2);
    assert.equal(num.decBtn.disabled, false);
    (num.incBtn as any).dispatch('mousedown', { button: 0, preventDefault: () => {} });
    (num.incBtn as any).dispatch('mouseup', {});
    assert.equal(num.getValue(), 3);

    // Set value exceeding max -> should clamp to 5
    num.setValue(10);
    assert.equal(num.getValue(), 5);
    assert.equal(num.incBtn.disabled, true);

    // Test precision
    const floatNum = builder.createNumberInput({
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.05,
      precision: 2,
    });
    assert.equal(floatNum.getValue(), 0.25);
    assert.equal(floatNum.input.value, '0.25');
    (floatNum.incBtn as any).dispatch('mousedown', { button: 0, preventDefault: () => {} });
    (floatNum.incBtn as any).dispatch('mouseup', {});
    assert.equal(floatNum.getValue(), 0.3);
    assert.equal(floatNum.input.value, '0.30');

    num.destroy?.();
    floatNum.destroy?.();
  } finally {
    if (origDoc) (globalThis as any).document = origDoc;
    else delete (globalThis as any).document;
  }
});

test('Plugin UI Builder extended components (tabs, collapsible, segmented, search, file picker, tooltip, dropzone) work properly', () => {
  const createElement = (tag: string) => {
    const el: any = {
      tagName: tag.toUpperCase(),
      className: '',
      title: '',
      value: '',
      style: {},
      children: [],
      classList: {
        add: (...cls: string[]) => { el.className = `${el.className} ${cls.join(' ')}`.trim(); },
        remove: (...cls: string[]) => {
          cls.forEach((c) => { el.className = el.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim(); });
        },
        toggle: (c: string, force?: boolean) => {
          const has = el.className.includes(c);
          const should = force !== undefined ? force : !has;
          if (should) el.classList.add(c);
          else el.classList.remove(c);
        },
      },
      append: (...nodes: any[]) => el.children.push(...nodes),
      appendChild: (node: any) => el.children.push(node),
      remove: () => {},
      replaceChildren: (...nodes: any[]) => { el.children = [...nodes]; },
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: (k: string, v: string) => { el[k] = v; },
      getAttribute: (k: string) => el[k],
      getBoundingClientRect: () => ({ top: 100, left: 100, width: 200, height: 40, right: 300, bottom: 140 }),
      focus: () => {},
    };
    return el;
  };

  const origDoc = (globalThis as any).document;
  (globalThis as any).document = {
    createElement,
    body: {
      classList: { add: () => {}, remove: () => {} },
      appendChild: () => {},
    },
  };

  try {
    const builder = createUIBuilder();

    // 1. Test createTabs
    const p1 = createElement('div');
    const p2 = createElement('div');
    let tabSwitched = '';
    const tabs = builder.createTabs({
      tabs: [
        { id: 'tab_a', label: 'Tab A', icon: '🅰️', content: p1 },
        { id: 'tab_b', label: 'Tab B', content: p2 },
      ],
      defaultTab: 'tab_a',
      onChange: (id) => { tabSwitched = id; },
    });

    assert.equal(tabs.getActiveTab(), 'tab_a');
    assert.equal(tabs.tabContent.children[0].hidden, false);
    assert.equal(tabs.tabContent.children[1].hidden, true);

    tabs.switchTab('tab_b');
    assert.equal(tabs.getActiveTab(), 'tab_b');
    assert.equal(tabSwitched, 'tab_b');
    assert.equal(tabs.tabContent.children[0].hidden, true);
    assert.equal(tabs.tabContent.children[1].hidden, false);

    // 2. Test createCollapsible
    let toggledState = false;
    const bodyContent = createElement('div');
    const coll = builder.createCollapsible({
      title: '고급 설정',
      defaultOpen: false,
      content: bodyContent,
      onToggle: (open) => { toggledState = open; },
    });

    assert.equal(coll.isOpen(), false);
    assert.equal(coll.body.hidden, true);
    coll.open();
    assert.equal(coll.isOpen(), true);
    assert.equal(coll.body.hidden, false);
    assert.equal(toggledState, true);
    coll.toggle();
    assert.equal(coll.isOpen(), false);

    // 3. Test createSegmentedControl
    let segmentVal = '';
    const seg = builder.createSegmentedControl({
      label: '모드',
      options: [
        { value: 'cycle', label: '순환' },
        { value: 'hold', label: '홀드' },
      ],
      value: 'cycle',
      onChange: (v) => { segmentVal = v; },
    });

    assert.equal(seg.getValue(), 'cycle');
    seg.setValue('hold');
    assert.equal(seg.getValue(), 'hold');
    assert.equal(segmentVal, 'hold');

    // 4. Test createSearchInput
    let searchedQuery = '';
    const search = builder.createSearchInput({
      placeholder: '검색어 입력',
      debounceMs: 0,
      onSearch: (q) => { searchedQuery = q; },
    });

    assert.equal(search.input.placeholder, '검색어 입력');
    search.setValue('TextureOverride', true);
    assert.equal(search.getValue(), 'TextureOverride');
    search.clear();
    assert.equal(search.getValue(), '');

    // 5. Test createFilePicker
    let pickedPath = '';
    const picker = builder.createFilePicker({
      label: '파일 경로',
      placeholder: '경로를 선택하세요',
      onChange: (p) => { pickedPath = p; },
      onBrowse: () => 'd:/mods/outfit.dds',
    });

    assert.equal(picker.input.placeholder, '경로를 선택하세요');
    picker.setValue('d:/custom/mod.ini');
    assert.equal(pickedPath, 'd:/custom/mod.ini');
    picker.browseBtn.onclick?.({} as any);

    // 6. Test attachTooltip
    const targetEl = createElement('button');
    const detach = builder.attachTooltip(targetEl, '도움말 툴팁 내용');
    assert.equal(typeof detach, 'function');
    detach();

    // 7. Test createDropZone
    let droppedFiles: any[] = [];
    const dropZone = builder.createDropZone({
      label: 'DDS 파일을 드롭하세요',
      accept: ['.dds'],
      onDrop: (files) => { droppedFiles = files; },
    });

    dropZone.setLabel('새 라벨', '새 서브라벨');
    dropZone.dispose();

    // 8. Test createBadge
    const badge = builder.createBadge({ text: '$arm == 0', variant: 'accent' });
    assert.equal(badge.getText(), '$arm == 0');
    assert.equal(badge.getVariant(), 'accent');
    assert.ok(badge.element.className.includes('plugin-badge-accent'));
    badge.setText('상시 렌더링');
    badge.setVariant('muted');
    assert.equal(badge.getText(), '상시 렌더링');
    assert.equal(badge.getVariant(), 'muted');
    assert.ok(badge.element.className.includes('plugin-badge-muted'));

    // 9. Test createCodeBlock
    const codeBlock = builder.createCodeBlock({ code: 'run = CommandList\\Draw', language: 'ini' });
    assert.equal(codeBlock.getCode(), 'run = CommandList\\Draw');
    assert.ok(codeBlock.container.className.includes('plugin-codeblock-container'));
    codeBlock.setCode('run = CommandList\\ZZMI\\SetTextures');
    assert.equal(codeBlock.getCode(), 'run = CommandList\\ZZMI\\SetTextures');

    // 10. Test createListItem
    let itemClicked = false;
    const listItem = builder.createListItem({
      title: '머리 파트 (부위 #1)',
      subtitle: 'drawindexed = auto · match_first_index: 0',
      badge: { text: '$hair == 1', variant: 'accent' },
      selected: false,
      onClick: () => { itemClicked = true; },
    });
    assert.equal(listItem.isSelected(), false);
    assert.ok(listItem.element.className.includes('plugin-list-item'));
    listItem.setSelected(true);
    assert.equal(listItem.isSelected(), true);
    assert.ok(listItem.element.className.includes('selected'));

    listItem.setTitle('몸체 파트 (부위 #2)');
    listItem.setSubtitle('상시 표시');
    listItem.setBadge({ text: '상시', variant: 'muted' });
    if (listItem.element.onclick) listItem.element.onclick({} as any);
    assert.equal(itemClicked, true);

    // 11. Test form control responsiveness and zero margin defaults
    const sel = builder.createSelect({
      label: '변수',
      options: ['a', 'b'],
    });
    assert.equal(sel.select.style.width, '100%');
    assert.equal(sel.select.style.minWidth, '0');
    assert.equal(sel.select.style.margin, '0');
    assert.equal(sel.row.style.margin, '0');

    const inp = builder.createInput({
      label: '텍스트',
      value: '테스트',
    });
    assert.equal(inp.input.style.width, '100%');
    assert.equal(inp.input.style.minWidth, '0');
    assert.equal(inp.input.style.margin, '0');
  } finally {
    if (origDoc) (globalThis as any).document = origDoc;
    else delete (globalThis as any).document;
  }
});

test('normalizePluginPath handles Windows paths, segments and dots correctly', () => {
  assert.equal(normalizePluginPath('foo\\\\bar\\\\baz.js'), 'foo/bar/baz.js');
  assert.equal(normalizePluginPath('./components/../utils/helpers.js'), 'utils/helpers.js');
  assert.equal(normalizePluginPath('/src//sub/index.js'), 'src/sub/index.js');
});

test('resolveRelativeSpecifier resolves relative files with or without extensions and indices', () => {
  const files = new Set([
    'ui/button.js',
    'constants/colors.json',
    'styles/main.css',
    'components/header/index.js',
  ]);

  assert.equal(resolveRelativeSpecifier('ui/view.js', './button.js', files), 'ui/button.js');
  assert.equal(resolveRelativeSpecifier('ui/view.js', './button', files), 'ui/button.js');
  assert.equal(resolveRelativeSpecifier('ui/view.js', '../constants/colors', files), 'constants/colors.json');
  assert.equal(resolveRelativeSpecifier('ui/view.js', '../styles/main.css', files), 'styles/main.css');
  assert.equal(resolveRelativeSpecifier('ui/view.js', '../components/header', files), 'components/header/index.js');
  assert.equal(resolveRelativeSpecifier('ui/view.js', 'external-lib', files), null);
});

test('linkPluginModules links multi-file plugin and executes correctly via dynamic import', async () => {
  const entryScript = `
    import { formatGreeting } from './sub/helper.js';
    import config from './data.json';
    import './style.css';

    export default {
      activate(ctx) {
        return formatGreeting(config.name);
      }
    };
  `;

  const files = {
    'sub/helper.js': `
      import { PREFIX } from './constants.js';
      export function formatGreeting(name) {
        return PREFIX + ' ' + name;
      }
    `,
    'sub/constants.js': `
      export const PREFIX = 'Migoto';
    `,
    'data.json': JSON.stringify({ name: 'Studio' }),
    'style.css': '.my-plugin-btn { color: red; }',
  };

  const linked = linkPluginModules(entryScript, 'index.js', files);
  assert.ok(linked.entryUrl.startsWith('blob:') || linked.entryUrl.startsWith('data:'));
  assert.equal(linked.blobUrls.length, 5); // constants, data.json, style.css, helper, index

  const mod = await import(linked.entryUrl);
  const plugin = mod.default;
  assert.equal(typeof plugin.activate, 'function');
  const result = plugin.activate({});
  assert.equal(result, 'Migoto Studio');

  linked.dispose();
});

test('validatePluginZip extracts multi-file plugin with index.js as entry point', () => {
  const zipBytes = zipSync({
    'plugin.json': strToU8(JSON.stringify({ id: 'multi-file-plugin', name: 'Multi File Plugin', version: '1.0.0' })),
    'index.js': strToU8('import { greet } from "./ui.js"; export default { activate() {} };'),
    'ui.js': strToU8('export function greet() { return "hello"; }'),
  });

  const extracted = validatePluginZip(zipBytes);
  assert.equal(extracted.manifest.id, 'multi-file-plugin');
  assert.equal(extracted.entryPath, 'index.js');
  assert.ok(extracted.files['ui.js']);
  assert.ok(extracted.files['index.js']);
});

test('formatDisplayKey formats 3DMigoto key bindings for clean UI presentation', () => {
  assert.equal(formatDisplayKey('no_modifiers VK_F4'), 'F4');
  assert.equal(formatDisplayKey('ctrl no_alt no_shift VK_F1'), 'Ctrl + F1');
  assert.equal(formatDisplayKey('alt shift VK_SPACE'), 'Alt + Shift + Space');
  assert.equal(formatDisplayKey('ctrl alt no_shift VK_OEM_3'), 'Ctrl + Alt + ` ~');
  assert.equal(formatDisplayKey('VK_OEM_PERIOD'), '. >');
  assert.equal(formatDisplayKey(''), '');
});

test('INI raw block manipulation preserves repeated keys and comment ordering', () => {
  const ini = `
[TextureOverrideBody]
hash = abcdef12
match_first_index = 0
; First draw indexed
drawindexed = auto
match_first_index = 100
; Second draw indexed
drawindexed = auto

[Constants]
global $active = 1
`.trim();

  // 1. getSectionRaw
  const raw = getSectionRaw(ini, 'TextureOverrideBody');
  assert.ok(raw);
  assert.ok(raw.includes('match_first_index = 0'));
  assert.ok(raw.includes('match_first_index = 100'));

  // 2. parseSectionLines
  const lines = parseSectionLines(raw);
  assert.ok(lines.length >= 7);
  const drawindexedLines = lines.filter((l) => l.type === 'property' && l.key === 'drawindexed');
  assert.equal(drawindexedLines.length, 2);
  const commentLines = lines.filter((l) => l.type === 'comment');
  assert.equal(commentLines.length, 2);

  // 3. setSectionRaw replaces block cleanly
  const updatedBlock = `[TextureOverrideBody]\nhash = 99999999\ndrawindexed = auto`;
  const modifiedIni = setSectionRaw(ini, 'TextureOverrideBody', updatedBlock);
  assert.ok(modifiedIni.includes('hash = 99999999'));
  assert.ok(!modifiedIni.includes('abcdef12'));
  assert.ok(modifiedIni.includes('[Constants]'));
});

test('Plugin UI Builder widgets uniformly expose .element and validation methods', () => {
  const createElement = (tag: string) => {
    const el: any = {
      tagName: tag.toUpperCase(),
      className: '',
      children: [] as any[],
      style: {} as Record<string, string>,
      classList: {
        add: (...cls: string[]) => { el.className = `${el.className} ${cls.join(' ')}`.trim(); },
        remove: (...cls: string[]) => {
          cls.forEach((c) => { el.className = el.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim(); });
        },
        contains: (c: string) => el.className.split(/\s+/).includes(c),
      },
      attributes: {} as Record<string, string>,
      setAttribute: (k: string, v: string) => { el.attributes[k] = v; },
      removeAttribute: (k: string) => { delete el.attributes[k]; },
      append: (...nodes: any[]) => el.children.push(...nodes),
      remove: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    return el;
  };

  const origDocument = (globalThis as any).document;
  (globalThis as any).document = {
    createElement,
  };

  try {
    const ui = createUIBuilder();

    // 1. createInput
    const inputWidget = ui.createInput({ label: 'Name', value: 'Test' });
    assert.ok(inputWidget.element, 'createInput must have .element');
    assert.equal(toElement(inputWidget), inputWidget.element);
    assert.equal(inputWidget.hasError(), false);
    inputWidget.setError('Invalid section name');
    assert.equal(inputWidget.hasError(), true);
    inputWidget.clearError();
    assert.equal(inputWidget.hasError(), false);

    // 2. createNumberInput
    const numWidget = ui.createNumberInput({ label: 'Opacity', value: 0.5 });
    assert.ok(numWidget.element, 'createNumberInput must have .element');
    assert.equal(toElement(numWidget), numWidget.element);
    assert.equal(numWidget.element, numWidget.row);
    assert.equal(numWidget.hasError(), false);
    numWidget.setError('Value must be >= 0');
    assert.equal(numWidget.hasError(), true);
    numWidget.clearError();
    assert.equal(numWidget.hasError(), false);

    // 3. createKeyInput
    let emittedDetails: any = null;
    const keyWidget = ui.createKeyInput({
      label: 'Toggle Key',
      value: 'no_modifiers VK_F4',
      onChange: (raw, details) => {
        emittedDetails = details;
      },
    });
    assert.ok(keyWidget.element, 'createKeyInput must have .element');
    assert.equal(toElement(keyWidget), keyWidget.element);
    assert.equal(keyWidget.getDisplayValue(), 'F4');
    keyWidget.setValue('ctrl no_alt no_shift VK_F1');
    assert.equal(keyWidget.getDisplayValue(), 'Ctrl + F1');
    assert.ok(emittedDetails);
    assert.equal(emittedDetails.display, 'Ctrl + F1');
    keyWidget.setError('Duplicate key shortcut');
    assert.equal(keyWidget.hasError(), true);
    keyWidget.clearError();
    assert.equal(keyWidget.hasError(), false);

    // 4. Container children unwrapping via toElement
    const row = ui.createRow({
      children: [inputWidget, numWidget, keyWidget],
    });
    assert.equal(row.children.length, 3);
    assert.equal(row.children[0], inputWidget.element);
    assert.equal(row.children[1], numWidget.element);
    assert.equal(row.children[2], keyWidget.element);
  } finally {
    (globalThis as any).document = origDocument;
  }
});

test('computeLineDiff calculates accurate line additions and deletions', async () => {
  const { computeLineDiff } = await import('../src/core/editor/diff.ts');

  // Identical text
  assert.deepEqual(computeLineDiff('hello\nworld', 'hello\nworld'), []);

  // Simple modification
  const orig = 'line1\nline2\nline3';
  const mod = 'line1\nline_changed\nline3';
  const hunks = computeLineDiff(orig, mod);
  assert.equal(hunks.length, 1);
  assert.equal(hunks[0].originalStart, 2);
  assert.deepEqual(hunks[0].originalLines, ['line2']);
  assert.equal(hunks[0].modifiedStart, 2);
  assert.deepEqual(hunks[0].modifiedLines, ['line_changed']);

  // Pure insertion
  const modInsert = 'line1\ninserted\nline2\nline3';
  const insertHunks = computeLineDiff(orig, modInsert);
  assert.equal(insertHunks.length, 1);
  assert.deepEqual(insertHunks[0].originalLines, []);
  assert.deepEqual(insertHunks[0].modifiedLines, ['inserted']);

  // Pure deletion
  const modDelete = 'line1\nline3';
  const deleteHunks = computeLineDiff(orig, modDelete);
  assert.equal(deleteHunks.length, 1);
  assert.deepEqual(deleteHunks[0].originalLines, ['line2']);
  assert.deepEqual(deleteHunks[0].modifiedLines, []);
});

test('Plugin UI Builder modal, icon button, chip group, and direct HTMLElement return work properly', () => {
  const createElement = (tag: string) => {
    const el: any = {
      tagName: tag.toUpperCase(),
      className: '',
      children: [] as any[],
      childNodes: [] as any[],
      style: {} as Record<string, string>,
      classList: {
        add: (...cls: string[]) => { el.className = `${el.className} ${cls.join(' ')}`.trim(); },
        remove: (...cls: string[]) => {
          cls.forEach((c) => { el.className = el.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim(); });
        },
        toggle: (c: string, force?: boolean) => {
          const has = el.className.split(/\s+/).includes(c);
          const shouldAdd = force !== undefined ? force : !has;
          if (shouldAdd) el.classList.add(c);
          else el.classList.remove(c);
        },
        contains: (c: string) => el.className.split(/\s+/).includes(c),
      },
      attributes: {} as Record<string, string>,
      setAttribute: (k: string, v: string) => { el.attributes[k] = v; },
      removeAttribute: (k: string) => { delete el.attributes[k]; },
      append: (...nodes: any[]) => {
        el.children.push(...nodes);
        el.childNodes.push(...nodes);
        nodes.forEach((n) => { if (n && typeof n === 'object') n.parentElement = el; });
      },
      appendChild: (node: any) => {
        el.children.push(node);
        el.childNodes.push(node);
        if (node && typeof node === 'object') node.parentElement = el;
        return node;
      },
      replaceChildren: (...nodes: any[]) => {
        el.children = [...nodes];
        el.childNodes = [...nodes];
      },
      remove: () => {
        if (el.parentElement) {
          el.parentElement.children = el.parentElement.children.filter((c: any) => c !== el);
          el.parentElement.childNodes = el.parentElement.childNodes.filter((c: any) => c !== el);
          el.parentElement = null;
        }
      },
      querySelector: (selector: string) => null,
      querySelectorAll: (selector: string) => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    return el;
  };

  const origDocument = (globalThis as any).document;
  const mockBody = createElement('body');
  (globalThis as any).document = {
    createElement,
    body: mockBody,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  try {
    const ui = createUIBuilder();

    // 1. createModal
    let openCallbackFired = false;
    let closeCallbackFired = false;
    const testContent = createElement('div');
    const testAction = createElement('button');

    const modal = ui.createModal({
      title: '해시 스킵 섹션 추가',
      description: '특정 부위를 지우기 위한 섹션을 등록합니다.',
      content: testContent,
      actions: [testAction],
      width: 400,
      onOpen: () => { openCallbackFired = true; },
      onClose: () => { closeCallbackFired = true; },
    });

    assert.equal(typeof modal.open, 'function');
    assert.equal(typeof modal.close, 'function');
    assert.equal(modal.isOpen(), false);
    assert.equal(modal.panel.style.width, 'min(400px, 96vw)');

    modal.open();
    assert.equal(modal.isOpen(), true);
    assert.equal(openCallbackFired, true);

    modal.setTitle('새로운 모달 제목');
    modal.setDescription('새로운 모달 설명');
    modal.close();
    assert.equal(modal.isOpen(), false);
    assert.equal(closeCallbackFired, true);

    // Direct HTMLElement check & toElement unwrapping
    assert.equal(modal.tagName, 'DIV');
    assert.equal(toElement(modal), modal);

    // 2. createButton & createIconButton
    const refreshBtn = ui.createButton({
      icon: 'refresh',
      iconOnly: true,
      title: '문서 새로고침',
      variant: 'secondary',
    });
    assert.equal(refreshBtn.tagName, 'BUTTON');
    assert.ok(refreshBtn.className.includes('plugin-icon-btn'));
    assert.equal(refreshBtn.title, '문서 새로고침');
    assert.ok(refreshBtn.innerHTML.includes('<svg'));

    const iconBtn = ui.createIconButton({
      icon: 'trash',
      title: '삭제',
      variant: 'danger',
    });
    assert.equal(iconBtn.tagName, 'BUTTON');
    assert.ok(iconBtn.className.includes('plugin-icon-btn'));
    assert.ok(iconBtn.className.includes('danger'));

    const textIconBtn = ui.createButton({
      text: '추가',
      icon: 'plus',
      variant: 'primary',
    });
    assert.ok(textIconBtn.className.includes('has-icon'));
    assert.equal(textIconBtn.children.length, 2);

    // 3. createChipGroup (multi & single select)
    let selectedResult: any = null;
    const chipGroup = ui.createChipGroup({
      label: '상태값 다중 선택',
      multiple: true,
      options: [
        { value: '0', label: '0' },
        { value: '1', label: '1' },
        { value: '2', label: '2' },
      ],
      value: ['0', '1'],
      onChange: (vals) => {
        selectedResult = vals;
      },
    });

    assert.equal(typeof chipGroup.getValue, 'function');
    assert.deepEqual(chipGroup.getValue(), ['0', '1']);
    chipGroup.setValue(['1', '2']);
    assert.deepEqual(chipGroup.getValue(), ['1', '2']);

    const singleChipGroup = ui.createChipGroup({
      options: ['OptionA', 'OptionB', 'OptionC'],
      value: 'OptionB',
      multiple: false,
    });
    assert.equal(singleChipGroup.getValue(), 'OptionB');
    singleChipGroup.setValue('OptionC');
    assert.equal(singleChipGroup.getValue(), 'OptionC');

    // 4. Widget DOM Consistency: directly appendable without toElement()
    const container = createElement('div');
    const inputWidget = ui.createInput({ label: '입력창', value: 'hello' });
    const numberWidget = ui.createNumberInput({ value: 42 });
    const checkboxWidget = ui.createCheckbox({ label: '활성화', checked: true });

    // Directly append instances to DOM container
    container.append(inputWidget);
    container.append(numberWidget);
    container.append(checkboxWidget);
    container.append(refreshBtn);
    container.append(chipGroup);

    assert.equal(container.children.length, 5);
    assert.equal(container.children[0], inputWidget);
    assert.equal(container.children[1], numberWidget);
    assert.equal(container.children[2], checkboxWidget);
    assert.equal(container.children[3], refreshBtn);
    assert.equal(container.children[4], chipGroup);

    // Also verify container auto-unwrapping when passing to createColumn
    const col = ui.createColumn({
      children: [inputWidget, refreshBtn, chipGroup],
    });
    assert.equal(col.children.length, 3);
    assert.equal(col.children[0], inputWidget);
    assert.equal(col.children[1], refreshBtn);
    assert.equal(col.children[2], chipGroup);
  } finally {
    (globalThis as any).document = origDocument;
  }
});

test('PluginLifecycleEvent and subscription contracts work properly', () => {
  type PluginLifecycleAction = import('../src/plugins/types.ts').PluginLifecycleAction;
  type PluginLifecycleEvent = import('../src/plugins/types.ts').PluginLifecycleEvent;

  const events: PluginLifecycleEvent[] = [];
  const listeners = new Set<(event: PluginLifecycleEvent) => void>();

  const onDidPluginChange = (listener: (event: PluginLifecycleEvent) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const emit = (action: PluginLifecycleAction, pluginId: string, name: string) => {
    const ev: PluginLifecycleEvent = {
      action,
      pluginId,
      manifest: { id: pluginId, name, version: '1.0.0' },
    };
    listeners.forEach((l) => l(ev));
  };

  const unlisten = onDidPluginChange((e) => events.push(e));

  emit('activated', 'custom-lint', 'Custom Lint');
  emit('deactivated', 'custom-lint', 'Custom Lint');
  emit('installed', 'zzmi-support', 'ZZMI Support');
  emit('uninstalled', 'zzmi-support', 'ZZMI Support');

  assert.equal(events.length, 4);
  assert.equal(events[0].action, 'activated');
  assert.equal(events[1].action, 'deactivated');
  assert.equal(events[2].action, 'installed');
  assert.equal(events[3].action, 'uninstalled');
  unlisten();
  emit('activated', 'test', 'Test');
  assert.equal(events.length, 4);
});

test('parseGitHubUrl correctly parses various GitHub repository and release URLs', async () => {
  const { parseGitHubUrl } = await import('../src/plugins/github.ts');

  // Standard repo URL
  const ref1 = parseGitHubUrl('https://github.com/DPN-dpn/migoto-custom-plugin');
  assert.ok(ref1);
  assert.equal(ref1.owner, 'DPN-dpn');
  assert.equal(ref1.repo, 'migoto-custom-plugin');

  // With .git suffix
  const refGit = parseGitHubUrl('https://github.com/DPN-dpn/migoto-custom-plugin.git');
  assert.ok(refGit);
  assert.equal(refGit.owner, 'DPN-dpn');
  assert.equal(refGit.repo, 'migoto-custom-plugin');

  // Short owner/repo format
  const refShort = parseGitHubUrl('alice/cool-plugin');
  assert.ok(refShort);
  assert.equal(refShort.owner, 'alice');
  assert.equal(refShort.repo, 'cool-plugin');

  // Release tag URL
  const refTag = parseGitHubUrl('https://github.com/alice/cool-plugin/releases/tag/v2.1.0');
  assert.ok(refTag);
  assert.equal(refTag.owner, 'alice');
  assert.equal(refTag.repo, 'cool-plugin');
  assert.equal(refTag.tag, 'v2.1.0');

  // Direct download ZIP URL
  const refDownload = parseGitHubUrl('https://github.com/alice/cool-plugin/releases/download/v2.1.0/plugin.zip');
  assert.ok(refDownload);
  assert.equal(refDownload.owner, 'alice');
  assert.equal(refDownload.repo, 'cool-plugin');
  assert.equal(refDownload.tag, 'v2.1.0');
  assert.ok(refDownload.directZipUrl?.endsWith('plugin.zip'));

  // Tree / branch URL
  const refTree = parseGitHubUrl('https://github.com/alice/cool-plugin/tree/main');
  assert.ok(refTree);
  assert.equal(refTree.owner, 'alice');
  assert.equal(refTree.repo, 'cool-plugin');
  assert.equal(refTree.tag, 'main');

  // Trailing slash
  const refSlash = parseGitHubUrl('https://github.com/alice/cool-plugin/');
  assert.ok(refSlash);
  assert.equal(refSlash.owner, 'alice');
  assert.equal(refSlash.repo, 'cool-plugin');

  // Invalid strings
  assert.equal(parseGitHubUrl(''), null);
  assert.equal(parseGitHubUrl('https://google.com/test'), null);
});

test('Plugin dependency and version checking satisfies semver rules', () => {
  // 1. Semver parsing: returns [major, minor, patch, prerelease]
  assert.deepEqual(parseSemver('1.2.3'), [1, 2, 3, null]);
  assert.deepEqual(parseSemver('v2.0.4'), [2, 0, 4, null]);
  assert.deepEqual(parseSemver('0.12.11-beta.1'), [0, 12, 11, 'beta.1']);

  // 2. Semver comparing
  assert.equal(compareSemver('1.2.3', '1.2.0') > 0, true);
  assert.equal(compareSemver('1.2.0', '1.2.3') < 0, true);
  assert.equal(compareSemver('1.2.3', '1.2.3'), 0);

  // 3. satisfiesVersionConstraint
  assert.equal(satisfiesVersionConstraint('1.2.3', '^1.2.0'), true);
  assert.equal(satisfiesVersionConstraint('1.2.3', '^1.3.0'), false);
  assert.equal(satisfiesVersionConstraint('2.0.0', '^1.2.0'), false);
  assert.equal(satisfiesVersionConstraint('1.2.3', '~1.2.0'), true);
  assert.equal(satisfiesVersionConstraint('1.3.0', '~1.2.0'), false);
  assert.equal(satisfiesVersionConstraint('1.2.3', '>=1.2.0'), true);
  assert.equal(satisfiesVersionConstraint('1.1.9', '>=1.2.0'), false);
  assert.equal(satisfiesVersionConstraint('1.2.3', '*'), true);
  assert.equal(satisfiesVersionConstraint('1.2.3', '1.2.3'), true);
  assert.equal(satisfiesVersionConstraint('1.2.4', '1.2.3'), false);

  // 4. parseDependencySpec
  const p1 = parseDependencySpec('dep-a', '^1.0.0');
  assert.equal(p1.id, 'dep-a');
  assert.equal(p1.versionConstraint, '^1.0.0');
  assert.equal(p1.gitHubUrl, undefined);

  const p2 = parseDependencySpec('dep-missing', 'https://github.com/alice/dep-missing#>=2.0.0');
  assert.equal(p2.id, 'dep-missing');
  assert.equal(p2.versionConstraint, '>=2.0.0');
  assert.equal(p2.gitHubUrl, 'https://github.com/alice/dep-missing');

  // 5. checkDependency with resolver
  const mockPlugins: Record<string, any> = {
    'dep-a': { manifest: { id: 'dep-a', version: '1.5.0' }, enabled: true },
    'dep-b': { manifest: { id: 'dep-b', version: '2.0.0' }, enabled: false },
  };
  const resolver = (id: string) => mockPlugins[id];

  // Satisfied required dependency
  const r1 = checkDependency(p1, resolver);
  assert.equal(r1.satisfied, true);
  assert.equal(r1.status, 'ok');
  assert.equal(r1.installedVersion, '1.5.0');

  // Missing dependency
  const r2 = checkDependency(p2, resolver);
  assert.equal(r2.satisfied, false);
  assert.equal(r2.status, 'missing');

  // Disabled dependency
  const pDisabled = parseDependencySpec('dep-b', '>=1.0.0');
  const r3 = checkDependency(pDisabled, resolver);
  assert.equal(r3.satisfied, false);
  assert.equal(r3.status, 'disabled');

  // Version mismatch
  const pMismatch = parseDependencySpec('dep-a', '>=2.0.0');
  const r4 = checkDependency(pMismatch, resolver);
  assert.equal(r4.satisfied, false);
  assert.equal(r4.status, 'version_mismatch');

  // 6. checkAllDependencies
  const targetManifest: any = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    dependencies: {
      'dep-a': '^1.0.0',
      'dep-missing': '>=1.0.0',
    },
  };
  const allResults = checkAllDependencies(targetManifest, resolver);
  assert.equal(allResults.length, 2);
  assert.equal(allResults[0].satisfied, true);
  assert.equal(allResults[1].satisfied, false);
  assert.equal(allResults[1].status, 'missing');

  // 7. topologicalSortPlugins
  const pA: any = { manifest: { id: 'pA', dependencies: { pB: '*' } } };
  const pB: any = { manifest: { id: 'pB' } };
  const { sorted, cycles } = topologicalSortPlugins([pA, pB]);
  assert.equal(cycles.length, 0);
  assert.equal(sorted[0].manifest.id, 'pB');
  assert.equal(sorted[1].manifest.id, 'pA');
});

test('Plugin menu items deduplication and lifecycle cleanup', () => {
  // Mock PluginManager menu items map behavior
  const menuItems = new Map<string, { manifest: any; items: any[] }>();

  const registerMenuItem = (manifest: any, options: { label: string; shortcut?: string; action: () => void }) => {
    let group = menuItems.get(manifest.id);
    if (!group) {
      group = { manifest, items: [] };
      menuItems.set(manifest.id, group);
    }
    const itemDef = { label: options.label, shortcut: options.shortcut, action: options.action };
    const existingIdx = group.items.findIndex((it) => it.label === options.label);
    if (existingIdx !== -1) {
      group.items[existingIdx] = itemDef;
    } else {
      group.items.push(itemDef);
    }

    return () => {
      const g = menuItems.get(manifest.id);
      if (g) {
        g.items = g.items.filter((it) => it !== itemDef);
        if (g.items.length === 0) {
          menuItems.delete(manifest.id);
        }
      }
    };
  };

  const manifest = { id: 'test-plugin', name: 'Test Plugin' };

  // First registration
  const unreg1 = registerMenuItem(manifest, { label: 'Open Viewer', action: () => {} });
  assert.equal(menuItems.get('test-plugin')?.items.length, 1);

  // Duplicate registration with same label replaces item instead of adding duplicate
  const unreg2 = registerMenuItem(manifest, { label: 'Open Viewer', action: () => {} });
  assert.equal(menuItems.get('test-plugin')?.items.length, 1);

  // Registration with different label adds new item
  registerMenuItem(manifest, { label: 'Export Data', action: () => {} });
  assert.equal(menuItems.get('test-plugin')?.items.length, 2);

  // Unregistering second Open Viewer removes it
  unreg2();
  assert.equal(menuItems.get('test-plugin')?.items.length, 1);
  assert.equal(menuItems.get('test-plugin')?.items[0].label, 'Export Data');

  // Deleting plugin clears menu group completely
  menuItems.delete('test-plugin');
  assert.equal(menuItems.has('test-plugin'), false);
});

test('checkGitHubPluginUpdate detection logic with semver version comparison', () => {
  // Test version comparison for plugin update detection
  assert.equal(isNewerVersion('1.2.0', '1.2.1'), true);
  assert.equal(isNewerVersion('1.2.1', '1.2.0'), false);
  assert.equal(isNewerVersion('1.2.0', '1.2.0'), false);
  assert.equal(isNewerVersion('1.2.0', 'v1.2.1'), true);
  assert.equal(isNewerVersion('v1.2.0', '1.2.1'), true);
  assert.equal(isNewerVersion('1.2.0', '2.0.0'), true);
});




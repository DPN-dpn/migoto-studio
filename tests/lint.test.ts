import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lintModel,
  stripComments,
  MarkerSeverity,
  registerAllowedResource,
  clearAllowedResources,
  registerAllowedVariable,
  clearAllowedVariables,
  registerAllowedUsedVariable,
  registerAllowedUsedResource,
  type TextModelLike,
  type LintOptions,
} from '../src/core/ini/lint.ts';

function createMockModel(content: string): TextModelLike {
  const lines = content.split(/\r?\n/);
  return {
    getLineCount: () => lines.length,
    getLineContent: (n: number) => lines[n - 1] ?? '',
  };
}

const defaultOptions: LintOptions = {
  enabled: true,
  duplicateSections: true,
  unclosedBlocks: true,
  comparisonInCondition: true,
  missingResources: true,
  undeclaredVars: true,
  unusedItems: true,
};

test('stripComments preserves strings and strips comments', () => {
  assert.equal(stripComments('a = 1 ; comment').code, 'a = 1 ');
  assert.equal(stripComments('filename = "foo;bar.dds" ; comment').code, 'filename = "foo;bar.dds" ');
  assert.equal(stripComments('; entire line comment').code, '');
});

test('detects unclosed section header', () => {
  const model = createMockModel('[TextureOverrideBody\nhash = 123');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Error && m.message.includes("닫는 대괄호 ']'")), true);
});

test('detects duplicate sections', () => {
  const model = createMockModel('[ResourceBody]\ntype = Buffer\n[ResourceBody]\ntype = Buffer');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Warning && m.message.includes('중복 정의')), true);
});

test('detects unclosed if block before next section', () => {
  const model = createMockModel('[Present]\nif $swap == 1\n$costume = 2\n[TextureOverride]\nhash = 123');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Error && m.message.includes('새 섹션이 시작')), true);
});

test('detects unclosed if block at EOF', () => {
  const model = createMockModel('[Present]\nif $swap == 1\n$costume = 2');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Error && m.message.includes('파일이 끝났습니다')), true);
});

test('detects orphaned endif / else without if', () => {
  const model = createMockModel('[Present]\n$costume = 2\nendif');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Error && m.message.includes("짝이 맞는 'if' 없이 'endif'")), true);
});

test('detects single = in condition', () => {
  const model = createMockModel('[Present]\nif $swap = 1\nendif');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Warning && m.message.includes("단일 등호 '='")), true);
});

test('detects missing resource reference', () => {
  const model = createMockModel('[TextureOverride]\nvb0 = ResourceNotExist\n');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Warning && m.message.includes('ResourceNotExist')), true);
});

test('detects undeclared variable when enabled', () => {
  const model = createMockModel('[Constants]\nglobal $swapvar = 0\n[Present]\n$undeclared = 1\n');
  const markers = lintModel(model, defaultOptions);
  assert.equal(markers.some((m) => m.severity === MarkerSeverity.Warning && m.message.includes('$undeclared')), true);
});

test('sample.ini passes with zero errors and zero warnings when undeclared check is aligned', () => {
  const sampleIni = `; Sample INI
[Constants]
global persist $swapvar = 0
global $active
global $costume = 1

[KeySwap]
condition = $active == 1
key = no_modifiers VK_DOWN
type = cycle
$swapvar = 0,1,2

[Present]
if $swapvar == 1
    $costume = 2
else if $swapvar == 2
    $costume = 3
endif

[TextureOverrideBodyPosition]
hash = 1a2b3c4d
match_priority = 10
if $costume == 1
    vb0 = ResourceBodyPosition
    ib = ResourceBodyIB
    handling = skip
    drawindexed = auto
endif

[ResourceBodyPosition]
type = Buffer
stride = 40
filename = Meshes/BodyPosition.buf

[ResourceBodyIB]
type = Buffer
format = DXGI_FORMAT_R32_UINT
filename = Meshes/Body.ib
`;
  const model = createMockModel(sampleIni);
  const markers = lintModel(model, {
    ...defaultOptions,
    unusedItems: false,
  });
  const errors = markers.filter((m) => m.severity === MarkerSeverity.Error);
  const warnings = markers.filter((m) => m.severity === MarkerSeverity.Warning);
  assert.equal(errors.length, 0, 'No errors in valid sample');
  assert.equal(warnings.length, 0, 'No warnings in valid sample');
});

test('ZZMI CommandList and SlotFix is recognized as valid when allowed', () => {
  clearAllowedResources();
  const unregister1 = registerAllowedResource(/^commandlist\\zzmi\\/i);
  const unregister2 = registerAllowedResource(/^resource\\zzmi\\/i);

  const zzmiIni = `
[TextureOverrideEllen]
hash = 12345678
Resource\\ZZMI\\Diffuse = ref ResourceCustomDiffuse
Resource\\ZZMI\\NormalMap = ref ResourceCustomNormalMap
Resource\\ZZMI\\LightMap = ref ResourceCustomLightMap
Resource\\ZZMI\\MaterialMap = ref ResourceCustomMaterialMap
Resource\\ZZMI\\WEngineFX = ref ResourceCustomWEngineFX
run = CommandList\\ZZMI\\SetTextures

[ResourceCustomDiffuse]
filename = Textures/Diffuse.dds

[ResourceCustomNormalMap]
filename = Textures/NormalMap.dds

[ResourceCustomLightMap]
filename = Textures/LightMap.dds

[ResourceCustomMaterialMap]
filename = Textures/MaterialMap.dds

[ResourceCustomWEngineFX]
filename = Textures/WEngineFX.dds
`;

  const model = createMockModel(zzmiIni);
  const markers = lintModel(model, {
    ...defaultOptions,
    unusedItems: false,
  });

  const errors = markers.filter((m) => m.severity === MarkerSeverity.Error);
  const warnings = markers.filter((m) => m.severity === MarkerSeverity.Warning);
  assert.equal(errors.length, 0, 'No errors in valid ZZMI snippet');
  assert.equal(warnings.length, 0, 'No warnings in valid ZZMI snippet');

  unregister1();
  unregister2();

  // Once unregistered, CommandList\ZZMI\SetTextures should report missing section
  const markersWithoutZZMI = lintModel(model, {
    ...defaultOptions,
    unusedItems: false,
  });
  assert.ok(markersWithoutZZMI.some((m) => m.message.includes('CommandList\\ZZMI\\SetTextures')));
});

test('ZZMI TTL syntax ($\\TTL\\alpha, $\\TTL\\_1, run = CommandList\\TTL\\Draw) is recognized as valid when allowed', () => {
  clearAllowedResources();
  clearAllowedVariables();

  const uRes1 = registerAllowedResource(/^commandlist\\ttl\\/i);
  const uRes2 = registerAllowedResource(/^resource\\ttl\\/i);
  const uVar1 = registerAllowedVariable(/^\\?ttl\\/i);

  const ttlIni = `
[TextureOverridePart]
hash = 1234abcd
$\\TTL\\alpha = 0.4
$\\TTL\\_1 = 192
$\\TTL\\_2 = 71646
run = CommandList\\TTL\\Draw
`;

  const model = createMockModel(ttlIni);
  const markers = lintModel(model, {
    ...defaultOptions,
    undeclaredVars: true,
    missingResources: true,
    unusedItems: false,
  });

  const warnings = markers.filter((m) => m.severity === MarkerSeverity.Warning);
  assert.equal(warnings.length, 0, 'No warnings for valid ZZMI TTL syntax when allowed');

  uRes1();
  uRes2();
  uVar1();
});

test('single ini mode guides user to check namespace for undeclared and namespaced variables', () => {
  // 1. Regular undeclared variable in single ini mode
  const model1 = createMockModel('[Present]\n$costume = 1\n');
  const markers1 = lintModel(model1, { ...defaultOptions, hasFolder: false });
  const m1 = markers1.find((m) => m.message.includes('$costume'));
  assert.ok(m1);
  assert.ok(m1.message.includes('네임스페이스에 있는 변수인지 확인해야 합니다'));

  // 2. Namespaced undeclared variable in single ini mode
  const model2 = createMockModel('[Present]\nif $\\Raiden\\costume == 1\nendif');
  const markers2 = lintModel(model2, { ...defaultOptions, hasFolder: false });
  const m2 = markers2.find((m) => m.message.includes('costume'));
  assert.ok(m2);
  assert.ok(m2.message.includes('단일 ini 파일로 열려 있어 외부 네임스페이스를 확인할 수 없습니다'));
  assert.ok(m2.message.includes('네임스페이스에 있는 변수인지 확인해야 합니다'));
});

test('folder mode delegates namespaced variables to custom lint rule', () => {
  const model = createMockModel('[Present]\nif $\\Raiden\\costume == 1\nendif');
  const markers = lintModel(model, { ...defaultOptions, hasFolder: true });
  // In folder mode, core linter delegates $\Raiden\costume to workspace custom lint rule
  assert.equal(markers.some((m) => m.message.includes('costume')), false);
});

test('this = syntax marks declared resource as used and detects undeclared resource', () => {
  const validIni = `
[TextureOverrideBody]
hash = 12345678
this = ResourceBodyDiffuse

[ResourceBodyDiffuse]
filename = Textures/Body.dds
`;
  const validModel = createMockModel(validIni);
  const validMarkers = lintModel(validModel, {
    ...defaultOptions,
    unusedItems: true,
  });
  // Should have NO warnings or info markers about unused resources
  const unusedMarkers = validMarkers.filter((m) => m.message.includes('사용되지 않는'));
  const missingMarkers = validMarkers.filter((m) => m.severity === MarkerSeverity.Warning);
  assert.equal(unusedMarkers.length, 0, 'ResourceBodyDiffuse should be marked as used');
  assert.equal(missingMarkers.length, 0, 'No missing resource warnings');

  // Now test undeclared resource in this =
  const invalidIni = `
[TextureOverrideBody]
hash = 12345678
this = ResourceNotExist
`;
  const invalidModel = createMockModel(invalidIni);
  const invalidMarkers = lintModel(invalidModel, {
    ...defaultOptions,
    unusedItems: true,
  });
  assert.ok(
    invalidMarkers.some(
      (m) => m.severity === MarkerSeverity.Warning && m.message.includes('ResourceNotExist')
    ),
    'Should report warning for missing resource in this ='
  );
});

test('CommandListSkinTexture is recognized as valid when allowed', () => {
  clearAllowedResources();
  const unregister = registerAllowedResource('CommandListSkinTexture');

  const model = createMockModel('[TextureOverrideFace]\nhash = 12345678\nrun = CommandListSkinTexture\n');
  const markers = lintModel(model, defaultOptions);

  const errors = markers.filter((m) => m.severity === MarkerSeverity.Error);
  const warnings = markers.filter((m) => m.severity === MarkerSeverity.Warning);
  assert.equal(errors.length, 0, 'No errors for CommandListSkinTexture');
  assert.equal(warnings.length, 0, 'No warnings for allowed CommandListSkinTexture');

  unregister();
  const markersAfter = lintModel(model, defaultOptions);
  assert.ok(
    markersAfter.some((m) => m.message.includes('CommandListSkinTexture')),
    'Should report warning when CommandListSkinTexture is not allowed'
  );
});

test('suppresses unused warning when variable or resource is externally allowed', () => {
  const model = createMockModel(`[Constants]
global $costume = 0

[ResourceCostume]
type = Buffer
`);

  // Without external allowance, both $costume and ResourceCostume are marked as unused
  const markersBefore = lintModel(model, defaultOptions);
  assert.ok(
    markersBefore.some((m) => m.message.includes('$costume') && m.message.includes('사용되지 않았습니다')),
    'Should report $costume as unused'
  );
  assert.ok(
    markersBefore.some((m) => m.message.includes('ResourceCostume') && m.message.includes('참조되지 않았습니다')),
    'Should report ResourceCostume as unreferenced'
  );

  // Register external allowance
  const unregVar = registerAllowedUsedVariable('costume');
  const unregRes = registerAllowedUsedResource('resourcecostume');

  const markersAfter = lintModel(model, defaultOptions);
  const unusedAfter = markersAfter.filter(
    (m) => m.message.includes('사용되지 않았습니다') || m.message.includes('참조되지 않았습니다')
  );
  assert.equal(unusedAfter.length, 0, 'Should not report unused warnings when registered as externally used');

  unregVar();
  unregRes();

  const markersRestored = lintModel(model, defaultOptions);
  const unusedRestored = markersRestored.filter(
    (m) => m.message.includes('사용되지 않았습니다') || m.message.includes('참조되지 않았습니다')
  );
  assert.equal(unusedRestored.length, 2, 'Should report unused warnings after unregistering');
});

test('section names with dot and hyphen (e.g. ResourceTest.01, CommandListTest.01) are matched completely without false missing or unused warning', () => {
  const model = createMockModel(`[TextureOverrideBody]
this = ResourceTest.01
run = CommandListTest.01

[ResourceTest.01]
filename = Textures/test.dds

[CommandListTest.01]
handling = skip
`);

  const markers = lintModel(model, defaultOptions);
  const warnings = markers.filter((m) => m.severity === MarkerSeverity.Warning);
  assert.equal(warnings.length, 0, 'Section names with dot should match completely without missing section warning');

  const unusedInfo = markers.filter((m) => m.severity === MarkerSeverity.Info && m.message.includes('참조되지 않았습니다'));
  assert.equal(unusedInfo.length, 0, 'Section names with dot should not be marked as unused when referenced');
});



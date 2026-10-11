import test from 'node:test';
import assert from 'node:assert/strict';
import { lintModel, stripComments, MarkerSeverity, type TextModelLike, type LintOptions } from '../src/core/lint.ts';

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

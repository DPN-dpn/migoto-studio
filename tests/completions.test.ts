import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSymbols, computeSuggestions, type TextModelLike } from '../src/symbols.ts';

function createMockModel(content: string): TextModelLike {
  const lines = content.split(/\r?\n/);
  return {
    getLineCount: () => lines.length,
    getLineContent: (n: number) => lines[n - 1] ?? '',
  };
}

const sampleIni = `; Test INI
[Constants]
global persist $swapvar = 0
global $show_ui = 1
$flag = 2

[KeyToggle]
key = no_modifiers VK_F1
type = cycle
$swapvar = 0,1,2

[Present]
if $swapvar == 1
  run = CommandListSwap
endif

[TextureOverrideBody]
hash = 12345678
vb0 = ResourceMesh
ib = ResourceIB

[ResourceMesh]
type = Buffer
stride = 40
filename = Meshes/Body.buf

[ResourceIB]
type = Buffer
format = DXGI_FORMAT_R32_UINT

[CommandListSwap]
$swapvar = 1

[CustomShaderPost]
vs = post.hlsl
`;

test('extractSymbols parses sections, resources, command lists, and variables', () => {
  const model = createMockModel(sampleIni);
  const symbols = extractSymbols(model);

  // Sections
  assert.equal(symbols.sections.includes('Constants'), true);
  assert.equal(symbols.sections.includes('KeyToggle'), true);
  assert.equal(symbols.sections.includes('Present'), true);
  assert.equal(symbols.sections.includes('TextureOverrideBody'), true);
  assert.equal(symbols.sections.includes('ResourceMesh'), true);

  // Resources
  assert.deepEqual(symbols.resources, ['ResourceMesh', 'ResourceIB']);

  // Command lists / Custom shaders
  assert.deepEqual(symbols.commandLists, ['CommandListSwap', 'CustomShaderPost']);

  // Variables
  assert.equal(symbols.variables.has('swapvar'), true);
  assert.equal(symbols.variables.has('show_ui'), true);
  assert.equal(symbols.variables.has('flag'), true);
});

test('computeSuggestions suggests variables after $', () => {
  const model = createMockModel(sampleIni);
  const symbols = extractSymbols(model);

  const prefix = 'if $';
  const suggestions = computeSuggestions(symbols, prefix, 10, prefix.length + 1);

  assert.equal(suggestions.length >= 3, true);
  assert.equal(suggestions.some((s) => s.label === '$swapvar'), true);
  assert.equal(suggestions.some((s) => s.label === '$show_ui'), true);
});

test('computeSuggestions suggests resources and null after slot assignment', () => {
  const model = createMockModel(sampleIni);
  const symbols = extractSymbols(model);

  const prefix = 'vb0 = ';
  const suggestions = computeSuggestions(symbols, prefix, 20, prefix.length + 1);

  assert.equal(suggestions.some((s) => s.label === 'ResourceMesh'), true);
  assert.equal(suggestions.some((s) => s.label === 'ResourceIB'), true);
  assert.equal(suggestions.some((s) => s.label === 'null'), true);
});

test('computeSuggestions suggests command lists after run =', () => {
  const model = createMockModel(sampleIni);
  const symbols = extractSymbols(model);

  const prefix = 'post run = ';
  const suggestions = computeSuggestions(symbols, prefix, 15, prefix.length + 1);

  assert.equal(suggestions.some((s) => s.label === 'CommandListSwap'), true);
  assert.equal(suggestions.some((s) => s.label === 'CustomShaderPost'), true);
});

test('computeSuggestions suggests templates after [', () => {
  const model = createMockModel(sampleIni);
  const symbols = extractSymbols(model);

  const prefix = '[';
  const suggestions = computeSuggestions(symbols, prefix, 25, 2);

  assert.equal(suggestions.some((s) => s.label === '[Constants]'), true);
  assert.equal(suggestions.some((s) => s.label === '[TextureOverride]'), true);
  assert.equal(suggestions.some((s) => s.label === '[ResourceBuffer]'), true);
});

test('computeSuggestions suggests DXGI formats after format =', () => {
  const model = createMockModel(sampleIni);
  const symbols = extractSymbols(model);

  const prefix = 'format = ';
  const suggestions = computeSuggestions(symbols, prefix, 30, prefix.length + 1);

  assert.equal(suggestions.some((s) => s.label === 'DXGI_FORMAT_R32_UINT'), true);
  assert.equal(suggestions.some((s) => s.label === 'DXGI_FORMAT_R16_UINT'), true);
});

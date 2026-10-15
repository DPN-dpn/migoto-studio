import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSymbolAtPosition,
  scanModelOccurrences,
  type SymbolTarget,
} from '../src/core/ini/symbol-nav.ts';

// Mock text model for testing
function createMockModel(content: string, uriStr = 'inifile:///test.ini') {
  const lines = content.split('\n');
  return {
    uri: { toString: () => uriStr, scheme: 'inifile', path: '/test.ini' } as any,
    getLineCount: () => lines.length,
    getLineContent: (line: number) => lines[line - 1] ?? '',
    getValue: () => content,
    getWordAtPosition: (pos: { lineNumber: number; column: number }) => {
      const line = lines[pos.lineNumber - 1] ?? '';
      const col = pos.column;
      const match = /\b[a-zA-Z0-9_\\]+\b/g;
      let m: RegExpExecArray | null;
      while ((m = match.exec(line)) !== null) {
        const start = m.index + 1;
        const end = start + m[0].length;
        if (col >= start && col <= end) {
          return { word: m[0], startColumn: start, endColumn: end };
        }
      }
      return null;
    },
  } as any;
}

test('getSymbolAtPosition correctly identifies sections and variables', () => {
  const code = [
    '[TextureOverrideBody]',
    'hash = 12345678',
    'run = CommandListSwap',
    '',
    '[Constants]',
    'global persist $costume = 0',
    '',
    '[Present]',
    'if $costume == 1',
    '  $\\Raiden\\active = 1',
    'endif',
  ].join('\n');

  const model = createMockModel(code);

  // 1. Cursor on section header [TextureOverrideBody] (line 1, col 5)
  const sym1 = getSymbolAtPosition(model, { lineNumber: 1, column: 5 });
  assert.ok(sym1);
  assert.equal(sym1.kind, 'section');
  assert.equal(sym1.cleanName, 'TextureOverrideBody');

  // 2. Cursor on section reference `run = CommandListSwap` (line 3, col 12)
  const sym2 = getSymbolAtPosition(model, { lineNumber: 3, column: 12 });
  assert.ok(sym2);
  assert.equal(sym2.kind, 'section');
  assert.equal(sym2.cleanName, 'CommandListSwap');

  // 3. Cursor on variable declaration `$costume` (line 6, col 18)
  const sym3 = getSymbolAtPosition(model, { lineNumber: 6, column: 18 });
  assert.ok(sym3);
  assert.equal(sym3.kind, 'variable');
  assert.equal(sym3.cleanName, 'costume');

  // 4. Cursor on variable usage `if $costume == 1` (line 9, col 6)
  const sym4 = getSymbolAtPosition(model, { lineNumber: 9, column: 6 });
  assert.ok(sym4);
  assert.equal(sym4.kind, 'variable');
  assert.equal(sym4.cleanName, 'costume');

  // 5. Cursor on namespaced variable `$\Raiden\active` (line 10, col 7)
  const sym5 = getSymbolAtPosition(model, { lineNumber: 10, column: 7 });
  assert.ok(sym5);
  assert.equal(sym5.kind, 'variable');
  assert.equal(sym5.namespace, 'Raiden');
  assert.equal(sym5.cleanName, 'active');
});

test('scanModelOccurrences detects definitions and usages', () => {
  const code = [
    '[Constants]',
    'global persist $swapvar = 0',
    '$subvar = 1',
    '',
    '[CommandListSwap]',
    'if $swapvar == 1',
    '  $swapvar = 2',
    'endif',
    '',
    '[TextureOverrideBody]',
    'run = CommandListSwap',
  ].join('\n');

  const model = createMockModel(code);

  // Variable occurrences test
  const varTarget: SymbolTarget = {
    name: '$swapvar',
    cleanName: 'swapvar',
    kind: 'variable',
    rawMatch: '$swapvar',
    range: { startLineNumber: 2, startColumn: 16, endLineNumber: 2, endColumn: 24 },
  };

  const varOccs = scanModelOccurrences(model, varTarget, 'test.ini');
  assert.equal(varOccs.length, 3);

  // Line 2: declaration
  assert.equal(varOccs[0].range.startLineNumber, 2);
  assert.equal(varOccs[0].isDefinition, true);
  assert.equal(varOccs[0].section, '[Constants]');

  // Line 6: condition usage
  assert.equal(varOccs[1].range.startLineNumber, 6);
  assert.equal(varOccs[1].isDefinition, false);
  assert.equal(varOccs[1].section, '[CommandListSwap]');

  // Line 7: assignment usage
  assert.equal(varOccs[2].range.startLineNumber, 7);
  assert.equal(varOccs[2].isDefinition, false);

  // Section occurrences test
  const secTarget: SymbolTarget = {
    name: '[CommandListSwap]',
    cleanName: 'CommandListSwap',
    kind: 'section',
    rawMatch: '[CommandListSwap]',
    range: { startLineNumber: 5, startColumn: 1, endLineNumber: 5, endColumn: 18 },
  };

  const secOccs = scanModelOccurrences(model, secTarget, 'test.ini');
  assert.equal(secOccs.length, 2);

  // Line 5: Section header (definition)
  assert.equal(secOccs[0].range.startLineNumber, 5);
  assert.equal(secOccs[0].isDefinition, true);

  // Line 11: Section reference `run = CommandListSwap` (usage)
  assert.equal(secOccs[1].range.startLineNumber, 11);
  assert.equal(secOccs[1].isDefinition, false);
});

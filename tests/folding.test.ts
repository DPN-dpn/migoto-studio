import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFoldingRanges, FoldingRangeKind } from '../src/core/folding.ts';

function createMockModel(content: string) {
  const lines = content.split('\n');
  return {
    getLineCount: () => lines.length,
    getLineContent: (n: number) => lines[n - 1] ?? '',
  };
}

test('computeFoldingRanges folds sections, conditionals, and comments', () => {
  const code = [
    '; Comment line 1',
    '; Comment line 2',
    '',
    '[Constants]',
    'global persist $costume = 0',
    'global persist $credit = 1',
    '',
    '[TextureOverrideBody]',
    'hash = 12345678',
    'if $costume == 1',
    '  run = CommandListCostume',
    'endif',
    '',
    '[CommandListCostume]',
    'handling = skip',
  ].join('\n');

  const model = createMockModel(code);
  const ranges = computeFoldingRanges(model);

  // 1. Comment block (lines 1-2)
  const commentRange = ranges.find((r) => r.kind === FoldingRangeKind.Comment && r.start === 1);
  assert.ok(commentRange, 'Comment block should be folded');
  assert.equal(commentRange.end, 2);

  // 2. [Constants] section (lines 4-6) - line 7 is blank, so end is line 6
  const constRange = ranges.find((r) => r.kind === FoldingRangeKind.Region && r.start === 4);
  assert.ok(constRange, '[Constants] section should be folded');
  assert.equal(constRange.end, 6);

  // 3. [TextureOverrideBody] section (lines 8-12) - line 13 is blank
  const texRange = ranges.find((r) => r.kind === FoldingRangeKind.Region && r.start === 8);
  assert.ok(texRange, '[TextureOverrideBody] section should be folded');
  assert.equal(texRange.end, 12);

  // 4. Nested conditional block (lines 10-12)
  const ifRange = ranges.find((r) => r.start === 10);
  assert.ok(ifRange, 'if block should be folded');
  assert.equal(ifRange.end, 12);

  // 5. [CommandListCostume] section (lines 14-15)
  const cmdRange = ranges.find((r) => r.kind === FoldingRangeKind.Region && r.start === 14);
  assert.ok(cmdRange, '[CommandListCostume] section should be folded');
  assert.equal(cmdRange.end, 15);
});

test('computeFoldingRanges handles single-line or empty sections without invalid ranges', () => {
  const code = [
    '[EmptySection1]',
    '[EmptySection2]',
    'val = 1',
  ].join('\n');

  const model = createMockModel(code);
  const ranges = computeFoldingRanges(model);

  // EmptySection1 has no body lines before EmptySection2, so it shouldn't produce invalid start>=end
  const empty1 = ranges.find((r) => r.start === 1);
  assert.equal(empty1, undefined);

  // EmptySection2 has line 3
  const sec2 = ranges.find((r) => r.start === 2);
  assert.ok(sec2);
  assert.equal(sec2.end, 3);
});

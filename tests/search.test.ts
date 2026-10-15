import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchRegex,
  matchesPattern,
  searchInText,
  replaceAllInText,
  escapeRegex,
} from '../src/core/workspace/search.ts';

test('escapeRegex escapes special regex characters', () => {
  assert.equal(escapeRegex('hello.world[1]?(a+b)'), 'hello\\.world\\[1\\]\\?\\(a\\+b\\)');
});

test('buildSearchRegex creates proper regex for plain, case-sensitive, word, and regex options', () => {
  // Plain case-insensitive
  const r1 = buildSearchRegex('test');
  assert.equal(r1.source, 'test');
  assert.equal(r1.flags, 'gi');

  // Case-sensitive
  const r2 = buildSearchRegex('Test', { matchCase: true });
  assert.equal(r2.source, 'Test');
  assert.equal(r2.flags, 'g');

  // Whole word
  const r3 = buildSearchRegex('target', { wholeWord: true });
  assert.equal(r3.source, '\\btarget\\b');
  assert.equal(r3.flags, 'gi');

  // Regex mode
  const r4 = buildSearchRegex('hash\\s*=\\s*\\d+', { isRegex: true, matchCase: true });
  assert.equal(r4.source, 'hash\\s*=\\s*\\d+');
  assert.equal(r4.flags, 'g');
});

test('searchInText locates matches with exact line numbers and columns', () => {
  const content = [
    '; Comment line',
    '[TextureOverrideBody]',
    'hash = 12345678',
    'run = CommandListSwap',
    'x = hash + 1',
  ].join('\n');

  const regex = buildSearchRegex('hash', { wholeWord: true });
  const matches = searchInText(content, regex);

  assert.equal(matches.length, 2);

  // First occurrence at line 3, column 1 ("hash = 12345678")
  assert.equal(matches[0].lineNumber, 3);
  assert.equal(matches[0].startColumn, 1);
  assert.equal(matches[0].endColumn, 5);
  assert.equal(matches[0].matchedText, 'hash');
  assert.equal(matches[0].lineContent, 'hash = 12345678');

  // Second occurrence at line 5, column 5 ("x = hash + 1")
  assert.equal(matches[1].lineNumber, 5);
  assert.equal(matches[1].startColumn, 5);
  assert.equal(matches[1].endColumn, 9);
  assert.equal(matches[1].matchedText, 'hash');
});

test('searchInText respects case sensitivity and whole word flags', () => {
  const text = 'foo Foo food FOOD FOO';

  // Case insensitive, whole word
  const r1 = buildSearchRegex('foo', { wholeWord: true, matchCase: false });
  const m1 = searchInText(text, r1);
  // Matches: foo, Foo, FOO (food and FOOD are 4 letters, not whole word matches)
  assert.equal(m1.length, 3);

  // Case sensitive, whole word
  const r2 = buildSearchRegex('foo', { wholeWord: true, matchCase: true });
  const m2 = searchInText(text, r2);
  assert.equal(m2.length, 1);
  assert.equal(m2[0].matchedText, 'foo');
});

test('matchesPattern filters files by extensions and glob patterns', () => {
  // Empty pattern matches all
  assert.equal(matchesPattern('path/to/file.ini', ''), true);

  // Extension matching (*.ini)
  assert.equal(matchesPattern('d:/mods/character/body.ini', '*.ini'), true);
  assert.equal(matchesPattern('d:/mods/character/texture.dds', '*.ini'), false);

  // Comma-separated multiple patterns
  assert.equal(matchesPattern('character/head.ini', '*.ini, *.txt'), true);
  assert.equal(matchesPattern('character/readme.txt', '*.ini, *.txt'), true);
  assert.equal(matchesPattern('character/diff.bin', '*.ini, *.txt'), false);

  // Path substring matching
  assert.equal(matchesPattern('mods/genshin/character/mod.ini', 'genshin'), true);
  assert.equal(matchesPattern('mods/zzz/character/mod.ini', 'genshin'), false);
});

test('replaceAllInText replaces all matching occurrences and reports total count', () => {
  const text = 'val1 = $swap\nval2 = $swap\nval3 = $other';
  const regex = buildSearchRegex('$swap');

  const { newText, count } = replaceAllInText(text, regex, '$active');
  assert.equal(count, 2);
  assert.equal(newText, 'val1 = $active\nval2 = $active\nval3 = $other');
});

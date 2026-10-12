import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_TO_VK,
  VK_KEY_LIST,
  formatKeyBinding,
  generateKeySnippet,
  parseKeyBindingLine,
} from '../src/core/keys.ts';

test('CODE_TO_VK maps common browser event codes to 3DMigoto virtual keys', () => {
  // Function keys
  assert.equal(CODE_TO_VK['F1'], 'VK_F1');
  assert.equal(CODE_TO_VK['F12'], 'VK_F12');

  // Letters and numbers
  assert.equal(CODE_TO_VK['KeyA'], 'VK_A');
  assert.equal(CODE_TO_VK['KeyZ'], 'VK_Z');
  assert.equal(CODE_TO_VK['Digit1'], 'VK_1');
  assert.equal(CODE_TO_VK['Numpad5'], 'VK_NUMPAD5');

  // Navigation & 3DMigoto specials
  assert.equal(CODE_TO_VK['ArrowUp'], 'VK_UP');
  assert.equal(CODE_TO_VK['PageUp'], 'VK_PRIOR');
  assert.equal(CODE_TO_VK['PageDown'], 'VK_NEXT');
  assert.equal(CODE_TO_VK['Enter'], 'VK_RETURN');
  assert.equal(CODE_TO_VK['Backspace'], 'VK_BACK');
  assert.equal(CODE_TO_VK['Space'], 'VK_SPACE');
});

test('VK_KEY_LIST contains valid categorized entries', () => {
  assert.ok(VK_KEY_LIST.length > 50);

  const f1 = VK_KEY_LIST.find((k) => k.vk === 'VK_F1');
  assert.ok(f1);
  assert.equal(f1.category, '기능키(F1~F24)');

  const prior = VK_KEY_LIST.find((k) => k.vk === 'VK_PRIOR');
  assert.ok(prior);
  assert.equal(prior.category, '방향/이동키');

  const lbutton = VK_KEY_LIST.find((k) => k.vk === 'VK_LBUTTON');
  assert.ok(lbutton);
  assert.equal(lbutton.category, '마우스');
});

test('formatKeyBinding generates correct 3DMigoto modifier strings', () => {
  // No modifiers
  assert.equal(formatKeyBinding({ vk: 'VK_F1' }), 'no_modifiers VK_F1');

  // Single modifier
  assert.equal(formatKeyBinding({ vk: 'VK_SPACE', ctrl: true }), 'ctrl VK_SPACE');
  assert.equal(formatKeyBinding({ vk: 'VK_A', alt: true }), 'alt VK_A');
  assert.equal(formatKeyBinding({ vk: 'VK_B', shift: true }), 'shift VK_B');
  assert.equal(formatKeyBinding({ vk: 'VK_C', win: true }), 'windows VK_C');

  // Multiple modifiers
  assert.equal(
    formatKeyBinding({ vk: 'VK_1', ctrl: true, alt: true }),
    'ctrl alt VK_1'
  );
  assert.equal(
    formatKeyBinding({ vk: 'VK_X', ctrl: true, shift: true, win: true }),
    'ctrl shift windows VK_X'
  );

  // Negative conditions (exclude)
  assert.equal(
    formatKeyBinding({ vk: 'VK_F1', ctrl: 'exclude' }),
    'no_ctrl VK_F1'
  );
  assert.equal(
    formatKeyBinding({ vk: 'VK_F2', ctrl: 'require', alt: 'exclude' }),
    'ctrl no_alt VK_F2'
  );
  assert.equal(
    formatKeyBinding({
      vk: 'VK_SPACE',
      ctrl: 'require',
      alt: 'exclude',
      shift: 'exclude',
      win: 'exclude',
    }),
    'ctrl no_alt no_shift no_windows VK_SPACE'
  );
});

test('parseKeyBindingLine extracts prefix, modifiers and virtual key from editor line', () => {
  // Simple no_modifiers
  const res1 = parseKeyBindingLine('key = no_modifiers VK_F1');
  assert.ok(res1);
  assert.equal(res1.prefix, 'key = ');
  assert.equal(res1.vk, 'VK_F1');
  assert.equal(res1.ctrl, 'none');
  assert.equal(res1.alt, 'none');

  // Indented line with positive and negative modifiers
  const res2 = parseKeyBindingLine('    key = ctrl no_alt VK_SPACE');
  assert.ok(res2);
  assert.equal(res2.prefix, '    key = ');
  assert.equal(res2.vk, 'VK_SPACE');
  assert.equal(res2.ctrl, 'require');
  assert.equal(res2.alt, 'exclude');
  assert.equal(res2.shift, 'none');

  // Non-key line
  const res3 = parseKeyBindingLine('type = cycle');
  assert.equal(res3, null);
});

test('generateKeySnippet creates expected formats', () => {
  const binding = 'no_modifiers VK_F1';

  // value
  assert.equal(generateKeySnippet('value', binding), 'no_modifiers VK_F1');

  // line
  assert.equal(generateKeySnippet('line', binding), 'key = no_modifiers VK_F1\n');

  // toggle
  const toggle = generateKeySnippet('toggle', binding);
  assert.ok(toggle.includes('[KeyToggle]'));
  assert.ok(toggle.includes('key = no_modifiers VK_F1'));
  assert.ok(toggle.includes('type = cycle'));

  // hold
  const hold = generateKeySnippet('hold', binding);
  assert.ok(hold.includes('[KeyHold]'));
  assert.ok(hold.includes('key = no_modifiers VK_F1'));
  assert.ok(hold.includes('type = hold'));
});

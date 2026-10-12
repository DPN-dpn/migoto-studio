import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIni,
  classifyIniSection,
  mergeIniSections,
  formatIniSection,
} from '../src/core/ini.ts';

test('classifyIniSection correctly identifies 3DMigoto/XXMI section types', () => {
  assert.equal(classifyIniSection('TextureOverrideBody'), '텍스처 오버라이드');
  assert.equal(classifyIniSection('KeyToggle'), '키 (단축키)');
  assert.equal(classifyIniSection('ShaderOverrideHair'), '셰이더 오버라이드');
  assert.equal(classifyIniSection('ShaderRegexFix'), '셰이더 정규식');
  assert.equal(classifyIniSection('ResourceIB'), '리소스');
  assert.equal(classifyIniSection('CommandListDraw'), '커맨드 리스트');
  assert.equal(classifyIniSection('CustomShaderTest'), '커스텀 셰이더');
  assert.equal(classifyIniSection('Constants'), '상수 (전역)');
  assert.equal(classifyIniSection('Present'), '프레임 렌더링 (Present)');
  assert.equal(classifyIniSection('Logging'), '일반 설정');
  assert.equal(classifyIniSection('RandomCustomName'), '기타');
});

test('parseIni extracts sections, properties, variables, and preamble', () => {
  const iniText = `; Top comment
; File author: DPN
global $globalVar = 10

[KeyToggle]
key = VK_F1
type = cycle
$active = 0, 1

[TextureOverrideBody]
hash = 1234abcd ; inline comment
match_priority = 0
`;

  const doc = parseIni(iniText);
  assert.ok(doc.preamble.includes('; Top comment'));
  assert.ok(doc.preamble.includes('global $globalVar = 10'));
  assert.equal(doc.sections.length, 2);

  const keySec = doc.getSection('keytoggle');
  assert.ok(keySec);
  assert.equal(keySec.name, 'KeyToggle');
  assert.equal(keySec.group, '키 (단축키)');
  assert.equal(keySec.properties['key'], 'VK_F1');
  assert.equal(keySec.properties['type'], 'cycle');
  assert.equal(keySec.variables['$active'], '0, 1');

  const texSec = doc.getSection('TextureOverrideBody');
  assert.ok(texSec);
  assert.equal(texSec.properties['hash'], '1234abcd');
  assert.equal(texSec.properties['match_priority'], '0');

  assert.equal(doc.hasSection('nonexistent'), false);
  assert.equal(doc.hasSection('textureoverridebody'), true);
  assert.equal(doc.getSectionsByGroup('텍스처 오버라이드').length, 1);
});

test('mergeIniSections replaces existing sections in-place and preserves untargeted sections', () => {
  const original = `; Header
[Constants]
global $val = 1

[KeyToggle]
key = F1
type = toggle

[TextureOverrideOld]
hash = aaaa
`;

  const patch = `[KeyToggle]
key = F1
type = cycle
$val = 0, 1

[TextureOverrideNew]
hash = bbbb
`;

  const result = mergeIniSections(original, patch);

  assert.deepEqual(result.replacedSections, ['KeyToggle']);
  assert.deepEqual(result.addedSections, ['TextureOverrideNew']);
  assert.deepEqual(result.preservedSections, ['Constants', 'TextureOverrideOld']);

  // Header and Constants must still come first
  assert.ok(result.newText.startsWith('; Header'));
  const keyToggleIdx = result.newText.indexOf('[KeyToggle]');
  const constantsIdx = result.newText.indexOf('[Constants]');
  const texOldIdx = result.newText.indexOf('[TextureOverrideOld]');
  const texNewIdx = result.newText.indexOf('[TextureOverrideNew]');

  assert.ok(constantsIdx < keyToggleIdx);
  assert.ok(keyToggleIdx < texOldIdx);
  assert.ok(texOldIdx < texNewIdx);

  // KeyToggle must have the new content
  assert.ok(result.newText.includes('type = cycle'));
  assert.ok(result.newText.includes('$val = 0, 1'));
});

test('formatIniSection formats properties and variables cleanly', () => {
  const formatted = formatIniSection(
    'KeyToggle',
    { key: 'VK_F1', type: 'toggle' },
    { variables: { $active: '0, 1' }, comments: ['Custom toggle key'] },
  );

  assert.ok(formatted.startsWith('[KeyToggle]'));
  assert.ok(formatted.includes('; Custom toggle key'));
  assert.ok(formatted.includes('$active = 0, 1'));
  assert.ok(formatted.includes('key = VK_F1'));
  assert.ok(formatted.includes('type = toggle'));
});

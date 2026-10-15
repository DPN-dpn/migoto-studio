import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSections } from '../src/ui/panels/outline.ts';

test('parseSections extracts section headers and groups correctly', () => {
  const content = [
    '; Comment header',
    '[Constants]',
    'global $var = 1',
    '',
    '[KeyToggle]',
    'key = VK_F1',
    '',
    '; [CommentedOutSection]',
    '[TextureOverrideBody]',
    'hash = 12345678',
    '',
    '[CommandListSetTextures]',
    'run = CommandList\\ZZMI\\SetTextures',
  ];

  const mockModel: any = {
    getLineCount: () => content.length,
    getLineContent: (line: number) => content[line - 1],
  };

  const sections = parseSections(mockModel);
  assert.equal(sections.length, 4);

  assert.equal(sections[0].name, 'Constants');
  assert.equal(sections[0].line, 2);
  assert.equal(sections[0].group, '일반 설정');

  assert.equal(sections[1].name, 'KeyToggle');
  assert.equal(sections[1].line, 5);
  assert.equal(sections[1].group, '키 (단축키)');

  assert.equal(sections[2].name, 'TextureOverrideBody');
  assert.equal(sections[2].line, 9);
  assert.equal(sections[2].group, '텍스처 오버라이드');

  assert.equal(sections[3].name, 'CommandListSetTextures');
  assert.equal(sections[3].line, 12);
  assert.equal(sections[3].group, '커맨드 리스트');
});

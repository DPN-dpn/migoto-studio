import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIni } from '../src/core/ini/ini.ts';
import { detectPartFromSectionName, discoverModParts, standard3DMigotoResolver, findResourceFilename } from '../src/core/slots/resolver.ts';
import { SlotManager } from '../src/core/slots/slot-manager.ts';
import { createZzmiSlotResolver } from '../default-plugins/zzmi-support/rules.ts';

test('detectPartFromSectionName correctly categorizes 3DMigoto section names', () => {
  assert.equal(detectPartFromSectionName('TextureOverrideRoxyHead'), 'head');
  assert.equal(detectPartFromSectionName('TextureOverrideBodyDiffuse'), 'body');
  assert.equal(detectPartFromSectionName('TextureOverrideCharacterHair'), 'hair');
  assert.equal(detectPartFromSectionName('TextureOverrideFaceTex'), 'face');
  assert.equal(detectPartFromSectionName('TextureOverrideDressA'), 'dress');
  assert.equal(detectPartFromSectionName('TextureOverrideSwordWeapon'), 'weapon');
  assert.equal(detectPartFromSectionName('TextureOverrideWingAccessory'), 'extra');
  assert.equal(detectPartFromSectionName('TextureOverrideCustomPartX'), 'custom');
  assert.equal(detectPartFromSectionName('TextureOverrideRandom1234'), 'unknown');
});

test('standard3DMigotoResolver parses ps-t slots and explicit texture properties', () => {
  const iniText = `
[TextureOverrideHeroBody]
hash = a1b2c3d4
match_first_index = 0
ib = ResourceHeroBodyIB
ps-t0 = ResourceHeroDiffuse
ps-t1 = ResourceHeroLightMap
ps-t2 = ResourceHeroNormalMap

[ResourceHeroDiffuse]
filename = Hero_Diffuse.dds

[ResourceHeroNormalMap]
filename = Hero_Normal.dds
`;
  const doc = parseIni(iniText);
  const sec = doc.getSection('TextureOverrideHeroBody')!;
  assert.ok(sec);

  const slots = standard3DMigotoResolver.resolveSlots(sec, doc);
  assert.ok(slots);
  assert.equal(slots.length, 3);

  const diffSlot = slots.find((s) => s.slotId === 'ps-t0');
  assert.ok(diffSlot);
  assert.equal(diffSlot.slotType, 'diffuse');
  assert.equal(diffSlot.resourceRef, 'ResourceHeroDiffuse');
  assert.equal(diffSlot.textureFile, 'Hero_Diffuse.dds');

  const normSlot = slots.find((s) => s.slotId === 'ps-t2');
  assert.ok(normSlot);
  assert.equal(normSlot.slotType, 'normal');
  assert.equal(normSlot.textureFile, 'Hero_Normal.dds');
});

test('SlotManager classifies matched and unmatched sections and allows manual matching', () => {
  const sm = new SlotManager();
  const iniText = `
[TextureOverrideHeroHead]
hash = 11111111
match_first_index = 0
ib = ResourceHeadIB
diffuse = ResourceHeadDiffuse

[TextureOverrideMysteriousMesh]
hash = 99999999
match_first_index = 500
ib = ResourceMeshIB
diffuse = ResourceMeshDiffuse

[ResourceHeadDiffuse]
filename = Head.dds
`;
  const doc = parseIni(iniText);
  const docsMap = new Map([['main.ini', doc]]);

  const result = sm.analyzeDocuments(docsMap);
  assert.equal(result.slots.length, 1);
  assert.equal(result.slots[0].part.toLowerCase(), 'head');
  assert.equal(result.slots[0].sectionName, 'TextureOverrideHeroHead');

  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].sectionName, 'TextureOverrideMysteriousMesh');

  // Manually assign mysterious mesh to 'body'
  sm.setPartMapping('TextureOverrideMysteriousMesh', 'body');

  const updatedSlots = sm.getSlots();
  assert.equal(updatedSlots.length, 2);
  const manualSlot = updatedSlots.find((s) => s.sectionName === 'TextureOverrideMysteriousMesh');
  assert.ok(manualSlot);
  assert.equal(manualSlot.part, 'body');
  assert.equal(manualSlot.isManual, true);
  assert.equal(sm.getUnmatched().length, 0);
});

test('ZZMI SlotFix custom resolver parses Resource\\ZZMI syntax and CommandList references', () => {
  const sm = new SlotManager();
  const zzmiResolver = createZzmiSlotResolver();
  const unregister = sm.registerTextureSlotResolver(zzmiResolver);

  const iniText = `
[TextureOverrideAnbyBody]
hash = 12345678
match_first_index = 0
ib = ResourceAnbyBodyIB
run = CommandList\\ZZMI\\SetTextures

[CommandList\\ZZMI\\SetTextures]
Resource\\ZZMI\\Diffuse = ref ResourceAnbyDiffuse
Resource\\ZZMI\\NormalMap = ref ResourceAnbyNormal
Resource\\ZZMI\\LightMap = ref ResourceAnbyLight
Resource\\ZZMI\\WEngineFX = ref ResourceAnbyWEngine

[ResourceAnbyDiffuse]
filename = Anby_Body_D.dds

[ResourceAnbyNormal]
filename = Anby_Body_N.dds
`;
  const doc = parseIni(iniText);
  const docsMap = new Map([['anby.ini', doc]]);

  const result = sm.analyzeDocuments(docsMap);
  assert.equal(result.slots.length, 1);
  const bodySlot = result.slots[0];
  assert.equal(bodySlot.part.toLowerCase(), 'body');
  assert.equal(bodySlot.textureSlots.length, 4);

  const diffSlot = bodySlot.textureSlots.find((t) => t.slotId === 'ZZMI\\Diffuse');
  assert.ok(diffSlot);
  assert.equal(diffSlot.slotType, 'diffuse');
  assert.equal(diffSlot.resourceRef, 'ResourceAnbyDiffuse');
  assert.equal(diffSlot.textureFile, 'Anby_Body_D.dds');

  const fxSlot = bodySlot.textureSlots.find((t) => t.slotId === 'ZZMI\\WEngineFX');
  assert.ok(fxSlot);
  assert.equal(fxSlot.slotType, 'fx');

  unregister();
});

test('discoverModParts dynamically extracts arbitrary modder-defined parts per mod INI', () => {
  const iniSections = [
    'TextureOverrideJaneDoeBody',
    'TextureOverrideJaneDoeHead',
    'TextureOverrideJaneDoeTail',
    'TextureOverrideJaneDoeJacket',
    'TextureOverrideJaneDoeKnife',
  ];

  const map = discoverModParts(iniSections);
  assert.equal(map.get('TextureOverrideJaneDoeBody'), 'Body');
  assert.equal(map.get('TextureOverrideJaneDoeHead'), 'Head');
  assert.equal(map.get('TextureOverrideJaneDoeTail'), 'Tail');
  assert.equal(map.get('TextureOverrideJaneDoeJacket'), 'Jacket');
  assert.equal(map.get('TextureOverrideJaneDoeKnife'), 'Knife');
});

test('SlotManager supports arbitrary dynamic part names in analyzeDocuments and setPartMapping', () => {
  const sm = new SlotManager();
  const iniText = `
[TextureOverrideEllenHair]
hash = 1001
diffuse = ResourceHair

[TextureOverrideEllenTail]
hash = 1002
diffuse = ResourceTail

[TextureOverrideEllenSharkBlade]
hash = 1003
diffuse = ResourceBlade
`;
  const doc = parseIni(iniText);
  const result = sm.analyzeDocuments(new Map([['ellen.ini', doc]]));

  assert.equal(result.slots.length, 3);
  const parts = result.slots.map((s) => s.part);
  assert.ok(parts.includes('Hair'));
  assert.ok(parts.includes('Tail'));
  assert.ok(parts.includes('Blade'));

  // Custom manual mapping with an arbitrary part name
  sm.setPartMapping('TextureOverrideEllenTail', 'CyberTail');
  const tailSlot = sm.getSlot('cybertail');
  assert.ok(tailSlot);
  assert.equal(tailSlot.part, 'CyberTail');
});

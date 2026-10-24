import type { IniDocument, IniSection } from '../ini/ini.ts';
import type { ModPartType, TextureSlot, TextureSlotResolver } from './types.ts';

export const PART_LABELS: Record<ModPartType, string> = {
  body: '몸체 (Body)',
  head: '머리 (Head)',
  hair: '헤어 (Hair)',
  face: '얼굴 (Face)',
  dress: '의상 (Dress)',
  weapon: '무기 (Weapon)',
  extra: '장신구 (Accessory)',
  custom: '커스텀 (Custom)',
  unknown: '미분류 (Unknown)',
};

/**
 * 섹션 이름을 분석하여 3DMigoto/XXMI 모드 모델 부위를 추정합니다.
 */
export function detectPartFromSectionName(sectionName: string): ModPartType {
  const norm = sectionName.toLowerCase().replace(/^(textureoverride|shaderoverride|override)/i, '');

  // 1. 헤어 (머리 전체보다 더 구체적인 키워드 우선)
  if (/(hair|ahoge|bangs|ponytail|twintail|pigtail)/i.test(norm)) {
    return 'hair';
  }

  // 2. 얼굴 및 이목구비
  if (/(face|facemesh|eye|eyebrow|mouth|teeth|tongue|lip)/i.test(norm)) {
    return 'face';
  }

  // 3. 머리 (Head)
  if (/(head|headmesh|skull)/i.test(norm)) {
    return 'head';
  }

  // 4. 의상/복장
  if (/(dress|costume|outfit|cloth|shirt|skirt|pants|jacket|suit|coat|underwear|bra|panties|top|bottom|shoes|boots|sock)/i.test(norm)) {
    return 'dress';
  }

  // 5. 몸체/피부
  if (/(body|bodymesh|skin|arm|leg|torso|hand|foot|feet|handmesh)/i.test(norm)) {
    return 'body';
  }

  // 6. 무기
  if (/(weapon|sword|gun|bow|blade|shield|spear|catalyst|wengine|claymore|polearm|dagger)/i.test(norm)) {
    return 'weapon';
  }

  // 7. 장신구/부속품
  if (/(acc|accessory|hat|glasses|mask|wing|tail|ribbon|badge|prop|item|ring|earring|necklace|cape)/i.test(norm)) {
    return 'extra';
  }

  // 8. 커스텀/기타 부위
  if (/(custom|part|misc)/i.test(norm)) {
    return 'custom';
  }

  return 'unknown';
}

/**
 * [Resource<Name>] 섹션에서 실제 텍스처 파일명을 조회합니다.
 */
export function findResourceFilename(resourceName: string, doc: IniDocument, allDocs?: Map<string, IniDocument>): string | undefined {
  const clean = resourceName.replace(/^[\\$]+/, '').replace(/^ref\s+/i, '').trim();
  const candidates = [clean, `Resource${clean}`, `Resource\\${clean}`];

  const searchIn = (d: IniDocument): string | undefined => {
    for (const name of candidates) {
      const sec = d.getSection(name);
      if (sec && sec.properties['filename']) {
        return sec.properties['filename'].replace(/['"]/g, '').trim();
      }
    }
    return undefined;
  };

  const found = searchIn(doc);
  if (found) return found;

  if (allDocs) {
    for (const otherDoc of allDocs.values()) {
      const f = searchIn(otherDoc);
      if (f) return f;
    }
  }

  return undefined;
}

/**
 * 표준 3DMigoto 텍스처 슬롯 파서 (ps-t0, ps-t1, Direct 프로퍼티 등)
 */
export const standard3DMigotoResolver: TextureSlotResolver = {
  id: 'standard-3dmigoto',
  name: '표준 3DMigoto 슬롯 리졸버',
  priority: 0,
  resolveSlots: (section: IniSection, doc: IniDocument, allDocs?: Map<string, IniDocument>): TextureSlot[] | null => {
    const slots: TextureSlot[] = [];
    const props = section.properties;

    for (const [key, rawVal] of Object.entries(props)) {
      const lowerKey = key.toLowerCase();
      const cleanVal = rawVal.replace(/^ref\s+/i, '').trim();

      // ps-t0, ps-t1, ps-t2... 패턴
      const psMatch = lowerKey.match(/^ps-t(\d+)$/);
      if (psMatch) {
        const slotNum = parseInt(psMatch[1], 10);
        let slotType: TextureSlot['slotType'] = 'custom';
        if (slotNum === 0) slotType = 'diffuse';
        else if (slotNum === 1) slotType = 'light';
        else if (slotNum === 2) slotType = 'normal';
        else if (slotNum === 3) slotType = 'material';

        slots.push({
          slotId: `ps-t${slotNum}`,
          slotType,
          resourceRef: cleanVal,
          textureFile: findResourceFilename(cleanVal, doc, allDocs),
          sourceSection: section.name,
          rawLine: `${key} = ${rawVal}`,
        });
        continue;
      }

      // 직접 이름 프로퍼티 (diffuse = ..., normal = ...)
      if (/^(diffuse|diffusemap)$/i.test(lowerKey)) {
        slots.push({
          slotId: 'Diffuse',
          slotType: 'diffuse',
          resourceRef: cleanVal,
          textureFile: findResourceFilename(cleanVal, doc, allDocs),
          sourceSection: section.name,
          rawLine: `${key} = ${rawVal}`,
        });
      } else if (/^(normal|normalmap)$/i.test(lowerKey)) {
        slots.push({
          slotId: 'NormalMap',
          slotType: 'normal',
          resourceRef: cleanVal,
          textureFile: findResourceFilename(cleanVal, doc, allDocs),
          sourceSection: section.name,
          rawLine: `${key} = ${rawVal}`,
        });
      } else if (/^(light|lightmap)$/i.test(lowerKey)) {
        slots.push({
          slotId: 'LightMap',
          slotType: 'light',
          resourceRef: cleanVal,
          textureFile: findResourceFilename(cleanVal, doc, allDocs),
          sourceSection: section.name,
          rawLine: `${key} = ${rawVal}`,
        });
      }
    }

    return slots.length > 0 ? slots : null;
  },
};

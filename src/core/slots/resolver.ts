import type { IniDocument, IniSection } from '../ini/ini.ts';
import type { ModPartType, TextureSlot, TextureSlotResolver } from './types.ts';

export const PART_LABELS: Record<string, string> = {
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
 * 부위 식별자를 사람이 읽기 좋은 레이블로 변환합니다.
 * 표준 부위는 한/영 병기 레이블을 제공하고, 모더가 자유롭게 명명한 부위는 깔끔한 타이틀 형태로 포맷팅합니다.
 */
export function formatPartLabel(part: string): string {
  const lower = part.toLowerCase();
  if (PART_LABELS[lower]) {
    return PART_LABELS[lower];
  }
  // camelCase 또는 snake_case를 공백으로 분리
  const spaced = part
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return part;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * 부위 이름 문자열을 기반으로 일관되고 미려한 HSL 배지 색상 스타일을 생성합니다.
 */
export function getPartColorStyle(part: string): { bg: string; color: string; border: string } {
  const lower = part.toLowerCase();
  if (lower === 'unknown') {
    return {
      bg: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.35)',
    };
  }

  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash << 5) - hash + lower.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsla(${hue}, 70%, 50%, 0.16)`,
    color: `hsl(${hue}, 85%, 68%)`,
    border: `1px solid hsla(${hue}, 70%, 50%, 0.32)`,
  };
}

/**
 * 모드 INI 전체의 오버라이드 섹션 목록을 분석하여,
 * 모더가 부여한 고유한 부위 이름들을 동적으로 파악합니다.
 */
export function discoverModParts(sectionNames: string[]): Map<string, string> {
  const result = new Map<string, string>();
  if (sectionNames.length === 0) return result;

  // 1. 3DMigoto 표준 접두사 제거
  const entries: Array<{ original: string; stripped: string }> = [];
  for (const name of sectionNames) {
    const clean = name.replace(/^(textureoverride|shaderoverride|override)[_-\s]*/i, '');
    entries.push({ original: name, stripped: clean });
  }

  // 2. 모드 내 섹션들이 공유하는 공통 캐릭터/모드 접두사 탐색 (예: 'Roxy', 'JaneDoe', 'Keqing_')
  const valid = entries.map((e) => e.stripped).filter((s) => s.length > 0);
  let commonPrefix = '';

  if (valid.length >= 2) {
    const first = valid[0];
    let maxLen = 0;
    for (let len = 1; len <= first.length; len++) {
      const candidate = first.slice(0, len);
      if (valid.every((s) => s.toLowerCase().startsWith(candidate.toLowerCase()))) {
        maxLen = len;
      } else {
        break;
      }
    }

    if (maxLen >= 2) {
      commonPrefix = first.slice(0, maxLen);
      // 언더스코어가 있다면 언더스코어까지를 깔끔한 접두사로 분리
      const lastUnderscore = commonPrefix.lastIndexOf('_');
      if (lastUnderscore >= 2) {
        commonPrefix = commonPrefix.slice(0, lastUnderscore + 1);
      }
    }
  }

  // 3. 각 섹션별 최종 부위 식별자 결정
  for (const entry of entries) {
    let part = entry.stripped;

    if (commonPrefix && part.toLowerCase().startsWith(commonPrefix.toLowerCase())) {
      const rest = part.slice(commonPrefix.length).replace(/^[_-\s]+/, '');
      if (rest.length > 0 && !/^\d+$/.test(rest)) {
        part = rest;
      }
    }

    if (!part) {
      part = detectPartFromSectionName(entry.original);
    } else {
      part = refinePartName(part, entry.original);
    }

    result.set(entry.original, part);
  }

  return result;
}

function refinePartName(part: string, originalSection: string): string {
  const lower = part.toLowerCase();

  // 명확한 부위가 아니거나 모호한 명칭은 unknown으로 분류하여 수동 매칭 패널로 유도
  if (
    !part ||
    lower === 'mesh' ||
    lower === 'texture' ||
    lower.includes('mysterious') ||
    lower.includes('random') ||
    lower.includes('dummy') ||
    lower.includes('unknown') ||
    /^(temp|test|mesh)\d*$/i.test(part) ||
    /^[a-f0-9]{8,}$/i.test(part)
  ) {
    return 'unknown';
  }

  // 꼬리, 재킷, 머리, 몸체, 리본, 칼날 등 흔히 쓰이는 부위 키워드가 끝에 붙어 있는 경우 추출
  const match = part.match(/(hair|ahoge|bangs|face|eye|head|dress|outfit|skirt|pants|jacket|suit|body|skin|arm|leg|weapon|sword|gun|bow|blade|tail|ribbon|horn|wing|cape|glasses|mask|hat|bell|prop)/i);
  if (match) {
    const matched = match[0];
    const cap = matched.charAt(0).toUpperCase() + matched.slice(1).toLowerCase();
    if (lower.endsWith(matched.toLowerCase())) {
      return cap;
    }
  }

  const clean = part.replace(/^[_-\s]+|[_-\s]+$/g, '');
  if (!clean || clean.toLowerCase() === 'unknown') return 'unknown';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * 단일 섹션 이름을 바탕으로 부위를 추정합니다 (모드 전체 파싱이 없을 때의 fallback).
 */
export function detectPartFromSectionName(sectionName: string): ModPartType {
  const norm = sectionName.toLowerCase().replace(/^(textureoverride|shaderoverride|override)[_-\s]*/i, '');
  if (!norm) return 'unknown';

  if (/(hair|ahoge|bangs|ponytail|twintail|pigtail)/i.test(norm)) return 'hair';
  if (/(face|facemesh|eye|eyebrow|mouth|teeth|tongue|lip)/i.test(norm)) return 'face';
  if (/(head|headmesh|skull)/i.test(norm)) return 'head';
  if (/(dress|costume|outfit|cloth|shirt|skirt|pants|jacket|suit|coat|underwear|bra|panties|top|bottom|shoes|boots|sock)/i.test(norm)) return 'dress';
  if (/(body|bodymesh|skin|arm|leg|torso|hand|foot|feet|handmesh)/i.test(norm)) return 'body';
  if (/(weapon|sword|gun|bow|blade|shield|spear|catalyst|wengine|claymore|polearm|dagger)/i.test(norm)) return 'weapon';
  if (/(acc|accessory|hat|glasses|mask|wing|tail|ribbon|badge|prop|item|ring|earring|necklace|cape|bell)/i.test(norm)) return 'extra';
  if (/(custom|part|misc)/i.test(norm)) return 'custom';

  // 특정 키워드에 걸리지 않았더라도 의미 있는 모더 고유 부위명인 경우 추출
  if (/^[a-zA-Z][a-zA-Z0-9_-]{1,}$/.test(norm)) {
    if (/^(random|temp|dummy|test|mesh)\d+$/i.test(norm) || /^[a-f0-9]{8,}$/i.test(norm)) {
      return 'unknown';
    }
    return norm.charAt(0).toUpperCase() + norm.slice(1);
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

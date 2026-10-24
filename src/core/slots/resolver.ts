import type { IniDocument, IniSection } from '../ini/ini.ts';
import type { ModPartType, TextureSlot, TextureSlotResolver } from './types.ts';

export const PART_LABELS: Record<string, string> = {
  head: '머리 (Head)',
  hair: '헤어 (Hair)',
  face: '얼굴 (Face)',
  body: '몸체 (Body)',
  dress: '의상 (Dress)',
  weapon: '무기 (Weapon)',
  tail: '꼬리 (Tail)',
  coat: '코트 (Coat)',
  jacket: '재킷 (Jacket)',
  upper: '상의 (Upper)',
  lower: '하의 (Lower)',
  top: '상의 (Top)',
  bottom: '하의 (Bottom)',
  skirt: '스커트 (Skirt)',
  pants: '바지 (Pants)',
  shoes: '신발 (Shoes)',
  boots: '부츠 (Boots)',
  socks: '양말 (Socks)',
  stockings: '스타킹 (Stockings)',
  wings: '날개 (Wings)',
  wing: '날개 (Wing)',
  horn: '뿔 (Horn)',
  ears: '귀 (Ears)',
  ribbon: '리본 (Ribbon)',
  sword: '검 (Sword)',
  blade: '칼날 (Blade)',
  dagger: '단검 (Dagger)',
  gun: '총기 (Gun)',
  bow: '활 (Bow)',
  saw: '톱 (Saw)',
  shield: '방패 (Shield)',
  glasses: '안경 (Glasses)',
  mask: '가면 (Mask)',
  hat: '모자 (Hat)',
  cap: '모자 (Cap)',
  bag: '가방 (Bag)',
  earrings: '귀걸이 (Earrings)',
  necklace: '목걸이 (Necklace)',
  cape: '망토 (Cape)',
  gloves: '장갑 (Gloves)',
  accessory: '장신구 (Accessory)',
  extra: '장신구 (Extra)',
  custom: '커스텀 (Custom)',
  unknown: '미분류 (Unknown)',
};

/**
 * 부위 식별자를 사람이 읽기 좋은 레이블로 변환합니다.
 * 사전에 등록된 부위는 한/영 병기 레이블을 제공하고,
 * 모더가 자유롭게 명명한 부위(예: SharkBlade, MechaArm 등)는 깔끔한 타이틀 형태로 띄어쓰기 및 대문자 포맷팅합니다.
 */
export function formatPartLabel(part: string): string {
  const lower = part.toLowerCase();
  if (PART_LABELS[lower]) {
    return PART_LABELS[lower];
  }
  // camelCase 또는 snake_case / kebab-case를 공백으로 분리
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
 * 섹션 이름에서 3DMigoto 오버라이드 접두사 및 기술/텍스처 접미사를 정리합니다.
 */
export function cleanSectionName(sectionName: string): string {
  let clean = sectionName.replace(/^(textureoverride|shaderoverride|override|commandlist)[_-\s]*/i, '');

  // 끝에 붙은 기술 접미사(IB, VB, Remap 등) 제거 (단, 이름 전체가 IB/VB인 경우는 유지)
  if (clean.length > 3 && /(ib|vb|remap|blend|position|texcoord|normal|tangent)$/i.test(clean)) {
    clean = clean.replace(/(ib|vb|remap|blend|position|texcoord|normal|tangent)$/i, '');
  }

  // 끝에 붙은 텍스처 타입 접미사 제거 (예: BodyDiffuse -> Body, TailTex -> Tail)
  if (clean.length > 5 && /(diffuse|lightmap|normalmap|materialmap|tex)$/i.test(clean)) {
    clean = clean.replace(/(diffuse|lightmap|normalmap|materialmap|tex)$/i, '');
  }

  return clean.replace(/^[_-\s]+|[_-\s]+$/g, '');
}

/**
 * 주어진 문자열이 독립된 부위명이 아닌 단순 서브메시 인덱스나 변형 식별자(A, B, 1, 2, _A 등)인지 판별합니다.
 */
export function isSubmeshVariantOnly(str: string): boolean {
  if (!str) return true;
  const s = str.trim();
  // 1글자 알파벳 (A, B, C...)
  if (/^[a-zA-Z]$/.test(s)) return true;
  // 1~2자리 숫자 (0, 1, 2... 99)
  if (/^\d{1,2}$/.test(s)) return true;
  // 밑줄이나 하이픈으로 시작하는 1~2글자 인덱스 (_A, _1, -B, _01)
  if (/^[-_][a-zA-Z0-9]{1,2}$/.test(s)) return true;
  // 단독 2글자 영숫자 인덱스 (A1, 1A, a1, b2)
  if (/^[a-zA-Z]\d$/.test(s) || /^\d[a-zA-Z]$/.test(s)) return true;
  return false;
}

/**
 * 공통 접두사가 부위 어간(stem)까지 과도하게 포함한 경우,
 * 실제 캐릭터/모더 접두사 경계로 안전하게 후퇴(back-off)시킵니다.
 */
export function backOffPrefix(prefix: string): string {
  if (!prefix || prefix.length <= 2) return prefix;

  // 1. 구분자(_ 또는 -)가 있는 경우 마지막 구분자 경계로 후퇴
  const lastDelim = Math.max(prefix.lastIndexOf('_'), prefix.lastIndexOf('-'));
  if (lastDelim >= 1) {
    return prefix.slice(0, lastDelim + 1);
  }

  // 2. PascalCase / CamelCase 대문자 경계가 여러 개 있는 경우 (예: PearlBody -> Pearl)
  const upperIndices: number[] = [];
  for (let i = 0; i < prefix.length; i++) {
    if (/[A-Z]/.test(prefix[i])) {
      upperIndices.push(i);
    }
  }
  if (upperIndices.length >= 2) {
    const lastUpper = upperIndices[upperIndices.length - 1];
    if (lastUpper >= 2) {
      return prefix.slice(0, lastUpper);
    }
  }

  // 3. 알려진 부위 키워드(PART_LABELS)로 끝나는지 검사 (예: Pearlbody -> body로 끝나므로 Pearl)
  const lower = prefix.toLowerCase();
  for (const partKey of Object.keys(PART_LABELS)) {
    if (partKey.length >= 3 && lower.endsWith(partKey) && prefix.length > partKey.length) {
      const cutPos = prefix.length - partKey.length;
      return prefix.slice(0, cutPos);
    }
  }

  // 4. 일반적인 단어 분절: 첫 번째 PascalCase 단어 분리 (예: Pearlbody -> Pearl + body)
  const match = prefix.match(/^([A-Z][a-z]{2,})([a-z]{2,})$/);
  if (match) {
    return match[1];
  }

  return prefix;
}

/**
 * 단일 섹션명에서 캐릭터/모드 접두사를 분리하고 모더가 명명한 부위 이름을 추출합니다.
 */
export function extractPartName(name: string): string {
  const cleaned = cleanSectionName(name);
  if (!cleaned) return 'unknown';

  const lower = cleaned.toLowerCase();
  if (
    lower.includes('random') ||
    lower.includes('dummy') ||
    lower.includes('mysterious') ||
    lower.includes('unknown') ||
    /^(temp|test|mesh)\d*$/i.test(cleaned) ||
    /^[a-f0-9]{8,}$/i.test(cleaned)
  ) {
    return 'unknown';
  }

  // 언더스코어 또는 하이픈 구분자가 있는 경우 마지막 세그먼트를 부위명으로 사용
  // 예: JaneDoe_Tail -> Tail, Mod_Char_Coat -> Coat, Jane_Body_A -> BodyA
  if (cleaned.includes('_') || cleaned.includes('-')) {
    const parts = cleaned.split(/[-_]+/).filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (parts.length >= 3 && isSubmeshVariantOnly(last)) {
        const prev = parts[parts.length - 2];
        return refinePartName(`${prev}${last}`);
      }
      if (last && !/^\d+$/.test(last)) {
        return refinePartName(last);
      }
    }
  }

  // 끝부분이 서브메시 인덱스(A, B, 1, 2)로 끝나는 경우 어간 탐색
  // 예: PearlbodyA -> Pearlbody + A
  const endVariantMatch = cleaned.match(/^(.+?)([A-Z]|\d{1,2})$/);
  if (endVariantMatch) {
    const stem = endVariantMatch[1];
    const variant = endVariantMatch[2];

    if (isSubmeshVariantOnly(variant)) {
      const lowerStem = stem.toLowerCase();
      for (const partKey of Object.keys(PART_LABELS)) {
        if (partKey.length >= 3 && lowerStem.endsWith(partKey)) {
          const matchedPart = stem.slice(stem.length - partKey.length);
          return refinePartName(`${matchedPart}${variant}`);
        }
      }
    }
  }

  // CamelCase 분절 탐색 (예: HeroHead -> Head, AnbyBody -> Body, PearlBodyA -> BodyA)
  const tokens = cleaned.match(/[A-Z][a-z0-9]*/g);
  if (tokens && tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    if (isSubmeshVariantOnly(last)) {
      const prev = tokens[tokens.length - 2];
      return refinePartName(`${prev}${last}`);
    }
    if (tokens.length >= 3) {
      return refinePartName(last);
    }
    return refinePartName(last);
  }

  return refinePartName(cleaned);
}

/**
 * 모드 INI 전체의 오버라이드 섹션 목록을 분석하여,
 * 미리 정해둔 부위에 끼워맞추지 않고 모더가 명명한 실제 부위 이름들을 모드 단위로 동적 파악합니다.
 */
export function discoverModParts(sectionNames: string[]): Map<string, string> {
  const result = new Map<string, string>();
  if (sectionNames.length === 0) return result;

  // 1. 섹션명에서 기술적 접두사/접미사 1차 정리
  const entries: Array<{ original: string; cleaned: string }> = [];
  for (const name of sectionNames) {
    const cleaned = cleanSectionName(name);
    entries.push({ original: name, cleaned });
  }

  // 2. 모드 내 섹션들이 공유하는 공통 캐릭터/모드 접두사 탐색 (예: 'Roxy', 'JaneDoe_', 'Ellen', 'Pearl')
  const valid = entries.map((e) => e.cleaned).filter((s) => s.length > 0 && refinePartName(s) !== 'unknown');
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
      // 언더스코어나 하이픈이 있다면 구분자까지를 접두사 경계로 정리
      const lastDelim = Math.max(commonPrefix.lastIndexOf('_'), commonPrefix.lastIndexOf('-'));
      if (lastDelim >= 2) {
        commonPrefix = commonPrefix.slice(0, lastDelim + 1);
      }
    }
  }

  // 공통 접두사가 너무 많은 부분(부위 어간)까지 삼켜서 남은 문자열이 단순 인덱스(A, B, 1 등)만 남는 경우 back-off
  if (commonPrefix && valid.length >= 1) {
    const remnants = valid.map((v) => {
      if (v.toLowerCase().startsWith(commonPrefix.toLowerCase())) {
        return v.slice(commonPrefix.length).replace(/^[_-\s]+/, '');
      }
      return v;
    });

    const isAllVariant = remnants.every((r) => isSubmeshVariantOnly(r));
    if (isAllVariant) {
      const backed = backOffPrefix(commonPrefix);
      if (backed !== commonPrefix && backed.length > 0) {
        commonPrefix = backed;
      }
    }
  }

  // 3. 각 섹션별 최종 부위 식별자 결정
  for (const entry of entries) {
    let part = entry.cleaned;

    // 공통 접두사가 존재하면 제거하여 모더가 부여한 실제 부위명만 추출
    if (commonPrefix && part.toLowerCase().startsWith(commonPrefix.toLowerCase())) {
      const rest = part.slice(commonPrefix.length).replace(/^[_-\s]+/, '');
      if (rest.length > 0 && !isSubmeshVariantOnly(rest)) {
        part = rest;
      } else if (isSubmeshVariantOnly(rest)) {
        // 혹시라도 여전히 서브메시 인덱스만 남은 경우 fallback
        part = extractPartName(entry.cleaned);
      }
    } else {
      // 공통 접두사가 적용되지 않는 개별 섹션은 CamelCase / 구분자 분절 적용
      part = extractPartName(entry.cleaned);
    }

    if (!part || part === 'unknown') {
      part = extractPartName(entry.original);
    } else {
      part = refinePartName(part);
    }

    result.set(entry.original, part);
  }

  return result;
}

/**
 * 모더가 지은 부위 이름을 정제합니다.
 * 미리 정해둔 카테고리로 축소하지 않고 모더가 지은 부위명(Tail, Blade, Jacket 등)을 온전히 보존합니다.
 */
function refinePartName(part: string): string {
  const lower = part.toLowerCase();

  // 부위명이 아니거나 의미를 알 수 없는 모호한 명칭, 또는 단독 서브메시 인덱스는 unknown 처리
  if (
    !part ||
    lower === 'mesh' ||
    lower === 'texture' ||
    lower.includes('mysterious') ||
    lower.includes('random') ||
    lower.includes('dummy') ||
    lower.includes('unknown') ||
    /^(temp|test|mesh)\d*$/i.test(part) ||
    /^[a-f0-9]{8,}$/i.test(part) ||
    isSubmeshVariantOnly(part)
  ) {
    return 'unknown';
  }

  const clean = part.replace(/^[_-\s]+|[_-\s]+$/g, '');
  if (!clean || clean.toLowerCase() === 'unknown') return 'unknown';

  // 첫 글자 대문자화하여 모더의 부위명 그대로 반환
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * 단일 섹션 이름을 바탕으로 부위를 추정합니다 (모드 전체 파싱이 없을 때의 fallback).
 * 특정 몇 개 카테고리에 고정하지 않고, 섹션명에 적힌 모더의 부위 명칭을 추출합니다.
 */
export function detectPartFromSectionName(sectionName: string): ModPartType {
  return extractPartName(sectionName);
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

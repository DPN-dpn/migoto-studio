/**
 * INI 구조 파싱, 섹션 분류 및 스마트 병합 코어 API
 * 3DMigoto 및 XXMI 포맷을 완벽하게 지원합니다.
 */

export interface IniSection {
  /** 섹션 이름 (예: "TextureOverrideBody", "KeyToggle") */
  name: string;
  /** 원본 헤더 라인 (예: "[TextureOverrideBody]") */
  header: string;
  /** 섹션 분류 그룹 (예: "텍스처 오버라이드", "키 (단축키)" 등) */
  group: string;
  /** 시작 줄 번호 (1-indexed) */
  startLine: number;
  /** 끝 줄 번호 (1-indexed) */
  endLine: number;
  /** 헤더를 제외한 본문 줄 목록 */
  bodyLines: string[];
  /** 본문 텍스트 */
  body: string;
  /** 헤더를 포함한 전체 텍스트 */
  fullText: string;
  /** 파싱된 key = value 속성 맵 (키는 소문자로 정규화됨) */
  properties: Record<string, string>;
  /** 파싱된 $var = value 변수 맵 */
  variables: Record<string, string>;
  /** 섹션 내부 주석 라인 목록 */
  comments: string[];
}

export interface IniDocument {
  /** 첫 번째 섹션 이전의 주석 및 전역 내용 */
  preamble: string;
  /** 파싱된 모든 섹션 목록 */
  sections: IniSection[];
  /** 이름으로 섹션 검색 (대소문자 무시) */
  getSection(name: string): IniSection | undefined;
  /** 특정 이름의 섹션 존재 여부 확인 */
  hasSection(name: string): boolean;
  /** 특정 그룹에 속한 섹션들 필터링 */
  getSectionsByGroup(group: string): IniSection[];
}

export interface IniMergeResult {
  /** 스마트 병합된 최종 텍스트 */
  newText: string;
  /** 기존 파일에서 제자리 교체된 섹션 이름 목록 */
  replacedSections: string[];
  /** 기존 파일에 새로 추가된 섹션 이름 목록 */
  addedSections: string[];
  /** 변경되지 않고 그대로 보존된 기존 섹션 이름 목록 */
  preservedSections: string[];
}

const SECTION_GROUP_PATTERNS: Array<[RegExp, string]> = [
  [/^key/i, '키 (단축키)'],
  [/^textureoverride/i, '텍스처 오버라이드'],
  [/^shaderoverride/i, '셰이더 오버라이드'],
  [/^shaderregex/i, '셰이더 정규식'],
  [/^resource/i, '리소스'],
  [/^commandlist/i, '커맨드 리스트'],
  [/^customshader/i, '커스텀 셰이더'],
  [/^constants/i, '상수 (전역)'],
  [/^present/i, '프레임 렌더링 (Present)'],
  [/^(include|logging|system|device|rendering|hunting|profile|loader|stereo|convergence|depth|cursor|dummy|ini)/i, '일반 설정'],
];

/**
 * 섹션 이름의 접두사와 패턴을 분석하여 어떤 역할/유형의 섹션인지 분류합니다.
 */
export function classifyIniSection(name: string): string {
  const trimmed = name.trim();
  for (const [pattern, group] of SECTION_GROUP_PATTERNS) {
    if (pattern.test(trimmed)) {
      return group;
    }
  }
  return '기타';
}

/**
 * 인라인 주석(;)을 제거합니다 (문자열 내의 따옴표는 안전하게 보존).
 */
function stripInlineComment(line: string): string {
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      if (!inQuote) inQuote = ch;
      else if (inQuote === ch) inQuote = null;
    } else if (ch === ';' && !inQuote) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

/**
 * INI 텍스트를 구조화된 IniDocument로 파싱합니다.
 */
export function parseIni(text: string): IniDocument {
  const lines = text.split(/\r?\n/);
  const sectionHeaderRegex = /^\s*\[([^\]\r\n]+)\]/;
  const sections: IniSection[] = [];

  let firstSectionLineIdx = -1;
  const sectionMarkers: Array<{ name: string; header: string; lineIdx: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const match = sectionHeaderRegex.exec(lines[i]);
    if (match) {
      if (firstSectionLineIdx === -1) firstSectionLineIdx = i;
      sectionMarkers.push({
        name: match[1].trim(),
        header: lines[i],
        lineIdx: i,
      });
    }
  }

  const preamble = firstSectionLineIdx === -1
    ? text
    : lines.slice(0, firstSectionLineIdx).join('\n');

  for (let s = 0; s < sectionMarkers.length; s++) {
    const startLineIdx = sectionMarkers[s].lineIdx;
    const endLineIdx = s + 1 < sectionMarkers.length ? sectionMarkers[s + 1].lineIdx : lines.length;
    const blockLines = lines.slice(startLineIdx, endLineIdx);
    const bodyLines = blockLines.slice(1);

    const properties: Record<string, string> = {};
    const variables: Record<string, string> = {};
    const comments: string[] = [];

    for (const bLine of bodyLines) {
      const trimmedLine = bLine.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith(';')) {
        comments.push(trimmedLine);
        continue;
      }

      const cleanLine = stripInlineComment(bLine);
      const eqIdx = cleanLine.indexOf('=');
      if (eqIdx !== -1) {
        const key = cleanLine.slice(0, eqIdx).trim();
        const val = cleanLine.slice(eqIdx + 1).trim();
        if (key.startsWith('$')) {
          variables[key] = val;
        } else {
          properties[key.toLowerCase()] = val;
        }
      }
    }

    sections.push({
      name: sectionMarkers[s].name,
      header: sectionMarkers[s].header,
      group: classifyIniSection(sectionMarkers[s].name),
      startLine: startLineIdx + 1,
      endLine: endLineIdx,
      bodyLines,
      body: bodyLines.join('\n').trimEnd(),
      fullText: blockLines.join('\n').trimEnd(),
      properties,
      variables,
      comments,
    });
  }

  return {
    preamble,
    sections,
    getSection(name: string): IniSection | undefined {
      const target = name.trim().toLowerCase();
      return sections.find((sec) => sec.name.toLowerCase() === target);
    },
    hasSection(name: string): boolean {
      const target = name.trim().toLowerCase();
      return sections.some((sec) => sec.name.toLowerCase() === target);
    },
    getSectionsByGroup(group: string): IniSection[] {
      return sections.filter((sec) => sec.group === group);
    },
  };
}

/**
 * targetText(기존 문서)에 sourceText(수정/새 코드)의 섹션들을 스마트하게 병합합니다.
 * - 이미 존재하는 섹션은 그 자리에서 원형을 유지하며 교체됩니다.
 * - 새로 나타난 섹션은 파일 끝에 추가됩니다.
 * - 수정 대상이 아닌 기존 섹션과 상단 주석은 안전하게 보존됩니다.
 */
export function mergeIniSections(
  targetText: string,
  sourceText: string,
  options?: { appendNew?: boolean },
): IniMergeResult {
  const targetDoc = parseIni(targetText);
  const sourceDoc = parseIni(sourceText);
  const appendNew = options?.appendNew !== false;

  const replacedSections: string[] = [];
  const addedSections: string[] = [];
  const preservedSections: string[] = [];

  // source에 섹션이 없는 경우 (단순 표현식, 코드 조각 등)
  if (sourceDoc.sections.length === 0) {
    if (!targetText.trim()) {
      return {
        newText: sourceText.trim() + '\n',
        replacedSections: [],
        addedSections: ['(전체)'],
        preservedSections: [],
      };
    }
    const sep = targetText.endsWith('\n\n') ? '' : targetText.endsWith('\n') ? '\n' : '\n\n';
    return {
      newText: targetText + sep + sourceText.trim() + '\n',
      replacedSections: [],
      addedSections: ['(추가)'],
      preservedSections: targetDoc.sections.map((s) => s.name),
    };
  }

  // target이 비어있는 경우
  if (!targetText.trim()) {
    return {
      newText: sourceText.trim() + '\n',
      replacedSections: [],
      addedSections: sourceDoc.sections.map((s) => s.name),
      preservedSections: [],
    };
  }

  // 기존 섹션 대소문자 매핑
  const targetMap = new Map<string, number>();
  targetDoc.sections.forEach((sec, idx) => {
    targetMap.set(sec.name.toLowerCase(), idx);
  });

  const updatedSections = [...targetDoc.sections];
  const appendedSections: IniSection[] = [];
  const handledSourceKeys = new Set<string>();

  for (const srcSec of sourceDoc.sections) {
    const key = srcSec.name.toLowerCase();
    if (targetMap.has(key)) {
      const idx = targetMap.get(key)!;
      updatedSections[idx] = srcSec;
      replacedSections.push(srcSec.name);
      handledSourceKeys.add(key);
    } else if (appendNew) {
      appendedSections.push(srcSec);
      addedSections.push(srcSec.name);
      handledSourceKeys.add(key);
    }
  }

  for (const origSec of targetDoc.sections) {
    if (!handledSourceKeys.has(origSec.name.toLowerCase())) {
      preservedSections.push(origSec.name);
    }
  }

  const parts: string[] = [];
  if (targetDoc.preamble.trim()) {
    parts.push(targetDoc.preamble.trimEnd());
  }

  for (const sec of updatedSections) {
    parts.push(sec.fullText.trimEnd());
  }

  for (const sec of appendedSections) {
    parts.push(sec.fullText.trimEnd());
  }

  const newText = parts.join('\n\n') + '\n';
  return {
    newText,
    replacedSections,
    addedSections,
    preservedSections,
  };
}

/**
 * 섹션 이름과 속성 맵으로부터 깔끔한 INI 섹션 텍스트 블록을 포맷팅합니다.
 */
export function formatIniSection(
  name: string,
  properties: Record<string, string>,
  options?: { comments?: string[]; variables?: Record<string, string> },
): string {
  const lines: string[] = [`[${name}]`];

  if (options?.comments) {
    for (const c of options.comments) {
      lines.push(c.startsWith(';') ? c : `; ${c}`);
    }
  }

  if (options?.variables) {
    for (const [k, v] of Object.entries(options.variables)) {
      lines.push(`${k} = ${v}`);
    }
  }

  for (const [k, v] of Object.entries(properties)) {
    lines.push(`${k} = ${v}`);
  }

  return lines.join('\n');
}

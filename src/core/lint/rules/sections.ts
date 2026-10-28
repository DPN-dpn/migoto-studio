import type { monaco } from '../../editor/monaco.ts';
import { MarkerSeverity } from '../types.ts';
import { checkUnclosedBlocks, type BlockState } from './conditions.ts';

export interface SectionDef {
  name: string;
  line: number;
  col: number;
  endCol: number;
}

export function handleSectionHeader(
  code: string,
  line: number,
  commentIndex: number,
  sections: Map<string, SectionDef[]>,
  conditionStack: BlockState[],
  options: { unclosedBlocks: boolean; duplicateSections: boolean },
  markers: monaco.editor.IMarkerData[],
): { isSection: boolean; sectionName?: string } {
  const leadingWhitespaceMatch = /^\s*/.exec(code);
  const leadingSpaces = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;

  if (!code.slice(leadingSpaces).startsWith('[')) {
    return { isSection: false };
  }

  const closeBracket = code.indexOf(']', leadingSpaces);
  if (closeBracket === -1) {
    markers.push({
      severity: MarkerSeverity.Error,
      message: "섹션 헤더에 닫는 대괄호 ']'가 누락되었습니다.",
      startLineNumber: line,
      startColumn: leadingSpaces + 1,
      endLineNumber: line,
      endColumn: commentIndex + 1,
    });
    return { isSection: true };
  }

  const secName = code.slice(leadingSpaces + 1, closeBracket).trim();
  const startCol = leadingSpaces + 1;
  const endCol = closeBracket + 2;

  if (secName.length === 0) {
    markers.push({
      severity: MarkerSeverity.Error,
      message: '섹션 이름이 비어 있습니다.',
      startLineNumber: line,
      startColumn: startCol,
      endLineNumber: line,
      endColumn: endCol,
    });
    return { isSection: true };
  }

  // If we had unclosed if-blocks when a new section starts, flag them
  if (options.unclosedBlocks && conditionStack.length > 0) {
    checkUnclosedBlocks(conditionStack, 'section', markers);
  }

  const lower = secName.toLowerCase();
  const def: SectionDef = { name: secName, line, col: startCol, endCol };
  const existing = sections.get(lower);

  if (existing && existing.length > 0) {
    if (options.duplicateSections) {
      const prev = existing[0];
      markers.push({
        severity: MarkerSeverity.Warning,
        message: `섹션 '[${secName}]'이(가) 이미 ${prev.line}번째 줄에 정의되어 있습니다. (중복 정의)`,
        startLineNumber: line,
        startColumn: startCol,
        endLineNumber: line,
        endColumn: endCol,
      });
    }
    existing.push(def);
  } else {
    sections.set(lower, [def]);
  }

  return { isSection: true, sectionName: secName };
}

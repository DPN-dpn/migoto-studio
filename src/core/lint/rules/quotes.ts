import type { monaco } from '../../editor/monaco.ts';
import { MarkerSeverity } from '../types.ts';

/**
 * Strips comments from a line while respecting single and double quotes.
 * Returns the code part and the 0-based index where the comment started (or line.length if none).
 */
export function stripComments(line: string): { code: string; commentIndex: number } {
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ';' || (ch === '/' && line[i + 1] === '/')) {
        return { code: line.slice(0, i), commentIndex: i };
      }
    }
  }
  return { code: line, commentIndex: line.length };
}

/**
 * Checks for unclosed quotes in non-comment code.
 */
export function checkUnclosedQuotes(code: string): { unclosed: boolean; quoteChar: string; index: number } {
  let inQuote: '"' | "'" | null = null;
  let quoteIndex = -1;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      quoteIndex = i;
    }
  }
  return { unclosed: inQuote !== null, quoteChar: inQuote ?? '', index: quoteIndex };
}

export function lintQuotes(code: string, line: number, markers: monaco.editor.IMarkerData[]): void {
  const quoteCheck = checkUnclosedQuotes(code);
  if (quoteCheck.unclosed) {
    markers.push({
      severity: MarkerSeverity.Warning,
      message: `닫는 따옴표(${quoteCheck.quoteChar})가 누락되었습니다.`,
      startLineNumber: line,
      startColumn: quoteCheck.index + 1,
      endLineNumber: line,
      endColumn: code.length + 1,
    });
  }
}

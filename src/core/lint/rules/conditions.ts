import type { monaco } from '../../editor/monaco.ts';
import { MarkerSeverity } from '../types.ts';

export interface BlockState {
  type: 'if';
  line: number;
  col: number;
  endCol: number;
  hasElse: boolean;
}

/**
 * Checks for a single '=' instead of '==' in a conditional expression.
 */
export function checkConditionComparison(
  expr: string,
  line: number,
  baseCol: number,
  markers: monaco.editor.IMarkerData[],
): void {
  // Look for '=' that is NOT part of '==', '!=', '<=', '>='
  const eqRe = /(?<![!<>=])=(?!=)/g;
  let m: RegExpExecArray | null;
  while ((m = eqRe.exec(expr)) !== null) {
    const col = baseCol + m.index + 1;
    markers.push({
      severity: MarkerSeverity.Warning,
      message: "조건문에서 단일 등호 '='가 사용되었습니다. 값 비교에는 '=='를 사용해야 합니다.",
      startLineNumber: line,
      startColumn: col,
      endLineNumber: line,
      endColumn: col + 1,
    });
  }
}

/**
 * Validates condition keywords (if, elif, else, endif) and tracks condition block stack.
 */
export function handleConditionStatement(
  code: string,
  line: number,
  conditionStack: BlockState[],
  options: { unclosedBlocks: boolean; comparisonInCondition: boolean },
  markers: monaco.editor.IMarkerData[],
): boolean {
  const condMatch = /^\s*(if|elif|else\s+if|else|endif)\b(.*)$/i.exec(code);
  if (!condMatch) return false;

  const keywordRaw = condMatch[1].toLowerCase().replace(/\s+/, ' ');
  const rest = condMatch[2];
  const kwIdx = code.toLowerCase().indexOf(condMatch[1].toLowerCase());
  const kwStartCol = kwIdx + 1;
  const kwEndCol = kwStartCol + condMatch[1].length;

  if (keywordRaw === 'if') {
    conditionStack.push({
      type: 'if',
      line,
      col: kwStartCol,
      endCol: kwEndCol,
      hasElse: false,
    });

    if (options.comparisonInCondition) {
      checkConditionComparison(rest, line, kwEndCol, markers);
    }
  } else if (keywordRaw === 'elif' || keywordRaw === 'else if') {
    if (!options.unclosedBlocks) {
      // unclosedBlocks disabled
    } else if (conditionStack.length === 0) {
      markers.push({
        severity: MarkerSeverity.Error,
        message: `짝이 맞는 'if' 없이 '${condMatch[1]}'가 사용되었습니다.`,
        startLineNumber: line,
        startColumn: kwStartCol,
        endLineNumber: line,
        endColumn: kwEndCol,
      });
    } else {
      const top = conditionStack[conditionStack.length - 1];
      if (top.hasElse) {
        markers.push({
          severity: MarkerSeverity.Error,
          message: `'else' 뒤에는 '${condMatch[1]}'가 올 수 없습니다.`,
          startLineNumber: line,
          startColumn: kwStartCol,
          endLineNumber: line,
          endColumn: kwEndCol,
        });
      }
    }

    if (options.comparisonInCondition) {
      checkConditionComparison(rest, line, kwEndCol, markers);
    }
  } else if (keywordRaw === 'else') {
    if (!options.unclosedBlocks) {
      // skipped
    } else if (conditionStack.length === 0) {
      markers.push({
        severity: MarkerSeverity.Error,
        message: "짝이 맞는 'if' 없이 'else'가 사용되었습니다.",
        startLineNumber: line,
        startColumn: kwStartCol,
        endLineNumber: line,
        endColumn: kwEndCol,
      });
    } else {
      const top = conditionStack[conditionStack.length - 1];
      if (top.hasElse) {
        markers.push({
          severity: MarkerSeverity.Error,
          message: "이미 이 조건문 블록에 'else'가 정의되어 있습니다.",
          startLineNumber: line,
          startColumn: kwStartCol,
          endLineNumber: line,
          endColumn: kwEndCol,
        });
      } else {
        top.hasElse = true;
      }
    }
  } else if (keywordRaw === 'endif') {
    if (!options.unclosedBlocks) {
      // skipped
    } else if (conditionStack.length === 0) {
      markers.push({
        severity: MarkerSeverity.Error,
        message: "짝이 맞는 'if' 없이 'endif'가 사용되었습니다.",
        startLineNumber: line,
        startColumn: kwStartCol,
        endLineNumber: line,
        endColumn: kwEndCol,
      });
    } else {
      conditionStack.pop();
    }
  }

  return true;
}

/**
 * Checks for unclosed if-blocks at section boundary or EOF.
 */
export function checkUnclosedBlocks(
  conditionStack: BlockState[],
  reason: 'section' | 'eof',
  markers: monaco.editor.IMarkerData[],
): void {
  while (conditionStack.length > 0) {
    const unclosed = conditionStack.pop()!;
    const message =
      reason === 'section'
        ? "'if' 블록이 'endif'로 닫히지 않은 상태에서 새 섹션이 시작되었습니다."
        : "'if' 조건문이 'endif'로 닫히지 않은 채 파일이 끝났습니다.";

    markers.push({
      severity: MarkerSeverity.Error,
      message,
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.endCol,
    });
  }
}

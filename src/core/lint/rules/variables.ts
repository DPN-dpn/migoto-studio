import type { monaco } from '../../editor/monaco.ts';
import { MarkerSeverity } from '../types.ts';
import { isAllowedVariable, isAllowedUsedVariable } from '../registry.ts';

export interface VarDecl {
  line: number;
  col: number;
  endCol: number;
}

export interface VarUsage {
  name: string;
  line: number;
  col: number;
  endCol: number;
}

/**
 * Tracks variable declarations and references on a single line.
 */
export function trackLineVariables(
  code: string,
  line: number,
  isConstantsSection: boolean,
  declaredVars: Map<string, VarDecl>,
  varUsages: VarUsage[],
): void {
  // Variable declaration check
  // Lines like: global persist $swapvar = 0, or in [Constants]: $swapvar = 0
  const varDeclRe = /\b(?:global|persist|local)\s+\$([a-zA-Z0-9_\\/](?:[a-zA-Z0-9_.\-\\\/]*[a-zA-Z0-9_\\/])?)/gi;
  let vdm: RegExpExecArray | null;
  let foundExplicitDecl = false;
  while ((vdm = varDeclRe.exec(code)) !== null) {
    foundExplicitDecl = true;
    const vName = vdm[1].toLowerCase();
    const col = vdm.index + vdm[0].indexOf('$') + 1;
    declaredVars.set(vName, { line, col, endCol: col + vdm[1].length + 1 });
  }

  if (isConstantsSection && !foundExplicitDecl) {
    // In [Constants], lines like `$costume = 1` or `$active` are declarations
    const constLineRe = /^\s*(?:persist\s+|global\s+|local\s+)*\$([a-zA-Z0-9_\\/](?:[a-zA-Z0-9_.\-\\\/]*[a-zA-Z0-9_\\/])?)/i.exec(code);
    if (constLineRe) {
      const vName = constLineRe[1].toLowerCase();
      const dollarIdx = code.indexOf('$' + constLineRe[1]);
      if (dollarIdx !== -1) {
        declaredVars.set(vName, { line, col: dollarIdx + 1, endCol: dollarIdx + constLineRe[1].length + 2 });
      }
    }
  }

  // Collect all $var references on this line
  const varRefRe = /\$([a-zA-Z0-9_\\/](?:[a-zA-Z0-9_.\-\\\/]*[a-zA-Z0-9_\\/])?)/g;
  let vm: RegExpExecArray | null;
  while ((vm = varRefRe.exec(code)) !== null) {
    const vName = vm[1].toLowerCase();
    const col = vm.index + 1;
    const endCol = col + vm[0].length;
    // If this line is the declaration line of this variable, don't count it as a usage
    const decl = declaredVars.get(vName);
    const isDeclSpot = decl && decl.line === line && Math.abs(decl.col - col) <= 2;
    if (!isDeclSpot) {
      varUsages.push({ name: vName, line, col, endCol });
    }
  }
}

/**
 * Validates undeclared variables.
 */
export function checkUndeclaredVariables(
  varUsages: VarUsage[],
  declaredVars: Map<string, VarDecl>,
  hasFolder: boolean,
  markers: monaco.editor.IMarkerData[],
): void {
  for (const usage of varUsages) {
    if (declaredVars.has(usage.name)) continue;
    if (isAllowedVariable(usage.name)) continue;

    const isNamespaced = usage.name.includes('\\');
    if (hasFolder && isNamespaced) {
      // Folder mode: delegated to namespace lint rule across mod folder
      continue;
    }

    let message: string;
    if (!hasFolder) {
      if (isNamespaced) {
        message = `선언되지 않은 변수 '$${usage.name}'입니다. 단일 ini 파일로 열려 있어 외부 네임스페이스를 확인할 수 없습니다. 네임스페이스에 있는 변수인지 확인해야 합니다.`;
      } else {
        message = `선언되지 않은 변수 '$${usage.name}'입니다. [Constants] 섹션에 선언되어 있거나 네임스페이스에 있는 변수인지 확인해야 합니다.`;
      }
    } else {
      message = `선언되지 않은 변수 '$${usage.name}'입니다. [Constants] 섹션에 선언되어 있는지 확인하세요.`;
    }

    markers.push({
      severity: MarkerSeverity.Warning,
      message,
      startLineNumber: usage.line,
      startColumn: usage.col,
      endLineNumber: usage.line,
      endColumn: usage.endCol,
    });
  }
}

/**
 * Validates unused declared variables.
 */
export function checkUnusedVariables(
  declaredVars: Map<string, VarDecl>,
  varUsages: VarUsage[],
  hasFolder: boolean,
  markers: monaco.editor.IMarkerData[],
): void {
  const usedVarNames = new Set(varUsages.map((u) => u.name));
  for (const [name, decl] of declaredVars) {
    if (!usedVarNames.has(name) && !isAllowedUsedVariable(name)) {
      let message = `변수 '$${name}'이(가) 선언되었지만 다른 곳에서 사용되지 않았습니다.`;
      if (!hasFolder) {
        message += ' (단일 ini 파일로 열려 있어 외부 네임스페이스나 다른 파일에서의 사용 여부는 확인되지 않습니다)';
      }
      markers.push({
        severity: MarkerSeverity.Info,
        message,
        startLineNumber: decl.line,
        startColumn: decl.col,
        endLineNumber: decl.line,
        endColumn: decl.endCol,
      });
    }
  }
}

import type { monaco } from '../editor/monaco';
import type { Settings } from '../workspace/settings';
import {
  isBuiltinResource,
  isHelpIniResource,
  isHelpIniVariable,
  HELP_INI_RESOURCE_REGEX,
  HELP_INI_VARIABLE_REGEX,
} from './builtin-syntax.ts';

export {
  isBuiltinResource,
  isHelpIniResource,
  isHelpIniVariable,
  HELP_INI_RESOURCE_REGEX,
  HELP_INI_VARIABLE_REGEX,
};

export const MarkerSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
} as const;
export type MarkerSeverity = typeof MarkerSeverity[keyof typeof MarkerSeverity];

export interface TextModelLike {
  getLineCount(): number;
  getLineContent(lineNumber: number): string;
}

export interface LintOptions {
  enabled: boolean;
  duplicateSections: boolean;
  unclosedBlocks: boolean;
  comparisonInCondition: boolean;
  missingResources: boolean;
  undeclaredVars: boolean;
  unusedItems: boolean;
  hasFolder?: boolean;
}

export function optionsFromSettings(s: Settings, hasFolder = false): LintOptions {
  return {
    enabled: s.lintEnabled,
    duplicateSections: s.lintDuplicateSections,
    unclosedBlocks: s.lintUnclosedBlocks,
    comparisonInCondition: s.lintComparisonInCondition,
    missingResources: s.lintMissingResources,
    undeclaredVars: s.lintUndeclaredVars,
    unusedItems: s.lintUnusedItems,
    hasFolder,
  };
}

interface BlockState {
  type: 'if';
  line: number;
  col: number;
  endCol: number;
  hasElse: boolean;
}

interface SectionDef {
  name: string;
  line: number;
  col: number;
  endCol: number;
}

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
function checkUnclosedQuotes(code: string): { unclosed: boolean; quoteChar: string; index: number } {
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

/**
 * Lints a Monaco text model according to the configured options.
 * Returns an array of monaco.editor.IMarkerData.
 */
export function lintModel(model: TextModelLike, options: LintOptions): monaco.editor.IMarkerData[] {
  if (!options.enabled) return [];

  const markers: monaco.editor.IMarkerData[] = [];
  const lineCount = model.getLineCount();

  // Symbol tracking
  const sections = new Map<string, SectionDef[]>(); // lowerName -> list of definitions
  const declaredVars = new Map<string, { line: number; col: number; endCol: number }>();
  const varUsages: { name: string; line: number; col: number; endCol: number }[] = [];
  const resourceRefs: { name: string; line: number; col: number; endCol: number }[] = [];

  let currentSectionName = '';
  const conditionStack: BlockState[] = [];

  for (let line = 1; line <= lineCount; line++) {
    const rawLine = model.getLineContent(line);
    const { code, commentIndex } = stripComments(rawLine);
    const trimmed = code.trim();

    if (trimmed.length === 0) continue;

    // 1. Unclosed quotes check
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

    // 2. Section Header check
    const leadingWhitespaceMatch = /^\s*/.exec(code);
    const leadingSpaces = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;

    if (code.slice(leadingSpaces).startsWith('[')) {
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
      } else {
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
        } else {
          // If we had unclosed if-blocks when a new section starts, flag them
          if (options.unclosedBlocks && conditionStack.length > 0) {
            while (conditionStack.length > 0) {
              const unclosed = conditionStack.pop()!;
              markers.push({
                severity: MarkerSeverity.Error,
                message: "'if' 블록이 'endif'로 닫히지 않은 상태에서 새 섹션이 시작되었습니다.",
                startLineNumber: unclosed.line,
                startColumn: unclosed.col,
                endLineNumber: unclosed.line,
                endColumn: unclosed.endCol,
              });
            }
          }

          currentSectionName = secName;
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
        }
      }
      continue;
    }

    // 3. Condition statements (if, elif, else, endif)
    const condMatch = /^\s*(if|elif|else\s+if|else|endif)\b(.*)$/i.exec(code);
    if (condMatch) {
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
    }

    // 4. Variables & Resource references tracking
    const isConstantsSection = currentSectionName.toLowerCase() === 'constants';

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

    // 5. Resource / CommandList references
    // Keys like: run = CommandListX, post run = ..., pre run = ..., this = ResourceX, vb0 = ResourceX, ib = ResourceIB, ps-t0 = ResourceTexture
    // or path/namespace references: Resource\Sub\Key = ref Target, run = CommandList\Sub\Action
    const resRefMatch = /^\s*(?:(?:pre\s+|post\s+)?run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+|Resource(?:\\[a-zA-Z0-9_.\-]+)*)\s*=\s*(?:ref\s+|copy\s+)?([a-zA-Z0-9_.\-\\\/]+)/i.exec(code);
    if (resRefMatch) {
      const target = resRefMatch[1].trim();
      const lowerTarget = target.toLowerCase();
      // Skip keywords like 'null', 'skip', 'auto', 'default'
      if (!['null', 'skip', 'auto', 'default'].includes(lowerTarget)) {
        // If it starts with Resource/CommandList/CustomShader or is a 'run'/'this'/slot assignment
        if (
          /^(?:resource|commandlist|customshader)/i.test(target) ||
          /(?:run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+)\s*=/i.test(code)
        ) {
          const eqIdx = code.indexOf('=');
          const valIdx = eqIdx !== -1 ? code.indexOf(target, eqIdx) : code.lastIndexOf(target);
          if (valIdx !== -1) {
            resourceRefs.push({
              name: target,
              line,
              col: valIdx + 1,
              endCol: valIdx + target.length + 1,
            });
          }
        }
      }
    }

    // Left-side namespaced Resource binding (e.g. Resource\ZZMI\Diffuse = ref ResourceDiffuse)
    const leftResMatch = /^\s*(Resource\\[a-zA-Z0-9_.\-\\\/]+)\s*=/i.exec(code);
    if (leftResMatch) {
      const leftTarget = leftResMatch[1].trim();
      const valIdx = code.indexOf(leftTarget);
      if (valIdx !== -1) {
        resourceRefs.push({
          name: leftTarget,
          line,
          col: valIdx + 1,
          endCol: valIdx + leftTarget.length + 1,
        });
      }
    }
  }

  // EOF: check unclosed if-blocks
  if (options.unclosedBlocks && conditionStack.length > 0) {
    while (conditionStack.length > 0) {
      const unclosed = conditionStack.pop()!;
      markers.push({
        severity: MarkerSeverity.Error,
        message: "'if' 조건문이 'endif'로 닫히지 않은 채 파일이 끝났습니다.",
        startLineNumber: unclosed.line,
        startColumn: unclosed.col,
        endLineNumber: unclosed.line,
        endColumn: unclosed.endCol,
      });
    }
  }

  // 6. Missing Resources check
  if (options.missingResources) {
    for (const ref of resourceRefs) {
      if (isAllowedResource(ref.name)) continue;
      if (!sections.has(ref.name.toLowerCase())) {
        const isNamespaced = ref.name.includes('\\');
        if (options.hasFolder && isNamespaced) {
          // Folder mode: delegated to namespace lint rule
          continue;
        }
        let message: string;
        if (!options.hasFolder && isNamespaced) {
          message = `참조된 섹션 '[${ref.name}]'을(를) 찾을 수 없습니다. 단일 ini 파일로 열려 있어 외부 네임스페이스를 확인할 수 없습니다. 네임스페이스에 정의된 섹션인지 확인해야 합니다.`;
        } else {
          message = `참조된 섹션 '[${ref.name}]'을(를) 찾을 수 없습니다. (다른 include 파일이나 네임스페이스에 정의되어 있다면 정상일 수 있습니다)`;
        }
        markers.push({
          severity: MarkerSeverity.Warning,
          message,
          startLineNumber: ref.line,
          startColumn: ref.col,
          endLineNumber: ref.line,
          endColumn: ref.endCol,
        });
      }
    }
  }

  // 7. Undeclared variables check
  if (options.undeclaredVars) {
    for (const usage of varUsages) {
      if (declaredVars.has(usage.name)) continue;
      if (isAllowedVariable(usage.name)) continue;

      const isNamespaced = usage.name.includes('\\');
      if (options.hasFolder && isNamespaced) {
        // Folder mode: delegated to custom lint rule across mod folder
        continue;
      }

      let message: string;
      if (!options.hasFolder) {
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

  // 8. Unused items check (info)
  if (options.unusedItems) {
    // Unused variables
    const usedVarNames = new Set(varUsages.map((u) => u.name));
    for (const [name, decl] of declaredVars) {
      if (!usedVarNames.has(name) && !isAllowedUsedVariable(name)) {
        let message = `변수 '$${name}'이(가) 선언되었지만 다른 곳에서 사용되지 않았습니다.`;
        if (!options.hasFolder) {
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

    // Unused Resources / CommandLists
    const referencedSecNames = new Set(resourceRefs.map((r) => r.name.toLowerCase()));
    for (const [lowerName, defs] of sections) {
      if (
        /^(?:resource|commandlist)/i.test(lowerName) &&
        !referencedSecNames.has(lowerName) &&
        !isAllowedUsedResource(lowerName)
      ) {
        for (const def of defs) {
          let message = `'[${def.name}]' 섹션이 정의되었지만 파일 내에서 참조되지 않았습니다.`;
          if (!options.hasFolder) {
            message += ' (단일 ini 파일로 열려 있어 외부 네임스페이스나 다른 파일에서의 참조 여부는 확인되지 않습니다)';
          }
          markers.push({
            severity: MarkerSeverity.Info,
            message,
            startLineNumber: def.line,
            startColumn: def.col,
            endLineNumber: def.line,
            endColumn: def.endCol,
          });
        }
      }
    }
  }

  return markers;
}

/**
 * Checks for a single '=' instead of '==' in a conditional expression.
 */
function checkConditionComparison(
  expr: string,
  line: number,
  baseCol: number,
  markers: monaco.editor.IMarkerData[],
) {
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

let registeredAllowedResources: (string | RegExp | ((name: string) => boolean))[] = [];

export function registerAllowedResource(
  pattern: string | RegExp | ((name: string) => boolean),
): () => void {
  registeredAllowedResources.push(pattern);
  return () => {
    registeredAllowedResources = registeredAllowedResources.filter((p) => p !== pattern);
  };
}

export function isAllowedResource(name: string): boolean {
  if (isBuiltinResource(name) || isHelpIniResource(name)) return true;
  const norm = name.toLowerCase();
  return registeredAllowedResources.some((p) => {
    if (typeof p === 'function') return p(name) || p(norm);
    if (typeof p === 'string') return p.toLowerCase() === norm;
    return p.test(name);
  });
}

export function clearAllowedResources(): void {
  registeredAllowedResources = [];
  registeredAllowedUsedResources = [];
}

let registeredAllowedVariables: (string | RegExp | ((name: string) => boolean))[] = [];

export function registerAllowedVariable(pattern: string | RegExp | ((name: string) => boolean)): () => void {
  registeredAllowedVariables.push(pattern);
  return () => {
    registeredAllowedVariables = registeredAllowedVariables.filter((p) => p !== pattern);
  };
}

export function isAllowedVariable(name: string): boolean {
  if (isHelpIniVariable(name)) return true;
  const norm = name.toLowerCase();
  const trimmed = norm.startsWith('\\') ? norm.slice(1) : norm;
  return registeredAllowedVariables.some((p) => {
    if (typeof p === 'function') {
      return p(name) || p(norm) || p(trimmed) || p(`\\${trimmed}`);
    }
    if (typeof p === 'string') {
      const pNorm = p.toLowerCase();
      const pTrimmed = pNorm.startsWith('\\') ? pNorm.slice(1) : pNorm;
      return norm === pNorm || trimmed === pTrimmed;
    }
    return p.test(name) || p.test(norm) || p.test(trimmed) || p.test(`\\${trimmed}`);
  });
}

export function clearAllowedVariables(): void {
  registeredAllowedVariables = [];
  registeredAllowedUsedVariables = [];
}

let registeredAllowedUsedVariables: (string | RegExp | ((name: string) => boolean))[] = [];

export function registerAllowedUsedVariable(
  pattern: string | RegExp | ((name: string) => boolean),
): () => void {
  registeredAllowedUsedVariables.push(pattern);
  return () => {
    registeredAllowedUsedVariables = registeredAllowedUsedVariables.filter((p) => p !== pattern);
  };
}

export function isAllowedUsedVariable(name: string): boolean {
  if (isHelpIniVariable(name)) return true;
  const norm = name.toLowerCase();
  const trimmed = norm.startsWith('\\') ? norm.slice(1) : norm;
  return registeredAllowedUsedVariables.some((p) => {
    if (typeof p === 'function') {
      return p(name) || p(norm) || p(trimmed) || p(`\\${trimmed}`);
    }
    if (typeof p === 'string') {
      const pNorm = p.toLowerCase();
      const pTrimmed = pNorm.startsWith('\\') ? pNorm.slice(1) : pNorm;
      return norm === pNorm || trimmed === pTrimmed;
    }
    return p.test(name) || p.test(norm) || p.test(trimmed) || p.test(`\\${trimmed}`);
  });
}

export function clearAllowedUsedVariables(): void {
  registeredAllowedUsedVariables = [];
}

let registeredAllowedUsedResources: (string | RegExp | ((name: string) => boolean))[] = [];

export function registerAllowedUsedResource(
  pattern: string | RegExp | ((name: string) => boolean),
): () => void {
  registeredAllowedUsedResources.push(pattern);
  return () => {
    registeredAllowedUsedResources = registeredAllowedUsedResources.filter((p) => p !== pattern);
  };
}

export function isAllowedUsedResource(name: string): boolean {
  if (isBuiltinResource(name) || isHelpIniResource(name)) return true;
  const norm = name.toLowerCase();
  const trimmed = norm.startsWith('\\') ? norm.slice(1) : norm;
  return registeredAllowedUsedResources.some((p) => {
    if (typeof p === 'function') {
      return p(name) || p(norm) || p(trimmed) || p(`\\${trimmed}`);
    }
    if (typeof p === 'string') {
      const pNorm = p.toLowerCase();
      const pTrimmed = pNorm.startsWith('\\') ? pNorm.slice(1) : pNorm;
      return norm === pNorm || trimmed === pTrimmed;
    }
    return p.test(name) || p.test(norm) || p.test(trimmed) || p.test(`\\${trimmed}`);
  });
}

export function clearAllowedUsedResources(): void {
  registeredAllowedUsedResources = [];
}



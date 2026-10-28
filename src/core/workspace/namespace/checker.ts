import type { monaco } from '../../editor/monaco.ts';
import { MarkerSeverity } from '../../ini/lint.ts';
import { isBuiltinResource, isHelpIniResource, isHelpIniVariable } from '../../ini/builtin-syntax.ts';
import { stripComments } from './parser.ts';
import { buildWorkspaceIndex, type WorkspaceIndex, type WorkspaceContextLike } from './indexer.ts';

export interface NamespaceCheckerOptions {
  isAllowedVariable?: (name: string) => boolean;
  isAllowedResource?: (name: string) => boolean;
}

/**
 * 모드 폴더가 열려 있을 때, 네임스페이스 변수 및 CommandList 호출의 유효성을 검사합니다.
 */
export function checkNamespaceDiagnostics(
  model: { getLineCount(): number; getLineContent(line: number): string },
  index: WorkspaceIndex,
  options?: NamespaceCheckerOptions,
): monaco.editor.IMarkerData[] {
  const { namespaceMap } = index;
  const diagnostics: monaco.editor.IMarkerData[] = [];
  const count = model.getLineCount();

  let activeSection = '';

  for (let line = 1; line <= count; line++) {
    const raw = model.getLineContent(line);
    const { code } = stripComments(raw);
    const trimmed = code.trim();
    if (!trimmed) continue;

    // 섹션 헤더 추적
    const secMatch = /^\s*\[([^\]]+)\]/.exec(code);
    if (secMatch) {
      activeSection = secMatch[1].trim();
      continue;
    }

    // A. 네임스페이스 변수 검사: $\Namespace\Var
    const varRefRe = /\$([a-zA-Z0-9_\\/](?:[a-zA-Z0-9_.\-\\\/]*[a-zA-Z0-9_\\/])?)/g;
    let vm: RegExpExecArray | null;
    while ((vm = varRefRe.exec(code)) !== null) {
      const fullVar = vm[1];
      const startCol = vm.index + 1;
      const endCol = startCol + vm[0].length;

      // 선언부인지 확인 (선언부는 검사 제외)
      const isConstantsSec = activeSection.toLowerCase() === 'constants';
      const beforeMatch = code.slice(0, vm.index);
      const isDecl = isConstantsSec && /^\s*(?:persist\s+|global\s+|local\s+)*$/i.test(beforeMatch);
      const isExplicitDecl = /\b(?:global|persist|local)\s*$/i.test(beforeMatch);
      if (isDecl || isExplicitDecl) continue;

      // 슬래시(\)가 포함된 네임스페이스 변수 검증
      if (fullVar.includes('\\')) {
        const parts = fullVar.split('\\').filter(Boolean);
        if (parts.length >= 2) {
          const nsName = parts.slice(0, -1).join('\\');
          const varName = parts[parts.length - 1];
          const nsData = namespaceMap.get(nsName.toLowerCase());

          // 빌트인 네임스페이스이거나 코어/플러그인에서 허용된 변수인 경우 검사 제외
          const isBuiltInNs =
            nsName.toLowerCase() === 'shaderfixes\\help.ini' ||
            nsName.toLowerCase() === 'srmi' ||
            isHelpIniVariable(fullVar);

          if (
            isBuiltInNs ||
            (options?.isAllowedVariable ? options.isAllowedVariable(fullVar) : false)
          ) {
            continue;
          }

          if (!nsData) {
            diagnostics.push({
              severity: MarkerSeverity.Warning,
              message: `모드 폴더 내에서 네임스페이스 '${nsName}'을(를) 찾을 수 없습니다. (해당 ini 파일에 'namespace = ${nsName}' 선언이 있는지 확인하세요)`,
              startLineNumber: line,
              startColumn: startCol,
              endLineNumber: line,
              endColumn: endCol,
            });
          } else if (!nsData.variables.has(varName.toLowerCase())) {
            diagnostics.push({
              severity: MarkerSeverity.Warning,
              message: `네임스페이스 '${nsName}'에 선언되지 않은 변수 '$${varName}'입니다. (${nsName}의 [Constants] 섹션을 확인하세요)`,
              startLineNumber: line,
              startColumn: startCol,
              endLineNumber: line,
              endColumn: endCol,
            });
          }
        }
      }
    }

    // B. CommandList 및 Function 호출 검사 (예: run = CommandList\Namespace\Action)
    const runMatch = /^\s*(?:(?:pre\s+|post\s+)?run)\s*=\s*(?:ref\s+)?([a-zA-Z0-9_.\-\\\/]+)/i.exec(code);
    if (runMatch) {
      const target = runMatch[1].trim();
      if (target.includes('\\')) {
        const parts = target.split('\\').filter(Boolean);
        const prefix = parts[0];
        const isBuiltIn =
          isBuiltinResource(target) ||
          isHelpIniResource(target) ||
          prefix.toLowerCase().startsWith('builtin') ||
          prefix.toLowerCase() === 'srmi' ||
          (options?.isAllowedResource ? options.isAllowedResource(target) : false);

        if (!isBuiltIn && parts.length >= 3) {
          const nsName = parts.slice(1, -1).join('\\');
          const actionName = parts[parts.length - 1];
          const nsData = namespaceMap.get(nsName.toLowerCase());

          const rawIdx = raw.indexOf(runMatch[1]);
          const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
          const endCol = startCol + runMatch[1].length;

          if (!nsData) {
            diagnostics.push({
              severity: MarkerSeverity.Warning,
              message: `모드 폴더 내에서 네임스페이스 '${nsName}'을(를) 찾을 수 없습니다.`,
              startLineNumber: line,
              startColumn: startCol,
              endLineNumber: line,
              endColumn: endCol,
            });
          } else {
            const hasAction =
              nsData.sections.has(`commandlist\\${nsName.toLowerCase()}\\${actionName.toLowerCase()}`) ||
              nsData.sections.has(`commandlist${actionName.toLowerCase()}`) ||
              nsData.sections.has(actionName.toLowerCase());

            if (!hasAction) {
              diagnostics.push({
                severity: MarkerSeverity.Warning,
                message: `네임스페이스 '${nsName}'에 정의되지 않은 커맨드리스트 또는 함수 '[CommandList${actionName}]'입니다.`,
                startLineNumber: line,
                startColumn: startCol,
                endLineNumber: line,
                endColumn: endCol,
              });
            }
          }
        }
      }
    }
  }

  return diagnostics;
}

/**
 * 모드 폴더 컨텍스트를 받아 워크스페이스 인덱스를 구축하고 진단을 수행하는 헬퍼 함수
 */
export async function checkNamespaceFolderConsistency(
  model: { getLineCount(): number; getLineContent(line: number): string },
  context: WorkspaceContextLike,
  options?: NamespaceCheckerOptions,
): Promise<monaco.editor.IMarkerData[]> {
  const index = await buildWorkspaceIndex(context);
  return checkNamespaceDiagnostics(model, index, options);
}

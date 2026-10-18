import { stripComments } from '../../src/core/ini/lint.ts';
import type { LintDiagnostic, PluginContext } from '../../src/plugins/types.ts';
import { parseIniExports, isBuiltinResource } from './parser.ts';
import { buildWorkspaceIndex } from './indexer.ts';

export interface DynamicRegistrationState {
  unregisterAllowedVars: (() => void) | null;
  unregisterAllowedGroupResources: (() => void) | null;
  unregisterAllowedUsedVars: (() => void) | null;
  unregisterAllowedUsedResources: (() => void) | null;
}

export function registerLintRules(
  context: PluginContext,
  isActive: () => boolean,
  state: DynamicRegistrationState,
) {
  // 1. 에디터 린트 규칙: 모드 리소스 파일 실재성 검사
  context.linter.registerRule({
    id: 'missing-resource-files',
    name: '모드 리소스 파일 실재성 검사',
    check: async (ctx) => {
      if (!ctx.folder) {
        return [];
      }

      const diagnostics: LintDiagnostic[] = [];
      const count = ctx.model.getLineCount();

      for (let line = 1; line <= count; line++) {
        const raw = ctx.model.getLineContent(line);
        const { code } = stripComments(raw);
        const trimmed = code.trim();
        if (!trimmed) continue;

        const match = /^\s*filename\s*=\s*(.+)$/i.exec(code);
        if (!match) continue;

        let target = match[1].trim();
        if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith("'") && target.endsWith("'"))) {
          target = target.slice(1, -1).trim();
        }

        if (!target) continue;

        const exists = await ctx.fileExists(target);
        if (!exists) {
          const rawIdx = raw.indexOf(match[1]);
          const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
          const endCol = startCol + match[1].length;

          diagnostics.push({
            severity: 'warning',
            message: `참조된 파일 "${target}"을(를) 모드 폴더에서 찾을 수 없습니다. (파일명 및 확장자 확인 필요)`,
            startLineNumber: line,
            startColumn: startCol,
            endLineNumber: line,
            endColumn: endCol,
          });
        }
      }

      return diagnostics;
    },
  });

  // 2. 에디터 린트 규칙: XXMI 네임스페이스 변수 및 함수 유효성 검사
  context.linter.registerRule({
    id: 'xxmi-namespace-check',
    name: 'XXMI 네임스페이스 및 변수 검사',
    check: async (ctx) => {
      if (!isActive()) {
        return [];
      }
      // 단일 INI 파일로 열린 경우 (모드 폴더가 없는 경우)는 코어 린터가
      // "네임스페이스에 있는 변수인지 확인해야 합니다" 안내 메시지를 표시하므로 중복 방지를 위해 건너뜁니다.
      if (!ctx.folder) {
        return [];
      }

      const diagnostics: LintDiagnostic[] = [];
      const { allSummaries, namespaceMap, allKnownVariables } = await buildWorkspaceIndex(ctx, context);

      if (!isActive()) {
        return [];
      }

      // 현재 에디터 모델의 네임스페이스 확인
      const currentModelExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || '');
      const currentNsKey = currentModelExp.namespace ? currentModelExp.namespace.toLowerCase() : '';
      const currentNsGroup = currentNsKey ? namespaceMap.get(currentNsKey) : null;
      const currentFilePath = (ctx.file?.path || ctx.file?.name || '').toLowerCase();

      // 이전 동적 등록 정리
      if (state.unregisterAllowedVars) {
        state.unregisterAllowedVars();
        state.unregisterAllowedVars = null;
      }
      if (state.unregisterAllowedGroupResources) {
        state.unregisterAllowedGroupResources();
        state.unregisterAllowedGroupResources = null;
      }
      if (state.unregisterAllowedUsedVars) {
        state.unregisterAllowedUsedVars();
        state.unregisterAllowedUsedVars = null;
      }
      if (state.unregisterAllowedUsedResources) {
        state.unregisterAllowedUsedResources();
        state.unregisterAllowedUsedResources = null;
      }

      const sharedVars = currentNsGroup ? currentNsGroup.variables : null;
      const sharedSections = currentNsGroup ? currentNsGroup.sections : null;

      // 다른 ini 파일에서 참조된 변수 및 섹션 수집 (외부 파일에서 사용되었으므로 unused 경고 제외)
      const externallyUsedVars = new Set<string>();
      const externallyUsedResources = new Set<string>();

      for (const other of allSummaries) {
        const otherPath = other.filePath.toLowerCase();
        if (
          otherPath &&
          currentFilePath &&
          (otherPath === currentFilePath ||
            otherPath.endsWith(`/${currentFilePath}`) ||
            otherPath.endsWith(`\\${currentFilePath}`) ||
            currentFilePath.endsWith(`/${otherPath}`) ||
            currentFilePath.endsWith(`\\${otherPath}`))
        ) {
          continue;
        }

        const otherNsKey = other.namespace ? other.namespace.toLowerCase() : '';

        if (currentNsKey && otherNsKey === currentNsKey) {
          // 동일 네임스페이스를 공유하는 파일: 해당 파일에서 사용된 모든 변수와 섹션 인정
          for (const uv of other.usedVariables) externallyUsedVars.add(uv);
          for (const us of other.usedSections) externallyUsedResources.add(us);
        } else if (!currentNsKey && !otherNsKey) {
          // 네임스페이스가 없는 단일 모드 폴더 내 파일들: 상호 참조 인정
          for (const uv of other.usedVariables) externallyUsedVars.add(uv);
          for (const us of other.usedSections) externallyUsedResources.add(us);
        } else if (currentNsKey) {
          // 다른 네임스페이스에서 \CurrentNamespace\var 또는 CommandList\CurrentNamespace\action 으로 참조한 경우
          for (const uv of other.usedVariables) {
            const clean = uv.startsWith('\\') ? uv.slice(1) : uv;
            if (clean.startsWith(`${currentNsKey}\\`)) {
              const varName = clean.slice(currentNsKey.length + 1);
              externallyUsedVars.add(varName);
            }
          }
          for (const us of other.usedSections) {
            const clean = us.startsWith('\\') ? us.slice(1) : us;
            const parts = clean.split('\\');
            if (parts.length >= 3 && parts[1] === currentNsKey) {
              const type = parts[0];
              const action = parts.slice(2).join('\\');
              externallyUsedResources.add(`${type}${action}`.toLowerCase());
              externallyUsedResources.add(clean);
            }
          }
        }
      }

      // 코어 린터에 허용 변수 등록:
      // 1) \Namespace\var 형태의 명시적 네임스페이스 변수
      // 2) 현재 파일과 동일한 namespace = 를 공유하는 다른 ini 파일들의 변수 ($var 접두사 없이 사용 가능)
      if (context.linter?.registerAllowedVariable) {
        state.unregisterAllowedVars = context.linter.registerAllowedVariable((name: string) => {
          const norm = name.toLowerCase().replace(/^\/+/, '');
          const clean = norm.startsWith('\\') ? norm.slice(1) : norm;
          if (allKnownVariables.has(`\\${clean}`) || allKnownVariables.has(clean)) {
            return true;
          }
          if (sharedVars && sharedVars.has(clean)) {
            return true;
          }
          return false;
        });
      }

      // 코어 린터에 허용 섹션(리소스/커맨드리스트) 등록:
      // 현재 파일과 동일한 namespace = 를 공유하는 다른 ini 파일들에 정의된 모든 섹션 허용
      if (sharedSections && sharedSections.size > 0 && context.linter?.registerAllowedResource) {
        state.unregisterAllowedGroupResources = context.linter.registerAllowedResource((name: string) => {
          return sharedSections.has(name.toLowerCase());
        });
      }

      // 코어 린터에 타 파일에서 참조된 변수/섹션 허용 등록 (Unused 경고 방지)
      if (externallyUsedVars.size > 0 && context.linter?.registerAllowedUsedVariable) {
        state.unregisterAllowedUsedVars = context.linter.registerAllowedUsedVariable((name: string) => {
          const clean = name.toLowerCase().replace(/^[\\$]+/, '');
          return externallyUsedVars.has(clean);
        });
      }

      if (externallyUsedResources.size > 0 && context.linter?.registerAllowedUsedResource) {
        state.unregisterAllowedUsedResources = context.linter.registerAllowedUsedResource((name: string) => {
          const clean = name.toLowerCase().replace(/^[\\\/]+/, '');
          if (externallyUsedResources.has(clean)) return true;
          const parts = clean.split('\\').filter(Boolean);
          if (parts.length > 1 && externallyUsedResources.has(parts[parts.length - 1])) {
            return true;
          }
          return false;
        });
      }

      // 현재 에디터 모델 검사
      const count = ctx.model.getLineCount();
      let activeSection = '';

      for (let line = 1; line <= count; line++) {
        const raw = ctx.model.getLineContent(line);
        const { code } = stripComments(raw);
        const trimmed = code.trim();
        if (!trimmed) continue;

        const secMatch = /^\s*\[([^\]]+)\]/.exec(code);
        if (secMatch) {
          activeSection = secMatch[1].trim();
          continue;
        }

        // A. 네임스페이스 변수 검사
        const varRefRe = /\$([a-zA-Z0-9_\\]+)/g;
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

              if (!nsData) {
                diagnostics.push({
                  severity: 'warning',
                  message: `모드 폴더 내에서 네임스페이스 '${nsName}'을(를) 찾을 수 없습니다. (해당 ini 파일에 'namespace = ${nsName}' 선언이 있는지 확인하세요)`,
                  startLineNumber: line,
                  startColumn: startCol,
                  endLineNumber: line,
                  endColumn: endCol,
                });
              } else if (!nsData.variables.has(varName.toLowerCase())) {
                diagnostics.push({
                  severity: 'warning',
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
        const runMatch = /^\s*(?:(?:pre\s+|post\s+)?run)\s*=\s*(?:ref\s+)?([a-zA-Z0-9_\\]+)/i.exec(code);
        if (runMatch) {
          const target = runMatch[1].trim();
          if (target.includes('\\')) {
            const parts = target.split('\\').filter(Boolean);
            const prefix = parts[0];
            const isBuiltIn =
              isBuiltinResource(target) ||
              prefix.toLowerCase().startsWith('builtin') ||
              (ctx.isAllowedResource ? ctx.isAllowedResource(target) : false);

            if (!isBuiltIn && parts.length >= 3) {
              const nsName = parts.slice(1, -1).join('\\');
              const actionName = parts[parts.length - 1];
              const nsData = namespaceMap.get(nsName.toLowerCase());

              const rawIdx = raw.indexOf(runMatch[1]);
              const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
              const endCol = startCol + runMatch[1].length;

              if (!nsData) {
                diagnostics.push({
                  severity: 'warning',
                  message: `모드 폴더 내에서 네임스페이스 '${nsName}'을(를) 찾을 수 없습니다.`,
                  startLineNumber: line,
                  startColumn: startCol,
                  endLineNumber: line,
                  endColumn: endCol,
                });
              } else {
                const possibleNames = [
                  `${prefix}${actionName}`.toLowerCase(),
                  target.toLowerCase(),
                  actionName.toLowerCase(),
                  `${prefix}\\${nsName.toLowerCase()}\\${actionName.toLowerCase()}`,
                ];
                const hasAction = possibleNames.some((p) => nsData.sections.has(p));
                if (!hasAction) {
                  diagnostics.push({
                    severity: 'warning',
                    message: `네임스페이스 '${nsName}'에 정의된 ${prefix} '${actionName}'을(를) 찾을 수 없습니다.`,
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
    },
  });
}

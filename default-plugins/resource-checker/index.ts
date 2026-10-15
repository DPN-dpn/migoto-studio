import { definePlugin } from '../../src/plugins/api.ts';
import { stripComments } from '../../src/core/ini/lint.ts';
import type { DirEntry, LintDiagnostic } from '../../src/plugins/types.ts';

interface NamespaceExport {
  namespace: string;
  filePath: string;
  variables: Set<string>;
  sections: Set<string>;
}

interface NamespaceGroup {
  namespace: string;
  files: string[];
  variables: Set<string>;
  sections: Set<string>;
}

function parseIniExports(text: string, filePath: string): NamespaceExport {
  const lines = text.split(/\r?\n/);
  let currentNamespace = '';
  let currentSection = '';
  const variables = new Set<string>();
  const sections = new Set<string>();

  // 1차 스캔: 섹션 시작 전에 선언된 namespace = 확인
  for (let i = 0; i < lines.length; i++) {
    const { code } = stripComments(lines[i]);
    const trimmed = code.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('[')) break;
    const nsMatch = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(code);
    if (nsMatch) {
      let ns = nsMatch[1].trim();
      if ((ns.startsWith('"') && ns.endsWith('"')) || (ns.startsWith("'") && ns.endsWith("'"))) {
        ns = ns.slice(1, -1).trim();
      }
      currentNamespace = ns;
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const { code } = stripComments(raw);
    const trimmed = code.trim();
    if (!trimmed) continue;

    // Namespace declaration: namespace = CharacterMod
    const nsMatch = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(code);
    if (nsMatch) {
      let ns = nsMatch[1].trim();
      if ((ns.startsWith('"') && ns.endsWith('"')) || (ns.startsWith("'") && ns.endsWith("'"))) {
        ns = ns.slice(1, -1).trim();
      }
      currentNamespace = ns;
    }

    // Section header: [Constants], [CommandListAction], [ResourceFoo]
    const secMatch = /^\s*\[([^\]]+)\]/.exec(code);
    if (secMatch) {
      currentSection = secMatch[1].trim();
      const secLower = currentSection.toLowerCase();
      sections.add(secLower);

      // If section is e.g. CommandListSwap and namespace is Raiden,
      // register CommandList\Raiden\Swap variant
      if (currentNamespace) {
        const nsLower = currentNamespace.toLowerCase();
        if (secLower.startsWith('commandlist') && secLower.length > 11) {
          const action = secLower.slice(11);
          sections.add(`commandlist\\${nsLower}\\${action}`);
        } else if (secLower.startsWith('resource') && secLower.length > 8) {
          const res = secLower.slice(8);
          sections.add(`resource\\${nsLower}\\${res}`);
        } else if (secLower.startsWith('customshader') && secLower.length > 12) {
          const shader = secLower.slice(12);
          sections.add(`customshader\\${nsLower}\\${shader}`);
        }
      }
      continue;
    }

    // Variables declaration
    const varDeclRe = /\b(?:global|persist|local)\s+\$([a-zA-Z0-9_\\]+)/gi;
    let vm: RegExpExecArray | null;
    let foundExplicit = false;
    while ((vm = varDeclRe.exec(code)) !== null) {
      foundExplicit = true;
      const vName = vm[1].toLowerCase();
      const parts = vName.split('\\').filter(Boolean);
      const simpleName = parts[parts.length - 1];
      if (simpleName) variables.add(simpleName);
      variables.add(vName);
    }

    // In [Constants], lines like `$costume = 1` or `$active`
    if (currentSection.toLowerCase() === 'constants' && !foundExplicit) {
      const constLineMatch = /^\s*(?:persist\s+|global\s+|local\s+)*\$([a-zA-Z0-9_\\]+)/i.exec(code);
      if (constLineMatch) {
        const vName = constLineMatch[1].toLowerCase();
        const parts = vName.split('\\').filter(Boolean);
        const simpleName = parts[parts.length - 1];
        if (simpleName) variables.add(simpleName);
        variables.add(vName);
      }
    }
  }

  return {
    namespace: currentNamespace,
    filePath,
    variables,
    sections,
  };
}

let unregisterAllowedVars: (() => void) | null = null;
let unregisterAllowedGroupResources: (() => void) | null = null;

export default definePlugin({
  activate(context) {

    // 0. XXMI 표준 내장 커맨드리스트 허용 등록 (GIMI / ZZMI / XXMI 내장 함수)
    if (context.linter?.registerAllowedResource) {
      context.linter.registerAllowedResource('CommandListSkinTexture');
      context.linter.registerAllowedResource(/^(?:builtin\\)?commandlistskintexture$/i);
      context.linter.registerAllowedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
      context.linter.registerAllowedResource(/^builtin\\skintexture$/i);
    }

    // Helper to collect all INI files in workspace
    const collectIniFiles = async (ctx: any): Promise<string[]> => {
      if (ctx.getAllFiles) {
        const files = ctx.getAllFiles();
        if (files && files.length > 0) {
          return files.filter((f: string) => /\.(ini|3dm|migoto)$/i.test(f));
        }
      }
      try {
        const entries = await context.workspace.readDirectory();
        const list: string[] = [];
        const traverse = (items: DirEntry[], prefix = '') => {
          for (const item of items) {
            const rel = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.isDir && item.children) {
              traverse(item.children, rel);
            } else if (!item.isDir && /\.(ini|3dm|migoto)$/i.test(item.name)) {
              list.push(rel);
            }
          }
        };
        traverse(entries);
        return list;
      } catch {
        return [];
      }
    };

    // Helper to read text of a file
    const readIniText = async (ctx: any, path: string): Promise<string> => {
      const curPath = ctx.file?.path || ctx.file?.name;
      if (curPath && (curPath === path || curPath.endsWith(`/${path}`) || curPath.endsWith(`\\${path}`))) {
        return ctx.model.getValue();
      }
      if (ctx.readTextFile) {
        try {
          return await ctx.readTextFile(path);
        } catch {}
      }
      try {
        return await context.workspace.readTextFile(path);
      } catch {
        return '';
      }
    };

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
        // 단일 INI 파일로 열린 경우 (모드 폴더가 없는 경우)는 코어 린터가
        // "네임스페이스에 있는 변수인지 확인해야 합니다" 안내 메시지를 표시하므로 중복 방지를 위해 건너뜁니다.
        if (!ctx.folder) {
          return [];
        }

        const diagnostics: LintDiagnostic[] = [];
        const iniPaths = await collectIniFiles(ctx);

        // 모드 폴더 내 모든 INI 파일의 네임스페이스 및 내보내기 색인 빌드
        const namespaceMap = new Map<string, NamespaceGroup>();
        const allKnownVariables = new Set<string>();

        for (const iniPath of iniPaths) {
          const content = await readIniText(ctx, iniPath);
          if (!content) continue;
          const exp = parseIniExports(content, iniPath);

          if (exp.namespace) {
            const nsKey = exp.namespace.toLowerCase();
            let group = namespaceMap.get(nsKey);
            if (!group) {
              group = {
                namespace: exp.namespace,
                files: [],
                variables: new Set<string>(),
                sections: new Set<string>(),
              };
              namespaceMap.set(nsKey, group);
            }
            group.files.push(iniPath);
            for (const v of exp.variables) {
              group.variables.add(v);
              allKnownVariables.add(`\\${nsKey}\\${v}`);
              allKnownVariables.add(`${nsKey}\\${v}`);
            }
            for (const s of exp.sections) {
              group.sections.add(s);
            }
          }
        }

        // 현재 에디터 모델의 네임스페이스 확인
        // ini 파일에서 namespace = 가 정의돼있으면 그 ini는 그 네임스페이스를 사용하며,
        // 다른 ini와 동일한 namespace = 로 공유되면 같은 네임스페이스 스코프를 공유합니다.
        const currentModelExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || '');
        const currentNsKey = currentModelExp.namespace ? currentModelExp.namespace.toLowerCase() : '';
        const currentNsGroup = currentNsKey ? namespaceMap.get(currentNsKey) : null;

        // 이전 동적 등록 정리
        if (unregisterAllowedVars) {
          unregisterAllowedVars();
          unregisterAllowedVars = null;
        }
        if (unregisterAllowedGroupResources) {
          unregisterAllowedGroupResources();
          unregisterAllowedGroupResources = null;
        }

        const sharedVars = currentNsGroup ? currentNsGroup.variables : null;
        const sharedSections = currentNsGroup ? currentNsGroup.sections : null;

        // 코어 린터에 허용 변수 등록:
        // 1) \Namespace\var 형태의 명시적 네임스페이스 변수
        // 2) 현재 파일과 동일한 namespace = 를 공유하는 다른 ini 파일들의 변수 ($var 접두사 없이 사용 가능)
        if (context.linter?.registerAllowedVariable) {
          unregisterAllowedVars = context.linter.registerAllowedVariable((name: string) => {
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
          unregisterAllowedGroupResources = context.linter.registerAllowedResource((name: string) => {
            return sharedSections.has(name.toLowerCase());
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
              const isBuiltIn = prefix.toLowerCase().startsWith('builtin');
              const isAllowed = ctx.isAllowedResource ? ctx.isAllowedResource(target) : false;

              if (!isBuiltIn && !isAllowed && parts.length >= 3) {
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
  },
  deactivate() {
    if (unregisterAllowedVars) {
      unregisterAllowedVars();
      unregisterAllowedVars = null;
    }
    if (unregisterAllowedGroupResources) {
      unregisterAllowedGroupResources();
      unregisterAllowedGroupResources = null;
    }
  },
});

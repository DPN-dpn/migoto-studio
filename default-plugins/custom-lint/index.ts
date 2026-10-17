import { stripComments } from '../../src/core/ini/lint.ts';
import type { DirEntry, LintDiagnostic, SymbolLocation, CustomDefinitionProvider, CustomReferenceProvider, MigotoPlugin } from '../../src/plugins/types.ts';

export interface SymbolLocationRecord {
  name: string;        // Lowercase name or clean name
  rawName: string;
  kind: 'variable' | 'section';
  line: number;
  startCol: number;
  endCol: number;
  lineContent: string;
  section: string;
  filePath: string;
  namespace?: string;
}

interface NamespaceExport {
  namespace: string;
  filePath: string;
  variables: Set<string>;
  sections: Set<string>;
  usedVariables: Set<string>;
  usedSections: Set<string>;
  declarations: SymbolLocationRecord[];
  usages: SymbolLocationRecord[];
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
  const usedVariables = new Set<string>();
  const usedSections = new Set<string>();
  const declarations: SymbolLocationRecord[] = [];
  const usages: SymbolLocationRecord[] = [];

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

      const bracketIdx = raw.indexOf('[');
      const startCol = bracketIdx !== -1 ? bracketIdx + 2 : 1;
      const endCol = startCol + currentSection.length;

      declarations.push({
        name: secLower,
        rawName: currentSection,
        kind: 'section',
        line: i + 1,
        startCol,
        endCol,
        lineContent: raw,
        section: `[${currentSection}]`,
        filePath,
        namespace: currentNamespace,
      });

      // If section is e.g. CommandListSwap and namespace is Raiden,
      // register CommandList\Raiden\Swap variant
      if (currentNamespace) {
        const nsLower = currentNamespace.toLowerCase();
        if (secLower.startsWith('commandlist') && secLower.length > 11) {
          const action = secLower.slice(11);
          const alias = `commandlist\\${nsLower}\\${action}`;
          sections.add(alias);
          declarations.push({
            name: alias,
            rawName: `CommandList\\${currentNamespace}\\${currentSection.slice(11)}`,
            kind: 'section',
            line: i + 1,
            startCol,
            endCol,
            lineContent: raw,
            section: `[${currentSection}]`,
            filePath,
            namespace: currentNamespace,
          });
        } else if (secLower.startsWith('resource') && secLower.length > 8) {
          const res = secLower.slice(8);
          const alias = `resource\\${nsLower}\\${res}`;
          sections.add(alias);
          declarations.push({
            name: alias,
            rawName: `Resource\\${currentNamespace}\\${currentSection.slice(8)}`,
            kind: 'section',
            line: i + 1,
            startCol,
            endCol,
            lineContent: raw,
            section: `[${currentSection}]`,
            filePath,
            namespace: currentNamespace,
          });
        } else if (secLower.startsWith('customshader') && secLower.length > 12) {
          const shader = secLower.slice(12);
          const alias = `customshader\\${nsLower}\\${shader}`;
          sections.add(alias);
          declarations.push({
            name: alias,
            rawName: `CustomShader\\${currentNamespace}\\${currentSection.slice(12)}`,
            kind: 'section',
            line: i + 1,
            startCol,
            endCol,
            lineContent: raw,
            section: `[${currentSection}]`,
            filePath,
            namespace: currentNamespace,
          });
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

      const rawIdx = raw.indexOf(vm[0]);
      const dollarRel = vm[0].indexOf('$');
      const startCol = rawIdx !== -1 && dollarRel !== -1 ? rawIdx + dollarRel + 1 : (rawIdx !== -1 ? rawIdx + 1 : 1);
      const endCol = startCol + vm[1].length + 1;

      declarations.push({
        name: simpleName ? simpleName.toLowerCase() : vName,
        rawName: `$${vm[1]}`,
        kind: 'variable',
        line: i + 1,
        startCol,
        endCol,
        lineContent: raw,
        section: currentSection ? `[${currentSection}]` : '',
        filePath,
        namespace: currentNamespace,
      });

      if (vName.includes('\\')) {
        declarations.push({
          name: vName,
          rawName: `$${vm[1]}`,
          kind: 'variable',
          line: i + 1,
          startCol,
          endCol,
          lineContent: raw,
          section: currentSection ? `[${currentSection}]` : '',
          filePath,
          namespace: currentNamespace,
        });
      }
    }

    // In [Constants], lines like `$costume = 1` or `$active`
    const isConstants = currentSection.toLowerCase() === 'constants';
    if (isConstants && !foundExplicit) {
      const constLineMatch = /^\s*(?:persist\s+|global\s+|local\s+)*\$([a-zA-Z0-9_\\]+)/i.exec(code);
      if (constLineMatch) {
        const vName = constLineMatch[1].toLowerCase();
        const parts = vName.split('\\').filter(Boolean);
        const simpleName = parts[parts.length - 1];
        if (simpleName) variables.add(simpleName);
        variables.add(vName);

        const rawIdx = raw.indexOf(`$${constLineMatch[1]}`);
        const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
        const endCol = startCol + constLineMatch[1].length + 1;

        declarations.push({
          name: simpleName ? simpleName.toLowerCase() : vName,
          rawName: `$${constLineMatch[1]}`,
          kind: 'variable',
          line: i + 1,
          startCol,
          endCol,
          lineContent: raw,
          section: `[${currentSection}]`,
          filePath,
          namespace: currentNamespace,
        });

        if (vName.includes('\\')) {
          declarations.push({
            name: vName,
            rawName: `$${constLineMatch[1]}`,
            kind: 'variable',
            line: i + 1,
            startCol,
            endCol,
            lineContent: raw,
            section: `[${currentSection}]`,
            filePath,
            namespace: currentNamespace,
          });
        }
      }
    }

    // Variable usages
    const eqIdx = code.indexOf('=');
    const varRefRe = /\$([a-zA-Z0-9_\\]+)/g;
    let vum: RegExpExecArray | null;
    while ((vum = varRefRe.exec(code)) !== null) {
      if (eqIdx !== -1 && vum.index < eqIdx) {
        if (foundExplicit || isConstants) {
          continue;
        }
      } else if (eqIdx === -1 && (foundExplicit || isConstants)) {
        continue;
      }
      const vName = vum[1].toLowerCase();
      usedVariables.add(vName);
      const clean = vName.startsWith('\\') ? vName.slice(1) : vName;
      usedVariables.add(clean);
      const parts = clean.split('\\').filter(Boolean);
      let targetNs = currentNamespace;
      let leafName = clean;
      if (parts.length > 1) {
        targetNs = parts[0];
        leafName = parts.slice(1).join('\\');
        usedVariables.add(parts[parts.length - 1]);
      }

      const startCol = vum.index + 1;
      const endCol = startCol + vum[0].length;

      usages.push({
        name: leafName.toLowerCase(),
        rawName: vum[0],
        kind: 'variable',
        line: i + 1,
        startCol,
        endCol,
        lineContent: raw,
        section: currentSection ? `[${currentSection}]` : '',
        filePath,
        namespace: targetNs,
      });

      if (parts.length > 1) {
        usages.push({
          name: clean.toLowerCase(),
          rawName: vum[0],
          kind: 'variable',
          line: i + 1,
          startCol,
          endCol,
          lineContent: raw,
          section: currentSection ? `[${currentSection}]` : '',
          filePath,
          namespace: targetNs,
        });
      }
    }

    // Section references (run = ..., ps-t0 = ..., Resource = ..., etc.)
    const resRefMatch = /^\s*(?:(?:pre\s+|post\s+)?run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+|Resource(?:\\[a-zA-Z0-9_]+)*|(?:cs|vs|ps|hs|ds|gs))\s*=\s*(?:ref\s+|copy\s+)?([a-zA-Z0-9_\\]+)/i.exec(code);
    if (resRefMatch) {
      const target = resRefMatch[1].trim();
      const targetLower = target.toLowerCase();
      if (!['null', 'skip', 'auto', 'default'].includes(targetLower)) {
        usedSections.add(targetLower);
        const clean = targetLower.startsWith('\\') ? targetLower.slice(1) : targetLower;
        usedSections.add(clean);
        const parts = clean.split('\\').filter(Boolean);
        let targetNs = currentNamespace;
        let actionName = clean;
        if (parts.length >= 3) {
          targetNs = parts[1];
          actionName = `${parts[0]}${parts[parts.length - 1]}`.toLowerCase();
          usedSections.add(parts[parts.length - 1]);
        } else if (parts.length > 1) {
          usedSections.add(parts[parts.length - 1]);
        }

        const matchIdx = raw.indexOf(resRefMatch[1]);
        const startCol = matchIdx !== -1 ? matchIdx + 1 : 1;
        const endCol = startCol + resRefMatch[1].length;

        usages.push({
          name: actionName.toLowerCase(),
          rawName: target,
          kind: 'section',
          line: i + 1,
          startCol,
          endCol,
          lineContent: raw,
          section: currentSection ? `[${currentSection}]` : '',
          filePath,
          namespace: targetNs,
        });
        if (clean !== actionName) {
          usages.push({
            name: clean.toLowerCase(),
            rawName: target,
            kind: 'section',
            line: i + 1,
            startCol,
            endCol,
            lineContent: raw,
            section: currentSection ? `[${currentSection}]` : '',
            filePath,
            namespace: targetNs,
          });
        }
      }
    }

    const refCopyRe = /\b(?:ref|copy)\s+([a-zA-Z0-9_\\]+)/gi;
    let rcm: RegExpExecArray | null;
    while ((rcm = refCopyRe.exec(code)) !== null) {
      const target = rcm[1].trim();
      const targetLower = target.toLowerCase();
      if (!['null', 'skip', 'auto', 'default'].includes(targetLower)) {
        usedSections.add(targetLower);
        const clean = targetLower.startsWith('\\') ? targetLower.slice(1) : targetLower;
        usedSections.add(clean);
        const parts = clean.split('\\').filter(Boolean);
        let targetNs = currentNamespace;
        let actionName = clean;
        if (parts.length >= 3) {
          targetNs = parts[1];
          actionName = `${parts[0]}${parts[parts.length - 1]}`.toLowerCase();
          usedSections.add(parts[parts.length - 1]);
        } else if (parts.length > 1) {
          usedSections.add(parts[parts.length - 1]);
        }

        const startCol = rcm.index + 1;
        const endCol = startCol + rcm[0].length;

        usages.push({
          name: actionName.toLowerCase(),
          rawName: target,
          kind: 'section',
          line: i + 1,
          startCol,
          endCol,
          lineContent: raw,
          section: currentSection ? `[${currentSection}]` : '',
          filePath,
          namespace: targetNs,
        });
        if (clean !== actionName) {
          usages.push({
            name: clean.toLowerCase(),
            rawName: target,
            kind: 'section',
            line: i + 1,
            startCol,
            endCol,
            lineContent: raw,
            section: currentSection ? `[${currentSection}]` : '',
            filePath,
            namespace: targetNs,
          });
        }
      }
    }
  }

  return {
    namespace: currentNamespace,
    filePath,
    variables,
    sections,
    usedVariables,
    usedSections,
    declarations,
    usages,
  };
}

export function isBuiltinResource(name: string): boolean {
  if (!name) return false;
  const norm = name.toLowerCase().replace(/^[\\\/]+/, '');
  return (
    norm.startsWith('builtincommandlist') ||
    norm.startsWith('builtin_commandlist') ||
    norm.startsWith('builtin\\') ||
    norm.startsWith('commandlist\\builtin') ||
    norm.startsWith('commandlist\\skintexture') ||
    norm === 'commandlistskintexture' ||
    norm === 'builtin'
  );
}

let isPluginActive = false;
let unregisterBuiltinResources: (() => void)[] = [];
let unregisterAllowedVars: (() => void) | null = null;
let unregisterAllowedGroupResources: (() => void) | null = null;
let unregisterAllowedUsedVars: (() => void) | null = null;
let unregisterAllowedUsedResources: (() => void) | null = null;
let unregisterDefProvider: (() => void) | null = null;
let unregisterRefProvider: (() => void) | null = null;

const plugin: MigotoPlugin = {
  activate(context) {
    isPluginActive = true;

    // 0. XXMI 표준 내장 커맨드리스트 허용 등록 (GIMI / ZZMI / XXMI 내장 함수: BuiltinCommandList~, CommandListSkinTexture 등)
    if (context.linter?.registerAllowedResource) {
      const u1 = context.linter.registerAllowedResource((name: string) => isBuiltinResource(name));
      const u2 = context.linter.registerAllowedResource(/^builtincommandlist/i);
      const u3 = context.linter.registerAllowedResource('CommandListSkinTexture');
      const u4 = context.linter.registerAllowedResource(/^(?:builtin\\)?commandlistskintexture$/i);
      const u5 = context.linter.registerAllowedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
      const u6 = context.linter.registerAllowedResource(/^builtin\\skintexture$/i);
      const u7 = context.linter.registerAllowedResource(/^(?:commandlist\\)?builtin\\/i);
      const u8 = context.linter.registerAllowedResource(/^builtin\\/i);
      unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
    }
    if (context.linter?.registerAllowedUsedResource) {
      const u1 = context.linter.registerAllowedUsedResource((name: string) => isBuiltinResource(name));
      const u2 = context.linter.registerAllowedUsedResource(/^builtincommandlist/i);
      const u3 = context.linter.registerAllowedUsedResource('CommandListSkinTexture');
      const u4 = context.linter.registerAllowedUsedResource(/^(?:builtin\\)?commandlistskintexture$/i);
      const u5 = context.linter.registerAllowedUsedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
      const u6 = context.linter.registerAllowedUsedResource(/^builtin\\skintexture$/i);
      const u7 = context.linter.registerAllowedUsedResource(/^(?:commandlist\\)?builtin\\/i);
      const u8 = context.linter.registerAllowedUsedResource(/^builtin\\/i);
      unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
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

    // Helper to build workspace index of namespaces, exports, declarations, and usages
    const buildWorkspaceIndex = async (ctx: any): Promise<{
      allSummaries: NamespaceExport[];
      namespaceMap: Map<string, NamespaceGroup>;
      allKnownVariables: Set<string>;
    }> => {
      const iniPaths = await collectIniFiles(ctx);
      const namespaceMap = new Map<string, NamespaceGroup>();
      const allKnownVariables = new Set<string>();
      const allSummaries: NamespaceExport[] = [];

      for (const iniPath of iniPaths) {
        const content = await readIniText(ctx, iniPath);
        if (!content) continue;
        const exp = parseIniExports(content, iniPath);
        allSummaries.push(exp);

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

      return { allSummaries, namespaceMap, allKnownVariables };
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
        if (!isPluginActive) {
          return [];
        }
        // 단일 INI 파일로 열린 경우 (모드 폴더가 없는 경우)는 코어 린터가
        // "네임스페이스에 있는 변수인지 확인해야 합니다" 안내 메시지를 표시하므로 중복 방지를 위해 건너뜁니다.
        if (!ctx.folder) {
          return [];
        }

        const diagnostics: LintDiagnostic[] = [];
        const { allSummaries, namespaceMap, allKnownVariables } = await buildWorkspaceIndex(ctx);

        if (!isPluginActive) {
          return [];
        }

        // 현재 에디터 모델의 네임스페이스 확인
        // ini 파일에서 namespace = 가 정의돼있으면 그 ini는 그 네임스페이스를 사용하며,
        // 다른 ini와 동일한 namespace = 로 공유되면 같은 네임스페이스 스코프를 공유합니다.
        const currentModelExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || '');
        const currentNsKey = currentModelExp.namespace ? currentModelExp.namespace.toLowerCase() : '';
        const currentNsGroup = currentNsKey ? namespaceMap.get(currentNsKey) : null;
        const currentFilePath = (ctx.file?.path || ctx.file?.name || '').toLowerCase();

        // 이전 동적 등록 정리
        if (unregisterAllowedVars) {
          unregisterAllowedVars();
          unregisterAllowedVars = null;
        }
        if (unregisterAllowedGroupResources) {
          unregisterAllowedGroupResources();
          unregisterAllowedGroupResources = null;
        }
        if (unregisterAllowedUsedVars) {
          unregisterAllowedUsedVars();
          unregisterAllowedUsedVars = null;
        }
        if (unregisterAllowedUsedResources) {
          unregisterAllowedUsedResources();
          unregisterAllowedUsedResources = null;
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

        // 코어 린터에 타 파일에서 참조된 변수/섹션 허용 등록 (Unused 경고 방지)
        if (externallyUsedVars.size > 0 && context.linter?.registerAllowedUsedVariable) {
          unregisterAllowedUsedVars = context.linter.registerAllowedUsedVariable((name: string) => {
            const clean = name.toLowerCase().replace(/^[\\$]+/, '');
            return externallyUsedVars.has(clean);
          });
        }

        if (externallyUsedResources.size > 0 && context.linter?.registerAllowedUsedResource) {
          unregisterAllowedUsedResources = context.linter.registerAllowedUsedResource((name: string) => {
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

    // 3. 에디터 / 린터: 동일 네임스페이스 및 크로스 파일 심볼 정의(선언) 추적
    const definitionProvider: CustomDefinitionProvider = {
      provideDefinition: async (target, ctx) => {
        if (!isPluginActive || !target) return null;
        const { allSummaries } = await buildWorkspaceIndex(ctx);
        if (!isPluginActive || allSummaries.length === 0) return null;

        const curPath = (ctx.file?.path || ctx.file?.name || '').toLowerCase();
        let currentNs = target.namespace ? target.namespace.toLowerCase() : '';
        if (!currentNs) {
          const curExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || '');
          if (curExp.namespace) {
            currentNs = curExp.namespace.toLowerCase();
          } else {
            const currentSummary = allSummaries.find((s) => {
              const p = s.filePath.toLowerCase();
              return p === curPath || p.endsWith(`/${curPath}`) || curPath.endsWith(`/${p}`);
            });
            if (currentSummary && currentSummary.namespace) {
              currentNs = currentSummary.namespace.toLowerCase();
            }
          }
        }

        const targetNameClean = (target.cleanName || target.name || '')
          .replace(/^[\[\]\$]+|[\[\]\$]+$/g, '')
          .toLowerCase();
        const targetBase = targetNameClean.includes('\\') ? targetNameClean.split('\\').pop()! : targetNameClean;

        const matchesDecl = (decl: SymbolLocationRecord): boolean => {
          const declName = decl.name.toLowerCase();
          const declRaw = decl.rawName.toLowerCase();
          if (target.kind === 'variable' && decl.kind === 'variable') {
            if (declName === targetNameClean || declName === targetBase) return true;
            const cleanDecl = declName.replace(/^[\\\$]+/, '');
            if (cleanDecl === targetNameClean || cleanDecl === targetBase) return true;
            if (cleanDecl.endsWith(`\\${targetNameClean}`) || cleanDecl.endsWith(`\\${targetBase}`)) return true;
            return false;
          } else if (target.kind === 'section' && decl.kind === 'section') {
            if (declName === targetNameClean || declRaw === targetNameClean || declName === targetBase || declRaw === targetBase) return true;
            if (declName === `[${targetNameClean}]` || declName === `[${targetBase}]`) return true;
            if (declName.endsWith(`\\${targetNameClean}`) || declName.endsWith(`\\${targetBase}`)) return true;
            if (declName.startsWith('commandlist') && (declName.slice(11) === targetNameClean || declName.slice(11) === targetBase)) return true;
            if (declName.startsWith('builtincommandlist') && (declName.slice(18) === targetNameClean || declName.slice(18) === targetBase)) return true;
            if (targetNameClean.startsWith('builtincommandlist') && (declName === targetNameClean.slice(18) || declName === targetBase)) return true;
            if (targetNameClean.startsWith('builtincommandlist') && declName === `commandlist${targetNameClean.slice(18)}`) return true;
            if (declName.startsWith('builtincommandlist') && targetNameClean === `commandlist${declName.slice(18)}`) return true;
            if (declName.startsWith('resource') && (declName.slice(8) === targetNameClean || declName.slice(8) === targetBase)) return true;
            if (declName.startsWith('customshader') && (declName.slice(12) === targetNameClean || declName.slice(12) === targetBase)) return true;
            return false;
          }
          return false;
        };

        // Phase 1: Search within files in the same namespace
        if (currentNs) {
          for (const s of allSummaries) {
            if (s.namespace && s.namespace.toLowerCase() === currentNs) {
              const found = s.declarations.find(matchesDecl);
              if (found) {
                return {
                  filePath: found.filePath,
                  lineNumber: found.line,
                  startColumn: found.startCol,
                  endColumn: found.endCol,
                  lineContent: found.lineContent,
                  section: found.section,
                  isDefinition: true,
                };
              }
            }
          }
        }

        // Phase 2: If target has explicit namespace prefix
        if (target.namespace) {
          const targetNsLower = target.namespace.toLowerCase();
          for (const s of allSummaries) {
            if (s.namespace && s.namespace.toLowerCase() === targetNsLower) {
              const found = s.declarations.find(matchesDecl);
              if (found) {
                return {
                  filePath: found.filePath,
                  lineNumber: found.line,
                  startColumn: found.startCol,
                  endColumn: found.endCol,
                  lineContent: found.lineContent,
                  section: found.section,
                  isDefinition: true,
                };
              }
            }
          }
        }

        // Phase 3: Global / all files search fallback
        for (const s of allSummaries) {
          const found = s.declarations.find(matchesDecl);
          if (found) {
            return {
              filePath: found.filePath,
              lineNumber: found.line,
              startColumn: found.startCol,
              endColumn: found.endCol,
              lineContent: found.lineContent,
              section: found.section,
              isDefinition: true,
            };
          }
        }

        return null;
      },
    };

    // 4. 에디터 / 린터: 동일 네임스페이스 및 크로스 파일 심볼 참조(사용) 추적
    const referenceProvider: CustomReferenceProvider = {
      provideReferences: async (target, ctx) => {
        if (!isPluginActive || !target) return [];
        const { allSummaries } = await buildWorkspaceIndex(ctx);
        if (!isPluginActive || allSummaries.length === 0) return [];

        const curPath = (ctx.file?.path || ctx.file?.name || '').toLowerCase();
        let currentNs = target.namespace ? target.namespace.toLowerCase() : '';
        if (!currentNs) {
          const curExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || '');
          if (curExp.namespace) {
            currentNs = curExp.namespace.toLowerCase();
          } else {
            const currentSummary = allSummaries.find((s) => {
              const p = s.filePath.toLowerCase();
              return p === curPath || p.endsWith(`/${curPath}`) || curPath.endsWith(`/${p}`);
            });
            if (currentSummary && currentSummary.namespace) {
              currentNs = currentSummary.namespace.toLowerCase();
            }
          }
        }

        const targetNameClean = (target.cleanName || target.name || '')
          .replace(/^[\[\]\$]+|[\[\]\$]+$/g, '')
          .toLowerCase();
        const targetBase = targetNameClean.includes('\\')
          ? targetNameClean.split('\\').pop() || targetNameClean
          : targetNameClean;

        const matchesRecord = (rec: SymbolLocationRecord): boolean => {
          const recName = rec.name.toLowerCase();
          const recRaw = rec.rawName.toLowerCase();
          if (target.kind === 'variable' && rec.kind === 'variable') {
            if (recName === targetNameClean || recName === targetBase) return true;
            const cleanRec = recName.replace(/^[\\\$]+/, '');
            if (cleanRec === targetNameClean || cleanRec === targetBase) return true;
            if (cleanRec.endsWith(`\\${targetNameClean}`) || cleanRec.endsWith(`\\${targetBase}`)) return true;
            return false;
          } else if (target.kind === 'section' && rec.kind === 'section') {
            if (recName === targetNameClean || recRaw === targetNameClean || recName === targetBase || recRaw === targetBase) return true;
            if (recName === `[${targetNameClean}]` || recName === `[${targetBase}]`) return true;
            if (recName.endsWith(`\\${targetNameClean}`) || recName.endsWith(`\\${targetBase}`)) return true;
            if (recName.startsWith('commandlist') && (recName.slice(11) === targetNameClean || recName.slice(11) === targetBase)) return true;
            if (recName.startsWith('builtincommandlist') && (recName.slice(18) === targetNameClean || recName.slice(18) === targetBase)) return true;
            if (targetNameClean.startsWith('builtincommandlist') && recName === targetNameClean.slice(18)) return true;
            if (targetNameClean.startsWith('builtincommandlist') && recName === `commandlist${targetNameClean.slice(18)}`) return true;
            if (recName.startsWith('builtincommandlist') && targetNameClean === `commandlist${recName.slice(18)}`) return true;
            if (recName.startsWith('resource') && (recName.slice(8) === targetNameClean || recName.slice(8) === targetBase)) return true;
            if (recName.startsWith('customshader') && (recName.slice(12) === targetNameClean || recName.slice(12) === targetBase)) return true;
            return false;
          }
          return false;
        };

        const results: SymbolLocation[] = [];
        const seen = new Set<string>();

        const addLocation = (rec: SymbolLocationRecord, isDef: boolean) => {
          const key = `${rec.filePath}:${rec.line}:${rec.startCol}`;
          if (seen.has(key)) return;
          seen.add(key);
          results.push({
            filePath: rec.filePath,
            lineNumber: rec.line,
            startColumn: rec.startCol,
            endColumn: rec.endCol,
            lineContent: rec.lineContent,
            section: rec.section,
            isDefinition: isDef,
          });
        };

        const isBuiltinTarget = isBuiltinResource(targetNameClean);

        for (const s of allSummaries) {
          const fileNs = s.namespace ? s.namespace.toLowerCase() : '';
          const isSameNs = currentNs ? fileNs === currentNs : !fileNs;

          if (isBuiltinTarget || isSameNs) {
            // 1. Same namespace or builtin: collect declarations & usages
            for (const d of s.declarations) {
              if (matchesRecord(d)) addLocation(d, true);
            }
            for (const u of s.usages) {
              if (matchesRecord(u)) addLocation(u, false);
            }
          } else if (currentNs) {
            // 2. Different namespace: collect usages that explicitly prefix currentNs
            for (const u of s.usages) {
              const uNs = u.namespace ? u.namespace.toLowerCase() : '';
              if (uNs === currentNs && matchesRecord(u)) {
                addLocation(u, false);
              }
            }
          }
        }

        return results;
      },
    };

    if (context.editor?.registerDefinitionProvider) {
      unregisterDefProvider = context.editor.registerDefinitionProvider(definitionProvider);
    } else if (context.linter?.registerDefinitionProvider) {
      unregisterDefProvider = context.linter.registerDefinitionProvider(definitionProvider);
    }

    if (context.editor?.registerReferenceProvider) {
      unregisterRefProvider = context.editor.registerReferenceProvider(referenceProvider);
    } else if (context.linter?.registerReferenceProvider) {
      unregisterRefProvider = context.linter.registerReferenceProvider(referenceProvider);
    }

    // 상단 [플러그인] 메뉴: 린터 상태 확인
    context.ui?.registerMenuItem?.({
      label: '모드 리소스 및 네임스페이스 린트 상태 확인',
      action: () => {
        const cur = context.workspace.getCurrentFile();
        const folder = context.workspace.getCurrentFolder();
        if (folder) {
          context.ui.showToast(`커스텀 린터가 정상 동작 중입니다. (모드 폴더: ${folder})`, 'info');
        } else if (cur) {
          context.ui.showToast(`커스텀 린터가 정상 동작 중입니다. (파일: ${cur.name})`, 'info');
        } else {
          context.ui.showToast('커스텀 린터가 활성화되어 있습니다.', 'info');
        }
      },
    });
  },
  deactivate() {
    isPluginActive = false;
    if (unregisterBuiltinResources.length > 0) {
      for (const cleanup of unregisterBuiltinResources) {
        try { cleanup(); } catch {}
      }
      unregisterBuiltinResources = [];
    }
    if (unregisterAllowedVars) {
      unregisterAllowedVars();
      unregisterAllowedVars = null;
    }
    if (unregisterAllowedGroupResources) {
      unregisterAllowedGroupResources();
      unregisterAllowedGroupResources = null;
    }
    if (unregisterAllowedUsedVars) {
      unregisterAllowedUsedVars();
      unregisterAllowedUsedVars = null;
    }
    if (unregisterAllowedUsedResources) {
      unregisterAllowedUsedResources();
      unregisterAllowedUsedResources = null;
    }
    if (unregisterDefProvider) {
      unregisterDefProvider();
      unregisterDefProvider = null;
    }
    if (unregisterRefProvider) {
      unregisterRefProvider();
      unregisterRefProvider = null;
    }
  },
};

export default plugin;


import type { SymbolLocationRecord } from './types.ts';
import { parseIniExports } from './parser.ts';
import { buildWorkspaceIndex, type WorkspaceContextLike } from './indexer.ts';

export interface CoreSymbolLocation {
  filePath: string;
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  lineContent?: string;
  section?: string;
  isDefinition?: boolean;
}

export function matchesSymbol(target: any, rec: SymbolLocationRecord): boolean {
  const targetNameClean = (target.cleanName || target.name || '')
    .replace(/^[\[\]\$]+|[\[\]\$]+$/g, '')
    .toLowerCase();
  const targetBase = targetNameClean.includes('\\')
    ? targetNameClean.split('\\').pop() || targetNameClean
    : targetNameClean;

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
    if (targetNameClean.startsWith('builtincommandlist') && (recName === targetNameClean.slice(18) || recName === targetBase)) return true;
    if (targetNameClean.startsWith('builtincommandlist') && recName === `commandlist${targetNameClean.slice(18)}`) return true;
    if (recName.startsWith('builtincommandlist') && targetNameClean === `commandlist${recName.slice(18)}`) return true;
    if (recName.startsWith('resource') && (recName.slice(8) === targetNameClean || recName.slice(8) === targetBase)) return true;
    if (recName.startsWith('customshader') && (recName.slice(12) === targetNameClean || recName.slice(12) === targetBase)) return true;
    return false;
  }
  return false;
}

export function createCoreDefinitionProvider(
  workspaceHelper?: {
    readDirectory?: () => Promise<any[]>;
    readTextFile?: (path: string) => Promise<string>;
  },
) {
  return {
    provideDefinition: async (target: any, ctx: WorkspaceContextLike): Promise<CoreSymbolLocation | null> => {
      if (!target) return null;
      const { allSummaries } = await buildWorkspaceIndex(ctx, workspaceHelper);
      if (allSummaries.length === 0) return null;

      const curPath = (ctx.file?.path || ctx.file?.name || '').toLowerCase();
      let currentNs = target.namespace ? target.namespace.toLowerCase() : '';
      if (!currentNs && ctx.model) {
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

      // Phase 1: Search within files in the same namespace
      if (currentNs) {
        for (const s of allSummaries) {
          if (s.namespace && s.namespace.toLowerCase() === currentNs) {
            const found = s.declarations.find((d) => matchesSymbol(target, d));
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
            const found = s.declarations.find((d) => matchesSymbol(target, d));
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

      // Phase 3: Global search fallback
      for (const s of allSummaries) {
        const found = s.declarations.find((d) => matchesSymbol(target, d));
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
}

export function createCoreReferenceProvider(
  workspaceHelper?: {
    readDirectory?: () => Promise<any[]>;
    readTextFile?: (path: string) => Promise<string>;
  },
) {
  return {
    provideReferences: async (target: any, ctx: WorkspaceContextLike): Promise<CoreSymbolLocation[]> => {
      if (!target) return [];
      const { allSummaries } = await buildWorkspaceIndex(ctx, workspaceHelper);
      if (allSummaries.length === 0) return [];

      const results: CoreSymbolLocation[] = [];

      for (const s of allSummaries) {
        // Collect definitions
        for (const d of s.declarations) {
          if (matchesSymbol(target, d)) {
            results.push({
              filePath: d.filePath,
              lineNumber: d.line,
              startColumn: d.startCol,
              endColumn: d.endCol,
              lineContent: d.lineContent,
              section: d.section,
              isDefinition: true,
            });
          }
        }

        // Collect usages
        for (const u of s.usages) {
          if (matchesSymbol(target, u)) {
            results.push({
              filePath: u.filePath,
              lineNumber: u.line,
              startColumn: u.startCol,
              endColumn: u.endCol,
              lineContent: u.lineContent,
              section: u.section,
              isDefinition: false,
            });
          }
        }
      }

      return results;
    },
  };
}

export const createNamespaceDefinitionProvider = createCoreDefinitionProvider;
export const createNamespaceReferenceProvider = createCoreReferenceProvider;

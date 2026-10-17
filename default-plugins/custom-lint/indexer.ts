import type { DirEntry, PluginContext } from '../../src/plugins/types.ts';
import type { NamespaceExport, NamespaceGroup } from './types.ts';
import { parseIniExports } from './parser.ts';

export interface WorkspaceIndex {
  allSummaries: NamespaceExport[];
  namespaceMap: Map<string, NamespaceGroup>;
  allKnownVariables: Set<string>;
}

/**
 * 모드 워크스페이스 내 모든 INI/3dm/migoto 파일 경로를 수집합니다.
 */
export async function collectIniFiles(ctx: any, context: PluginContext): Promise<string[]> {
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
}

/**
 * 대상 파일의 본문 텍스트를 읽어옵니다. 에디터에 열려있는 활성 파일인 경우 최신 모델 버퍼를 사용합니다.
 */
export async function readIniText(ctx: any, context: PluginContext, path: string): Promise<string> {
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
}

/**
 * 워크스페이스 전체 INI 파일들을 파싱하여 네임스페이스 맵, 변수 세트 및 심볼 선언/참조 인덱스를 구축합니다.
 */
export async function buildWorkspaceIndex(ctx: any, context: PluginContext): Promise<WorkspaceIndex> {
  const iniPaths = await collectIniFiles(ctx, context);
  const namespaceMap = new Map<string, NamespaceGroup>();
  const allKnownVariables = new Set<string>();
  const allSummaries: NamespaceExport[] = [];

  for (const iniPath of iniPaths) {
    const content = await readIniText(ctx, context, iniPath);
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
}

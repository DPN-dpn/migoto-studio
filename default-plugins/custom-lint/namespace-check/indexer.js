import { parseIniExports } from "./parser.js";
//#region default-plugins/custom-lint/namespace-check/indexer.ts
/**
* 모드 워크스페이스 내 모든 INI/3dm/migoto 파일 경로를 수집합니다.
*/
async function collectIniFiles(ctx, context) {
	if (ctx.getAllFiles) {
		const files = ctx.getAllFiles();
		if (files && files.length > 0) return files.filter((f) => /\.(ini|3dm|migoto)$/i.test(f));
	}
	try {
		const entries = await context.workspace.readDirectory();
		const list = [];
		const traverse = (items, prefix = "") => {
			for (const item of items) {
				const rel = prefix ? `${prefix}/${item.name}` : item.name;
				if (item.isDir && item.children) traverse(item.children, rel);
				else if (!item.isDir && /\.(ini|3dm|migoto)$/i.test(item.name)) list.push(rel);
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
async function readIniText(ctx, context, path) {
	const curPath = ctx.file?.path || ctx.file?.name;
	if (curPath && (curPath === path || curPath.endsWith(`/${path}`) || curPath.endsWith(`\\${path}`))) return ctx.model.getValue();
	if (ctx.readTextFile) try {
		return await ctx.readTextFile(path);
	} catch {}
	try {
		return await context.workspace.readTextFile(path);
	} catch {
		return "";
	}
}
/**
* 워크스페이스 전체 INI 파일들을 파싱하여 네임스페이스 맵, 변수 세트 및 심볼 선언/참조 인덱스를 구축합니다.
*/
async function buildWorkspaceIndex(ctx, context) {
	const iniPaths = await collectIniFiles(ctx, context);
	const namespaceMap = /* @__PURE__ */ new Map();
	const allKnownVariables = /* @__PURE__ */ new Set();
	const allSummaries = [];
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
					variables: /* @__PURE__ */ new Set(),
					sections: /* @__PURE__ */ new Set()
				};
				namespaceMap.set(nsKey, group);
			}
			group.files.push(iniPath);
			for (const v of exp.variables) {
				group.variables.add(v);
				allKnownVariables.add(`\\${nsKey}\\${v}`);
				allKnownVariables.add(`${nsKey}\\${v}`);
			}
			for (const s of exp.sections) group.sections.add(s);
		}
	}
	return {
		allSummaries,
		namespaceMap,
		allKnownVariables
	};
}
//#endregion
export { buildWorkspaceIndex, collectIniFiles, readIniText };

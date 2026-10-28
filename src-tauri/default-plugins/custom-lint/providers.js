import { isBuiltinResource, parseIniExports } from "./parser.js";
import { buildWorkspaceIndex } from "./indexer.js";
//#region default-plugins/custom-lint/providers.ts
function matchesSymbol(target, rec) {
	const targetNameClean = (target.cleanName || target.name || "").replace(/^[\[\]\$]+|[\[\]\$]+$/g, "").toLowerCase();
	const targetBase = targetNameClean.includes("\\") ? targetNameClean.split("\\").pop() || targetNameClean : targetNameClean;
	const recName = rec.name.toLowerCase();
	const recRaw = rec.rawName.toLowerCase();
	if (target.kind === "variable" && rec.kind === "variable") {
		if (recName === targetNameClean || recName === targetBase) return true;
		const cleanRec = recName.replace(/^[\\\$]+/, "");
		if (cleanRec === targetNameClean || cleanRec === targetBase) return true;
		if (cleanRec.endsWith(`\\${targetNameClean}`) || cleanRec.endsWith(`\\${targetBase}`)) return true;
		return false;
	} else if (target.kind === "section" && rec.kind === "section") {
		if (recName === targetNameClean || recRaw === targetNameClean || recName === targetBase || recRaw === targetBase) return true;
		if (recName === `[${targetNameClean}]` || recName === `[${targetBase}]`) return true;
		if (recName.endsWith(`\\${targetNameClean}`) || recName.endsWith(`\\${targetBase}`)) return true;
		if (recName.startsWith("commandlist") && (recName.slice(11) === targetNameClean || recName.slice(11) === targetBase)) return true;
		if (recName.startsWith("builtincommandlist") && (recName.slice(18) === targetNameClean || recName.slice(18) === targetBase)) return true;
		if (targetNameClean.startsWith("builtincommandlist") && (recName === targetNameClean.slice(18) || recName === targetBase)) return true;
		if (targetNameClean.startsWith("builtincommandlist") && recName === `commandlist${targetNameClean.slice(18)}`) return true;
		if (recName.startsWith("builtincommandlist") && targetNameClean === `commandlist${recName.slice(18)}`) return true;
		if (recName.startsWith("resource") && (recName.slice(8) === targetNameClean || recName.slice(8) === targetBase)) return true;
		if (recName.startsWith("customshader") && (recName.slice(12) === targetNameClean || recName.slice(12) === targetBase)) return true;
		return false;
	}
	return false;
}
function createDefinitionProvider(context, isActive) {
	return { provideDefinition: async (target, ctx) => {
		if (!isActive() || !target) return null;
		const { allSummaries } = await buildWorkspaceIndex(ctx, context);
		if (!isActive() || allSummaries.length === 0) return null;
		const curPath = (ctx.file?.path || ctx.file?.name || "").toLowerCase();
		let currentNs = target.namespace ? target.namespace.toLowerCase() : "";
		if (!currentNs) {
			const curExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || "");
			if (curExp.namespace) currentNs = curExp.namespace.toLowerCase();
			else {
				const currentSummary = allSummaries.find((s) => {
					const p = s.filePath.toLowerCase();
					return p === curPath || p.endsWith(`/${curPath}`) || curPath.endsWith(`/${p}`);
				});
				if (currentSummary && currentSummary.namespace) currentNs = currentSummary.namespace.toLowerCase();
			}
		}
		if (currentNs) {
			for (const s of allSummaries) if (s.namespace && s.namespace.toLowerCase() === currentNs) {
				const found = s.declarations.find((d) => matchesSymbol(target, d));
				if (found) return {
					filePath: found.filePath,
					lineNumber: found.line,
					startColumn: found.startCol,
					endColumn: found.endCol,
					lineContent: found.lineContent,
					section: found.section,
					isDefinition: true
				};
			}
		}
		if (target.namespace) {
			const targetNsLower = target.namespace.toLowerCase();
			for (const s of allSummaries) if (s.namespace && s.namespace.toLowerCase() === targetNsLower) {
				const found = s.declarations.find((d) => matchesSymbol(target, d));
				if (found) return {
					filePath: found.filePath,
					lineNumber: found.line,
					startColumn: found.startCol,
					endColumn: found.endCol,
					lineContent: found.lineContent,
					section: found.section,
					isDefinition: true
				};
			}
		}
		for (const s of allSummaries) {
			const found = s.declarations.find((d) => matchesSymbol(target, d));
			if (found) return {
				filePath: found.filePath,
				lineNumber: found.line,
				startColumn: found.startCol,
				endColumn: found.endCol,
				lineContent: found.lineContent,
				section: found.section,
				isDefinition: true
			};
		}
		return null;
	} };
}
function createReferenceProvider(context, isActive) {
	return { provideReferences: async (target, ctx) => {
		if (!isActive() || !target) return [];
		const { allSummaries } = await buildWorkspaceIndex(ctx, context);
		if (!isActive() || allSummaries.length === 0) return [];
		const curPath = (ctx.file?.path || ctx.file?.name || "").toLowerCase();
		let currentNs = target.namespace ? target.namespace.toLowerCase() : "";
		if (!currentNs) {
			const curExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || "");
			if (curExp.namespace) currentNs = curExp.namespace.toLowerCase();
			else {
				const currentSummary = allSummaries.find((s) => {
					const p = s.filePath.toLowerCase();
					return p === curPath || p.endsWith(`/${curPath}`) || curPath.endsWith(`/${p}`);
				});
				if (currentSummary && currentSummary.namespace) currentNs = currentSummary.namespace.toLowerCase();
			}
		}
		const targetNameClean = (target.cleanName || target.name || "").replace(/^[\[\]\$]+|[\[\]\$]+$/g, "").toLowerCase();
		const results = [];
		const seen = /* @__PURE__ */ new Set();
		const addLocation = (rec, isDef) => {
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
				isDefinition: isDef
			});
		};
		const isBuiltinTarget = isBuiltinResource(targetNameClean);
		for (const s of allSummaries) {
			const fileNs = s.namespace ? s.namespace.toLowerCase() : "";
			if (isBuiltinTarget || (currentNs ? fileNs === currentNs : !fileNs)) {
				for (const d of s.declarations) if (matchesSymbol(target, d)) addLocation(d, true);
				for (const u of s.usages) if (matchesSymbol(target, u)) addLocation(u, false);
			} else if (currentNs) {
				for (const u of s.usages) if ((u.namespace ? u.namespace.toLowerCase() : "") === currentNs && matchesSymbol(target, u)) addLocation(u, false);
			}
		}
		return results;
	} };
}
//#endregion
export { createDefinitionProvider, createReferenceProvider };

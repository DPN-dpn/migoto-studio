import { isBuiltinResource } from "../builtin-syntax/matcher.js";
import { isHelpIniResource, isHelpIniVariable } from "../builtin-syntax/help-ini.js";
import { parseIniExports, stripComments } from "./parser.js";
import { buildWorkspaceIndex } from "./indexer.js";
import { createDefinitionProvider, createReferenceProvider } from "./providers.js";
import { isSrmiResource, isSrmiVariable } from "../srmi/rules.js";
//#region default-plugins/custom-lint/namespace-check/index.ts
function createNamespaceRegistrationState() {
	return {
		unregisterAllowedVars: null,
		unregisterAllowedGroupResources: null,
		unregisterAllowedUsedVars: null,
		unregisterAllowedUsedResources: null,
		unregisterDefProvider: null,
		unregisterRefProvider: null
	};
}
function cleanupNamespaceState(state) {
	if (state.unregisterAllowedVars) {
		try {
			state.unregisterAllowedVars();
		} catch {}
		state.unregisterAllowedVars = null;
	}
	if (state.unregisterAllowedGroupResources) {
		try {
			state.unregisterAllowedGroupResources();
		} catch {}
		state.unregisterAllowedGroupResources = null;
	}
	if (state.unregisterAllowedUsedVars) {
		try {
			state.unregisterAllowedUsedVars();
		} catch {}
		state.unregisterAllowedUsedVars = null;
	}
	if (state.unregisterAllowedUsedResources) {
		try {
			state.unregisterAllowedUsedResources();
		} catch {}
		state.unregisterAllowedUsedResources = null;
	}
	if (state.unregisterDefProvider) {
		try {
			state.unregisterDefProvider();
		} catch {}
		state.unregisterDefProvider = null;
	}
	if (state.unregisterRefProvider) {
		try {
			state.unregisterRefProvider();
		} catch {}
		state.unregisterRefProvider = null;
	}
}
/**
* XXMI 네임스페이스 및 변수 유효성 검사 린트 규칙과 정의/참조 Provider를 등록합니다.
*/
function registerNamespaceCheck(context, isActive, state) {
	context.linter.registerRule({
		id: "xxmi-namespace-check",
		name: "XXMI 네임스페이스 및 변수 검사",
		check: async (ctx) => {
			if (!isActive()) return [];
			if (!ctx.folder) return [];
			const diagnostics = [];
			const { allSummaries, namespaceMap, allKnownVariables } = await buildWorkspaceIndex(ctx, context);
			if (!isActive()) return [];
			const currentModelExp = parseIniExports(ctx.model.getValue(), ctx.file?.path || ctx.file?.name || "");
			const currentNsKey = currentModelExp.namespace ? currentModelExp.namespace.toLowerCase() : "";
			const currentNsGroup = currentNsKey ? namespaceMap.get(currentNsKey) : null;
			const currentFilePath = (ctx.file?.path || ctx.file?.name || "").toLowerCase();
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
			const externallyUsedVars = /* @__PURE__ */ new Set();
			const externallyUsedResources = /* @__PURE__ */ new Set();
			for (const other of allSummaries) {
				const otherPath = other.filePath.toLowerCase();
				if (otherPath && currentFilePath && (otherPath === currentFilePath || otherPath.endsWith(`/${currentFilePath}`) || otherPath.endsWith(`\\${currentFilePath}`) || currentFilePath.endsWith(`/${otherPath}`) || currentFilePath.endsWith(`\\${otherPath}`))) continue;
				const otherNsKey = other.namespace ? other.namespace.toLowerCase() : "";
				if (currentNsKey && otherNsKey === currentNsKey) {
					for (const uv of other.usedVariables) externallyUsedVars.add(uv);
					for (const us of other.usedSections) externallyUsedResources.add(us);
				} else if (!currentNsKey && !otherNsKey) {
					for (const uv of other.usedVariables) externallyUsedVars.add(uv);
					for (const us of other.usedSections) externallyUsedResources.add(us);
				} else if (currentNsKey) {
					for (const uv of other.usedVariables) {
						const clean = uv.startsWith("\\") ? uv.slice(1) : uv;
						if (clean.startsWith(`${currentNsKey}\\`)) {
							const varName = clean.slice(currentNsKey.length + 1);
							externallyUsedVars.add(varName);
						}
					}
					for (const us of other.usedSections) {
						const clean = us.startsWith("\\") ? us.slice(1) : us;
						const parts = clean.split("\\");
						if (parts.length >= 3 && parts[1] === currentNsKey) {
							const type = parts[0];
							const action = parts.slice(2).join("\\");
							externallyUsedResources.add(`${type}${action}`.toLowerCase());
							externallyUsedResources.add(clean);
						}
					}
				}
			}
			if (context.linter?.registerAllowedVariable) state.unregisterAllowedVars = context.linter.registerAllowedVariable((name) => {
				const norm = name.toLowerCase().replace(/^\/+/, "");
				const clean = norm.startsWith("\\") ? norm.slice(1) : norm;
				if (allKnownVariables.has(`\\${clean}`) || allKnownVariables.has(clean)) return true;
				if (sharedVars && sharedVars.has(clean)) return true;
				return false;
			});
			if (sharedSections && sharedSections.size > 0 && context.linter?.registerAllowedResource) state.unregisterAllowedGroupResources = context.linter.registerAllowedResource((name) => {
				return sharedSections.has(name.toLowerCase());
			});
			if (externallyUsedVars.size > 0 && context.linter?.registerAllowedUsedVariable) state.unregisterAllowedUsedVars = context.linter.registerAllowedUsedVariable((name) => {
				const clean = name.toLowerCase().replace(/^[\\$]+/, "");
				return externallyUsedVars.has(clean);
			});
			if (externallyUsedResources.size > 0 && context.linter?.registerAllowedUsedResource) state.unregisterAllowedUsedResources = context.linter.registerAllowedUsedResource((name) => {
				const clean = name.toLowerCase().replace(/^[\\\/]+/, "");
				if (externallyUsedResources.has(clean)) return true;
				const parts = clean.split("\\").filter(Boolean);
				if (parts.length > 1 && externallyUsedResources.has(parts[parts.length - 1])) return true;
				return false;
			});
			const count = ctx.model.getLineCount();
			let activeSection = "";
			for (let line = 1; line <= count; line++) {
				const raw = ctx.model.getLineContent(line);
				const { code } = stripComments(raw);
				if (!code.trim()) continue;
				const secMatch = /^\s*\[([^\]]+)\]/.exec(code);
				if (secMatch) {
					activeSection = secMatch[1].trim();
					continue;
				}
				const varRefRe = /\$([a-zA-Z0-9_\\]+)/g;
				let vm;
				while ((vm = varRefRe.exec(code)) !== null) {
					const fullVar = vm[1];
					const startCol = vm.index + 1;
					const endCol = startCol + vm[0].length;
					const isConstantsSec = activeSection.toLowerCase() === "constants";
					const beforeMatch = code.slice(0, vm.index);
					const isDecl = isConstantsSec && /^\s*(?:persist\s+|global\s+|local\s+)*$/i.test(beforeMatch);
					const isExplicitDecl = /\b(?:global|persist|local)\s*$/i.test(beforeMatch);
					if (isDecl || isExplicitDecl) continue;
					if (fullVar.includes("\\")) {
						const parts = fullVar.split("\\").filter(Boolean);
						if (parts.length >= 2) {
							const nsName = parts.slice(0, -1).join("\\");
							const varName = parts[parts.length - 1];
							const nsData = namespaceMap.get(nsName.toLowerCase());
							if (nsName.toLowerCase() === "shaderfixes\\help.ini" || nsName.toLowerCase() === "srmi" || isHelpIniVariable(fullVar) || isSrmiVariable(fullVar) || (ctx.isAllowedVariable ? ctx.isAllowedVariable(fullVar) : false)) continue;
							if (!nsData) diagnostics.push({
								severity: "warning",
								message: `모드 폴더 내에서 네임스페이스 '${nsName}'을(를) 찾을 수 없습니다. (해당 ini 파일에 'namespace = ${nsName}' 선언이 있는지 확인하세요)`,
								startLineNumber: line,
								startColumn: startCol,
								endLineNumber: line,
								endColumn: endCol
							});
							else if (!nsData.variables.has(varName.toLowerCase())) diagnostics.push({
								severity: "warning",
								message: `네임스페이스 '${nsName}'에 선언되지 않은 변수 '$${varName}'입니다. (${nsName}의 [Constants] 섹션을 확인하세요)`,
								startLineNumber: line,
								startColumn: startCol,
								endLineNumber: line,
								endColumn: endCol
							});
						}
					}
				}
				const runMatch = /^\s*(?:(?:pre\s+|post\s+)?run)\s*=\s*(?:ref\s+)?([a-zA-Z0-9_\\]+)/i.exec(code);
				if (runMatch) {
					const target = runMatch[1].trim();
					if (target.includes("\\")) {
						const parts = target.split("\\").filter(Boolean);
						const prefix = parts[0];
						if (!(isBuiltinResource(target) || isHelpIniResource(target) || isSrmiResource(target) || prefix.toLowerCase().startsWith("builtin") || prefix.toLowerCase() === "srmi" || (ctx.isAllowedResource ? ctx.isAllowedResource(target) : false)) && parts.length >= 3) {
							const nsName = parts.slice(1, -1).join("\\");
							const actionName = parts[parts.length - 1];
							const nsData = namespaceMap.get(nsName.toLowerCase());
							const rawIdx = raw.indexOf(runMatch[1]);
							const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
							const endCol = startCol + runMatch[1].length;
							if (!nsData) diagnostics.push({
								severity: "warning",
								message: `모드 폴더 내에서 네임스페이스 '${nsName}'을(를) 찾을 수 없습니다.`,
								startLineNumber: line,
								startColumn: startCol,
								endLineNumber: line,
								endColumn: endCol
							});
							else if (![
								`${prefix}${actionName}`.toLowerCase(),
								target.toLowerCase(),
								actionName.toLowerCase(),
								`${prefix}\\${nsName.toLowerCase()}\\${actionName.toLowerCase()}`
							].some((p) => nsData.sections.has(p))) diagnostics.push({
								severity: "warning",
								message: `네임스페이스 '${nsName}'에 정의된 ${prefix} '${actionName}'을(를) 찾을 수 없습니다.`,
								startLineNumber: line,
								startColumn: startCol,
								endLineNumber: line,
								endColumn: endCol
							});
						}
					}
				}
			}
			return diagnostics;
		}
	});
	const definitionProvider = createDefinitionProvider(context, isActive);
	if (context.editor?.registerDefinitionProvider) state.unregisterDefProvider = context.editor.registerDefinitionProvider(definitionProvider);
	else if (context.linter?.registerDefinitionProvider) state.unregisterDefProvider = context.linter.registerDefinitionProvider(definitionProvider);
	const referenceProvider = createReferenceProvider(context, isActive);
	if (context.editor?.registerReferenceProvider) state.unregisterRefProvider = context.editor.registerReferenceProvider(referenceProvider);
	else if (context.linter?.registerReferenceProvider) state.unregisterRefProvider = context.linter.registerReferenceProvider(referenceProvider);
}
//#endregion
export { cleanupNamespaceState, createNamespaceRegistrationState, registerNamespaceCheck };

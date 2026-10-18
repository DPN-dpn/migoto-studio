//#region src/core/ini/lint.ts
/**
* Strips comments from a line while respecting single and double quotes.
* Returns the code part and the 0-based index where the comment started (or line.length if none).
*/
function stripComments(line) {
	let inQuote = null;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuote) {
			if (ch === inQuote) inQuote = null;
		} else if (ch === "\"" || ch === "'") inQuote = ch;
		else if (ch === ";" || ch === "/" && line[i + 1] === "/") return {
			code: line.slice(0, i),
			commentIndex: i
		};
	}
	return {
		code: line,
		commentIndex: line.length
	};
}
//#endregion
//#region default-plugins/custom-lint/parser.ts
function isBuiltinResource(name) {
	if (!name) return false;
	const norm = name.toLowerCase().replace(/^[\\\/]+/, "");
	return norm.startsWith("builtincommandlist") || norm.startsWith("builtin_commandlist") || norm.startsWith("builtin\\") || norm.startsWith("commandlist\\builtin") || norm.startsWith("commandlist\\skintexture") || norm === "commandlistskintexture" || norm === "builtin";
}
function parseIniExports(text, filePath) {
	const lines = text.split(/\r?\n/);
	let currentNamespace = "";
	let currentSection = "";
	const variables = /* @__PURE__ */ new Set();
	const sections = /* @__PURE__ */ new Set();
	const usedVariables = /* @__PURE__ */ new Set();
	const usedSections = /* @__PURE__ */ new Set();
	const declarations = [];
	const usages = [];
	for (let i = 0; i < lines.length; i++) {
		const { code } = stripComments(lines[i]);
		const trimmed = code.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("[")) break;
		const nsMatch = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(code);
		if (nsMatch) {
			let ns = nsMatch[1].trim();
			if (ns.startsWith("\"") && ns.endsWith("\"") || ns.startsWith("'") && ns.endsWith("'")) ns = ns.slice(1, -1).trim();
			currentNamespace = ns;
			break;
		}
	}
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		const { code } = stripComments(raw);
		if (!code.trim()) continue;
		const nsMatch = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(code);
		if (nsMatch) {
			let ns = nsMatch[1].trim();
			if (ns.startsWith("\"") && ns.endsWith("\"") || ns.startsWith("'") && ns.endsWith("'")) ns = ns.slice(1, -1).trim();
			currentNamespace = ns;
		}
		const secMatch = /^\s*\[([^\]]+)\]/.exec(code);
		if (secMatch) {
			currentSection = secMatch[1].trim();
			const secLower = currentSection.toLowerCase();
			sections.add(secLower);
			const bracketIdx = raw.indexOf("[");
			const startCol = bracketIdx !== -1 ? bracketIdx + 2 : 1;
			const endCol = startCol + currentSection.length;
			declarations.push({
				name: secLower,
				rawName: currentSection,
				kind: "section",
				line: i + 1,
				startCol,
				endCol,
				lineContent: raw,
				section: `[${currentSection}]`,
				filePath,
				namespace: currentNamespace
			});
			if (currentNamespace) {
				const nsLower = currentNamespace.toLowerCase();
				if (secLower.startsWith("commandlist") && secLower.length > 11) {
					const alias = `commandlist\\${nsLower}\\${secLower.slice(11)}`;
					sections.add(alias);
					declarations.push({
						name: alias,
						rawName: `CommandList\\${currentNamespace}\\${currentSection.slice(11)}`,
						kind: "section",
						line: i + 1,
						startCol,
						endCol,
						lineContent: raw,
						section: `[${currentSection}]`,
						filePath,
						namespace: currentNamespace
					});
				} else if (secLower.startsWith("resource") && secLower.length > 8) {
					const alias = `resource\\${nsLower}\\${secLower.slice(8)}`;
					sections.add(alias);
					declarations.push({
						name: alias,
						rawName: `Resource\\${currentNamespace}\\${currentSection.slice(8)}`,
						kind: "section",
						line: i + 1,
						startCol,
						endCol,
						lineContent: raw,
						section: `[${currentSection}]`,
						filePath,
						namespace: currentNamespace
					});
				} else if (secLower.startsWith("customshader") && secLower.length > 12) {
					const alias = `customshader\\${nsLower}\\${secLower.slice(12)}`;
					sections.add(alias);
					declarations.push({
						name: alias,
						rawName: `CustomShader\\${currentNamespace}\\${currentSection.slice(12)}`,
						kind: "section",
						line: i + 1,
						startCol,
						endCol,
						lineContent: raw,
						section: `[${currentSection}]`,
						filePath,
						namespace: currentNamespace
					});
				}
			}
			continue;
		}
		const varDeclRe = /\b(?:global|persist|local)\s+\$([a-zA-Z0-9_\\]+)/gi;
		let vm;
		let foundExplicit = false;
		while ((vm = varDeclRe.exec(code)) !== null) {
			foundExplicit = true;
			const vName = vm[1].toLowerCase();
			const parts = vName.split("\\").filter(Boolean);
			const simpleName = parts[parts.length - 1];
			if (simpleName) variables.add(simpleName);
			variables.add(vName);
			const rawIdx = raw.indexOf(vm[0]);
			const dollarRel = vm[0].indexOf("$");
			const startCol = rawIdx !== -1 && dollarRel !== -1 ? rawIdx + dollarRel + 1 : rawIdx !== -1 ? rawIdx + 1 : 1;
			const endCol = startCol + vm[1].length + 1;
			declarations.push({
				name: simpleName ? simpleName.toLowerCase() : vName,
				rawName: `$${vm[1]}`,
				kind: "variable",
				line: i + 1,
				startCol,
				endCol,
				lineContent: raw,
				section: currentSection ? `[${currentSection}]` : "",
				filePath,
				namespace: currentNamespace
			});
			if (vName.includes("\\")) declarations.push({
				name: vName,
				rawName: `$${vm[1]}`,
				kind: "variable",
				line: i + 1,
				startCol,
				endCol,
				lineContent: raw,
				section: currentSection ? `[${currentSection}]` : "",
				filePath,
				namespace: currentNamespace
			});
		}
		const isConstants = currentSection.toLowerCase() === "constants";
		if (isConstants && !foundExplicit) {
			const constLineMatch = /^\s*(?:persist\s+|global\s+|local\s+)*\$([a-zA-Z0-9_\\]+)/i.exec(code);
			if (constLineMatch) {
				const vName = constLineMatch[1].toLowerCase();
				const parts = vName.split("\\").filter(Boolean);
				const simpleName = parts[parts.length - 1];
				if (simpleName) variables.add(simpleName);
				variables.add(vName);
				const rawIdx = raw.indexOf(`$${constLineMatch[1]}`);
				const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
				const endCol = startCol + constLineMatch[1].length + 1;
				declarations.push({
					name: simpleName ? simpleName.toLowerCase() : vName,
					rawName: `$${constLineMatch[1]}`,
					kind: "variable",
					line: i + 1,
					startCol,
					endCol,
					lineContent: raw,
					section: `[${currentSection}]`,
					filePath,
					namespace: currentNamespace
				});
				if (vName.includes("\\")) declarations.push({
					name: vName,
					rawName: `$${constLineMatch[1]}`,
					kind: "variable",
					line: i + 1,
					startCol,
					endCol,
					lineContent: raw,
					section: `[${currentSection}]`,
					filePath,
					namespace: currentNamespace
				});
			}
		}
		const eqIdx = code.indexOf("=");
		const varRefRe = /\$([a-zA-Z0-9_\\]+)/g;
		let vum;
		while ((vum = varRefRe.exec(code)) !== null) {
			if (eqIdx !== -1 && vum.index < eqIdx) {
				if (foundExplicit || isConstants) continue;
			} else if (eqIdx === -1 && (foundExplicit || isConstants)) continue;
			const vName = vum[1].toLowerCase();
			usedVariables.add(vName);
			const clean = vName.startsWith("\\") ? vName.slice(1) : vName;
			usedVariables.add(clean);
			const parts = clean.split("\\").filter(Boolean);
			let targetNs = currentNamespace;
			let leafName = clean;
			if (parts.length > 1) {
				targetNs = parts[0];
				leafName = parts.slice(1).join("\\");
				usedVariables.add(parts[parts.length - 1]);
			}
			const startCol = vum.index + 1;
			const endCol = startCol + vum[0].length;
			usages.push({
				name: leafName.toLowerCase(),
				rawName: vum[0],
				kind: "variable",
				line: i + 1,
				startCol,
				endCol,
				lineContent: raw,
				section: currentSection ? `[${currentSection}]` : "",
				filePath,
				namespace: targetNs
			});
			if (parts.length > 1) usages.push({
				name: clean.toLowerCase(),
				rawName: vum[0],
				kind: "variable",
				line: i + 1,
				startCol,
				endCol,
				lineContent: raw,
				section: currentSection ? `[${currentSection}]` : "",
				filePath,
				namespace: targetNs
			});
		}
		const resRefMatch = /^\s*(?:(?:pre\s+|post\s+)?run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+|Resource(?:\\[a-zA-Z0-9_]+)*|(?:cs|vs|ps|hs|ds|gs))\s*=\s*(?:ref\s+|copy\s+)?([a-zA-Z0-9_\\]+)/i.exec(code);
		if (resRefMatch) {
			const target = resRefMatch[1].trim();
			const targetLower = target.toLowerCase();
			if (![
				"null",
				"skip",
				"auto",
				"default"
			].includes(targetLower)) {
				usedSections.add(targetLower);
				const clean = targetLower.startsWith("\\") ? targetLower.slice(1) : targetLower;
				usedSections.add(clean);
				const parts = clean.split("\\").filter(Boolean);
				let targetNs = currentNamespace;
				let actionName = clean;
				if (parts.length >= 3) {
					targetNs = parts[1];
					actionName = `${parts[0]}${parts[parts.length - 1]}`.toLowerCase();
					usedSections.add(parts[parts.length - 1]);
				} else if (parts.length > 1) usedSections.add(parts[parts.length - 1]);
				const matchIdx = raw.indexOf(resRefMatch[1]);
				const startCol = matchIdx !== -1 ? matchIdx + 1 : 1;
				const endCol = startCol + resRefMatch[1].length;
				usages.push({
					name: actionName.toLowerCase(),
					rawName: target,
					kind: "section",
					line: i + 1,
					startCol,
					endCol,
					lineContent: raw,
					section: currentSection ? `[${currentSection}]` : "",
					filePath,
					namespace: targetNs
				});
				if (clean !== actionName) usages.push({
					name: clean.toLowerCase(),
					rawName: target,
					kind: "section",
					line: i + 1,
					startCol,
					endCol,
					lineContent: raw,
					section: currentSection ? `[${currentSection}]` : "",
					filePath,
					namespace: targetNs
				});
			}
		}
		const refCopyRe = /\b(?:ref|copy)\s+([a-zA-Z0-9_\\]+)/gi;
		let rcm;
		while ((rcm = refCopyRe.exec(code)) !== null) {
			const target = rcm[1].trim();
			const targetLower = target.toLowerCase();
			if (![
				"null",
				"skip",
				"auto",
				"default"
			].includes(targetLower)) {
				usedSections.add(targetLower);
				const clean = targetLower.startsWith("\\") ? targetLower.slice(1) : targetLower;
				usedSections.add(clean);
				const parts = clean.split("\\").filter(Boolean);
				let targetNs = currentNamespace;
				let actionName = clean;
				if (parts.length >= 3) {
					targetNs = parts[1];
					actionName = `${parts[0]}${parts[parts.length - 1]}`.toLowerCase();
					usedSections.add(parts[parts.length - 1]);
				} else if (parts.length > 1) usedSections.add(parts[parts.length - 1]);
				const startCol = rcm.index + 1;
				const endCol = startCol + rcm[0].length;
				usages.push({
					name: actionName.toLowerCase(),
					rawName: target,
					kind: "section",
					line: i + 1,
					startCol,
					endCol,
					lineContent: raw,
					section: currentSection ? `[${currentSection}]` : "",
					filePath,
					namespace: targetNs
				});
				if (clean !== actionName) usages.push({
					name: clean.toLowerCase(),
					rawName: target,
					kind: "section",
					line: i + 1,
					startCol,
					endCol,
					lineContent: raw,
					section: currentSection ? `[${currentSection}]` : "",
					filePath,
					namespace: targetNs
				});
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
		usages
	};
}
//#endregion
//#region default-plugins/custom-lint/indexer.ts
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
//#region default-plugins/custom-lint/rules.ts
function registerLintRules(context, isActive, state) {
	context.linter.registerRule({
		id: "missing-resource-files",
		name: "모드 리소스 파일 실재성 검사",
		check: async (ctx) => {
			if (!ctx.folder) return [];
			const diagnostics = [];
			const count = ctx.model.getLineCount();
			for (let line = 1; line <= count; line++) {
				const raw = ctx.model.getLineContent(line);
				const { code } = stripComments(raw);
				if (!code.trim()) continue;
				const match = /^\s*filename\s*=\s*(.+)$/i.exec(code);
				if (!match) continue;
				let target = match[1].trim();
				if (target.startsWith("\"") && target.endsWith("\"") || target.startsWith("'") && target.endsWith("'")) target = target.slice(1, -1).trim();
				if (!target) continue;
				if (!await ctx.fileExists(target)) {
					const rawIdx = raw.indexOf(match[1]);
					const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
					const endCol = startCol + match[1].length;
					diagnostics.push({
						severity: "warning",
						message: `참조된 파일 "${target}"을(를) 모드 폴더에서 찾을 수 없습니다. (파일명 및 확장자 확인 필요)`,
						startLineNumber: line,
						startColumn: startCol,
						endLineNumber: line,
						endColumn: endCol
					});
				}
			}
			return diagnostics;
		}
	});
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
							const normalizedVar = parts.join("\\");
							if (ctx.isAllowedVariable ? ctx.isAllowedVariable(fullVar) || ctx.isAllowedVariable(`\\${normalizedVar}`) || ctx.isAllowedVariable(normalizedVar) || ctx.isAllowedVariable(vm[0]) || ctx.isAllowedVariable(`${nsName}\\`) || ctx.isAllowedVariable(nsName) : false) continue;
							const nsData = namespaceMap.get(nsName.toLowerCase());
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
						if (!(isBuiltinResource(target) || prefix.toLowerCase().startsWith("builtin") || (ctx.isAllowedResource ? ctx.isAllowedResource(target) : false)) && parts.length >= 3) {
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
}
//#endregion
//#region default-plugins/custom-lint/index.ts
var isPluginActive = false;
var unregisterBuiltinResources = [];
var dynamicState = {
	unregisterAllowedVars: null,
	unregisterAllowedGroupResources: null,
	unregisterAllowedUsedVars: null,
	unregisterAllowedUsedResources: null
};
var unregisterDefProvider = null;
var unregisterRefProvider = null;
var plugin = {
	activate(context) {
		isPluginActive = true;
		if (context.linter?.registerAllowedResource) {
			const u1 = context.linter.registerAllowedResource((name) => isBuiltinResource(name));
			const u2 = context.linter.registerAllowedResource(/^builtincommandlist/i);
			const u3 = context.linter.registerAllowedResource("CommandListSkinTexture");
			const u4 = context.linter.registerAllowedResource(/^(?:builtin\\)?commandlistskintexture$/i);
			const u5 = context.linter.registerAllowedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
			const u6 = context.linter.registerAllowedResource(/^builtin\\skintexture$/i);
			const u7 = context.linter.registerAllowedResource(/^(?:commandlist\\)?builtin\\/i);
			const u8 = context.linter.registerAllowedResource(/^builtin\\/i);
			unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
		}
		if (context.linter?.registerAllowedUsedResource) {
			const u1 = context.linter.registerAllowedUsedResource((name) => isBuiltinResource(name));
			const u2 = context.linter.registerAllowedUsedResource(/^builtincommandlist/i);
			const u3 = context.linter.registerAllowedUsedResource("CommandListSkinTexture");
			const u4 = context.linter.registerAllowedUsedResource(/^(?:builtin\\)?commandlistskintexture$/i);
			const u5 = context.linter.registerAllowedUsedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
			const u6 = context.linter.registerAllowedUsedResource(/^builtin\\skintexture$/i);
			const u7 = context.linter.registerAllowedUsedResource(/^(?:commandlist\\)?builtin\\/i);
			const u8 = context.linter.registerAllowedUsedResource(/^builtin\\/i);
			unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
		}
		registerLintRules(context, () => isPluginActive, dynamicState);
		const definitionProvider = createDefinitionProvider(context, () => isPluginActive);
		if (context.editor?.registerDefinitionProvider) unregisterDefProvider = context.editor.registerDefinitionProvider(definitionProvider);
		else if (context.linter?.registerDefinitionProvider) unregisterDefProvider = context.linter.registerDefinitionProvider(definitionProvider);
		const referenceProvider = createReferenceProvider(context, () => isPluginActive);
		if (context.editor?.registerReferenceProvider) unregisterRefProvider = context.editor.registerReferenceProvider(referenceProvider);
		else if (context.linter?.registerReferenceProvider) unregisterRefProvider = context.linter.registerReferenceProvider(referenceProvider);
	},
	deactivate() {
		isPluginActive = false;
		if (unregisterBuiltinResources.length > 0) {
			for (const cleanup of unregisterBuiltinResources) try {
				cleanup();
			} catch {}
			unregisterBuiltinResources = [];
		}
		if (dynamicState.unregisterAllowedVars) {
			dynamicState.unregisterAllowedVars();
			dynamicState.unregisterAllowedVars = null;
		}
		if (dynamicState.unregisterAllowedGroupResources) {
			dynamicState.unregisterAllowedGroupResources();
			dynamicState.unregisterAllowedGroupResources = null;
		}
		if (dynamicState.unregisterAllowedUsedVars) {
			dynamicState.unregisterAllowedUsedVars();
			dynamicState.unregisterAllowedUsedVars = null;
		}
		if (dynamicState.unregisterAllowedUsedResources) {
			dynamicState.unregisterAllowedUsedResources();
			dynamicState.unregisterAllowedUsedResources = null;
		}
		if (unregisterDefProvider) {
			unregisterDefProvider();
			unregisterDefProvider = null;
		}
		if (unregisterRefProvider) {
			unregisterRefProvider();
			unregisterRefProvider = null;
		}
	}
};
//#endregion
export { buildWorkspaceIndex, collectIniFiles, plugin as default, isBuiltinResource, parseIniExports, readIniText };

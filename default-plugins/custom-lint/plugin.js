//#region default-plugins/custom-lint/builtin-syntax/matcher.ts
/**
* matcher.ts
* GIMI / ZZMI / XXMI 내장 리소스 및 내장 커맨드리스트 여부를 판별합니다.
*/
function isBuiltinResource(name) {
	if (!name) return false;
	const norm = name.toLowerCase().replace(/^[\\\/]+/, "");
	return norm.startsWith("builtincommandlist") || norm.startsWith("builtin_commandlist") || norm.startsWith("builtin\\") || norm.startsWith("commandlist\\builtin") || norm.startsWith("commandlist\\skintexture") || norm === "commandlistskintexture" || norm === "builtin";
}
//#endregion
//#region default-plugins/custom-lint/builtin-syntax/help-ini.ts
/**
* help-ini.ts
* XXMI 레거시 빌트인 구문(ShaderFixes\help.ini 네임스페이스)을 전담 지원합니다.
*
* 예시:
* - pre run = CustomShader\ShaderFixes\help.ini\FormatText
* - pre Resource\ShaderFixes\help.ini\Notification = ResourceCreditInfo
* - pre $\ShaderFixes\help.ini\notification_timeout = time + 5.0
*/
var HELP_INI_RESOURCE_REGEX = /^(?:customshader|resource|commandlist)\\shaderfixes\\help\.ini\\/i;
var HELP_INI_VARIABLE_REGEX = /^\\?shaderfixes\\help\.ini\\/i;
function isHelpIniResource(name) {
	if (!name) return false;
	const clean = name.toLowerCase().replace(/^[\\\/]+/, "");
	return HELP_INI_RESOURCE_REGEX.test(clean) || clean.startsWith("shaderfixes\\help.ini\\");
}
function isHelpIniVariable(name) {
	if (!name) return false;
	const clean = name.toLowerCase().replace(/^[\\\$]+/, "");
	return HELP_INI_VARIABLE_REGEX.test(clean);
}
/**
* ShaderFixes\help.ini 빌트인 리소스, 커맨드, 셰이더 및 변수를 에디터 린터에 허용 등록합니다.
*/
function registerHelpIniSyntax(context) {
	const unregisterCallbacks = [];
	if (context.linter?.registerAllowedResource) {
		unregisterCallbacks.push(context.linter.registerAllowedResource(HELP_INI_RESOURCE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedResource((name) => isHelpIniResource(name)));
	}
	if (context.linter?.registerAllowedVariable) {
		unregisterCallbacks.push(context.linter.registerAllowedVariable(HELP_INI_VARIABLE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedVariable((name) => isHelpIniVariable(name)));
	}
	if (context.linter?.registerAllowedUsedResource) {
		unregisterCallbacks.push(context.linter.registerAllowedUsedResource(HELP_INI_RESOURCE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedUsedResource((name) => isHelpIniResource(name)));
	}
	if (context.linter?.registerAllowedUsedVariable) {
		unregisterCallbacks.push(context.linter.registerAllowedUsedVariable(HELP_INI_VARIABLE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedUsedVariable((name) => isHelpIniVariable(name)));
	}
	return unregisterCallbacks;
}
//#endregion
//#region default-plugins/custom-lint/builtin-syntax/index.ts
/**
* XXMI 표준 내장 커맨드리스트, 함수 및 레거시 빌트인 구문(ShaderFixes\help.ini 등)을 에디터 린터에 허용 등록합니다.
*/
function registerBuiltinSyntax(context) {
	const unregisterCallbacks = [];
	const patterns = [
		(name) => isBuiltinResource(name),
		/^builtincommandlist/i,
		"CommandListSkinTexture",
		/^(?:builtin\\)?commandlistskintexture$/i,
		/^commandlist\\(?:builtin\\)?skintexture$/i,
		/^builtin\\skintexture$/i,
		/^(?:commandlist\\)?builtin\\/i,
		/^builtin\\/i
	];
	if (context.linter?.registerAllowedResource) for (const pat of patterns) unregisterCallbacks.push(context.linter.registerAllowedResource(pat));
	if (context.linter?.registerAllowedUsedResource) for (const pat of patterns) unregisterCallbacks.push(context.linter.registerAllowedUsedResource(pat));
	unregisterCallbacks.push(...registerHelpIniSyntax(context));
	return unregisterCallbacks;
}
//#endregion
//#region default-plugins/custom-lint/file-check/index.ts
/**
* 주석을 제거하고 유효 코드 문자열을 반환합니다.
*/
function stripComments$1(line) {
	let inQuote = null;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuote) {
			if (ch === inQuote) inQuote = null;
		} else if (ch === "\"" || ch === "'") inQuote = ch;
		else if (ch === ";" || ch === "/" && line[i + 1] === "/") return line.slice(0, i);
	}
	return line;
}
/**
* 모드 리소스 파일 실재성 검사 규칙을 등록합니다.
* filename = ... 구문에서 지정된 파일이 모드 폴더 내에 실제로 존재하는지 검사합니다.
*/
function registerFileCheckRule(context) {
	return context.linter.registerRule({
		id: "missing-resource-files",
		name: "모드 리소스 파일 실재성 검사",
		check: async (ctx) => {
			if (!ctx.folder) return [];
			const diagnostics = [];
			const count = ctx.model.getLineCount();
			for (let line = 1; line <= count; line++) {
				const raw = ctx.model.getLineContent(line);
				const code = stripComments$1(raw);
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
}
//#endregion
//#region default-plugins/custom-lint/namespace-check/parser.ts
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
//#region default-plugins/custom-lint/namespace-check/providers.ts
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
							if (nsName.toLowerCase() === "shaderfixes\\help.ini" || isHelpIniVariable(fullVar) || (ctx.isAllowedVariable ? ctx.isAllowedVariable(fullVar) : false)) continue;
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
						if (!(isBuiltinResource(target) || isHelpIniResource(target) || prefix.toLowerCase().startsWith("builtin") || (ctx.isAllowedResource ? ctx.isAllowedResource(target) : false)) && parts.length >= 3) {
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
//#region default-plugins/custom-lint/zzmi/rules.ts
function registerZzmiRules(context) {
	const cleanups = [];
	if (context.linter?.registerAllowedResource) {
		cleanups.push(context.linter.registerAllowedResource(/^commandlist\\zzmi\\/i));
		cleanups.push(context.linter.registerAllowedResource(/^resource\\zzmi\\/i));
		cleanups.push(context.linter.registerAllowedResource("CommandList\\ZZMI\\SetTextures"));
		cleanups.push(context.linter.registerAllowedResource("CommandListSkinTexture"));
		cleanups.push(context.linter.registerAllowedResource(/^commandlist\\ttl\\/i));
		cleanups.push(context.linter.registerAllowedResource(/^resource\\ttl\\/i));
		cleanups.push(context.linter.registerAllowedResource("CommandList\\TTL\\Draw"));
		cleanups.push(context.linter.registerAllowedResource("Resource\\TTL\\TransparencyTex"));
	}
	if (context.linter?.registerAllowedVariable) {
		cleanups.push(context.linter.registerAllowedVariable((name) => {
			return name.toLowerCase().replace(/^[\\$]+/, "").startsWith("ttl\\");
		}));
		cleanups.push(context.linter.registerAllowedVariable(/^\\?ttl\\/i));
	}
	if (context.linter?.registerAllowedUsedVariable) cleanups.push(context.linter.registerAllowedUsedVariable((name) => {
		return name.toLowerCase().replace(/^[\\$]+/, "").startsWith("ttl\\");
	}));
	if (context.linter?.registerAllowedUsedResource) {
		cleanups.push(context.linter.registerAllowedUsedResource(/^resource\\ttl\\/i));
		cleanups.push(context.linter.registerAllowedUsedResource(/^commandlist\\ttl\\/i));
	}
	if (context.linter?.registerDiagnosticFilter) cleanups.push(context.linter.registerDiagnosticFilter((diag, ctx) => {
		const msg = diag.message || "";
		if (msg.includes("'TTL'") || msg.includes("'ttl'")) return false;
		if (/\bttl[\\_]/i.test(msg) || /\$?\\?ttl\\/i.test(msg)) return false;
		if (ctx?.model && diag.startLineNumber) {
			const lineContent = ctx.model.getLineContent(diag.startLineNumber) || "";
			if (/\\?TTL\\/i.test(lineContent) && /ttl/i.test(msg)) return false;
		}
		return true;
	}));
	if (context.slots?.registerTextureSlotResolver) cleanups.push(context.slots.registerTextureSlotResolver(createZzmiSlotResolver()));
	return cleanups;
}
/**
* ZZMI 슬롯픽스(SlotFix) 및 TTL 구문을 해석하는 텍스처 슬롯 리졸버 생성
*/
function createZzmiSlotResolver() {
	return {
		id: "zzmi-slotfix",
		name: "ZZMI 슬롯픽스 리졸버 (SlotFix & TTL)",
		priority: 10,
		resolveSlots: (section, doc, allDocs) => {
			const slots = [];
			const props = section.properties;
			const resolveFilename = (resName) => {
				const clean = resName.replace(/^[\\$]+/, "").replace(/^ref\s+/i, "").trim();
				const candidates = [
					clean,
					`Resource${clean}`,
					`Resource\\${clean}`
				];
				for (const name of candidates) {
					const sec = doc.getSection(name);
					if (sec && sec.properties["filename"]) {
						const fn = sec.properties["filename"].replace(/['"]/g, "").trim();
						if (/\.(dds|png|tga|jpg|jpeg|webp|bmp)$/i.test(fn)) return fn;
					}
				}
				if (allDocs) for (const otherDoc of allDocs.values()) for (const name of candidates) {
					const sec = otherDoc.getSection(name);
					if (sec && sec.properties["filename"]) {
						const fn = sec.properties["filename"].replace(/['"]/g, "").trim();
						if (/\.(dds|png|tga|jpg|jpeg|webp|bmp)$/i.test(fn)) return fn;
					}
				}
			};
			const checkProperties = (pRecord, srcSec) => {
				for (const [key, rawVal] of Object.entries(pRecord)) {
					const cleanKey = key.trim();
					const cleanVal = rawVal.replace(/^ref\s+/i, "").trim();
					const zzmiMatch = cleanKey.match(/^Resource\\ZZMI\\(.+)$/i);
					if (zzmiMatch) {
						const slotName = zzmiMatch[1].trim();
						const lowerSlot = slotName.toLowerCase();
						let slotType = "custom";
						let displaySlotName = slotName;
						if (lowerSlot.includes("diffuse")) {
							slotType = "diffuse";
							displaySlotName = "Diffuse";
						} else if (lowerSlot.includes("normal")) {
							slotType = "normal";
							displaySlotName = "NormalMap";
						} else if (lowerSlot.includes("light")) {
							slotType = "light";
							displaySlotName = "LightMap";
						} else if (lowerSlot.includes("material")) {
							slotType = "material";
							displaySlotName = "MaterialMap";
						} else if (lowerSlot.includes("fx") || lowerSlot.includes("wengine")) {
							slotType = "fx";
							displaySlotName = "WEngineFX";
						}
						slots.push({
							slotId: `ZZMI\\${displaySlotName}`,
							slotType,
							resourceRef: cleanVal,
							textureFile: resolveFilename(cleanVal),
							sourceSection: srcSec,
							rawLine: `${key} = ${rawVal}`
						});
						continue;
					}
					const ttlMatch = cleanKey.match(/^Resource\\TTL\\(.+)$/i);
					if (ttlMatch) {
						const slotName = ttlMatch[1].trim();
						const lowerTtl = slotName.toLowerCase();
						let displayTtl = slotName;
						if (lowerTtl.includes("transparency")) displayTtl = "TransparencyTex";
						slots.push({
							slotId: `TTL\\${displayTtl}`,
							slotType: "custom",
							resourceRef: cleanVal,
							textureFile: resolveFilename(cleanVal),
							sourceSection: srcSec,
							rawLine: `${key} = ${rawVal}`
						});
						continue;
					}
				}
			};
			checkProperties(props, section.name);
			if (props["run"]) {
				const cmdName = props["run"].trim();
				const cmdSec = doc.getSection(cmdName) || (allDocs ? (() => {
					for (const otherDoc of allDocs.values()) {
						const s = otherDoc.getSection(cmdName);
						if (s) return s;
					}
				})() : void 0);
				if (cmdSec) checkProperties(cmdSec.properties, cmdSec.name);
			}
			return slots.length > 0 ? slots : null;
		}
	};
}
//#endregion
//#region default-plugins/custom-lint/zzmi/templates.ts
var ZZMI_TEMPLATES = [
	{
		id: "zzmi_slot_fix",
		group: "ZZMI (젠레스 존 제로)",
		label: "ZZMI 텍스처 슬롯픽스 (SlotFix)",
		description: "ZZMI 텍스처 슬롯 매핑 및 WEngineFX 이펙트 슬롯 구문",
		body: [
			"; ZZMI SlotFix (Texture Slot Mapping)",
			"Resource\\ZZMI\\Diffuse = ref Resource${1:Diffuse}",
			"Resource\\ZZMI\\NormalMap = ref Resource${2:NormalMap}",
			"Resource\\ZZMI\\LightMap = ref Resource${3:LightMap}",
			"Resource\\ZZMI\\MaterialMap = ref Resource${4:MaterialMap}",
			"Resource\\ZZMI\\WEngineFX = ref Resource${5:WEngineFX}",
			"run = CommandList\\ZZMI\\SetTextures"
		].join("\n") + "\n"
	},
	{
		id: "zzmi_ttl_draw",
		group: "ZZMI (젠레스 존 제로)",
		label: "ZZMI TTL 투명도 드로우 (단일 투명도)",
		description: "Transparency Texture Lib (TTL) 단일 알파 투명도 렌더링 구문 (No Texture)",
		body: [
			"; ZZMI TTL (Transparency Texture Lib - Uniform Alpha)",
			"$\\TTL\\alpha = ${1:0.5}",
			"$\\TTL\\_1 = ${2:IndexCount}",
			"$\\TTL\\_2 = ${3:FirstIndex}",
			"run = CommandList\\TTL\\Draw"
		].join("\n") + "\n"
	},
	{
		id: "zzmi_ttl_texture",
		group: "ZZMI (젠레스 존 제로)",
		label: "ZZMI TTL 텍스처 마스크 투명도 (Texture Mask)",
		description: "Transparency Texture Lib (TTL) 텍스처 마스크 및 채널 기반 투명도 렌더링 구문",
		body: [
			"; ZZMI TTL (Transparency Texture Lib - Texture Mask)",
			"Resource\\TTL\\TransparencyTex = ref Resource${1:Transparency}",
			"$\\TTL\\_1 = ${2:IndexCount}",
			"$\\TTL\\_2 = ${3:FirstIndex}",
			"$\\TTL\\mask_channel = ${4:3}",
			"$\\TTL\\mask_invert = ${5:0}",
			"run = CommandList\\TTL\\Draw"
		].join("\n") + "\n"
	}
];
//#endregion
//#region default-plugins/custom-lint/zzmi/index.ts
/**
* ZZMI (젠레스 존 제로) 및 TTL (Transparency Texture Lib) 지원 기능을 등록합니다.
* (슬롯픽스 리졸버, 리소스/변수 허용, 진단 필터, 템플릿 등)
*/
function registerZzmiSupport(context) {
	const cleanups = [];
	cleanups.push(...registerZzmiRules(context));
	context.logger?.info(`ZZMI 모딩 지원 활성화 (슬롯픽스 템플릿 ${ZZMI_TEMPLATES.length}개 등록)`);
	if (context.templates?.registerTemplate) for (const tpl of ZZMI_TEMPLATES) context.templates.registerTemplate(tpl);
	return cleanups;
}
//#endregion
//#region default-plugins/custom-lint/index.ts
var isPluginActive = false;
var unregisterBuiltinList = [];
var unregisterFileCheck = void 0;
var unregisterZzmiList = [];
var namespaceState = createNamespaceRegistrationState();
var plugin = {
	activate(context) {
		isPluginActive = true;
		context.logger?.info("커스텀 린터 (내장문법 / 파일실재성 / 네임스페이스 / ZZMI지원) 활성화됨");
		unregisterBuiltinList = registerBuiltinSyntax(context);
		unregisterFileCheck = registerFileCheckRule(context);
		registerNamespaceCheck(context, () => isPluginActive, namespaceState);
		unregisterZzmiList = registerZzmiSupport(context);
	},
	deactivate() {
		isPluginActive = false;
		if (unregisterBuiltinList.length > 0) {
			for (const cleanup of unregisterBuiltinList) try {
				cleanup();
			} catch {}
			unregisterBuiltinList = [];
		}
		if (typeof unregisterFileCheck === "function") {
			try {
				unregisterFileCheck();
			} catch {}
			unregisterFileCheck = void 0;
		}
		cleanupNamespaceState(namespaceState);
		if (unregisterZzmiList.length > 0) {
			for (const cleanup of unregisterZzmiList) try {
				cleanup();
			} catch {}
			unregisterZzmiList = [];
		}
	}
};
//#endregion
export { ZZMI_TEMPLATES, buildWorkspaceIndex, collectIniFiles, createZzmiSlotResolver, plugin as default, isBuiltinResource, isHelpIniResource, isHelpIniVariable, parseIniExports, readIniText, registerZzmiRules };

import "../builtin-syntax/matcher.js";
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
		const resRefMatch = /^\s*(?:(?:pre\s+|post\s+)?run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+|Resource(?:\\[a-zA-Z0-9_.\-]+)*|(?:cs|vs|ps|hs|ds|gs))\s*=\s*(?:ref\s+|copy\s+)?([a-zA-Z0-9_.\-\\\/]+)/i.exec(code);
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
		const refCopyRe = /\b(?:ref|copy)\s+([a-zA-Z0-9_.\-\\\/]+)/gi;
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
export { parseIniExports, stripComments };

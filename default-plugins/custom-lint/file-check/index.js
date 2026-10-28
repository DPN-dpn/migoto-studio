//#region default-plugins/custom-lint/file-check/index.ts
/**
* 주석을 제거하고 유효 코드 문자열을 반환합니다.
*/
function stripComments(line) {
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
				const code = stripComments(raw);
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
export { registerFileCheckRule, stripComments };

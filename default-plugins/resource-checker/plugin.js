//#region src/plugins/api.ts
function e(e) {
	return e;
}
//#endregion
//#region src/core/ini/lint.ts
function t(e) {
	let t = null;
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		if (t) r === t && (t = null);
		else if (r === "\"" || r === "'") t = r;
		else if (r === ";" || r === "/" && e[n + 1] === "/") return {
			code: e.slice(0, n),
			commentIndex: n
		};
	}
	return {
		code: e,
		commentIndex: e.length
	};
}
//#endregion
//#region default-plugins/resource-checker/index.ts
function n(e, n) {
	let r = e.split(/\r?\n/), i = "", a = "", o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
	for (let e = 0; e < r.length; e++) {
		let n = r[e], { code: c } = t(n);
		if (!c.trim()) continue;
		let l = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(c);
		if (l) {
			let e = l[1].trim();
			(e.startsWith("\"") && e.endsWith("\"") || e.startsWith("'") && e.endsWith("'")) && (e = e.slice(1, -1).trim()), i = e;
		}
		let u = /^\s*\[([^\]]+)\]/.exec(c);
		if (u) {
			a = u[1].trim();
			let e = a.toLowerCase();
			if (s.add(e), i) {
				let t = i.toLowerCase();
				if (e.startsWith("commandlist") && e.length > 11) {
					let n = e.slice(11);
					s.add(`commandlist\\${t}\\${n}`);
				} else if (e.startsWith("resource") && e.length > 8) {
					let n = e.slice(8);
					s.add(`resource\\${t}\\${n}`);
				} else if (e.startsWith("customshader") && e.length > 12) {
					let n = e.slice(12);
					s.add(`customshader\\${t}\\${n}`);
				}
			}
			continue;
		}
		let d = /\b(?:global|persist|local)\s+\$([a-zA-Z0-9_\\]+)/gi, f, p = !1;
		for (; (f = d.exec(c)) !== null;) {
			p = !0;
			let e = f[1].toLowerCase(), t = e.split("\\").filter(Boolean), n = t[t.length - 1];
			n && o.add(n), o.add(e);
		}
		if (a.toLowerCase() === "constants" && !p) {
			let e = /^\s*(?:persist\s+|global\s+|local\s+)*\$([a-zA-Z0-9_\\]+)/i.exec(c);
			if (e) {
				let t = e[1].toLowerCase(), n = t.split("\\").filter(Boolean), r = n[n.length - 1];
				r && o.add(r), o.add(t);
			}
		}
	}
	return {
		namespace: i,
		filePath: n,
		variables: o,
		sections: s
	};
}
var r = e({ activate(e) {
	let r = null, i = async (t) => {
		if (t.getAllFiles) {
			let e = t.getAllFiles();
			if (e && e.length > 0) return e.filter((e) => /\.(ini|3dm|migoto)$/i.test(e));
		}
		try {
			let t = await e.workspace.readDirectory(), n = [], r = (e, t = "") => {
				for (let i of e) {
					let e = t ? `${t}/${i.name}` : i.name;
					i.isDir && i.children ? r(i.children, e) : !i.isDir && /\.(ini|3dm|migoto)$/i.test(i.name) && n.push(e);
				}
			};
			return r(t), n;
		} catch {
			return [];
		}
	}, a = async (t, n) => {
		let r = t.file?.path || t.file?.name;
		if (r && (r === n || r.endsWith(`/${n}`) || r.endsWith(`\\${n}`))) return t.model.getValue();
		if (t.readTextFile) try {
			return await t.readTextFile(n);
		} catch {}
		try {
			return await e.workspace.readTextFile(n);
		} catch {
			return "";
		}
	};
	e.linter.registerRule({
		id: "missing-resource-files",
		name: "모드 리소스 파일 실재성 검사",
		check: async (e) => {
			if (!e.folder) return [];
			let n = [], r = e.model.getLineCount();
			for (let i = 1; i <= r; i++) {
				let r = e.model.getLineContent(i), { code: a } = t(r);
				if (!a.trim()) continue;
				let o = /^\s*filename\s*=\s*(.+)$/i.exec(a);
				if (!o) continue;
				let s = o[1].trim();
				if ((s.startsWith("\"") && s.endsWith("\"") || s.startsWith("'") && s.endsWith("'")) && (s = s.slice(1, -1).trim()), s && !await e.fileExists(s)) {
					let e = r.indexOf(o[1]), t = e === -1 ? 1 : e + 1, a = t + o[1].length;
					n.push({
						severity: "warning",
						message: `참조된 파일 "${s}"을(를) 모드 폴더에서 찾을 수 없습니다. (파일명 및 확장자 확인 필요)`,
						startLineNumber: i,
						startColumn: t,
						endLineNumber: i,
						endColumn: a
					});
				}
			}
			return n;
		}
	}), e.linter.registerRule({
		id: "xxmi-namespace-check",
		name: "XXMI 네임스페이스 및 변수 검사",
		check: async (o) => {
			if (!o.folder) return [];
			let s = [], c = await i(o), l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Set();
			for (let e of c) {
				let t = await a(o, e);
				if (!t) continue;
				let r = n(t, e);
				if (r.namespace) {
					let t = r.namespace.toLowerCase(), n = l.get(t);
					n || (n = {
						namespace: r.namespace,
						files: [],
						variables: /* @__PURE__ */ new Set(),
						sections: /* @__PURE__ */ new Set()
					}, l.set(t, n)), n.files.push(e);
					for (let e of r.variables) n.variables.add(e), u.add(`\\${t}\\${e}`), u.add(`${t}\\${e}`);
					for (let e of r.sections) n.sections.add(e);
				}
			}
			r &&= (r(), null), u.size > 0 && e.linter.registerAllowedVariable && (r = e.linter.registerAllowedVariable((e) => {
				let t = e.toLowerCase().replace(/^\/+/, ""), n = t.startsWith("\\") ? t.slice(1) : t;
				return u.has(`\\${n}`) || u.has(n);
			}));
			let d = o.model.getLineCount(), f = "";
			for (let e = 1; e <= d; e++) {
				let n = o.model.getLineContent(e), { code: r } = t(n);
				if (!r.trim()) continue;
				let i = /^\s*\[([^\]]+)\]/.exec(r);
				if (i) {
					f = i[1].trim();
					continue;
				}
				let a = /\$([a-zA-Z0-9_\\]+)/g, c;
				for (; (c = a.exec(r)) !== null;) {
					let t = c[1], n = c.index + 1, i = n + c[0].length, a = f.toLowerCase() === "constants", o = r.slice(0, c.index), u = a && /^\s*(?:persist\s+|global\s+|local\s+)*$/i.test(o), d = /\b(?:global|persist|local)\s*$/i.test(o);
					if (!(u || d) && t.includes("\\")) {
						let r = t.split("\\").filter(Boolean);
						if (r.length >= 2) {
							let t = r.slice(0, -1).join("\\"), a = r[r.length - 1], o = l.get(t.toLowerCase());
							o ? o.variables.has(a.toLowerCase()) || s.push({
								severity: "warning",
								message: `네임스페이스 '${t}'에 선언되지 않은 변수 '$${a}'입니다. (${t}의 [Constants] 섹션을 확인하세요)`,
								startLineNumber: e,
								startColumn: n,
								endLineNumber: e,
								endColumn: i
							}) : s.push({
								severity: "warning",
								message: `모드 폴더 내에서 네임스페이스 '${t}'을(를) 찾을 수 없습니다. (해당 ini 파일에 'namespace = ${t}' 선언이 있는지 확인하세요)`,
								startLineNumber: e,
								startColumn: n,
								endLineNumber: e,
								endColumn: i
							});
						}
					}
				}
				let u = /^\s*(?:(?:pre\s+|post\s+)?run)\s*=\s*(?:ref\s+)?([a-zA-Z0-9_\\]+)/i.exec(r);
				if (u) {
					let t = u[1].trim();
					if (t.includes("\\")) {
						let r = t.split("\\").filter(Boolean), i = r[0], a = i.toLowerCase().startsWith("builtin"), c = o.isAllowedResource ? o.isAllowedResource(t) : !1;
						if (!a && !c && r.length >= 3) {
							let a = r.slice(1, -1).join("\\"), o = r[r.length - 1], c = l.get(a.toLowerCase()), d = n.indexOf(u[1]), f = d === -1 ? 1 : d + 1, p = f + u[1].length;
							c ? [
								`${i}${o}`.toLowerCase(),
								t.toLowerCase(),
								o.toLowerCase(),
								`${i}\\${a.toLowerCase()}\\${o.toLowerCase()}`
							].some((e) => c.sections.has(e)) || s.push({
								severity: "warning",
								message: `네임스페이스 '${a}'에 정의된 ${i} '${o}'을(를) 찾을 수 없습니다.`,
								startLineNumber: e,
								startColumn: f,
								endLineNumber: e,
								endColumn: p
							}) : s.push({
								severity: "warning",
								message: `모드 폴더 내에서 네임스페이스 '${a}'을(를) 찾을 수 없습니다.`,
								startLineNumber: e,
								startColumn: f,
								endLineNumber: e,
								endColumn: p
							});
						}
					}
				}
			}
			return s;
		}
	});
} });
//#endregion
export { r as default };

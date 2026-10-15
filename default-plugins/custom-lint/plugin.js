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
	let r = e.split(/\r?\n/), i = "", a = "", o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set();
	for (let e = 0; e < r.length; e++) {
		let { code: n } = t(r[e]), a = n.trim();
		if (!a) continue;
		if (a.startsWith("[")) break;
		let o = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(n);
		if (o) {
			let e = o[1].trim();
			(e.startsWith("\"") && e.endsWith("\"") || e.startsWith("'") && e.endsWith("'")) && (e = e.slice(1, -1).trim()), i = e;
			break;
		}
	}
	for (let e = 0; e < r.length; e++) {
		let n = r[e], { code: u } = t(n);
		if (!u.trim()) continue;
		let d = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(u);
		if (d) {
			let e = d[1].trim();
			(e.startsWith("\"") && e.endsWith("\"") || e.startsWith("'") && e.endsWith("'")) && (e = e.slice(1, -1).trim()), i = e;
		}
		let f = /^\s*\[([^\]]+)\]/.exec(u);
		if (f) {
			a = f[1].trim();
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
		let p = /\b(?:global|persist|local)\s+\$([a-zA-Z0-9_\\]+)/gi, m, h = !1;
		for (; (m = p.exec(u)) !== null;) {
			h = !0;
			let e = m[1].toLowerCase(), t = e.split("\\").filter(Boolean), n = t[t.length - 1];
			n && o.add(n), o.add(e);
		}
		let g = a.toLowerCase() === "constants";
		if (g && !h) {
			let e = /^\s*(?:persist\s+|global\s+|local\s+)*\$([a-zA-Z0-9_\\]+)/i.exec(u);
			if (e) {
				let t = e[1].toLowerCase(), n = t.split("\\").filter(Boolean), r = n[n.length - 1];
				r && o.add(r), o.add(t);
			}
		}
		let _ = u.indexOf("="), v = /\$([a-zA-Z0-9_\\]+)/g, y;
		for (; (y = v.exec(u)) !== null;) {
			if (_ !== -1 && y.index < _) {
				if (h || g) continue;
			} else if (_ === -1 && (h || g)) continue;
			let e = y[1].toLowerCase();
			c.add(e);
			let t = e.startsWith("\\") ? e.slice(1) : e;
			c.add(t);
			let n = t.split("\\").filter(Boolean);
			n.length > 1 && c.add(n[n.length - 1]);
		}
		let b = /^\s*(?:(?:pre\s+|post\s+)?run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+|Resource(?:\\[a-zA-Z0-9_]+)*|(?:cs|vs|ps|hs|ds|gs))\s*=\s*(?:ref\s+|copy\s+)?([a-zA-Z0-9_\\]+)/i.exec(u);
		if (b) {
			let e = b[1].trim().toLowerCase();
			if (![
				"null",
				"skip",
				"auto",
				"default"
			].includes(e)) {
				l.add(e);
				let t = e.startsWith("\\") ? e.slice(1) : e;
				l.add(t);
				let n = t.split("\\").filter(Boolean);
				n.length > 1 && l.add(n[n.length - 1]);
			}
		}
		let x = /\b(?:ref|copy)\s+([a-zA-Z0-9_\\]+)/gi, S;
		for (; (S = x.exec(u)) !== null;) {
			let e = S[1].trim().toLowerCase();
			if (![
				"null",
				"skip",
				"auto",
				"default"
			].includes(e)) {
				l.add(e);
				let t = e.startsWith("\\") ? e.slice(1) : e;
				l.add(t);
				let n = t.split("\\").filter(Boolean);
				n.length > 1 && l.add(n[n.length - 1]);
			}
		}
	}
	return {
		namespace: i,
		filePath: n,
		variables: o,
		sections: s,
		usedVariables: c,
		usedSections: l
	};
}
var r = null, i = null, a = null, o = null, s = e({
	activate(e) {
		e.linter?.registerAllowedResource && (e.linter.registerAllowedResource("CommandListSkinTexture"), e.linter.registerAllowedResource(/^(?:builtin\\)?commandlistskintexture$/i), e.linter.registerAllowedResource(/^commandlist\\(?:builtin\\)?skintexture$/i), e.linter.registerAllowedResource(/^builtin\\skintexture$/i)), e.linter?.registerAllowedUsedResource && (e.linter.registerAllowedUsedResource("CommandListSkinTexture"), e.linter.registerAllowedUsedResource(/^(?:builtin\\)?commandlistskintexture$/i), e.linter.registerAllowedUsedResource(/^commandlist\\(?:builtin\\)?skintexture$/i), e.linter.registerAllowedUsedResource(/^builtin\\skintexture$/i));
		let s = async (t) => {
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
		}, c = async (t, n) => {
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
			check: async (l) => {
				if (!l.folder) return [];
				let u = [], d = await s(l), f = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Set(), m = [];
				for (let e of d) {
					let t = await c(l, e);
					if (!t) continue;
					let r = n(t, e);
					if (m.push(r), r.namespace) {
						let t = r.namespace.toLowerCase(), n = f.get(t);
						n || (n = {
							namespace: r.namespace,
							files: [],
							variables: /* @__PURE__ */ new Set(),
							sections: /* @__PURE__ */ new Set()
						}, f.set(t, n)), n.files.push(e);
						for (let e of r.variables) n.variables.add(e), p.add(`\\${t}\\${e}`), p.add(`${t}\\${e}`);
						for (let e of r.sections) n.sections.add(e);
					}
				}
				let h = n(l.model.getValue(), l.file?.path || l.file?.name || ""), g = h.namespace ? h.namespace.toLowerCase() : "", _ = g ? f.get(g) : null, v = (l.file?.path || l.file?.name || "").toLowerCase();
				r &&= (r(), null), i &&= (i(), null), a &&= (a(), null), o &&= (o(), null);
				let y = _ ? _.variables : null, b = _ ? _.sections : null, x = /* @__PURE__ */ new Set(), S = /* @__PURE__ */ new Set();
				for (let e of m) {
					let t = e.filePath.toLowerCase();
					if (t && v && (t === v || t.endsWith(`/${v}`) || t.endsWith(`\\${v}`) || v.endsWith(`/${t}`) || v.endsWith(`\\${t}`))) continue;
					let n = e.namespace ? e.namespace.toLowerCase() : "";
					if (g && n === g) {
						for (let t of e.usedVariables) x.add(t);
						for (let t of e.usedSections) S.add(t);
					} else if (!g && !n) {
						for (let t of e.usedVariables) x.add(t);
						for (let t of e.usedSections) S.add(t);
					} else if (g) {
						for (let t of e.usedVariables) {
							let e = t.startsWith("\\") ? t.slice(1) : t;
							if (e.startsWith(`${g}\\`)) {
								let t = e.slice(g.length + 1);
								x.add(t);
							}
						}
						for (let t of e.usedSections) {
							let e = t.startsWith("\\") ? t.slice(1) : t, n = e.split("\\");
							if (n.length >= 3 && n[1] === g) {
								let t = n[0], r = n.slice(2).join("\\");
								S.add(`${t}${r}`.toLowerCase()), S.add(e);
							}
						}
					}
				}
				e.linter?.registerAllowedVariable && (r = e.linter.registerAllowedVariable((e) => {
					let t = e.toLowerCase().replace(/^\/+/, ""), n = t.startsWith("\\") ? t.slice(1) : t;
					return !!(p.has(`\\${n}`) || p.has(n) || y && y.has(n));
				})), b && b.size > 0 && e.linter?.registerAllowedResource && (i = e.linter.registerAllowedResource((e) => b.has(e.toLowerCase()))), x.size > 0 && e.linter?.registerAllowedUsedVariable && (a = e.linter.registerAllowedUsedVariable((e) => {
					let t = e.toLowerCase().replace(/^[\\$]+/, "");
					return x.has(t);
				})), S.size > 0 && e.linter?.registerAllowedUsedResource && (o = e.linter.registerAllowedUsedResource((e) => {
					let t = e.toLowerCase().replace(/^[\\\/]+/, "");
					if (S.has(t)) return !0;
					let n = t.split("\\").filter(Boolean);
					return !!(n.length > 1 && S.has(n[n.length - 1]));
				}));
				let C = l.model.getLineCount(), w = "";
				for (let e = 1; e <= C; e++) {
					let n = l.model.getLineContent(e), { code: r } = t(n);
					if (!r.trim()) continue;
					let i = /^\s*\[([^\]]+)\]/.exec(r);
					if (i) {
						w = i[1].trim();
						continue;
					}
					let a = /\$([a-zA-Z0-9_\\]+)/g, o;
					for (; (o = a.exec(r)) !== null;) {
						let t = o[1], n = o.index + 1, i = n + o[0].length, a = w.toLowerCase() === "constants", s = r.slice(0, o.index), c = a && /^\s*(?:persist\s+|global\s+|local\s+)*$/i.test(s), l = /\b(?:global|persist|local)\s*$/i.test(s);
						if (!(c || l) && t.includes("\\")) {
							let r = t.split("\\").filter(Boolean);
							if (r.length >= 2) {
								let t = r.slice(0, -1).join("\\"), a = r[r.length - 1], o = f.get(t.toLowerCase());
								o ? o.variables.has(a.toLowerCase()) || u.push({
									severity: "warning",
									message: `네임스페이스 '${t}'에 선언되지 않은 변수 '$${a}'입니다. (${t}의 [Constants] 섹션을 확인하세요)`,
									startLineNumber: e,
									startColumn: n,
									endLineNumber: e,
									endColumn: i
								}) : u.push({
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
					let s = /^\s*(?:(?:pre\s+|post\s+)?run)\s*=\s*(?:ref\s+)?([a-zA-Z0-9_\\]+)/i.exec(r);
					if (s) {
						let t = s[1].trim();
						if (t.includes("\\")) {
							let r = t.split("\\").filter(Boolean), i = r[0], a = i.toLowerCase().startsWith("builtin"), o = l.isAllowedResource ? l.isAllowedResource(t) : !1;
							if (!a && !o && r.length >= 3) {
								let a = r.slice(1, -1).join("\\"), o = r[r.length - 1], c = f.get(a.toLowerCase()), l = n.indexOf(s[1]), d = l === -1 ? 1 : l + 1, p = d + s[1].length;
								c ? [
									`${i}${o}`.toLowerCase(),
									t.toLowerCase(),
									o.toLowerCase(),
									`${i}\\${a.toLowerCase()}\\${o.toLowerCase()}`
								].some((e) => c.sections.has(e)) || u.push({
									severity: "warning",
									message: `네임스페이스 '${a}'에 정의된 ${i} '${o}'을(를) 찾을 수 없습니다.`,
									startLineNumber: e,
									startColumn: d,
									endLineNumber: e,
									endColumn: p
								}) : u.push({
									severity: "warning",
									message: `모드 폴더 내에서 네임스페이스 '${a}'을(를) 찾을 수 없습니다.`,
									startLineNumber: e,
									startColumn: d,
									endLineNumber: e,
									endColumn: p
								});
							}
						}
					}
				}
				return u;
			}
		});
	},
	deactivate() {
		r &&= (r(), null), i &&= (i(), null), a &&= (a(), null), o &&= (o(), null);
	}
});
//#endregion
export { s as default };

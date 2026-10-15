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
//#region default-plugins/custom-lint/index.ts
function n(e, n) {
	let r = e.split(/\r?\n/), i = "", a = "", o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set(), u = [], d = [];
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
		let f = r[e], { code: p } = t(f);
		if (!p.trim()) continue;
		let m = /^\s*namespace\s*=\s*([^;\r\n#]*)/i.exec(p);
		if (m) {
			let e = m[1].trim();
			(e.startsWith("\"") && e.endsWith("\"") || e.startsWith("'") && e.endsWith("'")) && (e = e.slice(1, -1).trim()), i = e;
		}
		let h = /^\s*\[([^\]]+)\]/.exec(p);
		if (h) {
			a = h[1].trim();
			let t = a.toLowerCase();
			s.add(t);
			let r = f.indexOf("["), o = r === -1 ? 1 : r + 2, c = o + a.length;
			if (u.push({
				name: t,
				rawName: a,
				kind: "section",
				line: e + 1,
				startCol: o,
				endCol: c,
				lineContent: f,
				section: `[${a}]`,
				filePath: n,
				namespace: i
			}), i) {
				let r = i.toLowerCase();
				if (t.startsWith("commandlist") && t.length > 11) {
					let l = `commandlist\\${r}\\${t.slice(11)}`;
					s.add(l), u.push({
						name: l,
						rawName: `CommandList\\${i}\\${a.slice(11)}`,
						kind: "section",
						line: e + 1,
						startCol: o,
						endCol: c,
						lineContent: f,
						section: `[${a}]`,
						filePath: n,
						namespace: i
					});
				} else if (t.startsWith("resource") && t.length > 8) {
					let l = `resource\\${r}\\${t.slice(8)}`;
					s.add(l), u.push({
						name: l,
						rawName: `Resource\\${i}\\${a.slice(8)}`,
						kind: "section",
						line: e + 1,
						startCol: o,
						endCol: c,
						lineContent: f,
						section: `[${a}]`,
						filePath: n,
						namespace: i
					});
				} else if (t.startsWith("customshader") && t.length > 12) {
					let l = `customshader\\${r}\\${t.slice(12)}`;
					s.add(l), u.push({
						name: l,
						rawName: `CustomShader\\${i}\\${a.slice(12)}`,
						kind: "section",
						line: e + 1,
						startCol: o,
						endCol: c,
						lineContent: f,
						section: `[${a}]`,
						filePath: n,
						namespace: i
					});
				}
			}
			continue;
		}
		let g = /\b(?:global|persist|local)\s+\$([a-zA-Z0-9_\\]+)/gi, _, v = !1;
		for (; (_ = g.exec(p)) !== null;) {
			v = !0;
			let t = _[1].toLowerCase(), r = t.split("\\").filter(Boolean), s = r[r.length - 1];
			s && o.add(s), o.add(t);
			let c = f.indexOf(_[0]), l = _[0].indexOf("$"), d = c !== -1 && l !== -1 ? c + l + 1 : c === -1 ? 1 : c + 1, p = d + _[1].length + 1;
			u.push({
				name: s ? s.toLowerCase() : t,
				rawName: `$${_[1]}`,
				kind: "variable",
				line: e + 1,
				startCol: d,
				endCol: p,
				lineContent: f,
				section: a ? `[${a}]` : "",
				filePath: n,
				namespace: i
			}), t.includes("\\") && u.push({
				name: t,
				rawName: `$${_[1]}`,
				kind: "variable",
				line: e + 1,
				startCol: d,
				endCol: p,
				lineContent: f,
				section: a ? `[${a}]` : "",
				filePath: n,
				namespace: i
			});
		}
		let y = a.toLowerCase() === "constants";
		if (y && !v) {
			let t = /^\s*(?:persist\s+|global\s+|local\s+)*\$([a-zA-Z0-9_\\]+)/i.exec(p);
			if (t) {
				let r = t[1].toLowerCase(), s = r.split("\\").filter(Boolean), c = s[s.length - 1];
				c && o.add(c), o.add(r);
				let l = f.indexOf(`$${t[1]}`), d = l === -1 ? 1 : l + 1, p = d + t[1].length + 1;
				u.push({
					name: c ? c.toLowerCase() : r,
					rawName: `$${t[1]}`,
					kind: "variable",
					line: e + 1,
					startCol: d,
					endCol: p,
					lineContent: f,
					section: `[${a}]`,
					filePath: n,
					namespace: i
				}), r.includes("\\") && u.push({
					name: r,
					rawName: `$${t[1]}`,
					kind: "variable",
					line: e + 1,
					startCol: d,
					endCol: p,
					lineContent: f,
					section: `[${a}]`,
					filePath: n,
					namespace: i
				});
			}
		}
		let b = p.indexOf("="), x = /\$([a-zA-Z0-9_\\]+)/g, S;
		for (; (S = x.exec(p)) !== null;) {
			if (b !== -1 && S.index < b) {
				if (v || y) continue;
			} else if (b === -1 && (v || y)) continue;
			let t = S[1].toLowerCase();
			c.add(t);
			let r = t.startsWith("\\") ? t.slice(1) : t;
			c.add(r);
			let o = r.split("\\").filter(Boolean), s = i, l = r;
			o.length > 1 && (s = o[0], l = o.slice(1).join("\\"), c.add(o[o.length - 1]));
			let u = S.index + 1, p = u + S[0].length;
			d.push({
				name: l.toLowerCase(),
				rawName: S[0],
				kind: "variable",
				line: e + 1,
				startCol: u,
				endCol: p,
				lineContent: f,
				section: a ? `[${a}]` : "",
				filePath: n,
				namespace: s
			}), o.length > 1 && d.push({
				name: r.toLowerCase(),
				rawName: S[0],
				kind: "variable",
				line: e + 1,
				startCol: u,
				endCol: p,
				lineContent: f,
				section: a ? `[${a}]` : "",
				filePath: n,
				namespace: s
			});
		}
		let C = /^\s*(?:(?:pre\s+|post\s+)?run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+|Resource(?:\\[a-zA-Z0-9_]+)*|(?:cs|vs|ps|hs|ds|gs))\s*=\s*(?:ref\s+|copy\s+)?([a-zA-Z0-9_\\]+)/i.exec(p);
		if (C) {
			let t = C[1].trim(), r = t.toLowerCase();
			if (![
				"null",
				"skip",
				"auto",
				"default"
			].includes(r)) {
				l.add(r);
				let o = r.startsWith("\\") ? r.slice(1) : r;
				l.add(o);
				let s = o.split("\\").filter(Boolean), c = i, u = o;
				s.length >= 3 ? (c = s[1], u = `${s[0]}${s[s.length - 1]}`.toLowerCase(), l.add(s[s.length - 1])) : s.length > 1 && l.add(s[s.length - 1]);
				let p = f.indexOf(C[1]), m = p === -1 ? 1 : p + 1, h = m + C[1].length;
				d.push({
					name: u.toLowerCase(),
					rawName: t,
					kind: "section",
					line: e + 1,
					startCol: m,
					endCol: h,
					lineContent: f,
					section: a ? `[${a}]` : "",
					filePath: n,
					namespace: c
				}), o !== u && d.push({
					name: o.toLowerCase(),
					rawName: t,
					kind: "section",
					line: e + 1,
					startCol: m,
					endCol: h,
					lineContent: f,
					section: a ? `[${a}]` : "",
					filePath: n,
					namespace: c
				});
			}
		}
		let w = /\b(?:ref|copy)\s+([a-zA-Z0-9_\\]+)/gi, T;
		for (; (T = w.exec(p)) !== null;) {
			let t = T[1].trim(), r = t.toLowerCase();
			if (![
				"null",
				"skip",
				"auto",
				"default"
			].includes(r)) {
				l.add(r);
				let o = r.startsWith("\\") ? r.slice(1) : r;
				l.add(o);
				let s = o.split("\\").filter(Boolean), c = i, u = o;
				s.length >= 3 ? (c = s[1], u = `${s[0]}${s[s.length - 1]}`.toLowerCase(), l.add(s[s.length - 1])) : s.length > 1 && l.add(s[s.length - 1]);
				let p = T.index + 1, m = p + T[0].length;
				d.push({
					name: u.toLowerCase(),
					rawName: t,
					kind: "section",
					line: e + 1,
					startCol: p,
					endCol: m,
					lineContent: f,
					section: a ? `[${a}]` : "",
					filePath: n,
					namespace: c
				}), o !== u && d.push({
					name: o.toLowerCase(),
					rawName: t,
					kind: "section",
					line: e + 1,
					startCol: p,
					endCol: m,
					lineContent: f,
					section: a ? `[${a}]` : "",
					filePath: n,
					namespace: c
				});
			}
		}
	}
	return {
		namespace: i,
		filePath: n,
		variables: o,
		sections: s,
		usedVariables: c,
		usedSections: l,
		declarations: u,
		usages: d
	};
}
function r(e) {
	if (!e) return !1;
	let t = e.toLowerCase().replace(/^[\\\/]+/, "");
	return t.startsWith("builtincommandlist") || t.startsWith("builtin_commandlist") || t.startsWith("builtin\\") || t.startsWith("commandlist\\builtin") || t.startsWith("commandlist\\skintexture") || t === "commandlistskintexture" || t === "builtin";
}
var i = !1, a = [], o = null, s = null, c = null, l = null, u = null, d = null, f = e({
	activate(e) {
		if (i = !0, e.linter?.registerAllowedResource) {
			let t = e.linter.registerAllowedResource((e) => r(e)), n = e.linter.registerAllowedResource(/^builtincommandlist/i), i = e.linter.registerAllowedResource("CommandListSkinTexture"), o = e.linter.registerAllowedResource(/^(?:builtin\\)?commandlistskintexture$/i), s = e.linter.registerAllowedResource(/^commandlist\\(?:builtin\\)?skintexture$/i), c = e.linter.registerAllowedResource(/^builtin\\skintexture$/i), l = e.linter.registerAllowedResource(/^(?:commandlist\\)?builtin\\/i), u = e.linter.registerAllowedResource(/^builtin\\/i);
			a.push(t, n, i, o, s, c, l, u);
		}
		if (e.linter?.registerAllowedUsedResource) {
			let t = e.linter.registerAllowedUsedResource((e) => r(e)), n = e.linter.registerAllowedUsedResource(/^builtincommandlist/i), i = e.linter.registerAllowedUsedResource("CommandListSkinTexture"), o = e.linter.registerAllowedUsedResource(/^(?:builtin\\)?commandlistskintexture$/i), s = e.linter.registerAllowedUsedResource(/^commandlist\\(?:builtin\\)?skintexture$/i), c = e.linter.registerAllowedUsedResource(/^builtin\\skintexture$/i), l = e.linter.registerAllowedUsedResource(/^(?:commandlist\\)?builtin\\/i), u = e.linter.registerAllowedUsedResource(/^builtin\\/i);
			a.push(t, n, i, o, s, c, l, u);
		}
		let f = async (t) => {
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
		}, p = async (t, n) => {
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
		}, m = async (e) => {
			let t = await f(e), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set(), a = [];
			for (let o of t) {
				let t = await p(e, o);
				if (!t) continue;
				let s = n(t, o);
				if (a.push(s), s.namespace) {
					let e = s.namespace.toLowerCase(), t = r.get(e);
					t || (t = {
						namespace: s.namespace,
						files: [],
						variables: /* @__PURE__ */ new Set(),
						sections: /* @__PURE__ */ new Set()
					}, r.set(e, t)), t.files.push(o);
					for (let n of s.variables) t.variables.add(n), i.add(`\\${e}\\${n}`), i.add(`${e}\\${n}`);
					for (let e of s.sections) t.sections.add(e);
				}
			}
			return {
				allSummaries: a,
				namespaceMap: r,
				allKnownVariables: i
			};
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
			check: async (a) => {
				if (!i || !a.folder) return [];
				let u = [], { allSummaries: d, namespaceMap: f, allKnownVariables: p } = await m(a);
				if (!i) return [];
				let h = n(a.model.getValue(), a.file?.path || a.file?.name || ""), g = h.namespace ? h.namespace.toLowerCase() : "", _ = g ? f.get(g) : null, v = (a.file?.path || a.file?.name || "").toLowerCase();
				o &&= (o(), null), s &&= (s(), null), c &&= (c(), null), l &&= (l(), null);
				let y = _ ? _.variables : null, b = _ ? _.sections : null, x = /* @__PURE__ */ new Set(), S = /* @__PURE__ */ new Set();
				for (let e of d) {
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
				e.linter?.registerAllowedVariable && (o = e.linter.registerAllowedVariable((e) => {
					let t = e.toLowerCase().replace(/^\/+/, ""), n = t.startsWith("\\") ? t.slice(1) : t;
					return !!(p.has(`\\${n}`) || p.has(n) || y && y.has(n));
				})), b && b.size > 0 && e.linter?.registerAllowedResource && (s = e.linter.registerAllowedResource((e) => b.has(e.toLowerCase()))), x.size > 0 && e.linter?.registerAllowedUsedVariable && (c = e.linter.registerAllowedUsedVariable((e) => {
					let t = e.toLowerCase().replace(/^[\\$]+/, "");
					return x.has(t);
				})), S.size > 0 && e.linter?.registerAllowedUsedResource && (l = e.linter.registerAllowedUsedResource((e) => {
					let t = e.toLowerCase().replace(/^[\\\/]+/, "");
					if (S.has(t)) return !0;
					let n = t.split("\\").filter(Boolean);
					return !!(n.length > 1 && S.has(n[n.length - 1]));
				}));
				let C = a.model.getLineCount(), w = "";
				for (let e = 1; e <= C; e++) {
					let n = a.model.getLineContent(e), { code: i } = t(n);
					if (!i.trim()) continue;
					let o = /^\s*\[([^\]]+)\]/.exec(i);
					if (o) {
						w = o[1].trim();
						continue;
					}
					let s = /\$([a-zA-Z0-9_\\]+)/g, c;
					for (; (c = s.exec(i)) !== null;) {
						let t = c[1], n = c.index + 1, r = n + c[0].length, a = w.toLowerCase() === "constants", o = i.slice(0, c.index), s = a && /^\s*(?:persist\s+|global\s+|local\s+)*$/i.test(o), l = /\b(?:global|persist|local)\s*$/i.test(o);
						if (!(s || l) && t.includes("\\")) {
							let i = t.split("\\").filter(Boolean);
							if (i.length >= 2) {
								let t = i.slice(0, -1).join("\\"), a = i[i.length - 1], o = f.get(t.toLowerCase());
								o ? o.variables.has(a.toLowerCase()) || u.push({
									severity: "warning",
									message: `네임스페이스 '${t}'에 선언되지 않은 변수 '$${a}'입니다. (${t}의 [Constants] 섹션을 확인하세요)`,
									startLineNumber: e,
									startColumn: n,
									endLineNumber: e,
									endColumn: r
								}) : u.push({
									severity: "warning",
									message: `모드 폴더 내에서 네임스페이스 '${t}'을(를) 찾을 수 없습니다. (해당 ini 파일에 'namespace = ${t}' 선언이 있는지 확인하세요)`,
									startLineNumber: e,
									startColumn: n,
									endLineNumber: e,
									endColumn: r
								});
							}
						}
					}
					let l = /^\s*(?:(?:pre\s+|post\s+)?run)\s*=\s*(?:ref\s+)?([a-zA-Z0-9_\\]+)/i.exec(i);
					if (l) {
						let t = l[1].trim();
						if (t.includes("\\")) {
							let i = t.split("\\").filter(Boolean), o = i[0];
							if (!(r(t) || o.toLowerCase().startsWith("builtin") || a.isAllowedResource && a.isAllowedResource(t)) && i.length >= 3) {
								let r = i.slice(1, -1).join("\\"), a = i[i.length - 1], s = f.get(r.toLowerCase()), c = n.indexOf(l[1]), d = c === -1 ? 1 : c + 1, p = d + l[1].length;
								s ? [
									`${o}${a}`.toLowerCase(),
									t.toLowerCase(),
									a.toLowerCase(),
									`${o}\\${r.toLowerCase()}\\${a.toLowerCase()}`
								].some((e) => s.sections.has(e)) || u.push({
									severity: "warning",
									message: `네임스페이스 '${r}'에 정의된 ${o} '${a}'을(를) 찾을 수 없습니다.`,
									startLineNumber: e,
									startColumn: d,
									endLineNumber: e,
									endColumn: p
								}) : u.push({
									severity: "warning",
									message: `모드 폴더 내에서 네임스페이스 '${r}'을(를) 찾을 수 없습니다.`,
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
		let h = { provideDefinition: async (e, t) => {
			if (!i || !e) return null;
			let { allSummaries: r } = await m(t);
			if (!i || r.length === 0) return null;
			let a = (t.file?.path || t.file?.name || "").toLowerCase(), o = e.namespace ? e.namespace.toLowerCase() : "";
			if (!o) {
				let e = n(t.model.getValue(), t.file?.path || t.file?.name || "");
				if (e.namespace) o = e.namespace.toLowerCase();
				else {
					let e = r.find((e) => {
						let t = e.filePath.toLowerCase();
						return t === a || t.endsWith(`/${a}`) || a.endsWith(`/${t}`);
					});
					e && e.namespace && (o = e.namespace.toLowerCase());
				}
			}
			let s = (e.cleanName || e.name || "").replace(/^[\[\]\$]+|[\[\]\$]+$/g, "").toLowerCase(), c = s.includes("\\") ? s.split("\\").pop() : s, l = (t) => {
				let n = t.name.toLowerCase(), r = t.rawName.toLowerCase();
				if (e.kind === "variable" && t.kind === "variable") {
					if (n === s || n === c) return !0;
					let e = n.replace(/^[\\\$]+/, "");
					return !!(e === s || e === c || e.endsWith(`\\${s}`) || e.endsWith(`\\${c}`));
				}
				return e.kind === "section" && t.kind === "section" && !!(n === s || r === s || n === c || r === c || n === `[${s}]` || n === `[${c}]` || n.endsWith(`\\${s}`) || n.endsWith(`\\${c}`) || n.startsWith("commandlist") && (n.slice(11) === s || n.slice(11) === c) || n.startsWith("builtincommandlist") && (n.slice(18) === s || n.slice(18) === c) || s.startsWith("builtincommandlist") && (n === s.slice(18) || n === c) || s.startsWith("builtincommandlist") && n === `commandlist${s.slice(18)}` || n.startsWith("builtincommandlist") && s === `commandlist${n.slice(18)}` || n.startsWith("resource") && (n.slice(8) === s || n.slice(8) === c) || n.startsWith("customshader") && (n.slice(12) === s || n.slice(12) === c));
			};
			if (o) {
				for (let e of r) if (e.namespace && e.namespace.toLowerCase() === o) {
					let t = e.declarations.find(l);
					if (t) return {
						filePath: t.filePath,
						lineNumber: t.line,
						startColumn: t.startCol,
						endColumn: t.endCol,
						lineContent: t.lineContent,
						section: t.section,
						isDefinition: !0
					};
				}
			}
			if (e.namespace) {
				let t = e.namespace.toLowerCase();
				for (let e of r) if (e.namespace && e.namespace.toLowerCase() === t) {
					let t = e.declarations.find(l);
					if (t) return {
						filePath: t.filePath,
						lineNumber: t.line,
						startColumn: t.startCol,
						endColumn: t.endCol,
						lineContent: t.lineContent,
						section: t.section,
						isDefinition: !0
					};
				}
			}
			for (let e of r) {
				let t = e.declarations.find(l);
				if (t) return {
					filePath: t.filePath,
					lineNumber: t.line,
					startColumn: t.startCol,
					endColumn: t.endCol,
					lineContent: t.lineContent,
					section: t.section,
					isDefinition: !0
				};
			}
			return null;
		} }, g = { provideReferences: async (e, t) => {
			if (!i || !e) return [];
			let { allSummaries: a } = await m(t);
			if (!i || a.length === 0) return [];
			let o = (t.file?.path || t.file?.name || "").toLowerCase(), s = e.namespace ? e.namespace.toLowerCase() : "";
			if (!s) {
				let e = n(t.model.getValue(), t.file?.path || t.file?.name || "");
				if (e.namespace) s = e.namespace.toLowerCase();
				else {
					let e = a.find((e) => {
						let t = e.filePath.toLowerCase();
						return t === o || t.endsWith(`/${o}`) || o.endsWith(`/${t}`);
					});
					e && e.namespace && (s = e.namespace.toLowerCase());
				}
			}
			let c = (e.cleanName || e.name || "").replace(/^[\[\]\$]+|[\[\]\$]+$/g, "").toLowerCase(), l = c.includes("\\") && c.split("\\").pop() || c, u = (t) => {
				let n = t.name.toLowerCase(), r = t.rawName.toLowerCase();
				if (e.kind === "variable" && t.kind === "variable") {
					if (n === c || n === l) return !0;
					let e = n.replace(/^[\\\$]+/, "");
					return !!(e === c || e === l || e.endsWith(`\\${c}`) || e.endsWith(`\\${l}`));
				}
				return e.kind === "section" && t.kind === "section" && !!(n === c || r === c || n === l || r === l || n === `[${c}]` || n === `[${l}]` || n.endsWith(`\\${c}`) || n.endsWith(`\\${l}`) || n.startsWith("commandlist") && (n.slice(11) === c || n.slice(11) === l) || n.startsWith("builtincommandlist") && (n.slice(18) === c || n.slice(18) === l) || c.startsWith("builtincommandlist") && n === c.slice(18) || c.startsWith("builtincommandlist") && n === `commandlist${c.slice(18)}` || n.startsWith("builtincommandlist") && c === `commandlist${n.slice(18)}` || n.startsWith("resource") && (n.slice(8) === c || n.slice(8) === l) || n.startsWith("customshader") && (n.slice(12) === c || n.slice(12) === l));
			}, d = [], f = /* @__PURE__ */ new Set(), p = (e, t) => {
				let n = `${e.filePath}:${e.line}:${e.startCol}`;
				f.has(n) || (f.add(n), d.push({
					filePath: e.filePath,
					lineNumber: e.line,
					startColumn: e.startCol,
					endColumn: e.endCol,
					lineContent: e.lineContent,
					section: e.section,
					isDefinition: t
				}));
			}, h = r(c);
			for (let e of a) {
				let t = e.namespace ? e.namespace.toLowerCase() : "";
				if (h || (s ? t === s : !t)) {
					for (let t of e.declarations) u(t) && p(t, !0);
					for (let t of e.usages) u(t) && p(t, !1);
				} else if (s) for (let t of e.usages) (t.namespace ? t.namespace.toLowerCase() : "") === s && u(t) && p(t, !1);
			}
			return d;
		} };
		e.editor?.registerDefinitionProvider ? u = e.editor.registerDefinitionProvider(h) : e.linter?.registerDefinitionProvider && (u = e.linter.registerDefinitionProvider(h)), e.editor?.registerReferenceProvider ? d = e.editor.registerReferenceProvider(g) : e.linter?.registerReferenceProvider && (d = e.linter.registerReferenceProvider(g));
	},
	deactivate() {
		if (i = !1, a.length > 0) {
			for (let e of a) try {
				e();
			} catch {}
			a = [];
		}
		o &&= (o(), null), s &&= (s(), null), c &&= (c(), null), l &&= (l(), null), u &&= (u(), null), d &&= (d(), null);
	}
});
//#endregion
export { f as default, r as isBuiltinResource };

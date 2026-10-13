//#region src/plugins/api.ts
function e(e) {
	return e;
}
//#endregion
//#region default-plugins/ai-assistant/icon.ts
var t = e({
	activate(e) {
		e.ui.registerSidebarView({
			id: "ai-assistant",
			title: "AI 에이전트",
			icon: "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z\"></path></svg>",
			render(t) {
				t.className = "sidebar-panel dynamic-plugin-panel plugin-subview ai-assistant-panel", t.replaceChildren();
				let n = document.createElement("div");
				n.className = "ai-subtab-bar";
				let r = document.createElement("button");
				r.className = "ai-subtab-btn active", r.textContent = "에이전트";
				let i = document.createElement("button");
				i.className = "ai-subtab-btn", i.textContent = "설정", n.append(r, i);
				let a = document.createElement("div");
				a.className = "ai-pane ai-agent-view";
				let o = document.createElement("div");
				o.className = "ai-pane ai-settings-view", o.hidden = !0, r.onclick = () => {
					r.classList.add("active"), i.classList.remove("active"), a.hidden = !1, o.hidden = !0;
				}, i.onclick = () => {
					i.classList.add("active"), r.classList.remove("active"), o.hidden = !1, a.hidden = !0;
				};
				let s = e.ui.createInput({
					label: "API URL:",
					placeholder: "https://generativelanguage.googleapis.com/v1beta/openai 또는 https://api.openai.com/v1",
					value: e.storage.get("api_url", "https://generativelanguage.googleapis.com/v1beta/openai"),
					onInput: (t) => e.storage.set("api_url", t.trim())
				}), c = document.createElement("div");
				c.className = "form-row";
				let l = document.createElement("label");
				l.textContent = "API Key:";
				let u = document.createElement("div");
				u.className = "ai-key-input-wrap";
				let d = document.createElement("input");
				d.type = "password", d.className = "plugin-input ai-key-input", d.placeholder = "Gemini 또는 OpenAI API 키 (Ollama는 비워둠)", d.value = e.storage.get("api_key", ""), d.oninput = () => e.storage.set("api_key", d.value.trim());
				let f = document.createElement("button");
				f.type = "button", f.className = "ai-eye-btn", f.title = "API 키 보기/숨기기", f.setAttribute("aria-label", "API 키 보기/숨기기");
				let p = "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle></svg>";
				f.innerHTML = p;
				let m = !1;
				f.onclick = () => {
					m = !m, d.type = m ? "text" : "password", f.innerHTML = m ? "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24\"></path><line x1=\"1\" y1=\"1\" x2=\"23\" y2=\"23\"></line></svg>" : p;
				}, u.append(d, f), c.append(l, u);
				let h = e.storage.get("model", "gemini-flash-latest").trim();
				(!h || h.startsWith("gemini-2.") || h.startsWith("gemini-1.") || h === "gemini-pro") && (h = "gemini-flash-latest", e.storage.set("model", h));
				let g = e.ui.createInput({
					label: "모델명:",
					placeholder: "gemini-flash-latest, gpt-4o-mini 등",
					value: h,
					onInput: (t) => {
						e.storage.set("model", t.trim()), y();
					}
				}), _ = document.createElement("div");
				_.className = "ai-model-chips";
				let v = [
					{
						name: "gemini-flash-latest",
						label: "gemini-flash-latest"
					},
					{
						name: "gemini-pro-latest",
						label: "gemini-pro-latest"
					},
					{
						name: "gpt-4o-mini",
						label: "gpt-4o-mini"
					},
					{
						name: "gpt-4o",
						label: "gpt-4o"
					}
				], y = () => {
					_.replaceChildren();
					let t = e.storage.get("model", "gemini-flash-latest").trim();
					for (let n of v) {
						let r = document.createElement("button");
						r.type = "button", r.className = `ai-model-chip${t === n.name ? " active" : ""}`, r.textContent = n.label, r.onclick = () => {
							g.setValue(n.name), e.storage.set("model", n.name), y();
						}, _.append(r);
					}
				};
				y();
				let b = document.createElement("div");
				b.className = "ai-settings-card";
				let x = document.createElement("div");
				x.className = "ai-settings-card-title", x.textContent = "빠른 프로바이더 설정";
				let S = document.createElement("div");
				S.className = "ai-quick-actions";
				let C = e.ui.createButton({
					text: "Google Gemini",
					variant: "small",
					onClick: () => {
						let t = "https://generativelanguage.googleapis.com/v1beta/openai", n = "gemini-flash-latest";
						s.setValue(t), g.setValue(n), e.storage.set("api_url", t), e.storage.set("model", n), y(), e.ui.showToast("Gemini 설정이 적용되었습니다. API Key를 입력하세요.", "info");
					}
				}), w = e.ui.createButton({
					text: "OpenAI (ChatGPT)",
					variant: "small",
					onClick: () => {
						let t = "https://api.openai.com/v1", n = "gpt-4o-mini";
						s.setValue(t), g.setValue(n), e.storage.set("api_url", t), e.storage.set("model", n), y(), e.ui.showToast("OpenAI 설정이 적용되었습니다.", "info");
					}
				}), T = e.ui.createButton({
					text: "로컬 Ollama",
					variant: "small",
					onClick: () => {
						let t = "http://localhost:11434/v1", n = "qwen2.5-coder";
						s.setValue(t), g.setValue(n), e.storage.set("api_url", t), e.storage.set("model", n), y(), e.ui.showToast("Ollama 설정이 적용되었습니다. (Key는 비워둠)", "info");
					}
				});
				S.append(C, w, T), b.append(x, S);
				let E = document.createElement("div");
				E.className = "ai-settings-card";
				let D = document.createElement("div");
				D.className = "ai-settings-card-title", D.textContent = "연결 정보 입력", E.append(D, s.row, c, g.row, _);
				let O = document.createElement("div");
				O.className = "ai-settings-card", O.style.fontSize = "11px", O.style.color = "var(--fg-dim)", O.style.lineHeight = "1.5", O.innerHTML = "\n          <div style=\"font-weight:600;color:var(--fg);margin-bottom:4px;\">안내사항</div>\n          <div>- Google Gemini: Google AI Studio 키(AQ...) 입력 시 gemini-flash-latest 모델이 기본 제공됩니다.</div>\n          <div>- OpenAI: platform.openai.com API 키 및 gpt-4o-mini 모델을 권장합니다.</div>\n          <div>- Ollama: 로컬 PC에서 실행 중인 경우 키 없이 바로 연결할 수 있습니다.</div>\n        ", o.append(b, E, O);
				let k = document.createElement("div");
				k.className = "ai-chat-history";
				let A = document.createElement("div");
				A.className = "ai-empty-state", A.innerHTML = "\n          <div class=\"ai-empty-title\">3DMigoto / XXMI 모딩 어시스턴트</div>\n          <div class=\"ai-empty-desc\">INI 코드 분석이나 토글 키 생성 등 모딩 작업을 질문하거나<br>하단의 [템플릿 ▾] 버튼을 눌러 빠르게 요청해 보세요.</div>\n        ", k.append(A);
				let j = document.createElement("div");
				j.className = "ai-input-dock";
				let M = document.createElement("div");
				M.className = "ai-input-dock-top";
				let N = document.createElement("div");
				N.className = "ai-dock-options";
				let P = document.createElement("div");
				P.className = "ai-context-select-wrap";
				let F = document.createElement("select");
				F.className = "ai-context-select", F.title = "AI에게 전달할 컨텍스트 범위를 선택합니다.";
				let I = document.createElement("option");
				I.value = "smart", I.textContent = "스마트";
				let L = document.createElement("option");
				L.value = "full", L.textContent = "전체 파일";
				let R = document.createElement("option");
				R.value = "none", R.textContent = "코드 제외", F.append(I, L, R), F.value = e.storage.get("context_mode", "smart"), F.onchange = () => e.storage.set("context_mode", F.value), P.append(F);
				let z = e.storage.get("auto_apply", !1), B = document.createElement("button");
				B.type = "button", B.className = "ai-auto-apply-toggle" + (z ? " active" : ""), B.title = "답변 완료 시 현재 열린 파일의 해당 섹션을 스마트하게 자동 교체/반영합니다.", B.textContent = "자동 반영", B.onclick = () => {
					z = !z, e.storage.set("auto_apply", z), B.classList.toggle("active", z), e.ui.showToast(`자동 반영이 ${z ? "활성화" : "비활성화"}되었습니다.`, z ? "info" : "warn");
				}, N.append(P, B);
				let V = document.createElement("div");
				V.className = "ai-template-btn-wrap";
				let H = document.createElement("button");
				H.className = "small-btn", H.textContent = "템플릿 ▾";
				let U = document.createElement("ul");
				U.className = "ai-template-menu", U.hidden = !0, [
					{
						label: "[분석] 문법 및 오류 분석",
						text: "현재 INI 파일의 문법적 오류나 권장되지 않는 작성 방식을 3DMigoto/XXMI 규격(elif 및 빌트인 키워드 지원) 기준으로 검사하고 개선안을 제시해 줘."
					},
					{
						label: "[생성] 토글 키 섹션 생성",
						text: "F1 키를 누르면 텍스처를 켜고 끄는 완전한 [KeyToggle] 및 관련 [Constants], [TextureOverride] 섹션을 만들어 줘."
					},
					{
						label: "[주석] 섹션 한글 상세 주석",
						text: "현재 파일의 각 섹션 위에 어떤 역할을 하는지 한국어로 상세한 주석을 달아줘."
					},
					{
						label: "[생성] 텍스처 오버라이드 기본형",
						text: "해시 값을 기반으로 텍스처를 교체하는 표준 [TextureOverride] 섹션 템플릿을 작성해 줘."
					},
					{
						label: "[생성] 상수 및 커맨드리스트 생성",
						text: "조건 분기 및 변수 제어를 위한 [Constants] 및 [CommandList] 섹션 예제를 만들어 줘."
					},
					{ label: "---" },
					{
						label: "[지우기] 대화 내역 초기화",
						isAction: !0
					}
				].forEach((t) => {
					if (t.label === "---") {
						let e = document.createElement("li");
						e.className = "ai-template-menu-divider", U.append(e);
						return;
					}
					let n = document.createElement("li");
					n.className = "ai-template-menu-item", n.textContent = t.label, n.onclick = (n) => {
						if (n.stopPropagation(), U.hidden = !0, t.isAction) {
							k.replaceChildren(A), e.ui.showToast("대화 내역이 초기화되었습니다.", "info");
							return;
						}
						t.text && (W.value = t.text, te(), W.focus());
					}, U.append(n);
				}), H.onclick = (e) => {
					e.stopPropagation(), U.hidden = !U.hidden;
				}, V.append(H, U), M.append(N, V);
				let ee = document.createElement("div");
				ee.className = "ai-input-dock-main";
				let W = document.createElement("textarea");
				W.className = "ai-dock-textarea", W.placeholder = "AI에게 질문이나 코드 작성을 요청하세요... (Enter로 전송, Shift+Enter 줄바꿈)", W.rows = 1;
				let G = document.createElement("div");
				G.className = "ai-dock-resizer", G.title = "드래그하여 입력창 높이 조절 (더블 클릭: 기본 크기 복원)";
				let K = e.storage.get("dock_textarea_height", 0), q = K >= 38;
				q && (W.style.height = `${K}px`, W.style.overflowY = "auto");
				let te = () => {
					if (q) {
						W.style.overflowY = W.scrollHeight > W.clientHeight ? "auto" : "hidden";
						return;
					}
					W.style.height = "auto";
					let e = W.scrollHeight;
					e > 120 ? (W.style.height = "120px", W.style.overflowY = "auto") : (W.style.height = `${Math.max(e, 38)}px`, W.style.overflowY = "hidden");
				};
				W.oninput = te;
				let J = !1, ne = 0, re = 38, ie = (e) => {
					if (!J) return;
					let t = ne - e.clientY, n = a.clientHeight, r = Math.max(120, n - 120), i = Math.max(38, Math.min(r, re + t));
					W.style.height = `${i}px`, W.style.overflowY = W.scrollHeight > i ? "auto" : "hidden", q = !0, K = i;
				}, ae = () => {
					J && (J = !1, G.classList.remove("dragging"), document.body.classList.remove("ai-dock-resizing"), window.removeEventListener("mousemove", ie), window.removeEventListener("mouseup", ae), K >= 38 && e.storage.set("dock_textarea_height", K));
				};
				G.onmousedown = (e) => {
					e.preventDefault(), J = !0, ne = e.clientY, re = W.clientHeight || 38, G.classList.add("dragging"), document.body.classList.add("ai-dock-resizing"), window.addEventListener("mousemove", ie), window.addEventListener("mouseup", ae);
				}, G.ondblclick = () => {
					q = !1, K = 0, e.storage.set("dock_textarea_height", 0), W.style.height = "38px", W.style.overflowY = "hidden", e.ui.showToast("입력창 높이가 기본 크기로 초기화되었습니다.", "info");
				};
				let Y = document.createElement("button");
				Y.className = "primary ai-dock-send-btn", Y.textContent = "전송", W.onkeydown = (e) => {
					e.key === "Enter" && !e.shiftKey && (e.preventDefault(), Q(W.value));
				}, Y.onclick = () => Q(W.value), ee.append(W, Y), j.append(M, ee), a.append(k, G, j), t.append(n, a, o);
				let oe = (e) => {
					!U.hidden && !V.contains(e.target) && (U.hidden = !0);
				};
				document.addEventListener("click", oe);
				function se(t, n = !1) {
					let r = e.editor.getText(), i = e.ini.merge(r, t);
					e.editor.setText(i.newText);
					let a = n ? "[자동 반영] " : "", o = i.replacedSections.length, s = i.addedSections.length;
					return o > 0 && s > 0 ? e.ui.showToast(`${a}${o}개 섹션 교체 및 ${s}개 섹션이 추가되었습니다. (되돌리기: Ctrl+Z)`, "info") : o > 0 ? e.ui.showToast(`${a}${o}개 섹션이 스마트 교체되었습니다. (되돌리기: Ctrl+Z)`, "info") : s > 0 ? e.ui.showToast(`${a}${s}개 섹션이 파일에 추가되었습니다. (되돌리기: Ctrl+Z)`, "info") : e.ui.showToast(`${a}파일 내용이 갱신되었습니다. (되돌리기: Ctrl+Z)`, "info"), !0;
				}
				function ce(e) {
					return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
				}
				function X(e) {
					let t = ce(e), n = [], r = t.replace(/`([^`]+)`/g, (e, t) => {
						let r = n.length;
						return n.push(`<code class="ai-inline-code">${t}</code>`), `\uFFF0CODE_${r}\uFFF1`;
					}).replace(/(\*\*\*|___)(.*?)\1/g, "<strong><em>$2</em></strong>");
					return r = r.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>"), r = r.replace(/(?<!\w)(\*|_)(.*?)\1(?!\w)/g, "<em>$2</em>"), r = r.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"ai-link\">$1</a>"), r = r.replace(/\uFFF0CODE_(\d+)\uFFF1/g, (e, t) => n[parseInt(t, 10)] || ""), r;
				}
				function le(e) {
					let t = e.split(/\r?\n/), n = [], r = !1, i = !1, a = !1, o = !1, s = [], c = [], l = [], u = () => {
						if (l.length > 0) {
							let e = l.map((e) => X(e)).join("<br>");
							n.push(`<p class="ai-md-p">${e}</p>`), l = [];
						}
					}, d = () => {
						if (!o) return;
						let e = "<table class=\"ai-md-table\">";
						if (s.length > 0) {
							e += "<thead><tr>";
							for (let t of s) e += `<th>${X(t)}</th>`;
							e += "</tr></thead>";
						}
						if (c.length > 0) {
							e += "<tbody>";
							for (let t of c) {
								e += "<tr>";
								for (let n of t) e += `<td>${X(n)}</td>`;
								e += "</tr>";
							}
							e += "</tbody>";
						}
						e += "</table>", n.push(e), o = !1, s = [], c = [];
					}, f = () => {
						u(), d(), r &&= (n.push("</ul>"), !1), i &&= (n.push("</ol>"), !1), a &&= (n.push("</blockquote>"), !1);
					};
					for (let e = 0; e < t.length; e++) {
						let p = t[e], m = p.trim();
						if (!m) {
							f();
							continue;
						}
						if (m.startsWith("|") && m.endsWith("|") && m.length > 2) {
							if (u(), r &&= (n.push("</ul>"), !1), i &&= (n.push("</ol>"), !1), a &&= (n.push("</blockquote>"), !1), /^\|?(\s*:?-{2,}:?\s*\|)+\s*$/.test(m)) continue;
							let e = m.slice(1, -1).split("|").map((e) => e.trim());
							o ? c.push(e) : (o = !0, s = e);
							continue;
						}
						if (o && d(), /^(\-{3,}|\*{3,}|_{3,})$/.test(m)) {
							f(), n.push("<hr class=\"ai-md-hr\">");
							continue;
						}
						let h = m.match(/^(#{1,6})\s+(.+)$/);
						if (h) {
							f();
							let e = Math.min(h[1].length + 2, 6);
							n.push(`<h${e} class="ai-md-h ai-md-h${e}">${X(h[2])}</h${e}>`);
							continue;
						}
						let g = m.match(/^>\s?(.*)$/);
						if (g) {
							u(), r &&= (n.push("</ul>"), !1), i &&= (n.push("</ol>"), !1), a ||= (n.push("<blockquote class=\"ai-md-quote\">"), !0), n.push(`<p>${X(g[1])}</p>`);
							continue;
						}
						a &&= (n.push("</blockquote>"), !1);
						let _ = m.match(/^[-*+]\s+(.+)$/);
						if (_) {
							u(), i &&= (n.push("</ol>"), !1), r ||= (n.push("<ul class=\"ai-md-ul\">"), !0), n.push(`<li>${X(_[1])}</li>`);
							continue;
						}
						r && !p.startsWith("  ") && !p.startsWith("	") && (n.push("</ul>"), r = !1);
						let v = m.match(/^\d+\.\s+(.+)$/);
						if (v) {
							u(), r &&= (n.push("</ul>"), !1), i ||= (n.push("<ol class=\"ai-md-ol\">"), !0), n.push(`<li>${X(v[1])}</li>`);
							continue;
						}
						i && !p.startsWith("  ") && !p.startsWith("	") && (n.push("</ol>"), i = !1), l.push(p);
					}
					return f(), n.join("");
				}
				function ue(t, n) {
					t.replaceChildren();
					let r = /```(?:[a-zA-Z0-9_-]+)?([\s\S]*?)```/g, i = 0, a;
					for (; (a = r.exec(n)) !== null;) {
						let r = n.slice(i, a.index);
						if (r.trim()) {
							let e = document.createElement("div");
							e.className = "ai-md-content", e.innerHTML = le(r.trim()), t.append(e);
						}
						let o = a[1].trim(), s = document.createElement("div");
						s.className = "ai-code-block";
						let c = document.createElement("pre");
						c.textContent = o, s.append(c);
						let l = document.createElement("div");
						l.className = "ai-code-bar";
						let u = document.createElement("button");
						u.className = "small-btn ai-apply-btn", u.textContent = "스마트 적용", u.title = "현재 열린 파일의 해당 섹션을 찾아 스마트하게 교체/반영합니다", u.onclick = () => {
							se(o, !1);
						};
						let d = document.createElement("button");
						d.className = "small-btn", d.textContent = "커서 삽입", d.title = "현재 에디터 커서 위치에 코드를 삽입합니다", d.onclick = () => {
							e.editor.insertText(o + "\n"), e.ui.showToast("에디터 커서에 코드가 삽입되었습니다.", "info");
						};
						let f = document.createElement("button");
						f.className = "small-btn", f.textContent = "복사", f.onclick = () => {
							navigator.clipboard.writeText(o), e.ui.showToast("클립보드에 복사되었습니다.", "info");
						}, l.append(u, d, f), s.append(l), t.append(s), i = a.index + a[0].length;
					}
					let o = n.slice(i);
					if (o.trim()) {
						let e = document.createElement("div");
						e.className = "ai-md-content", e.innerHTML = le(o.trim()), t.append(e);
					}
				}
				let Z = null;
				function de(e = "USER") {
					Z &&= (Z.abort(e), null);
				}
				function fe(e, t) {
					return new Promise((n, r) => {
						if (t?.aborted) return r(new DOMException("Aborted", "AbortError"));
						let i = setTimeout(() => {
							n();
						}, e);
						t?.addEventListener("abort", () => {
							clearTimeout(i), r(new DOMException("Aborted", "AbortError"));
						}, { once: !0 });
					});
				}
				function pe(t, n) {
					if (n === "none") return {
						promptText: t,
						detail: "단독 질의 모드 (에디터 코드 제외)"
					};
					let r = e.workspace.getCurrentFile()?.name || "document.ini", i = e.editor.getText(), a = i.split("\n").length;
					if (n === "full") return {
						promptText: `${t}\n\n[현재 열린 파일: ${r} (전체 코드가 전달되었습니다)]\n\`\`\`ini\n${i}\n\`\`\``,
						detail: `${r} (${a}줄 전체 첨부)`
					};
					let o = e.ini.parse(i), s = e.editor.getCursor()?.lineNumber || 1, c = o.sections.find((e) => s >= e.startLine && s <= e.endLine), l = t.toLowerCase(), u = [];
					for (let e of o.sections) {
						if (c && e.name === c.name) continue;
						let t = e.name.toLowerCase(), n = l.includes(t), r = (l.includes("hair") || l.includes("헤어")) && t.includes("hair") || (l.includes("face") || l.includes("얼굴")) && t.includes("face") || (l.includes("body") || l.includes("바디") || l.includes("몸")) && t.includes("body") || (l.includes("skirt") || l.includes("치마")) && t.includes("skirt") || (l.includes("dress") || l.includes("드레스") || l.includes("옷")) && (t.includes("dress") || t.includes("body")) || (l.includes("toggle") || l.includes("토글") || l.includes("키")) && (t.startsWith("key") || t.startsWith("constants")) || (l.includes("command") || l.includes("커맨드")) && t.startsWith("commandlist");
						if ((n || r) && (u.push(e), u.length >= 3)) break;
					}
					if (l.includes("토글") || l.includes("toggle") || l.includes("키") || l.includes("key") || l.includes("변수") || l.includes("$")) {
						let e = o.getSection("Constants");
						e && e !== c && !u.includes(e) && u.unshift(e);
					}
					let d = [];
					d.push(`[문서 구조 요약 - 총 ${o.sections.length}개 섹션 선언됨]`);
					for (let t of o.sections) {
						let n = e.ini.classifySection(t.name), r = t.properties.hash ? `hash=${t.properties.hash}` : t.properties.key ? `key=${t.properties.key}` : t.properties.type ? `type=${t.properties.type}` : "";
						d.push(`- [${t.name}] (${n}${r ? `, ${r}` : ""}, 라인 ${t.startLine}~${t.endLine})`);
					}
					let f = o.getSection("Constants"), p = f ? Object.keys(f.variables) : [];
					p.length > 0 && d.push(`- 선언된 전역 변수: ${p.slice(0, 10).join(", ")}${p.length > 10 ? " 외..." : ""}`);
					let m = [];
					c && m.push(`; [현재 에디터 커서 위치 섹션 (${c.name})]\n${c.fullText}`);
					for (let e of u) m.push(`; [질문과 연관된 참고 섹션 (${e.name})]\n${e.fullText}`);
					if (m.length === 0 && o.sections.length > 0) {
						let e = o.sections[0];
						m.push(`; [파일 첫 번째 섹션 (${e.name})]\n${e.fullText}`);
					}
					let h = [
						`[현재 열린 파일: ${r} - 스마트 요약 및 발췌 컨텍스트]`,
						d.join("\n"),
						"",
						"[수정 및 질문과 관련된 주요 섹션 본문 발췌]",
						m.join("\n\n")
					].join("\n"), g = h.split("\n").length, _ = a > 0 ? Math.max(0, Math.round((a - g) / a * 100)) : 0, v = [];
					c && v.push(`커서:[${c.name}]`), u.forEach((e) => v.push(`연관:[${e.name}]`));
					let y = `${r} (스마트 발췌: ${g}줄 전달, 원본 ${a}줄 대비 ${_}% 토큰 절감, ${v.join(", ") || "개요 전송"})`;
					return {
						promptText: `${t}\n\n${h}`,
						detail: y
					};
				}
				async function Q(t) {
					let n = t.trim();
					if (!n) return;
					Z && de("NEW_REQUEST");
					let r = new AbortController();
					Z = r, A.parentElement && A.remove(), W.value = "", q || (W.style.height = "38px"), W.style.overflowY = "hidden";
					let i = document.createElement("div");
					i.className = "ai-turn-group";
					let a = document.createElement("div");
					a.className = "ai-turn-header";
					let o = document.createElement("div");
					o.className = "ai-turn-header-top";
					let s = document.createElement("span");
					s.className = "ai-turn-badge", s.textContent = "질문", o.append(s);
					let c = n.length > 80 || n.includes("\n"), l = null;
					c && (l = document.createElement("button"), l.className = "ai-turn-toggle-btn", l.textContent = "더보기", o.append(l));
					let u = document.createElement("div");
					if (u.className = `ai-turn-prompt-text${c ? " truncated" : ""}`, u.textContent = n, l) {
						let e = !1, t = (t) => {
							t.stopPropagation(), e = !e, e ? (u.classList.remove("truncated"), l.textContent = "접기") : (u.classList.add("truncated"), l.textContent = "더보기");
						};
						l.onclick = t, a.onclick = (e) => {
							e.target.tagName !== "BUTTON" && t(e);
						};
					}
					a.append(o, u), i.append(a);
					let d = document.createElement("div");
					d.className = "ai-assistant-bubble";
					let f = document.createElement("div");
					f.className = "ai-status-card";
					let p = document.createElement("div");
					p.className = "ai-status-header";
					let m = document.createElement("div");
					m.className = "ai-status-header-left";
					let h = document.createElement("span");
					h.className = "ai-status-spinner";
					let _ = document.createElement("span");
					_.className = "ai-status-title", _.textContent = "요청 처리 준비 중...", m.append(h, _);
					let v = document.createElement("span");
					v.className = "ai-status-timer", v.textContent = "0.0s", p.append(m, v);
					let b = document.createElement("div");
					b.className = "ai-status-steps";
					let x = document.createElement("div");
					x.className = "ai-status-actions";
					let S = document.createElement("span");
					S.className = "ai-status-info";
					let C = document.createElement("button");
					C.className = "small-btn ai-status-abort-btn", C.textContent = "요청 중단", C.onclick = () => {
						de("USER");
					}, x.append(S, C), f.append(p, b, x), d.append(f), i.append(d), k.append(i), k.scrollTop = k.scrollHeight;
					let w = [
						{
							label: "요청 컨텍스트 분석 및 준비",
							status: "pending"
						},
						{
							label: "AI API 서버 연결 준비",
							status: "pending"
						},
						{
							label: "서버 응답 대기 중",
							status: "pending"
						},
						{
							label: "응답 렌더링 및 완료",
							status: "pending"
						}
					];
					function T(e, t, n, r) {
						w[e] && (w[e].status = t, n && (w[e].label = n), r !== void 0 && (w[e].detail = r)), E();
					}
					function E() {
						b.replaceChildren();
						for (let e of w) {
							if (e.status === "pending") continue;
							let t = document.createElement("div");
							t.className = `ai-status-step ${e.status}`;
							let n = document.createElement("span");
							n.className = "ai-status-step-dot", n.textContent = e.status === "completed" ? "[완료]" : e.status === "error" ? "[오류]" : e.status === "retry" ? "[재시도]" : "[진행]";
							let r = document.createElement("div");
							r.className = "ai-status-step-text-wrap";
							let i = document.createElement("span");
							if (i.className = "ai-status-step-label", i.textContent = e.label, r.append(i), e.detail) {
								let t = document.createElement("span");
								t.className = "ai-status-step-detail", t.textContent = e.detail, r.append(t);
							}
							t.append(n, r), b.append(t);
						}
					}
					let D = Date.now(), O = setInterval(() => {
						let e = ((Date.now() - D) / 1e3).toFixed(1);
						v.textContent = `${e}s`;
					}, 100), j = setTimeout(() => {
						r.abort("TIMEOUT");
					}, 45e3);
					T(0, "active", "컨텍스트 분석 중...");
					let M = e.storage.get("api_url", "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, ""), N = e.storage.get("api_key", "").trim(), P = e.storage.get("model", "gemini-flash-latest").trim();
					M.includes("generativelanguage.googleapis.com") && (M.endsWith("/openai") || (M = `${M}/openai`), (!P || P.startsWith("gemini-2.") || P.startsWith("gemini-1.") || P === "gemini-pro") && (P = "gemini-flash-latest", e.storage.set("model", "gemini-flash-latest"), g.setValue("gemini-flash-latest"), y()));
					let I = M.includes("generativelanguage.googleapis.com") ? "Google Gemini" : M.includes("api.openai.com") ? "OpenAI" : M.includes("localhost:11434") ? "로컬 Ollama" : "사용자 지정 API";
					S.textContent = `${I} / ${P}`;
					let L = pe(n, F.value || "smart"), R = L.promptText;
					T(0, "completed", "컨텍스트 준비 완료", L.detail), T(1, "completed", "AI API 연결 준비 완료", `${I} (${P})`), Y.textContent = "중단", Y.classList.remove("primary"), Y.classList.add("danger"), Y.onclick = () => de("USER"), _.textContent = "답변 생성 중...", T(2, "active", "서버 응답 대기 중...", "AI 서버에 질의를 전송하고 답변 수신을 대기하고 있습니다.");
					try {
						let t = { "Content-Type": "application/json" };
						N && (t.Authorization = `Bearer ${N}`, M.includes("generativelanguage.googleapis.com") && (t["x-goog-api-key"] = N));
						let n = 0, i = null;
						for (; n <= 2;) {
							n++;
							try {
								let a = await e.fetch(`${M}/chat/completions`, {
									method: "POST",
									headers: t,
									signal: r.signal,
									body: JSON.stringify({
										model: P,
										messages: [{
											role: "system",
											content: "당신은 3DMigoto 및 XXMI (.ini) 모딩 전문 개발 도우미입니다.\n사용자가 제공한 [문서 구조 요약] 및 [관련 섹션 본문]을 바탕으로 질문의 의도를 분석하고 정확한 INI 코드를 작성하세요.\n\n[3DMigoto / XXMI 문법 및 시스템 키워드 규칙]\n1. 빌트인 시스템 변수 (중요):\n   - 3DMigoto 및 XXMI 엔진에서 자체 제공하는 시스템 변수 및 상수들은 '$' 접두사를 붙이지 않는 정식 내장 키워드입니다:\n     * 드로우 및 파이프라인: draw_type (또는 DRAW_TYPE), vertex_count, index_count, instance_count, first_vertex, first_index, first_instance, indirect_offset\n     * 화면 및 해상도: rt_width, rt_height, res_width, res_height, window_width, window_height, scissor_left, scissor_top, scissor_right, scissor_bottom\n     * 상태 및 시간: time, frame_time, fps, frame_number, draw_number, dispatch_number, hunting, sli, frame_analysis, cursor_showing, cursor_x, cursor_y, separation, convergence\n   - 예시: 'if draw_type == 1' 또는 'if DRAW_TYPE == 1'은 3DMigoto/XXMI의 완전한 표준 정식 문법입니다.\n   - 절대 이 키워드들을 사용자 변수로 오인하여 '$'를 붙이도록 하거나 [Constants]에 'global $DRAW_TYPE = 0' 등으로 선언하라고 잘못 지적하지 마십시오.\n2. 사용자 정의 변수:\n   - 모더가 정의하는 상태 변수나 토글 변수는 '$'로 시작합니다 (예: '$toggle', '$active', 'global $costume = 0').\n   - 사용자 변수는 [Constants] 섹션에 선언되거나 [KeyToggle] 등에서 정의됩니다.\n3. 조건문 문법 및 elif 지원 (매우 중요):\n   - 3DMigoto 및 XXMI 파서는 'if', 'elif', 'else if', 'else', 'endif'를 공식적으로 완전하게 지원합니다.\n   - 예시 구조:\n     if <조건1>\n         ...\n     elif <조건2>\n         ...\n     else if <조건3>\n         ...\n     else\n         ...\n     endif\n   - 'elif'와 'else if'는 3DMigoto/XXMI 파서가 지원하는 정식 표준 문법입니다. 절대로 'elif가 지원되지 않는다'고 잘못 답변하거나, 이를 별도의 개별 'if' 문으로 강제 분리하라고 안내하지 마십시오.\n   - 조건 비교 연산자: '==', '!=', '>=', '<=', '>', '<' 등을 지원합니다 (단독 '='는 할당이므로 조건식에서는 '==' 사용).\n   - 모든 조건 분기 블록('if ... elif ... else')은 마지막에 단 하나의 'endif'로 닫힙니다.\n\n[중요 작성 규칙]\n1. 파일 전체 코드를 처음부터 끝까지 다시 작성하지 마십시오.\n2. 사용자의 요청에 따라 새로 생성하거나 수정해야 할 특정 섹션([KeyToggle], [TextureOverride], [Constants], [CommandList] 등) 단위만 마크다운 ```ini 코드 ``` 블록으로 작성하십시오.\n3. 에디터가 해당 섹션만 찾아 제자리(in-place)에 스마트 교체하므로, 변경이 필요한 섹션들만 온전하게 작성하면 됩니다.\n4. 코드 블록 외의 추가 설명이나 가이드는 명확하고 간결하게 작성하십시오."
										}, {
											role: "user",
											content: R
										}],
										temperature: .3
									})
								});
								if (!a.ok) {
									let e = await a.text(), t = e;
									try {
										let n = JSON.parse(e);
										Array.isArray(n) && n[0]?.error?.message ? t = n[0].error.message : n?.error?.message && (t = n.error.message);
									} catch {}
									if ((a.status === 503 || a.status === 429) && n <= 2) {
										let e = n === 1 ? 2 : 3.5;
										T(2, "retry", `서버 일시 과부하 (${a.status}) 감지`, `트래픽 급증으로 인해 ${e}초 후 자동으로 재시도합니다... (시도: ${n}/2회)`), await fe(e * 1e3, r.signal), T(2, "active", "서버 재요청 전송 중...", `재시도 (${n}/2) 응답 대기 중`);
										continue;
									}
									throw Error(`API 오류 (${a.status}): ${t}`);
								}
								i = await a.json();
								break;
							} catch (e) {
								if (r.signal.aborted || n > 2) throw e;
								T(2, "retry", "네트워크 응답 지연", "2초 후 다시 연결을 시도합니다..."), await fe(2e3, r.signal);
							}
						}
						clearInterval(O), clearTimeout(j);
						let a = ((Date.now() - D) / 1e3).toFixed(1);
						T(2, "completed", "서버 응답 수신 완료", `응답 수신 (소요: ${a}s)`), T(3, "active", "마크다운 렌더링 중...");
						let o = i.choices?.[0]?.message?.content || "(응답 없음)";
						f.remove();
						let s = document.createElement("div");
						s.className = "ai-completion-meta", s.innerHTML = `<span>답변 생성 완료 (${a}s 소요)</span><span>${I} / ${P}</span>`, d.append(s);
						let c = document.createElement("div");
						if (c.className = "ai-reply-body", ue(c, o), d.append(c), z) {
							let e = [], t = /```(?:[a-zA-Z0-9_-]+)?([\s\S]*?)```/g, n;
							for (; (n = t.exec(o)) !== null;) n[1].trim() && e.push(n[1].trim());
							e.length > 0 && se(e.join("\n\n"), !0);
						}
					} catch (e) {
						if (clearInterval(O), clearTimeout(j), h.style.display = "none", C.style.display = "none", r.signal.aborted) r.signal.reason === "TIMEOUT" ? (_.textContent = "서버 응답 시간 초과 (45초)", _.style.color = "#f87171", T(2, "error", "응답 대기 시간 초과 (45초)", "AI 서버가 지정된 시간 내에 응답하지 못했습니다. 트래픽 과부하 상태일 수 있습니다."), $(d, n, P, "TIMEOUT")) : (_.textContent = "요청이 중단되었습니다", _.style.color = "var(--fg-dim)", T(2, "error", "사용자에 의해 생성이 중단됨", "취소 버튼을 클릭하여 요청을 취소했습니다."));
						else {
							let t = e.message || String(e);
							_.textContent = "오류 발생", _.style.color = "#ef4444";
							let r = t.includes("503"), i = t.includes("404");
							r ? (T(2, "error", "Google AI 서버 일시적 과부하 (503)", "무료 티어 트래픽 집중으로 인해 현재 모델이 일시 지연되었습니다."), $(d, n, P, "503")) : i ? (T(2, "error", "모델 또는 엔드포인트를 찾을 수 없음 (404)", t), $(d, n, P, "404")) : (T(2, "error", "요청 처리 실패", t), $(d, n, P, "GENERAL"));
						}
					} finally {
						Z === r && (Z = null), Y.textContent = "전송", Y.classList.remove("danger"), Y.classList.add("primary"), Y.onclick = () => Q(W.value), k.scrollTop = k.scrollHeight;
					}
				}
				function $(t, n, r, i) {
					let a = document.createElement("div");
					a.className = "ai-error-actions-box";
					let o = document.createElement("div");
					o.className = "ai-error-actions-desc", o.textContent = i === "503" ? "Google Gemini 무료 티어 트래픽 집중으로 인해 요청이 일시 지연되었습니다. 잠시 후 다시 시도하시거나 다른 모델로 변경해 보세요." : i === "TIMEOUT" ? "서버 응답이 45초 동안 지연되었습니다. 네트워크 상태를 확인하시거나 다시 시도해 보세요." : i === "404" ? "지정된 모델 또는 엔드포인트를 찾을 수 없습니다 (404). Google Gemini 공식 별칭인 gemini-flash-latest 또는 gemini-pro-latest를 사용하세요." : "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 보세요.";
					let s = document.createElement("div");
					s.className = "ai-error-actions-btn-row";
					let c = r === "gemini-flash-latest" ? "gemini-pro-latest" : "gemini-flash-latest", l = document.createElement("button");
					l.className = "small-btn", l.textContent = `${c} 모델로 전환 후 재시도`, l.onclick = () => {
						e.storage.set("model", c), g.setValue(c), y(), e.ui.showToast(`모델이 ${c}(으)로 변경되었습니다.`, "info"), Q(n);
					};
					let u = document.createElement("button");
					u.className = "small-btn", u.textContent = "동일 모델로 다시 시도", u.onclick = () => {
						Q(n);
					}, s.append(l, u), a.append(o, s), t.append(a);
				}
				return () => {
					Z && Z.abort("UNMOUNT"), window.removeEventListener("mousemove", ie), window.removeEventListener("mouseup", ae), document.removeEventListener("click", oe);
				};
			}
		});
	},
	deactivate() {}
});
//#endregion
export { t as default };

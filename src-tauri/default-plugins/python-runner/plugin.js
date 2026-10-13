//#region src/plugins/api.ts
function e(e) {
	return e;
}
//#endregion
//#region default-plugins/python-runner/icon.ts
var t = e({
	activate(e) {
		e.ui.registerSidebarView({
			id: "python-runner",
			title: "Python 실행기",
			icon: "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><path d=\"M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.803v.825H3.904S0 5.79 0 11.907c0 6.12 3.4 5.925 3.4 5.925h2.031v-2.846s-.11-3.4 3.344-3.4h5.753s3.238.053 3.238-3.187V2.656S18.17 0 11.914 0zm-3.23 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.4 22.162c6.095 0 5.714-2.656 5.714-2.656l-.006-2.752H12v-.825h8.105s3.904.443 3.904-5.674c0-6.12-3.4-5.925-3.4-5.925h-2.031v2.846s.11 3.4-3.344 3.4H9.481s-3.238-.053-3.238 3.187v5.748s-.404 2.656 5.84 2.656zm3.23-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z\"/></svg>",
			render(t) {
				t.className = "sidebar-panel dynamic-plugin-panel plugin-subview python-runner-panel", t.replaceChildren();
				let n = e.ui.createPanelHeader("Python 실행기"), r = e.ui.createSelect({
					label: "실행 명령:",
					options: [
						"python",
						"py",
						"python3"
					],
					value: e.storage.get("cmd", "python"),
					onChange: (t) => e.storage.set("cmd", t)
				}), i = e.ui.createInput({
					label: "추가 인자:",
					placeholder: "예: --verbose output.ini",
					value: e.storage.get("args", ""),
					onInput: (t) => e.storage.set("args", t)
				}), a = e.ui.createCheckbox({
					id: "py-pass-file",
					label: "현재 열린 INI 파일 경로를 인자로 전달",
					checked: e.storage.get("pass_file", !0),
					onChange: (t) => e.storage.set("pass_file", t)
				}), o = e.ui.createCodeEditor({
					label: "실행할 Python 코드:",
					value: e.storage.get("code", "# Migoto Studio Python Runner\nimport sys\n\nprint(\"Python 실행 환경이 정상 작동 중입니다!\")\nif len(sys.argv) > 1:\n    print(f\"인자 파일: {sys.argv[1]}\")\n"),
					onInput: (t) => e.storage.set("code", t)
				}), s = e.ui.createConsole({
					title: "실행 결과 (Console)",
					placeholder: "(실행 버튼을 누르면 여기에 출력이 표시됩니다)"
				}), c = e.ui.createButton({
					text: "스크립트 실행",
					variant: "primary",
					async onClick() {
						c.disabled = !0, c.textContent = "실행 중...", s.set("프로세스 시작...\n");
						try {
							let t = o.getValue(), n = r.getValue(), c = [
								"-c",
								t,
								...i.getValue().trim().split(/\s+/).filter(Boolean)
							];
							if (a.isChecked()) {
								let t = e.workspace.getCurrentFile();
								t?.path && c.push(t.path);
							}
							let u = e.workspace.getCurrentFolder() || void 0, d = await e.system.exec(n, c, u);
							s.clear(), d.stdout && s.append(d.stdout), d.stderr && s.append((d.stdout ? "\n" : "") + d.stderr), !d.stdout && !d.stderr && s.set(`(출력 없음 - 종료 코드: ${d.exitCode})`), l.disabled = !d.stdout, d.exitCode === 0 ? e.ui.showToast("Python 실행 완료", "info") : e.ui.showToast(`실행 실패 (종료 코드 ${d.exitCode})`, "warn");
						} catch (t) {
							s.append(`\n[오류] ${t}`), e.ui.showToast("실행 오류 발생", "error");
						} finally {
							c.disabled = !1, c.textContent = "스크립트 실행";
						}
					}
				}), l = e.ui.createButton({
					text: "에디터에 결과 삽입",
					variant: "secondary",
					disabled: !0,
					onClick() {
						let t = s.output.textContent?.trim();
						t && (e.editor.insertText(t + "\n"), e.ui.showToast("에디터에 결과가 삽입되었습니다.", "info"));
					}
				}), u = e.ui.createButtonRow([c, l]);
				t.append(n, r.row, i.row, a.row, o.container, u, s.container);
			}
		});
	},
	deactivate() {}
});
//#endregion
export { t as default };

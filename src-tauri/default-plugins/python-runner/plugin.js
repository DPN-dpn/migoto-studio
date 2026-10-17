//#region src/plugins/api.ts
function e(e) {
	return e;
}
//#endregion
//#region default-plugins/python-runner/index.ts
var t = "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><path d=\"M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.803v.825H3.904S0 5.79 0 11.907c0 6.12 3.4 5.925 3.4 5.925h2.031v-2.846s-.11-3.4 3.344-3.4h5.753s3.238.053 3.238-3.187V2.656S18.17 0 11.914 0zm-3.23 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.4 22.162c6.095 0 5.714-2.656 5.714-2.656l-.006-2.752H12v-.825h8.105s3.904.443 3.904-5.674c0-6.12-3.4-5.925-3.4-5.925h-2.031v2.846s.11 3.4-3.344 3.4H9.481s-3.238-.053-3.238 3.187v5.748s-.404 2.656 5.84 2.656zm3.23-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z\"/></svg>";

function buildView(e, n, isTab) {
	let r = e.ui.createPanelHeader(isTab ? "Python 스크립트 실행기 (전체 화면)" : "Python 실행기");
	let cmdSelect = e.ui.createSelect({
		label: "실행 명령:",
		options: ["python", "py", "python3"],
		value: e.storage.get("cmd", "python"),
		onChange: (t) => e.storage.set("cmd", t)
	});
	let argsInput = e.ui.createInput({
		label: "추가 인자:",
		placeholder: "예: --verbose output.ini",
		value: e.storage.get("args", ""),
		onInput: (t) => e.storage.set("args", t)
	});
	let passFileCheck = e.ui.createCheckbox({
		id: isTab ? "py-pass-file-tab" : "py-pass-file",
		label: "현재 열린 INI 파일 경로를 인자로 전달",
		checked: e.storage.get("pass_file", !0),
		onChange: (t) => e.storage.set("pass_file", t)
	});
	let configCard = e.ui.createCard({
		title: "실행 환경 및 옵션",
		subtitle: "파이썬 인터프리터 및 커맨드라인 파라미터를 설정합니다.",
		content: [cmdSelect.row, argsInput.row, passFileCheck.row]
	});
	let codeEditor = e.ui.createCodeEditor({
		label: "실행할 Python 코드:",
		rows: isTab ? 10 : 6,
		value: e.storage.get("code", "# Migoto Studio Python Runner\nimport sys\n\nprint(\"Python 실행 환경이 정상 작동 중입니다!\")\nif len(sys.argv) > 1:\n    print(f\"인자 파일: {sys.argv[1]}\")\n"),
		onInput: (t) => e.storage.set("code", t)
	});
	let consoleView = e.ui.createConsole({
		title: "실행 결과 (Console)",
		placeholder: "(실행 버튼을 누르면 여기에 출력이 표시됩니다)"
	});
	let runBtn = e.ui.createButton({
		text: "스크립트 실행",
		variant: "primary",
		async onClick() {
			runBtn.disabled = !0;
			runBtn.textContent = "실행 중...";
			consoleView.set("프로세스 시작...\n");
			try {
				let t = codeEditor.getValue(), cmd = cmdSelect.getValue(), extra = argsInput.getValue().trim().split(/\s+/).filter(Boolean);
				let args = ["-c", t, ...extra];
				if (passFileCheck.isChecked()) {
					let cur = e.workspace.getCurrentFile();
					if (cur?.path) args.push(cur.path);
				}
				let cwd = e.workspace.getCurrentFolder() || void 0;
				let res = await e.system.exec(cmd, args, cwd);
				consoleView.clear();
				if (res.stdout) consoleView.append(res.stdout);
				if (res.stderr) consoleView.append((res.stdout ? "\n" : "") + res.stderr);
				if (!res.stdout && !res.stderr) {
					consoleView.set(`(출력 없음 - 종료 코드: ${res.exitCode})`);
				}
				insertBtn.disabled = !res.stdout;
				if (res.exitCode === 0) {
					e.ui.showToast("Python 실행 완료", "info");
				} else {
					e.ui.showToast(`실행 실패 (종료 코드 ${res.exitCode})`, "warn");
				}
			} catch (err) {
				consoleView.append(`\n[오류] ${err}`);
				e.ui.showToast("실행 오류 발생", "error");
			} finally {
				runBtn.disabled = !1;
				runBtn.textContent = "스크립트 실행";
			}
		}
	});
	let insertBtn = e.ui.createButton({
		text: "에디터에 결과 삽입",
		variant: "secondary",
		disabled: !0,
		onClick() {
			let t = consoleView.output.textContent?.trim();
			if (t) {
				e.editor.insertText(t + "\n");
				e.ui.showToast("에디터에 결과가 삽입되었습니다.", "info");
			}
		}
	});
	let actionRow = e.ui.createButtonRow([runBtn, insertBtn]);
	let scriptCard = e.ui.createCard({
		title: "스크립트 작성 및 실행 결과",
		content: [codeEditor.container, actionRow, consoleView.container]
	});
	n.append(r, configCard, scriptCard);
}

var plugin = e({
	activate(e) {
		e.ui.registerSidebarView({
			id: "python-runner",
			title: "Python 실행기",
			icon: t,
			render(n) {
				n.className = "sidebar-panel dynamic-plugin-panel plugin-subview python-runner-panel";
				n.replaceChildren();
				buildView(e, n, false);
			}
		});

		e.ui.registerMenuItem({
			label: "Python 실행기 열기 (에디터 탭)",
			shortcut: "Ctrl+Shift+P",
			action: () => {
				e.ui.openTab({
					id: "python-runner-tab",
					title: "Python 스크립트 실행기",
					icon: t,
					render(n) {
						n.className = "plugin-tab-view python-runner-tab-container";
						n.style.cssText = "max-width: 960px; margin: 0 auto; padding: 24px; box-sizing: border-box; overflow-y: auto; height: 100%;";
						buildView(e, n, true);
						return () => {
							n.replaceChildren();
						};
					}
				});
			}
		});
	},
	deactivate() {}
});
//#endregion
export { plugin as default };

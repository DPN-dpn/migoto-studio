//#region default-plugins/python-runner/icon.ts
var iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.803v.825H3.904S0 5.79 0 11.907c0 6.12 3.4 5.925 3.4 5.925h2.031v-2.846s-.11-3.4 3.344-3.4h5.753s3.238.053 3.238-3.187V2.656S18.17 0 11.914 0zm-3.23 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.4 22.162c6.095 0 5.714-2.656 5.714-2.656l-.006-2.752H12v-.825h8.105s3.904.443 3.904-5.674c0-6.12-3.4-5.925-3.4-5.925h-2.031v2.846s.11 3.4-3.344 3.4H9.481s-3.238-.053-3.238 3.187v5.748s-.404 2.656 5.84 2.656zm3.23-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z"/></svg>`;
//#endregion
//#region default-plugins/python-runner/index.ts
/**
* Python 스크립트 실행기 플러그인
* 파이썬 코드를 에디터 내에서 실행하고 표준 출력 결과를 확인하거나 에디터에 삽입할 수 있습니다.
*/
var plugin = {
	activate(context) {
		context.ui.registerSidebarView({
			id: "python-runner",
			title: "Python 실행기",
			icon: iconSvg,
			render(container) {
				container.className = "sidebar-panel dynamic-plugin-panel plugin-subview python-runner-panel";
				container.replaceChildren();
				buildPythonRunnerView(context, container, false);
			}
		});
		context.ui?.registerMenuItem?.({
			label: "Python 실행기 열기 (에디터 탭)",
			shortcut: "Ctrl+Shift+P",
			action: () => openPythonTab(context)
		});
	},
	deactivate() {}
};
function openPythonTab(context) {
	context.ui.openTab({
		id: "python-runner-tab",
		title: "Python 스크립트 실행기",
		icon: iconSvg,
		render(container) {
			container.className = "plugin-tab-view python-runner-tab-container";
			container.style.cssText = "max-width: 960px; margin: 0 auto; padding: 24px; box-sizing: border-box; overflow-y: auto; height: 100%;";
			buildPythonRunnerView(context, container, true);
			return () => {
				container.replaceChildren();
			};
		}
	});
}
function buildPythonRunnerView(context, container, isTab) {
	const header = context.ui.createPanelHeader(isTab ? "Python 스크립트 실행기 (전체 화면)" : "Python 실행기");
	const cmdSelect = context.ui.createSelect({
		label: "실행 명령:",
		options: [
			"python",
			"py",
			"python3"
		],
		value: context.storage.get("cmd", "python"),
		onChange: (cmd) => context.storage.set("cmd", cmd)
	});
	const argsInput = context.ui.createInput({
		label: "추가 인자:",
		placeholder: "예: --verbose output.ini",
		value: context.storage.get("args", ""),
		onInput: (args) => context.storage.set("args", args)
	});
	const passFileCheck = context.ui.createCheckbox({
		id: isTab ? "py-pass-file-tab" : "py-pass-file",
		label: "현재 열린 INI 파일 경로를 인자로 전달",
		checked: context.storage.get("pass_file", true),
		onChange: (checked) => context.storage.set("pass_file", checked)
	});
	const configCard = context.ui.createCard({
		title: "실행 환경 및 옵션",
		subtitle: "파이썬 인터프리터 및 커맨드라인 파라미터를 설정합니다.",
		content: [
			cmdSelect.row,
			argsInput.row,
			passFileCheck.row
		]
	});
	const codeEditor = context.ui.createCodeEditor({
		label: "실행할 Python 코드:",
		rows: isTab ? 10 : 6,
		value: context.storage.get("code", `# Migoto Studio Python Runner\nimport sys\n\nprint("Python 실행 환경이 정상 작동 중입니다!")\nif len(sys.argv) > 1:\n    print(f"인자 파일: {sys.argv[1]}")\n`),
		onInput: (code) => context.storage.set("code", code)
	});
	const consoleView = context.ui.createConsole({
		title: "실행 결과 (Console)",
		placeholder: "(실행 버튼을 누르면 여기에 출력이 표시됩니다)"
	});
	const runBtn = context.ui.createButton({
		text: "스크립트 실행",
		variant: "primary",
		async onClick() {
			runBtn.disabled = true;
			runBtn.textContent = "실행 중...";
			consoleView.set("프로세스 시작...\n");
			try {
				const code = codeEditor.getValue();
				const cmd = cmdSelect.getValue();
				const args = [
					"-c",
					code,
					...argsInput.getValue().trim().split(/\s+/).filter(Boolean)
				];
				if (passFileCheck.isChecked()) {
					const cur = context.workspace.getCurrentFile();
					if (cur?.path) args.push(cur.path);
				}
				const cwd = context.workspace.getCurrentFolder() || void 0;
				const res = await context.system.exec(cmd, args, cwd);
				consoleView.clear();
				if (res.stdout) consoleView.append(res.stdout);
				if (res.stderr) consoleView.append((res.stdout ? "\n" : "") + res.stderr);
				if (!res.stdout && !res.stderr) consoleView.set(`(출력 없음 - 종료 코드: ${res.exitCode})`);
				insertBtn.disabled = !res.stdout;
				if (res.exitCode === 0) context.ui.showToast("Python 실행 완료", "info");
				else context.ui.showToast(`실행 실패 (종료 코드 ${res.exitCode})`, "warn");
			} catch (err) {
				consoleView.append(`\n[오류] ${err}`);
				context.ui.showToast("실행 오류 발생", "error");
			} finally {
				runBtn.disabled = false;
				runBtn.textContent = "스크립트 실행";
			}
		}
	});
	const insertBtn = context.ui.createButton({
		text: "에디터에 결과 삽입",
		variant: "secondary",
		disabled: true,
		onClick() {
			const out = consoleView.output.textContent?.trim();
			if (out) {
				context.editor.insertText(out + "\n");
				context.ui.showToast("에디터에 결과가 삽입되었습니다.", "info");
			}
		}
	});
	const actionRow = context.ui.createButtonRow([runBtn, insertBtn]);
	const scriptCard = context.ui.createCard({
		title: "스크립트 작성 및 실행 결과",
		content: [
			codeEditor.container,
			actionRow,
			consoleView.container
		]
	});
	container.append(header, configCard, scriptCard);
}
//#endregion
export { plugin as default };

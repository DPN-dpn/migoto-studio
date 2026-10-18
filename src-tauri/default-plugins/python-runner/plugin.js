//#region default-plugins/python-runner/icon.ts
var iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.803v.825H3.904S0 5.79 0 11.907c0 6.12 3.4 5.925 3.4 5.925h2.031v-2.846s-.11-3.4 3.344-3.4h5.753s3.238.053 3.238-3.187V2.656S18.17 0 11.914 0zm-3.23 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.4 22.162c6.095 0 5.714-2.656 5.714-2.656l-.006-2.752H12v-.825h8.105s3.904.443 3.904-5.674c0-6.12-3.4-5.925-3.4-5.925h-2.031v2.846s.11 3.4-3.344 3.4H9.481s-3.238-.053-3.238 3.187v5.748s-.404 2.656 5.84 2.656zm3.23-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z"/></svg>`;
//#endregion
//#region default-plugins/python-runner/runner.ts
async function executePythonScript(context, options) {
	const extraArgs = options.extraArgsString.trim().split(/\s+/).filter(Boolean);
	let args = [];
	if (options.mode === "file") {
		const scriptPath = options.filePath.trim();
		if (!scriptPath) throw new Error("실행할 Python (.py) 파일 경로를 지정해주세요.");
		args = [scriptPath, ...extraArgs];
	} else args = [
		"-c",
		options.code,
		...extraArgs
	];
	if (options.passCurrentFile) {
		const cur = context.workspace.getCurrentFile();
		if (cur?.path) args.push(cur.path);
	}
	const cwd = context.workspace.getCurrentFolder() || void 0;
	return await context.system.exec(options.cmd, args, cwd, options.stdinText);
}
//#endregion
//#region default-plugins/python-runner/ui.ts
function buildPythonRunnerView(context, container) {
	const header = context.ui.createPanelHeader("Python 실행기");
	const pyBadge = context.ui.createBadge({
		text: "Python 3",
		variant: "accent"
	});
	header.append(pyBadge);
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
	let currentMode = context.storage.get("run_mode", "code");
	const modeSelect = context.ui.createSelect({
		label: "실행 방식:",
		options: [{
			label: "코드 직접 작성 (인라인)",
			value: "code"
		}, {
			label: "외부 Python 파일 (.py) 실행",
			value: "file"
		}],
		value: currentMode,
		onChange: (mode) => {
			currentMode = mode;
			context.storage.set("run_mode", mode);
			updateModeVisibility();
		}
	});
	const filePicker = context.ui.createFilePicker({
		label: "Python 파일 (.py) 경로:",
		placeholder: "예: C:/Scripts/my_tool.py 또는 ./script.py",
		value: context.storage.get("script_file", ""),
		filter: ".py",
		onChange: (p) => context.storage.set("script_file", p),
		onBrowse: async () => {
			return await context.workspace.pickFile({
				extensions: ["py"],
				title: "실행할 Python 스크립트 (.py) 선택"
			});
		}
	});
	const codeEditor = context.ui.createCodeEditor({
		label: "실행할 Python 코드:",
		rows: 6,
		value: context.storage.get("code", `# Migoto Studio Python Runner\nimport sys\n\nname = input("이름을 입력하세요: ") if sys.stdin.isatty() or not sys.stdin.closed else "사용자"\nprint(f"안녕하세요, {name}님!")\n`),
		onInput: (code) => context.storage.set("code", code)
	});
	const updateModeVisibility = () => {
		if (currentMode === "file") {
			filePicker.row.hidden = false;
			codeEditor.container.hidden = true;
		} else {
			filePicker.row.hidden = true;
			codeEditor.container.hidden = false;
		}
	};
	updateModeVisibility();
	const argsInput = context.ui.createInput({
		label: "추가 인자 (Arguments):",
		placeholder: "예: --verbose output.ini",
		value: context.storage.get("args", ""),
		onInput: (args) => context.storage.set("args", args)
	});
	const passFileCheck = context.ui.createCheckbox({
		id: "py-pass-file",
		label: "현재 열린 INI 파일 경로를 인자로 전달",
		checked: context.storage.get("pass_file", true),
		onChange: (checked) => context.storage.set("pass_file", checked)
	});
	const consoleView = context.ui.createConsole({
		title: "실행 결과 (Console)",
		placeholder: "(실행 버튼을 누르거나 아래에 입력을 넣고 전송하세요)",
		enableInput: true,
		inputPlaceholder: "표준 입력 (stdin) 입력 후 Enter 또는 전송...",
		onInputSubmit: (inputVal) => {
			if (!inputVal.trim() && !inputVal) return;
			consoleView.append(`\n> ${inputVal}\n`);
			consoleView.clearInput();
			executePython(inputVal + "\n");
		}
	});
	async function executePython(stdinText) {
		runBtn.disabled = true;
		runBtn.textContent = "실행 중...";
		if (currentMode === "file" && !filePicker.getValue().trim()) {
			context.ui.showToast("실행할 Python (.py) 파일 경로를 지정해주세요.", "warn");
			runBtn.disabled = false;
			runBtn.textContent = "스크립트 실행";
			return;
		}
		if (stdinText === void 0) consoleView.set("프로세스 시작...\n");
		try {
			const res = await executePythonScript(context, {
				cmd: cmdSelect.getValue(),
				mode: currentMode,
				code: codeEditor.getValue(),
				filePath: filePicker.getValue(),
				extraArgsString: argsInput.getValue(),
				passCurrentFile: passFileCheck.isChecked(),
				stdinText
			});
			if (stdinText === void 0) consoleView.clear();
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
	const runBtn = context.ui.createButton({
		text: "스크립트 실행",
		variant: "primary",
		async onClick() {
			const pendingInput = consoleView.getInputValue();
			const stdin = pendingInput ? pendingInput + "\n" : void 0;
			if (pendingInput) consoleView.clearInput();
			await executePython(stdin);
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
	container.append(header, cmdSelect.row, modeSelect.row, filePicker.row, codeEditor.container, argsInput.row, passFileCheck.row, actionRow, consoleView.container);
}
//#endregion
//#region default-plugins/python-runner/index.ts
/**
* Python 스크립트 실행기 플러그인
* 파이썬 코드를 직접 입력하거나 외부 .py 파일을 불러와 실행하고,
* 표준 출력 결과 확인 및 사용자 입력(stdin) 전달, 에디터 본문 삽입을 지원합니다.
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
				buildPythonRunnerView(context, container);
			}
		});
	},
	deactivate() {}
};
//#endregion
export { buildPythonRunnerView, plugin as default, executePythonScript };

import { executePythonScript } from "./runner.js";
//#region default-plugins/python-runner/ui.ts
function buildPythonRunnerView(context, container) {
	const header = context.ui.createPanelHeader("Python 실행기");
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
		if (stdinText === void 0) {
			consoleView.set("프로세스 시작...\n");
			context.logger?.info(`Python 실행 시작: ${cmdSelect.getValue()} (모드: ${currentMode})`);
		}
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
			if (res.exitCode === 0) {
				context.ui.showToast("Python 실행 완료", "info");
				context.logger?.info(`Python 실행 성공 (종료 코드: ${res.exitCode})`);
			} else {
				context.ui.showToast(`실행 실패 (종료 코드 ${res.exitCode})`, "warn");
				context.logger?.warn(`Python 실행 비정상 종료 (코드 ${res.exitCode})`, res.stderr);
			}
		} catch (err) {
			consoleView.append(`\n[오류] ${err}`);
			context.ui.showToast("실행 오류 발생", "error");
			context.logger?.error("Python 실행 예외 발생:", err);
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
export { buildPythonRunnerView };

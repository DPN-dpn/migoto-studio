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
export { executePythonScript };

import type { PluginContext } from '../../src/plugins/types.ts';

export interface SystemExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface PythonRunOptions {
  cmd: string;
  mode: 'code' | 'file';
  code: string;
  filePath: string;
  extraArgsString: string;
  passCurrentFile: boolean;
  stdinText?: string;
}

export async function executePythonScript(
  context: PluginContext,
  options: PythonRunOptions,
): Promise<SystemExecResult> {
  const extraArgs = options.extraArgsString.trim().split(/\s+/).filter(Boolean);
  let args: string[] = [];

  if (options.mode === 'file') {
    const scriptPath = options.filePath.trim();
    if (!scriptPath) {
      throw new Error('실행할 Python (.py) 파일 경로를 지정해주세요.');
    }
    args = [scriptPath, ...extraArgs];
  } else {
    args = ['-c', options.code, ...extraArgs];
  }

  if (options.passCurrentFile) {
    const cur = context.workspace.getCurrentFile();
    if (cur?.path) {
      args.push(cur.path);
    }
  }

  const cwd = context.workspace.getCurrentFolder() || undefined;
  return await context.system.exec(options.cmd, args, cwd, options.stdinText);
}

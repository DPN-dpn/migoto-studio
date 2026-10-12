import type { MigotoPlugin, PluginContext } from '../../types.ts';

/**
 * Python 스크립트 실행기 플러그인
 * 파이썬 코드를 에디터 내에서 실행하고 표준 출력 결과를 확인하거나 에디터에 삽입할 수 있습니다.
 */
const pythonRunnerPlugin: MigotoPlugin = {
  activate(context: PluginContext) {
    context.ui.registerSidebarView({
      id: 'python-runner',
      title: 'Python 실행기',
      icon: 'PY',
      render(container) {
        container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview python-runner-panel';
        container.replaceChildren();

        // Header
        const header = document.createElement('div');
        header.className = 'panel-section-title';
        header.innerHTML = '<span>Python 실행기</span>';

        // Exec Command Row
        const cmdRow = document.createElement('div');
        cmdRow.className = 'form-row';
        const cmdLabel = document.createElement('label');
        cmdLabel.textContent = '실행 명령:';
        const cmdSelect = document.createElement('select');
        cmdSelect.className = 'plugin-select';
        ['python', 'py', 'python3'].forEach((cmd) => {
          const opt = document.createElement('option');
          opt.value = cmd;
          opt.textContent = cmd;
          cmdSelect.append(opt);
        });
        const savedCmd = context.storage.get('cmd', 'python');
        cmdSelect.value = savedCmd;
        cmdSelect.onchange = () => context.storage.set('cmd', cmdSelect.value);
        cmdRow.append(cmdLabel, cmdSelect);

        // Arguments Input
        const argsRow = document.createElement('div');
        argsRow.className = 'form-row';
        const argsLabel = document.createElement('label');
        argsLabel.textContent = '추가 인자:';
        const argsInput = document.createElement('input');
        argsInput.className = 'plugin-input';
        argsInput.placeholder = '예: --verbose output.ini';
        argsInput.value = context.storage.get('args', '');
        argsInput.oninput = () => context.storage.set('args', argsInput.value);
        argsRow.append(argsLabel, argsInput);

        // Pass current file checkbox
        const optRow = document.createElement('div');
        optRow.className = 'form-check-row';
        const passFileCheck = document.createElement('input');
        passFileCheck.type = 'checkbox';
        passFileCheck.id = 'py-pass-file';
        passFileCheck.checked = context.storage.get('pass_file', true);
        passFileCheck.onchange = () => context.storage.set('pass_file', passFileCheck.checked);
        const passFileLabel = document.createElement('label');
        passFileLabel.htmlFor = 'py-pass-file';
        passFileLabel.textContent = '현재 열린 INI 파일 경로를 인자로 전달';
        optRow.append(passFileCheck, passFileLabel);

        // Python script editor textarea
        const codeHeader = document.createElement('div');
        codeHeader.className = 'code-header-row';
        codeHeader.textContent = '실행할 Python 코드:';

        const codeTextarea = document.createElement('textarea');
        codeTextarea.className = 'plugin-code-editor';
        codeTextarea.spellcheck = false;
        codeTextarea.value = context.storage.get(
          'code',
          `# Migoto Studio Python Runner
import sys

print("Python 실행 환경이 정상 작동 중입니다!")
if len(sys.argv) > 1:
    print(f"인자 파일: {sys.argv[1]}")
`,
        );
        codeTextarea.oninput = () => context.storage.set('code', codeTextarea.value);

        // Output console area
        const consoleHeader = document.createElement('div');
        consoleHeader.className = 'console-header-row';
        consoleHeader.innerHTML = '<span>실행 결과 (Console)</span>';

        const clearBtn = document.createElement('button');
        clearBtn.className = 'small-btn';
        clearBtn.textContent = '지우기';

        const consoleOutput = document.createElement('pre');
        consoleOutput.className = 'plugin-console-output';
        consoleOutput.textContent = '(실행 버튼을 누르면 여기에 출력이 표시됩니다)';

        clearBtn.onclick = () => {
          consoleOutput.textContent = '';
        };
        consoleHeader.append(clearBtn);

        // Action Buttons Row
        const btnRow = document.createElement('div');
        btnRow.className = 'plugin-actions-row';

        const runBtn = document.createElement('button');
        runBtn.className = 'primary run-btn';
        runBtn.textContent = '스크립트 실행';

        const insertBtn = document.createElement('button');
        insertBtn.className = 'secondary';
        insertBtn.textContent = '에디터에 결과 삽입';
        insertBtn.disabled = true;

        runBtn.onclick = async () => {
          runBtn.disabled = true;
          runBtn.textContent = '실행 중...';
          consoleOutput.textContent = '프로세스 시작...\n';
          try {
            const code = codeTextarea.value;
            const cmd = cmdSelect.value;
            const extraArgs = argsInput.value.trim().split(/\s+/).filter(Boolean);

            const args = ['-c', code, ...extraArgs];
            if (passFileCheck.checked) {
              const cur = context.workspace.getCurrentFile();
              if (cur?.path) args.push(cur.path);
            }

            const cwd = context.workspace.getCurrentFolder() || undefined;
            const res = await context.system.exec(cmd, args, cwd);

            consoleOutput.textContent = '';
            if (res.stdout) consoleOutput.textContent += res.stdout;
            if (res.stderr) consoleOutput.textContent += (res.stdout ? '\n' : '') + res.stderr;
            if (!res.stdout && !res.stderr) {
              consoleOutput.textContent = `(출력 없음 - 종료 코드: ${res.exitCode})`;
            }

            insertBtn.disabled = !res.stdout;
            if (res.exitCode === 0) {
              context.ui.showToast('Python 실행 완료', 'info');
            } else {
              context.ui.showToast(`실행 실패 (종료 코드 ${res.exitCode})`, 'warn');
            }
          } catch (err) {
            consoleOutput.textContent += `\n[오류] ${err}`;
            context.ui.showToast('실행 오류 발생', 'error');
          } finally {
            runBtn.disabled = false;
            runBtn.textContent = '스크립트 실행';
          }
        };

        insertBtn.onclick = () => {
          const out = consoleOutput.textContent?.trim();
          if (out) {
            context.editor.insertText(out + '\n');
            context.ui.showToast('에디터에 결과가 삽입되었습니다.', 'info');
          }
        };

        btnRow.append(runBtn, insertBtn);

        container.append(
          header,
          cmdRow,
          argsRow,
          optRow,
          codeHeader,
          codeTextarea,
          btnRow,
          consoleHeader,
          consoleOutput,
        );
      },
    });
  },
  deactivate() {},
};

export default pythonRunnerPlugin;
export { pythonRunnerPlugin };

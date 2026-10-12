import { definePlugin, type PluginContext } from '../../api.ts';
import iconSvg from './icon.ts';

/**
 * Python 스크립트 실행기 플러그인
 * 파이썬 코드를 에디터 내에서 실행하고 표준 출력 결과를 확인하거나 에디터에 삽입할 수 있습니다.
 */
export default definePlugin({
  activate(context: PluginContext) {
    context.ui.registerSidebarView({
      id: 'python-runner',
      title: 'Python 실행기',
      icon: iconSvg,
      render(container) {
        container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview python-runner-panel';
        container.replaceChildren();

        // 1. 헤더 생성
        const header = context.ui.createPanelHeader('Python 실행기');

        // 2. 실행 인터프리터 선택 드롭다운 API
        const cmdSelect = context.ui.createSelect({
          label: '실행 명령:',
          options: ['python', 'py', 'python3'],
          value: context.storage.get('cmd', 'python'),
          onChange: (cmd) => context.storage.set('cmd', cmd),
        });

        // 3. 추가 인자 입력 폼 API
        const argsInput = context.ui.createInput({
          label: '추가 인자:',
          placeholder: '예: --verbose output.ini',
          value: context.storage.get('args', ''),
          onInput: (args) => context.storage.set('args', args),
        });

        // 4. 활성 파일 경로 인자 전달 체크박스 API
        const passFileCheck = context.ui.createCheckbox({
          id: 'py-pass-file',
          label: '현재 열린 INI 파일 경로를 인자로 전달',
          checked: context.storage.get('pass_file', true),
          onChange: (checked) => context.storage.set('pass_file', checked),
        });

        // 5. 코드 에디터 입력 영역 API
        const codeEditor = context.ui.createCodeEditor({
          label: '실행할 Python 코드:',
          value: context.storage.get(
            'code',
            `# Migoto Studio Python Runner\nimport sys\n\nprint("Python 실행 환경이 정상 작동 중입니다!")\nif len(sys.argv) > 1:\n    print(f"인자 파일: {sys.argv[1]}")\n`,
          ),
          onInput: (code) => context.storage.set('code', code),
        });

        // 6. 실행 결과 콘솔 출력창 API
        const consoleView = context.ui.createConsole({
          title: '실행 결과 (Console)',
          placeholder: '(실행 버튼을 누르면 여기에 출력이 표시됩니다)',
        });

        // 7. 액션 버튼 API
        const runBtn = context.ui.createButton({
          text: '스크립트 실행',
          variant: 'primary',
          async onClick() {
            runBtn.disabled = true;
            runBtn.textContent = '실행 중...';
            consoleView.set('프로세스 시작...\n');
            try {
              const code = codeEditor.getValue();
              const cmd = cmdSelect.getValue();
              const extraArgs = argsInput.getValue().trim().split(/\s+/).filter(Boolean);

              const args = ['-c', code, ...extraArgs];
              if (passFileCheck.isChecked()) {
                const cur = context.workspace.getCurrentFile();
                if (cur?.path) args.push(cur.path);
              }

              const cwd = context.workspace.getCurrentFolder() || undefined;
              const res = await context.system.exec(cmd, args, cwd);

              consoleView.clear();
              if (res.stdout) consoleView.append(res.stdout);
              if (res.stderr) consoleView.append((res.stdout ? '\n' : '') + res.stderr);
              if (!res.stdout && !res.stderr) {
                consoleView.set(`(출력 없음 - 종료 코드: ${res.exitCode})`);
              }

              insertBtn.disabled = !res.stdout;
              if (res.exitCode === 0) {
                context.ui.showToast('Python 실행 완료', 'info');
              } else {
                context.ui.showToast(`실행 실패 (종료 코드 ${res.exitCode})`, 'warn');
              }
            } catch (err) {
              consoleView.append(`\n[오류] ${err}`);
              context.ui.showToast('실행 오류 발생', 'error');
            } finally {
              runBtn.disabled = false;
              runBtn.textContent = '스크립트 실행';
            }
          },
        });

        const insertBtn = context.ui.createButton({
          text: '에디터에 결과 삽입',
          variant: 'secondary',
          disabled: true,
          onClick() {
            const out = consoleView.output.textContent?.trim();
            if (out) {
              context.editor.insertText(out + '\n');
              context.ui.showToast('에디터에 결과가 삽입되었습니다.', 'info');
            }
          },
        });

        const actionRow = context.ui.createButtonRow([runBtn, insertBtn]);

        container.append(
          header,
          cmdSelect.row,
          argsInput.row,
          passFileCheck.row,
          codeEditor.container,
          actionRow,
          consoleView.container,
        );
      },
    });
  },
  deactivate() {},
});

import type { PluginContext, MigotoPlugin } from '../../src/plugins/types.ts';
import iconSvg from './icon.ts';

/**
 * Python 스크립트 실행기 플러그인
 * 파이썬 코드를 직접 입력하거나 외부 .py 파일을 불러와 실행하고,
 * 표준 출력 결과 확인 및 사용자 입력(stdin) 전달, 에디터 본문 삽입을 지원합니다.
 */
const plugin: MigotoPlugin = {
  activate(context: PluginContext) {
    // 좌측 사이드바 뷰 등록
    context.ui.registerSidebarView({
      id: 'python-runner',
      title: 'Python 실행기',
      icon: iconSvg,
      render(container) {
        container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview python-runner-panel';
        container.replaceChildren();
        buildPythonRunnerView(context, container);
      },
    });
  },
  deactivate() {},
};

export default plugin;

function buildPythonRunnerView(context: PluginContext, container: HTMLElement) {
  // 1. 헤더 생성
  const header = context.ui.createPanelHeader('Python 실행기');

  // 2. 실행 인터프리터 선택 드롭다운 API
  const cmdSelect = context.ui.createSelect({
    label: '실행 명령:',
    options: ['python', 'py', 'python3'],
    value: context.storage.get('cmd', 'python'),
    onChange: (cmd) => context.storage.set('cmd', cmd),
  });

  // 3. 실행 대상 모드 (인라인 코드 vs 외부 .py 파일)
  let currentMode = context.storage.get('run_mode', 'code'); // 'code' | 'file'
  const modeSelect = context.ui.createSelect({
    label: '실행 방식:',
    options: [
      { label: '코드 직접 작성 (인라인)', value: 'code' },
      { label: '외부 Python 파일 (.py) 실행', value: 'file' },
    ],
    value: currentMode,
    onChange: (mode) => {
      currentMode = mode;
      context.storage.set('run_mode', mode);
      updateModeVisibility();
    },
  });

  // 4. 외부 .py 파일 선택 영역
  const filePathInput = context.ui.createInput({
    label: 'Python 파일 (.py) 경로:',
    placeholder: '예: C:/Scripts/my_tool.py 또는 ./script.py',
    value: context.storage.get('script_file', ''),
    onInput: (p) => context.storage.set('script_file', p),
  });

  const pickFileBtn = context.ui.createButton({
    text: '파일 선택…',
    variant: 'secondary',
    async onClick() {
      const picked = await context.workspace.pickFile({
        extensions: ['py'],
        title: '실행할 Python 스크립트 (.py) 선택',
      });
      if (picked) {
        filePathInput.setValue(picked);
        context.storage.set('script_file', picked);
      }
    },
  });

  const fileBox = document.createElement('div');
  fileBox.className = 'plugin-field-group';
  const fileBtnRow = document.createElement('div');
  fileBtnRow.style.cssText = 'display: flex; gap: 6px; margin-top: 4px;';
  fileBtnRow.append(pickFileBtn);
  fileBox.append(filePathInput.row, fileBtnRow);

  // 5. 코드 에디터 입력 영역 API
  const codeEditor = context.ui.createCodeEditor({
    label: '실행할 Python 코드:',
    rows: 6,
    value: context.storage.get(
      'code',
      `# Migoto Studio Python Runner\nimport sys\n\nname = input("이름을 입력하세요: ") if sys.stdin.isatty() or not sys.stdin.closed else "사용자"\nprint(f"안녕하세요, {name}님!")\n`,
    ),
    onInput: (code) => context.storage.set('code', code),
  });

  const updateModeVisibility = () => {
    if (currentMode === 'file') {
      fileBox.hidden = false;
      codeEditor.container.hidden = true;
    } else {
      fileBox.hidden = true;
      codeEditor.container.hidden = false;
    }
  };
  updateModeVisibility();

  // 6. 추가 인자 입력 폼 API
  const argsInput = context.ui.createInput({
    label: '추가 인자 (Arguments):',
    placeholder: '예: --verbose output.ini',
    value: context.storage.get('args', ''),
    onInput: (args) => context.storage.set('args', args),
  });

  // 7. 활성 파일 경로 인자 전달 체크박스 API
  const passFileCheck = context.ui.createCheckbox({
    id: 'py-pass-file',
    label: '현재 열린 INI 파일 경로를 인자로 전달',
    checked: context.storage.get('pass_file', true),
    onChange: (checked) => context.storage.set('pass_file', checked),
  });

  // 8. 실행 결과 콘솔 출력창 (표준 입력 input 필드 포함)
  const consoleView = context.ui.createConsole({
    title: '실행 결과 (Console)',
    placeholder: '(실행 버튼을 누르거나 아래에 입력을 넣고 전송하세요)',
    enableInput: true,
    inputPlaceholder: '표준 입력 (stdin) 입력 후 Enter 또는 전송...',
    onInputSubmit: (inputVal) => {
      const trimmed = inputVal.trim();
      if (!trimmed && !inputVal) return;
      consoleView.append(`\n> ${inputVal}\n`);
      consoleView.clearInput();
      executePython(inputVal + '\n');
    },
  });

  // 9. 실행 함수
  async function executePython(stdinText?: string) {
    runBtn.disabled = true;
    runBtn.textContent = '실행 중...';

    const cmd = cmdSelect.getValue();
    const extraArgs = argsInput.getValue().trim().split(/\s+/).filter(Boolean);
    let args: string[] = [];

    if (currentMode === 'file') {
      const scriptPath = filePathInput.getValue().trim();
      if (!scriptPath) {
        context.ui.showToast('실행할 Python (.py) 파일 경로를 지정해주세요.', 'warn');
        runBtn.disabled = false;
        runBtn.textContent = '스크립트 실행';
        return;
      }
      args = [scriptPath, ...extraArgs];
    } else {
      const code = codeEditor.getValue();
      args = ['-c', code, ...extraArgs];
    }

    if (passFileCheck.isChecked()) {
      const cur = context.workspace.getCurrentFile();
      if (cur?.path) args.push(cur.path);
    }

    if (stdinText === undefined) {
      consoleView.set('프로세스 시작...\n');
    }

    try {
      const cwd = context.workspace.getCurrentFolder() || undefined;
      const res = await context.system.exec(cmd, args, cwd, stdinText);

      if (stdinText === undefined) {
        consoleView.clear();
      }
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
  }

  // 10. 액션 버튼 API
  const runBtn = context.ui.createButton({
    text: '스크립트 실행',
    variant: 'primary',
    async onClick() {
      const pendingInput = consoleView.getInputValue();
      const stdin = pendingInput ? pendingInput + '\n' : undefined;
      if (pendingInput) {
        consoleView.clearInput();
      }
      await executePython(stdin);
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
    modeSelect.row,
    fileBox,
    codeEditor.container,
    argsInput.row,
    passFileCheck.row,
    actionRow,
    consoleView.container,
  );
}

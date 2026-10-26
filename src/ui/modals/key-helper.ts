import { openModal } from './modal.ts';
import type { monaco } from '../../core/editor/monaco.ts';
import {
  CODE_TO_VK,
  VK_KEY_LIST,
  formatKeyBinding,
  parseKeyBinding,
  parseKeyBindingLine,
  type ModifierState,
  type VkKeyItem,
} from '../../core/ini/keys.ts';
import { showToast } from '../common/toast.ts';

export interface KeyHelperModalOptions {
  /** 모달 다이얼로그 타이틀 (기본값: '3DMigoto 키 입력 도우미') */
  title?: string;
  /** 초기 단축키 문자열 (예: 'ctrl no_alt VK_F1', 'VK_F4', 'key = VK_SPACE') */
  initialKey?: string;
  /** 특정 에디터 라인 번호 대상 편집 시 지정 */
  targetLineNumber?: number;
  /** 대상 Monaco 에디터 인스턴스 (생략 시 에디터 삽입 없이 반환값으로만 사용 가능) */
  editor?: monaco.editor.ICodeEditor | null;
  /** 적용 버튼 레이블 (기본값: 에디터 존재 시 '에디터에 적용/삽입', 그 외 '확인') */
  applyLabel?: string;
  /** 키 선택 및 적용 완료 시 콜백 */
  onApply?: (keyBinding: string) => void;
}

/**
 * Opens the interactive Key Helper Modal dialog.
 * Can be called with a Monaco editor instance, or with KeyHelperModalOptions.
 * Returns a Promise that resolves with the selected 3DMigoto keyBinding string (e.g. 'ctrl no_alt VK_F1')
 * or null if cancelled.
 */
export function openKeyHelperModal(
  editorOrOptions?: monaco.editor.ICodeEditor | KeyHelperModalOptions,
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val: string | null) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    const isEditor =
      editorOrOptions &&
      typeof (editorOrOptions as any).getPosition === 'function' &&
      typeof (editorOrOptions as any).getModel === 'function';

    const options: KeyHelperModalOptions = isEditor
      ? { editor: editorOrOptions as monaco.editor.ICodeEditor }
      : (editorOrOptions as KeyHelperModalOptions) || {};

    const editor = options.editor ?? null;
    const body = document.createElement('div');
    body.className = 'key-helper-modal-body';

    let currentVk = 'VK_F1';
    let ctrlState: ModifierState = 'none';
    let altState: ModifierState = 'none';
    let shiftState: ModifierState = 'none';
    let winState: ModifierState = 'none';
    let currentFriendlyName = 'F1';

    let targetLineNumber: number | null = options.targetLineNumber ?? null;
    let linePrefix = 'key = ';

    if (options.initialKey) {
      const parsed = parseKeyBinding(options.initialKey);
      currentVk = parsed.vk;
      ctrlState = parsed.ctrl;
      altState = parsed.alt;
      shiftState = parsed.shift;
      winState = parsed.win;
      const found = VK_KEY_LIST.find((k) => k.vk === currentVk);
      if (found) currentFriendlyName = found.label;
    } else if (editor) {
      // Check if cursor/context is on an existing 'key = ...' line
      const pos = editor.getPosition();
      const model = editor.getModel();
      if (pos && model) {
        const curLine = model.getLineContent(pos.lineNumber);
        const parsed = parseKeyBindingLine(curLine);
        if (parsed) {
          targetLineNumber = pos.lineNumber;
          linePrefix = parsed.prefix;
          currentVk = parsed.vk;
          ctrlState = parsed.ctrl;
          altState = parsed.alt;
          shiftState = parsed.shift;
          winState = parsed.win;
          const found = VK_KEY_LIST.find((k) => k.vk === currentVk);
          if (found) currentFriendlyName = found.label;
        }
      }
    }

    let closeFn: (() => void) | null = null;

    // 1. Live Key Capture Area
    const captureSection = document.createElement('div');
    captureSection.className = 'key-capture-section';

    const captureTitleRow = document.createElement('div');
    captureTitleRow.className = 'key-section-title-row';

    const captureTitle = document.createElement('div');
    captureTitle.className = 'key-section-title';
    captureTitle.textContent = '실시간 키보드 입력 감지';

    if (targetLineNumber) {
      const lineBadge = document.createElement('span');
      lineBadge.className = 'key-line-badge';
      lineBadge.textContent = `${targetLineNumber}번 줄 구문 편집 중`;
      captureTitleRow.append(captureTitle, lineBadge);
    } else if (options.initialKey) {
      const valBadge = document.createElement('span');
      valBadge.className = 'key-line-badge';
      valBadge.textContent = `현재 설정: ${options.initialKey.replace(/^\s*key\s*=\s*/i, '')}`;
      captureTitleRow.append(captureTitle, valBadge);
    } else {
      captureTitleRow.append(captureTitle);
    }

    const captureBox = document.createElement('div');
    captureBox.className = 'key-capture-box';
    captureBox.tabIndex = 0;

    const capturePrompt = document.createElement('div');
    capturePrompt.className = 'key-capture-prompt';
    capturePrompt.textContent = '여기를 클릭한 후 키보드를 누르면 즉시 감지됩니다 (예: F1, Ctrl+1, Space 등)';

    const capturedDisplay = document.createElement('div');
    capturedDisplay.className = 'key-captured-display';

    captureBox.append(capturePrompt, capturedDisplay);
    captureSection.append(captureTitleRow, captureBox);

    // 2. Modifiers Section with Positive & Negative Conditions
    const modSection = document.createElement('div');
    modSection.className = 'key-mod-section';

    const modHeader = document.createElement('div');
    modHeader.className = 'key-mod-header';

    const modTitle = document.createElement('div');
    modTitle.className = 'key-section-title';
    modTitle.textContent = '수식키 조건 설정';

    const resetModsBtn = document.createElement('button');
    resetModsBtn.className = 'small-btn key-clear-btn';
    resetModsBtn.textContent = '수식키 초기화';
    resetModsBtn.onclick = () => {
      ctrlState = 'none';
      altState = 'none';
      shiftState = 'none';
      winState = 'none';
      updateDisplay();
      updateSegmentButtons();
    };

    modHeader.append(modTitle, resetModsBtn);

    const modGrid = document.createElement('div');
    modGrid.className = 'key-mod-grid';

    interface ModConfig {
      name: string;
      get: () => ModifierState;
      set: (s: ModifierState) => void;
      requireLabel: string;
      excludeLabel: string;
    }

    const modConfigs: ModConfig[] = [
      {
        name: 'Ctrl',
        get: () => ctrlState,
        set: (s) => { ctrlState = s; },
        requireLabel: '긍정',
        excludeLabel: '부정',
      },
      {
        name: 'Alt',
        get: () => altState,
        set: (s) => { altState = s; },
        requireLabel: '긍정',
        excludeLabel: '부정',
      },
      {
        name: 'Shift',
        get: () => shiftState,
        set: (s) => { shiftState = s; },
        requireLabel: '긍정',
        excludeLabel: '부정',
      },
      {
        name: 'Win',
        get: () => winState,
        set: (s) => { winState = s; },
        requireLabel: '긍정',
        excludeLabel: '부정',
      },
    ];

    const updateSegmentButtonsCallbacks: (() => void)[] = [];

    modConfigs.forEach((cfg) => {
      const itemRow = document.createElement('div');
      itemRow.className = 'key-mod-item';

      const itemLabel = document.createElement('span');
      itemLabel.className = 'key-mod-item-name';
      itemLabel.textContent = cfg.name;

      const segGroup = document.createElement('div');
      segGroup.className = 'key-seg-group';

      const btnNone = document.createElement('button');
      btnNone.type = 'button';
      btnNone.className = 'key-seg-btn';
      btnNone.textContent = '무관';

      const btnRequire = document.createElement('button');
      btnRequire.type = 'button';
      btnRequire.className = 'key-seg-btn seg-require';
      btnRequire.textContent = cfg.requireLabel;

      const btnExclude = document.createElement('button');
      btnExclude.type = 'button';
      btnExclude.className = 'key-seg-btn seg-exclude';
      btnExclude.textContent = cfg.excludeLabel;

      const updateBtns = () => {
        const cur = cfg.get();
        btnNone.classList.toggle('is-selected', cur === 'none');
        btnRequire.classList.toggle('is-selected', cur === 'require');
        btnExclude.classList.toggle('is-selected', cur === 'exclude');
      };

      btnNone.onclick = () => {
        cfg.set('none');
        updateBtns();
        updateDisplay();
      };

      btnRequire.onclick = () => {
        cfg.set('require');
        updateBtns();
        updateDisplay();
      };

      btnExclude.onclick = () => {
        cfg.set('exclude');
        updateBtns();
        updateDisplay();
      };

      updateBtns();
      updateSegmentButtonsCallbacks.push(updateBtns);

      segGroup.append(btnNone, btnRequire, btnExclude);
      itemRow.append(itemLabel, segGroup);
      modGrid.append(itemRow);
    });

    const updateSegmentButtons = () => {
      updateSegmentButtonsCallbacks.forEach((fn) => fn());
    };

    modSection.append(modHeader, modGrid);

    // 3. Virtual Keys Selector (Manual Search / Browsing)
    const listSection = document.createElement('div');
    listSection.className = 'key-list-section';

    const listHeader = document.createElement('div');
    listHeader.className = 'key-list-header';

    const listTitle = document.createElement('div');
    listTitle.className = 'key-section-title';
    listTitle.textContent = '가상 키(VK) 목록 및 검색';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'plugin-search-input key-search-input';
    searchInput.placeholder = '가상 키 검색 (예: F1, Space, Numpad, Mouse)…';

    listHeader.append(listTitle, searchInput);

    const keysContainer = document.createElement('div');
    keysContainer.className = 'key-items-grid';

    const renderKeyItems = (query = '') => {
      keysContainer.replaceChildren();
      const q = query.trim().toLowerCase();
      const filtered = VK_KEY_LIST.filter(
        (k) =>
          !q ||
          k.vk.toLowerCase().includes(q) ||
          k.label.toLowerCase().includes(q) ||
          k.category.toLowerCase().includes(q),
      );

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'plugin-empty-hint';
        empty.textContent = '검색된 가상 키가 없습니다.';
        keysContainer.append(empty);
        return;
      }

      filtered.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `key-item-btn${item.vk === currentVk ? ' is-selected' : ''}`;
        btn.title = item.description || `${item.label} (${item.vk})`;
        btn.innerHTML = `<span class="key-item-label">${item.label}</span><span class="key-item-vk">${item.vk}</span>`;
        btn.onclick = () => {
          currentVk = item.vk;
          currentFriendlyName = item.label;
          updateDisplay();
          renderKeyItems(searchInput.value);
        };
        keysContainer.append(btn);
      });
    };

    searchInput.oninput = () => renderKeyItems(searchInput.value);
    renderKeyItems();

    listSection.append(listHeader, keysContainer);

    // 4. Preview Bar
    const previewSection = document.createElement('div');
    previewSection.className = 'key-preview-section';

    const previewTitle = document.createElement('div');
    previewTitle.className = 'key-section-title';
    previewTitle.textContent = '최종 구문 미리보기';

    const codePreview = document.createElement('div');
    codePreview.className = 'key-code-preview';

    previewSection.append(previewTitle, codePreview);

    // 5. Update Display Function
    const updateDisplay = () => {
      const keyString = formatKeyBinding({
        vk: currentVk,
        ctrl: ctrlState,
        alt: altState,
        shift: shiftState,
        win: winState,
      });

      const comboParts: string[] = [];
      if (ctrlState === 'require') comboParts.push('Ctrl');
      else if (ctrlState === 'exclude') comboParts.push('(no_ctrl)');

      if (altState === 'require') comboParts.push('Alt');
      else if (altState === 'exclude') comboParts.push('(no_alt)');

      if (shiftState === 'require') comboParts.push('Shift');
      else if (shiftState === 'exclude') comboParts.push('(no_shift)');

      if (winState === 'require') comboParts.push('Win');
      else if (winState === 'exclude') comboParts.push('(no_windows)');

      comboParts.push(currentFriendlyName);
      const friendlyCombo = comboParts.join(' + ');

      capturedDisplay.innerHTML = `
      <div class="key-display-row">
        <span class="key-display-tag">조합:</span>
        <strong class="key-display-combo">${friendlyCombo}</strong>
      </div>
      <div class="key-display-row">
        <span class="key-display-tag">3DMigoto 값:</span>
        <code class="key-display-code">${keyString}</code>
      </div>
    `;

      codePreview.textContent = `${linePrefix}${keyString}`;
    };

    // Keyboard capture event
    captureBox.onfocus = () => {
      captureBox.classList.add('is-active');
      capturePrompt.textContent = '키보드를 누르면 즉시 감지됩니다.';
    };

    captureBox.onblur = () => {
      captureBox.classList.remove('is-active');
      capturePrompt.textContent = '여기를 클릭한 후 키보드를 누르면 즉시 감지됩니다 (예: F1, Ctrl+1, Space 등)';
    };

    captureBox.onkeydown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Map physical modifiers
      ctrlState = e.ctrlKey ? 'require' : 'none';
      altState = e.altKey ? 'require' : 'none';
      shiftState = e.shiftKey ? 'require' : 'none';
      winState = e.metaKey ? 'require' : 'none';

      updateSegmentButtons();

      // If only modifier was pressed, update display and return
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        updateDisplay();
        return;
      }

      // Resolve VK code from event
      const vk = CODE_TO_VK[e.code];
      if (vk) {
        currentVk = vk;
        const item = VK_KEY_LIST.find((k) => k.vk === vk);
        currentFriendlyName = item ? item.label : e.key.toUpperCase();
        renderKeyItems(searchInput.value);
      } else if (e.key && e.key.length === 1) {
        const upper = e.key.toUpperCase();
        currentVk = `VK_${upper}`;
        currentFriendlyName = upper;
      }

      updateDisplay();
    };

    updateDisplay();

    // 6. Action Buttons Bar
    const actionsBar = document.createElement('div');
    actionsBar.className = 'key-modal-actions';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'primary key-action-btn';
    applyBtn.textContent =
      options.applyLabel ||
      (targetLineNumber ? '에디터에 적용' : (editor ? '에디터에 삽입' : '확인'));

    applyBtn.onclick = () => {
      const keyString = formatKeyBinding({
        vk: currentVk,
        ctrl: ctrlState,
        alt: altState,
        shift: shiftState,
        win: winState,
      });

      if (options.onApply) {
        options.onApply(keyString);
      }

      if (editor) {
        const model = editor.getModel();
        if (targetLineNumber !== null && model) {
          // Replace only the target line's value
          const lineRange = {
            startLineNumber: targetLineNumber,
            startColumn: 1,
            endLineNumber: targetLineNumber,
            endColumn: model.getLineMaxColumn(targetLineNumber),
          };
          editor.pushUndoStop();
          editor.executeEdits('key-helper', [{ range: lineRange, text: `${linePrefix}${keyString}` }]);
          editor.pushUndoStop();
          editor.focus();
          showToast(`'${linePrefix}${keyString}' 적용 완료`, 'info');
        } else {
          // Insert at cursor / selection
          const selection = editor.getSelection();
          const position = editor.getPosition();
          const range = selection && !selection.isEmpty()
            ? selection
            : {
              startLineNumber: position?.lineNumber || 1,
              startColumn: position?.column || 1,
              endLineNumber: position?.lineNumber || 1,
              endColumn: position?.column || 1,
            };

          const snippet = `key = ${keyString}`;
          editor.pushUndoStop();
          editor.executeEdits('key-helper', [{ range, text: snippet }]);
          editor.pushUndoStop();
          editor.focus();
          showToast(`'${snippet}' 삽입 완료`, 'info');
        }
      } else if (!options.onApply) {
        showToast(`'${keyString}' 설정 완료`, 'info');
      }

      safeResolve(keyString);
      closeFn?.();
    };

    const copyBtn = document.createElement('button');
    copyBtn.className = 'secondary key-action-btn';
    copyBtn.textContent = '값만 복사';
    copyBtn.onclick = async () => {
      const keyString = formatKeyBinding({
        vk: currentVk,
        ctrl: ctrlState,
        alt: altState,
        shift: shiftState,
        win: winState,
      });
      try {
        await navigator.clipboard.writeText(keyString);
        showToast(`'${keyString}' 클립보드 복사 완료`, 'info');
      } catch {
        showToast('클립보드 복사 실패', 'warn');
      }
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'key-action-btn';
    cancelBtn.textContent = '닫기';
    cancelBtn.onclick = () => {
      safeResolve(null);
      closeFn?.();
    };

    actionsBar.append(applyBtn, copyBtn, cancelBtn);

    body.append(captureSection, modSection, listSection, previewSection, actionsBar);

    const modalTitle =
      options.title ||
      (targetLineNumber
        ? `3DMigoto 키 바인딩 편집 (${targetLineNumber}번 줄)`
        : '3DMigoto 키 입력 도우미');

    closeFn = openModal(
      modalTitle,
      body,
      {
        autoHeight: true,
        className: 'modal-key-helper',
        onClose: () => {
          safeResolve(null);
        },
      },
    );

    setTimeout(() => captureBox.focus(), 60);
  });
}

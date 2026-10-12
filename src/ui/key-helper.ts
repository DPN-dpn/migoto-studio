import { openModal } from './modal';
import { monaco } from '../core/monaco';
import {
  CODE_TO_VK,
  VK_KEY_LIST,
  formatKeyBinding,
  generateKeySnippet,
  type KeyInsertFormat,
  type VkKeyItem,
} from '../core/keys';
import { showToast } from './toast';

/**
 * Opens the interactive Key Helper Modal dialog.
 * Captures real-time keyboard presses, converts them to 3DMigoto Virtual Key codes (VK_*),
 * and provides one-click insertion into the editor.
 */
export function openKeyHelperModal(editor: monaco.editor.IStandaloneCodeEditor): void {
  const body = document.createElement('div');
  body.className = 'key-helper-modal-body';

  let currentVk = 'VK_F1';
  let isCtrl = false;
  let isAlt = false;
  let isShift = false;
  let isWin = false;
  let currentFriendlyName = 'F1';

  // Smart default format based on current line in editor
  let insertFormat: KeyInsertFormat = 'line';
  const pos = editor.getPosition();
  const model = editor.getModel();
  if (pos && model) {
    const curLine = model.getLineContent(pos.lineNumber).trim();
    if (/^key\s*=/i.test(curLine)) {
      insertFormat = 'value';
    }
  }

  let closeFn: (() => void) | null = null;

  // 1. Live Key Capture Area
  const captureSection = document.createElement('div');
  captureSection.className = 'key-capture-section';

  const captureTitle = document.createElement('div');
  captureTitle.className = 'key-section-title';
  captureTitle.textContent = '실시간 키보드 입력 감지';

  const captureBox = document.createElement('div');
  captureBox.className = 'key-capture-box';
  captureBox.tabIndex = 0;

  const capturePrompt = document.createElement('div');
  capturePrompt.className = 'key-capture-prompt';
  capturePrompt.textContent = '여기를 클릭한 후 키보드를 누르세요 (예: F1, Ctrl+1, Space, Numpad 5 등)';

  const capturedDisplay = document.createElement('div');
  capturedDisplay.className = 'key-captured-display';

  captureBox.append(capturePrompt, capturedDisplay);

  // 2. Modifiers Checkbox Row
  const modRow = document.createElement('div');
  modRow.className = 'key-modifier-row';

  const createModCheck = (label: string, getVal: () => boolean, setVal: (v: boolean) => void) => {
    const wrap = document.createElement('label');
    wrap.className = 'key-modifier-label';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = getVal();
    input.onchange = () => {
      setVal(input.checked);
      updateDisplay();
    };
    wrap.append(input, document.createTextNode(` ${label}`));
    return { wrap, input };
  };

  const chkCtrl = createModCheck('Ctrl', () => isCtrl, (v) => { isCtrl = v; });
  const chkAlt = createModCheck('Alt', () => isAlt, (v) => { isAlt = v; });
  const chkShift = createModCheck('Shift', () => isShift, (v) => { isShift = v; });
  const chkWin = createModCheck('Win', () => isWin, (v) => { isWin = v; });

  const clearModsBtn = document.createElement('button');
  clearModsBtn.className = 'small-btn key-clear-btn';
  clearModsBtn.textContent = '수식키 초기화 (no_modifiers)';
  clearModsBtn.onclick = () => {
    isCtrl = false;
    isAlt = false;
    isShift = false;
    isWin = false;
    chkCtrl.input.checked = false;
    chkAlt.input.checked = false;
    chkShift.input.checked = false;
    chkWin.input.checked = false;
    updateDisplay();
  };

  modRow.append(chkCtrl.wrap, chkAlt.wrap, chkShift.wrap, chkWin.wrap, clearModsBtn);

  // 3. Format & Preview Section
  const previewSection = document.createElement('div');
  previewSection.className = 'key-preview-section';

  const formatTitle = document.createElement('div');
  formatTitle.className = 'key-section-title';
  formatTitle.textContent = '삽입 형식 선택';

  const formatOptionsRow = document.createElement('div');
  formatOptionsRow.className = 'key-format-options';

  const formats: { id: KeyInsertFormat; label: string; desc: string }[] = [
    { id: 'value', label: '값만 삽입', desc: 'key = 뒤에 들어갈 값만 삽입' },
    { id: 'line', label: '줄 전체 삽입', desc: 'key = ... 한 줄 전체 삽입' },
    { id: 'toggle', label: '[KeyToggle] 섹션', desc: 'F1으로 변수를 0/1 토글하는 섹션' },
    { id: 'hold', label: '[KeyHold] 섹션', desc: '키를 누르고 있는 동안만 켜지는 섹션' },
  ];

  const radioInputs: HTMLInputElement[] = [];
  formats.forEach((f) => {
    const fLabel = document.createElement('label');
    fLabel.className = 'key-format-radio-label';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'key_insert_format';
    radio.value = f.id;
    radio.checked = insertFormat === f.id;
    radio.onchange = () => {
      insertFormat = f.id;
      updateDisplay();
    };
    radioInputs.push(radio);

    const titleSpan = document.createElement('strong');
    titleSpan.textContent = f.label;
    const descSpan = document.createElement('span');
    descSpan.className = 'key-format-desc';
    descSpan.textContent = f.desc;

    fLabel.append(radio, titleSpan, descSpan);
    formatOptionsRow.append(fLabel);
  });

  const codePreview = document.createElement('pre');
  codePreview.className = 'key-code-preview';

  previewSection.append(formatTitle, formatOptionsRow, codePreview);

  // 4. Virtual Keys Selector (Manual Search / Browsing)
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
  searchInput.placeholder = '가상 키 검색 (예: F1, Space, Numpad, Mouse, 방향키)…';

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

  // 5. Update display function
  const updateDisplay = () => {
    // 3DMigoto formatted string
    const keyString = formatKeyBinding({
      vk: currentVk,
      ctrl: isCtrl,
      alt: isAlt,
      shift: isShift,
      win: isWin,
    });

    // Friendly display
    const comboParts: string[] = [];
    if (isCtrl) comboParts.push('Ctrl');
    if (isAlt) comboParts.push('Alt');
    if (isShift) comboParts.push('Shift');
    if (isWin) comboParts.push('Win');
    comboParts.push(currentFriendlyName);
    const friendlyCombo = comboParts.join(' + ');

    capturedDisplay.innerHTML = `
      <div class="key-display-row">
        <span class="key-display-tag">입력된 키:</span>
        <strong class="key-display-combo">${friendlyCombo}</strong>
      </div>
      <div class="key-display-row">
        <span class="key-display-tag">3DMigoto:</span>
        <code class="key-display-code">${keyString}</code>
      </div>
    `;

    // Code snippet preview
    const snippet = generateKeySnippet(insertFormat, keyString);
    codePreview.textContent = snippet;
  };

  // Keyboard capture event on captureBox
  captureBox.onfocus = () => {
    captureBox.classList.add('is-active');
    capturePrompt.textContent = '키를 누르는 중입니다… 키보드를 누르면 즉시 감지됩니다.';
  };

  captureBox.onblur = () => {
    captureBox.classList.remove('is-active');
    capturePrompt.textContent = '여기를 클릭한 후 키보드를 누르세요 (예: F1, Ctrl+1, Space, Numpad 5 등)';
  };

  captureBox.onkeydown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Modifier updates
    isCtrl = e.ctrlKey;
    isAlt = e.altKey;
    isShift = e.shiftKey;
    isWin = e.metaKey;

    chkCtrl.input.checked = isCtrl;
    chkAlt.input.checked = isAlt;
    chkShift.input.checked = isShift;
    chkWin.input.checked = isWin;

    // Check if only modifier was pressed
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      updateDisplay();
      return;
    }

    // Resolve VK code from event
    const vk = CODE_TO_VK[e.code];
    if (vk) {
      currentVk = vk;
      // Find matching item or use key label
      const item = VK_KEY_LIST.find((k) => k.vk === vk);
      currentFriendlyName = item ? item.label : e.key.toUpperCase();
      renderKeyItems(searchInput.value);
    } else if (e.key && e.key.length === 1) {
      // Fallback single character
      const upper = e.key.toUpperCase();
      const directVk = `VK_${upper}`;
      currentVk = directVk;
      currentFriendlyName = upper;
    }

    updateDisplay();
  };

  // Initial render
  updateDisplay();

  // 6. Action Buttons Bar
  const actionsBar = document.createElement('div');
  actionsBar.className = 'key-modal-actions';

  const insertBtn = document.createElement('button');
  insertBtn.className = 'primary key-action-btn';
  insertBtn.textContent = '에디터에 삽입';
  insertBtn.onclick = () => {
    const keyString = formatKeyBinding({
      vk: currentVk,
      ctrl: isCtrl,
      alt: isAlt,
      shift: isShift,
      win: isWin,
    });
    const snippet = generateKeySnippet(insertFormat, keyString);

    const selection = editor.getSelection();
    const position = editor.getPosition();
    const range = selection && !selection.isEmpty()
      ? selection
      : new monaco.Range(
          position?.lineNumber || 1,
          position?.column || 1,
          position?.lineNumber || 1,
          position?.column || 1,
        );

    editor.pushUndoStop();
    editor.executeEdits('key-helper', [{ range, text: snippet }]);
    editor.pushUndoStop();
    editor.focus();

    closeFn?.();
    showToast(`'${keyString}' 키 바인딩이 에디터에 삽입되었습니다.`, 'info');
  };

  const copyBtn = document.createElement('button');
  copyBtn.className = 'secondary key-action-btn';
  copyBtn.textContent = '클립보드에 복사';
  copyBtn.onclick = async () => {
    const keyString = formatKeyBinding({
      vk: currentVk,
      ctrl: isCtrl,
      alt: isAlt,
      shift: isShift,
      win: isWin,
    });
    const snippet = generateKeySnippet(insertFormat, keyString);
    try {
      await navigator.clipboard.writeText(snippet);
      showToast('키 바인딩 코드가 클립보드에 복사되었습니다.', 'info');
    } catch {
      showToast('클립보드 복사 실패', 'warn');
    }
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'key-action-btn';
  cancelBtn.textContent = '닫기';
  cancelBtn.onclick = () => closeFn?.();

  actionsBar.append(insertBtn, copyBtn, cancelBtn);

  body.append(captureSection, modRow, previewSection, listSection, actionsBar);

  closeFn = openModal('3DMigoto 키 입력 도우미 (Key Helper)', body);

  // Auto focus capture box on open
  setTimeout(() => captureBox.focus(), 80);
}

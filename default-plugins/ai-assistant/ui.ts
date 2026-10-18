import type { PluginContext } from '../../src/plugins/types.ts';
import { parseMarkdownToHtml } from './markdown.ts';
import { buildPromptContext, AI_TEMPLATES } from './context-builder.ts';
import { AVAILABLE_MODELS, callAiChatApi } from './api.ts';

export function buildAiAssistantView(context: PluginContext, container: HTMLElement): () => void {
  container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview ai-assistant-panel';
  container.replaceChildren();

  // 1. 에이전트 화면 패널
  const agentPane = document.createElement('div');
  agentPane.className = 'ai-pane ai-agent-view';

  // 2. 설정 화면 패널
  const settingsPane = document.createElement('div');
  settingsPane.className = 'ai-pane ai-settings-view';

  // --- [설정 패널 구성] ---
  const settingsHeader = context.ui.createPanelHeader('AI 연결 및 모델 설정');
  const providerBadge = context.ui.createBadge({ text: 'OpenAI API 호환', variant: 'muted' });
  settingsHeader.append(providerBadge);
  const urlInput = context.ui.createInput({
    label: 'API URL:',
    placeholder: 'https://generativelanguage.googleapis.com/v1beta/openai 또는 https://api.openai.com/v1',
    value: context.storage.get('api_url', 'https://generativelanguage.googleapis.com/v1beta/openai'),
    onInput: (v) => context.storage.set('api_url', v.trim()),
  });

  const keyRow = document.createElement('div');
  keyRow.className = 'form-row';

  const keyLabel = document.createElement('label');
  keyLabel.textContent = 'API Key:';

  const keyWrap = document.createElement('div');
  keyWrap.className = 'ai-key-input-wrap';

  const keyInput = document.createElement('input');
  keyInput.type = 'password';
  keyInput.className = 'plugin-input ai-key-input';
  keyInput.placeholder = 'Gemini 또는 OpenAI API 키 (Ollama는 비워둠)';
  keyInput.value = context.storage.get('api_key', '');
  keyInput.oninput = () => context.storage.set('api_key', keyInput.value.trim());

  const eyeBtn = document.createElement('button');
  eyeBtn.type = 'button';
  eyeBtn.className = 'ai-eye-btn';
  eyeBtn.title = 'API 키 보기/숨기기';
  eyeBtn.setAttribute('aria-label', 'API 키 보기/숨기기');

  const eyeSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const eyeOffSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

  eyeBtn.innerHTML = eyeSvg;
  let isKeyVisible = false;
  eyeBtn.onclick = () => {
    isKeyVisible = !isKeyVisible;
    keyInput.type = isKeyVisible ? 'text' : 'password';
    eyeBtn.innerHTML = isKeyVisible ? eyeOffSvg : eyeSvg;
  };

  keyWrap.append(keyInput, eyeBtn);
  keyRow.append(keyLabel, keyWrap);

  let initialModel = (context.storage.get('model', 'gemini-flash-latest') as string).trim();
  if (
    !initialModel ||
    initialModel.startsWith('gemini-2.') ||
    initialModel.startsWith('gemini-1.') ||
    initialModel === 'gemini-pro'
  ) {
    initialModel = 'gemini-flash-latest';
    context.storage.set('model', initialModel);
  }

  const modelInput = context.ui.createInput({
    label: '모델명:',
    placeholder: 'gemini-flash-latest, gpt-4o-mini 등',
    value: initialModel,
    onInput: (v) => {
      context.storage.set('model', v.trim());
      renderChips();
    },
  });

  const modelChipsWrap = document.createElement('div');
  modelChipsWrap.className = 'ai-model-chips';

  const renderChips = () => {
    modelChipsWrap.replaceChildren();
    const current = (context.storage.get('model', 'gemini-flash-latest') as string).trim();
    for (const m of AVAILABLE_MODELS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `ai-model-chip${current === m.name ? ' active' : ''}`;
      chip.textContent = m.label;
      chip.onclick = () => {
        modelInput.setValue(m.name);
        context.storage.set('model', m.name);
        renderChips();
      };
      modelChipsWrap.append(chip);
    }
  };
  renderChips();

  const presetRow = document.createElement('div');
  presetRow.className = 'ai-quick-actions';

  const btnPresetGemini = context.ui.createButton({
    text: 'Google Gemini',
    variant: 'small',
    onClick: () => {
      const u = 'https://generativelanguage.googleapis.com/v1beta/openai';
      const m = 'gemini-flash-latest';
      urlInput.setValue(u);
      modelInput.setValue(m);
      context.storage.set('api_url', u);
      context.storage.set('model', m);
      renderChips();
      context.ui.showToast('Gemini 설정이 적용되었습니다. API Key를 입력하세요.', 'info');
    },
  });

  const btnPresetOpenAI = context.ui.createButton({
    text: 'OpenAI (ChatGPT)',
    variant: 'small',
    onClick: () => {
      const u = 'https://api.openai.com/v1';
      const m = 'gpt-4o-mini';
      urlInput.setValue(u);
      modelInput.setValue(m);
      context.storage.set('api_url', u);
      context.storage.set('model', m);
      renderChips();
      context.ui.showToast('OpenAI 설정이 적용되었습니다.', 'info');
    },
  });

  const btnPresetOllama = context.ui.createButton({
    text: '로컬 Ollama',
    variant: 'small',
    onClick: () => {
      const u = 'http://localhost:11434/v1';
      const m = 'qwen2.5-coder';
      urlInput.setValue(u);
      modelInput.setValue(m);
      context.storage.set('api_url', u);
      context.storage.set('model', m);
      renderChips();
      context.ui.showToast('Ollama 설정이 적용되었습니다. (Key는 비워둠)', 'info');
    },
  });

  const presetButtons = context.ui.createButtonRow([btnPresetGemini, btnPresetOpenAI, btnPresetOllama]);

  const presetCard = context.ui.createCard({
    title: '빠른 프로바이더 설정',
    content: [presetButtons],
  });

  const configCard = context.ui.createCard({
    title: '연결 정보 입력',
    content: [urlInput.row, keyRow, modelInput.row, modelChipsWrap],
  });

  const guideDiv = document.createElement('div');
  guideDiv.style.cssText = 'font-size: 11px; color: var(--fg-dim); line-height: 1.5;';
  guideDiv.innerHTML = `
    <div>- Google Gemini: Google AI Studio 키(AQ...) 입력 시 gemini-flash-latest 모델이 기본 제공됩니다.</div>
    <div>- OpenAI: platform.openai.com API 키 및 gpt-4o-mini 모델을 권장합니다.</div>
    <div>- Ollama: 로컬 PC에서 실행 중인 경우 키 없이 바로 연결할 수 있습니다.</div>
  `;
  const guideCard = context.ui.createCard({
    title: '환경 및 모델 안내',
    content: [guideDiv],
  });

  settingsPane.append(settingsHeader, presetCard, configCard, guideCard);

  // --- [에이전트 패널 구성] ---
  const chatHistory = document.createElement('div');
  chatHistory.className = 'ai-chat-history';

  const emptyState = document.createElement('div');
  emptyState.className = 'ai-empty-state';
  emptyState.innerHTML = `
    <div class="ai-empty-title">3DMigoto / XXMI 모딩 어시스턴트</div>
    <div class="ai-empty-desc">INI 코드 분석이나 토글 키 생성 등 모딩 작업을 질문하거나<br>하단의 [템플릿 ▾] 버튼을 눌러 빠르게 요청해 보세요.</div>
  `;
  chatHistory.append(emptyState);

  // 하단 고정 입력 영역 (Dock)
  const inputDock = document.createElement('div');
  inputDock.className = 'ai-input-dock';

  const dockTop = document.createElement('div');
  dockTop.className = 'ai-input-dock-top';

  const dockOptions = document.createElement('div');
  dockOptions.className = 'ai-dock-options';

  const contextSelectWrap = document.createElement('div');
  contextSelectWrap.className = 'ai-context-select-wrap';

  const contextSelect = document.createElement('select');
  contextSelect.className = 'ai-context-select';
  contextSelect.title = 'AI에게 전달할 컨텍스트 범위를 선택합니다.';

  const optSmart = document.createElement('option');
  optSmart.value = 'smart';
  optSmart.textContent = '스마트';

  const optFull = document.createElement('option');
  optFull.value = 'full';
  optFull.textContent = '전체 파일';

  const optNone = document.createElement('option');
  optNone.value = 'none';
  optNone.textContent = '코드 제외';

  contextSelect.append(optSmart, optFull, optNone);
  contextSelect.value = context.storage.get('context_mode', 'smart');
  contextSelect.onchange = () => context.storage.set('context_mode', contextSelect.value);

  contextSelectWrap.append(contextSelect);

  let isAutoApply = context.storage.get('auto_apply', false);

  const autoApplyToggle = document.createElement('button');
  autoApplyToggle.type = 'button';
  autoApplyToggle.className = 'ai-auto-apply-toggle' + (isAutoApply ? ' active' : '');
  autoApplyToggle.title = '답변 완료 시 현재 열린 파일의 해당 섹션을 스마트하게 자동 교체/반영합니다.';
  autoApplyToggle.textContent = '자동 반영';

  autoApplyToggle.onclick = () => {
    isAutoApply = !isAutoApply;
    context.storage.set('auto_apply', isAutoApply);
    autoApplyToggle.classList.toggle('active', isAutoApply);
    context.ui.showToast(`자동 반영이 ${isAutoApply ? '활성화' : '비활성화'}되었습니다.`, isAutoApply ? 'info' : 'warn');
  };

  dockOptions.append(contextSelectWrap, autoApplyToggle);

  const templateWrap = document.createElement('div');
  templateWrap.className = 'ai-template-btn-wrap';

  const templateBtn = document.createElement('button');
  templateBtn.className = 'small-btn';
  templateBtn.textContent = '템플릿 ▾';

  const templateMenu = document.createElement('ul');
  templateMenu.className = 'ai-template-menu';
  templateMenu.hidden = true;

  AI_TEMPLATES.forEach((item) => {
    if (item.label === '---') {
      const div = document.createElement('li');
      div.className = 'ai-template-menu-divider';
      templateMenu.append(div);
      return;
    }

    const li = document.createElement('li');
    li.className = 'ai-template-menu-item';
    li.textContent = item.label;
    li.onclick = (e) => {
      e.stopPropagation();
      templateMenu.hidden = true;
      if (item.isAction) {
        chatHistory.replaceChildren(emptyState);
        context.ui.showToast('대화 내역이 초기화되었습니다.', 'info');
        return;
      }
      if (item.text) {
        dockTextarea.value = item.text;
        adjustTextareaHeight();
        dockTextarea.focus();
      }
    };
    templateMenu.append(li);
  });

  templateBtn.onclick = (e) => {
    e.stopPropagation();
    templateMenu.hidden = !templateMenu.hidden;
  };

  templateWrap.append(templateBtn, templateMenu);
  dockTop.append(dockOptions, templateWrap);

  const dockMain = document.createElement('div');
  dockMain.className = 'ai-input-dock-main';

  const dockTextarea = document.createElement('textarea');
  dockTextarea.className = 'ai-dock-textarea';
  dockTextarea.placeholder = 'AI에게 질문이나 코드 작성을 요청하세요... (Enter로 전송, Shift+Enter 줄바꿈)';
  dockTextarea.rows = 1;

  const dockResizer = document.createElement('div');
  dockResizer.className = 'ai-dock-resizer';
  dockResizer.title = '드래그하여 입력창 높이 조절 (더블 클릭: 기본 크기 복원)';

  let savedDockHeight = context.storage.get('dock_textarea_height', 0);
  let isManuallyResized = savedDockHeight >= 38;

  if (isManuallyResized) {
    dockTextarea.style.height = `${savedDockHeight}px`;
    dockTextarea.style.overflowY = 'auto';
  }

  const adjustTextareaHeight = () => {
    if (isManuallyResized) {
      dockTextarea.style.overflowY =
        dockTextarea.scrollHeight > dockTextarea.clientHeight ? 'auto' : 'hidden';
      return;
    }
    dockTextarea.style.height = 'auto';
    const scrollH = dockTextarea.scrollHeight;
    const maxH = 120;
    if (scrollH > maxH) {
      dockTextarea.style.height = `${maxH}px`;
      dockTextarea.style.overflowY = 'auto';
    } else {
      dockTextarea.style.height = `${Math.max(scrollH, 38)}px`;
      dockTextarea.style.overflowY = 'hidden';
    }
  };

  dockTextarea.oninput = adjustTextareaHeight;

  let isDraggingResizer = false;
  let dragStartY = 0;
  let dragStartHeight = 38;

  const onResizerMouseMove = (e: MouseEvent) => {
    if (!isDraggingResizer) return;
    const deltaY = dragStartY - e.clientY;
    const paneHeight = agentPane.clientHeight;
    const maxAllowed = Math.max(120, paneHeight - 120);
    const newH = Math.max(38, Math.min(maxAllowed, dragStartHeight + deltaY));

    dockTextarea.style.height = `${newH}px`;
    dockTextarea.style.overflowY = dockTextarea.scrollHeight > newH ? 'auto' : 'hidden';
    isManuallyResized = true;
    savedDockHeight = newH;
  };

  const onResizerMouseUp = () => {
    if (!isDraggingResizer) return;
    isDraggingResizer = false;
    dockResizer.classList.remove('dragging');
    document.body.classList.remove('ai-dock-resizing');
    window.removeEventListener('mousemove', onResizerMouseMove);
    window.removeEventListener('mouseup', onResizerMouseUp);

    if (savedDockHeight >= 38) {
      context.storage.set('dock_textarea_height', savedDockHeight);
    }
  };

  dockResizer.onmousedown = (e: MouseEvent) => {
    e.preventDefault();
    isDraggingResizer = true;
    dragStartY = e.clientY;
    dragStartHeight = dockTextarea.clientHeight || 38;
    dockResizer.classList.add('dragging');
    document.body.classList.add('ai-dock-resizing');

    window.addEventListener('mousemove', onResizerMouseMove);
    window.addEventListener('mouseup', onResizerMouseUp);
  };

  dockResizer.ondblclick = () => {
    isManuallyResized = false;
    savedDockHeight = 0;
    context.storage.set('dock_textarea_height', 0);
    dockTextarea.style.height = '38px';
    dockTextarea.style.overflowY = 'hidden';
    context.ui.showToast('입력창 높이가 기본 크기로 초기화되었습니다.', 'info');
  };

  const sendBtn = document.createElement('button');
  sendBtn.className = 'primary ai-dock-send-btn';
  sendBtn.textContent = '전송';

  dockTextarea.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(dockTextarea.value);
    }
  };

  sendBtn.onclick = () => sendMessage(dockTextarea.value);

  dockMain.append(dockTextarea, sendBtn);
  inputDock.append(dockTop, dockMain);

  agentPane.append(chatHistory, dockResizer, inputDock);

  const tabs = context.ui.createTabs({
    tabs: [
      { id: 'agent', label: '에이전트', content: agentPane },
      { id: 'settings', label: '설정', content: settingsPane },
    ],
    defaultTab: 'agent',
  });

  container.append(tabs.container);

  const onDocClick = (e: MouseEvent) => {
    if (!templateMenu.hidden && !templateWrap.contains(e.target as Node)) {
      templateMenu.hidden = true;
    }
  };
  document.addEventListener('click', onDocClick);

  function executeSmartApply(codeContent: string, isAuto = false): boolean {
    const currentText = context.editor.getText();
    const mergeResult = context.ini.merge(currentText, codeContent);
    context.editor.setText(mergeResult.newText);

    const prefix = isAuto ? '[자동 반영] ' : '';
    const replacedCount = mergeResult.replacedSections.length;
    const addedCount = mergeResult.addedSections.length;

    if (replacedCount > 0 && addedCount > 0) {
      context.ui.showToast(
        `${prefix}${replacedCount}개 섹션 교체 및 ${addedCount}개 섹션이 추가되었습니다. (되돌리기: Ctrl+Z)`,
        'info',
      );
    } else if (replacedCount > 0) {
      context.ui.showToast(
        `${prefix}${replacedCount}개 섹션이 스마트 교체되었습니다. (되돌리기: Ctrl+Z)`,
        'info',
      );
    } else if (addedCount > 0) {
      context.ui.showToast(
        `${prefix}${addedCount}개 섹션이 파일에 추가되었습니다. (되돌리기: Ctrl+Z)`,
        'info',
      );
    } else {
      context.ui.showToast(`${prefix}파일 내용이 갱신되었습니다. (되돌리기: Ctrl+Z)`, 'info');
    }
    return true;
  }

  function renderAssistantContent(targetEl: HTMLElement, text: string) {
    targetEl.replaceChildren();
    const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?([\s\S]*?)```/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const textBefore = text.slice(lastIdx, match.index);
      if (textBefore.trim()) {
        const mdDiv = document.createElement('div');
        mdDiv.className = 'ai-md-content';
        mdDiv.innerHTML = parseMarkdownToHtml(textBefore.trim());
        targetEl.append(mdDiv);
      }

      const codeContent = match[1].trim();
      const codeBox = document.createElement('div');
      codeBox.className = 'ai-code-block';

      const pre = document.createElement('pre');
      pre.textContent = codeContent;
      codeBox.append(pre);

      const btnBar = document.createElement('div');
      btnBar.className = 'ai-code-bar';

      const applyBtn = document.createElement('button');
      applyBtn.className = 'small-btn ai-apply-btn';
      applyBtn.textContent = '스마트 적용';
      applyBtn.title = '현재 열린 파일의 해당 섹션을 찾아 스마트하게 교체/반영합니다';
      applyBtn.onclick = () => {
        executeSmartApply(codeContent, false);
      };

      const insertBtn = document.createElement('button');
      insertBtn.className = 'small-btn';
      insertBtn.textContent = '커서 삽입';
      insertBtn.title = '현재 에디터 커서 위치에 코드를 삽입합니다';
      insertBtn.onclick = () => {
        context.editor.insertText(codeContent + '\n');
        context.ui.showToast('에디터 커서에 코드가 삽입되었습니다.', 'info');
      };

      const copyBtn = document.createElement('button');
      copyBtn.className = 'small-btn';
      copyBtn.textContent = '복사';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(codeContent);
        context.ui.showToast('클립보드에 복사되었습니다.', 'info');
      };

      btnBar.append(applyBtn, insertBtn, copyBtn);
      codeBox.append(btnBar);
      targetEl.append(codeBox);

      lastIdx = match.index + match[0].length;
    }

    const remaining = text.slice(lastIdx);
    if (remaining.trim()) {
      const mdDiv = document.createElement('div');
      mdDiv.className = 'ai-md-content';
      mdDiv.innerHTML = parseMarkdownToHtml(remaining.trim());
      targetEl.append(mdDiv);
    }
  }

  let activeAbortController: AbortController | null = null;

  function abortActiveRequest(reason = 'USER') {
    if (activeAbortController) {
      activeAbortController.abort(reason);
      activeAbortController = null;
    }
  }

  async function sendMessage(userPrompt: string) {
    const trimmedPrompt = userPrompt.trim();
    if (!trimmedPrompt) return;

    if (activeAbortController) {
      abortActiveRequest('NEW_REQUEST');
    }

    const abortController = new AbortController();
    activeAbortController = abortController;

    if (emptyState.parentElement) {
      emptyState.remove();
    }

    dockTextarea.value = '';
    if (!isManuallyResized) {
      dockTextarea.style.height = '38px';
      dockTextarea.style.overflowY = 'hidden';
    } else {
      dockTextarea.style.overflowY = 'hidden';
    }

    const turnGroup = document.createElement('div');
    turnGroup.className = 'ai-turn-group';

    const userBubble = document.createElement('div');
    userBubble.className = 'ai-turn-header';

    const userHeaderTop = document.createElement('div');
    userHeaderTop.className = 'ai-turn-header-top';

    const badge = document.createElement('span');
    badge.className = 'ai-turn-badge';
    badge.textContent = '질문';
    userHeaderTop.append(badge);

    const isLong = trimmedPrompt.length > 80 || trimmedPrompt.includes('\n');
    let toggleBtn: HTMLButtonElement | null = null;

    if (isLong) {
      toggleBtn = document.createElement('button');
      toggleBtn.className = 'ai-turn-toggle-btn';
      toggleBtn.textContent = '더보기';
      userHeaderTop.append(toggleBtn);
    }

    const promptTextEl = document.createElement('div');
    promptTextEl.className = `ai-turn-prompt-text${isLong ? ' truncated' : ''}`;
    promptTextEl.textContent = trimmedPrompt;

    if (toggleBtn) {
      let expanded = false;
      const toggleHandler = (e: MouseEvent) => {
        e.stopPropagation();
        expanded = !expanded;
        if (expanded) {
          promptTextEl.classList.remove('truncated');
          toggleBtn!.textContent = '접기';
        } else {
          promptTextEl.classList.add('truncated');
          toggleBtn!.textContent = '더보기';
        }
      };
      toggleBtn.onclick = toggleHandler;
      userBubble.onclick = (e) => {
        if ((e.target as HTMLElement).tagName !== 'BUTTON') {
          toggleHandler(e);
        }
      };
    }

    userBubble.append(userHeaderTop, promptTextEl);
    turnGroup.append(userBubble);

    const assistantBubble = document.createElement('div');
    assistantBubble.className = 'ai-assistant-bubble';

    const statusCard = document.createElement('div');
    statusCard.className = 'ai-status-card';

    const statusHeader = document.createElement('div');
    statusHeader.className = 'ai-status-header';

    const statusHeaderLeft = document.createElement('div');
    statusHeaderLeft.className = 'ai-status-header-left';

    const spinner = document.createElement('span');
    spinner.className = 'ai-status-spinner';

    const statusTitle = document.createElement('span');
    statusTitle.className = 'ai-status-title';
    statusTitle.textContent = '요청 처리 준비 중...';

    statusHeaderLeft.append(spinner, statusTitle);

    const timerEl = document.createElement('span');
    timerEl.className = 'ai-status-timer';
    timerEl.textContent = '0.0s';

    statusHeader.append(statusHeaderLeft, timerEl);

    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'ai-status-steps';

    const statusActions = document.createElement('div');
    statusActions.className = 'ai-status-actions';

    const statusInfo = document.createElement('span');
    statusInfo.className = 'ai-status-info';

    const abortBtn = document.createElement('button');
    abortBtn.className = 'small-btn ai-status-abort-btn';
    abortBtn.textContent = '요청 중단';
    abortBtn.onclick = () => {
      abortActiveRequest('USER');
    };

    statusActions.append(statusInfo, abortBtn);
    statusCard.append(statusHeader, stepsContainer, statusActions);
    assistantBubble.append(statusCard);

    turnGroup.append(assistantBubble);
    chatHistory.append(turnGroup);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      timerEl.textContent = `${elapsed}s`;
    }, 100);

    const timeoutTimer = setTimeout(() => {
      if (activeAbortController === abortController) {
        abortController.abort('TIMEOUT');
      }
    }, 45000);

    const steps = [
      { id: 'ctx', title: '에디터 컨텍스트 및 질의 분석' },
      { id: 'conn', title: 'AI 모델 엔드포인트 연결' },
      { id: 'gen', title: '답변 생성 및 코드 스트리밍' },
      { id: 'render', title: '마크다운 및 Diff 렌더링' },
    ];

    const stepElements = steps.map((step) => {
      const el = document.createElement('div');
      el.className = 'ai-step-item pending';
      el.innerHTML = `
        <span class="ai-step-icon"></span>
        <div class="ai-step-text-wrap">
          <span class="ai-step-title">${step.title}</span>
          <span class="ai-step-detail"></span>
        </div>
      `;
      stepsContainer.append(el);
      return el;
    });

    const updateStep = (
      index: number,
      state: 'pending' | 'active' | 'completed' | 'error' | 'retry',
      title?: string,
      detail?: string,
    ) => {
      const el = stepElements[index];
      if (!el) return;
      el.className = `ai-step-item ${state}`;
      if (title) {
        const tEl = el.querySelector('.ai-step-title');
        if (tEl) tEl.textContent = title;
      }
      if (detail !== undefined) {
        const dEl = el.querySelector('.ai-step-detail');
        if (dEl) dEl.textContent = detail;
      }
    };

    const apiUrl = ((context.storage.get('api_url') as string) || 'https://generativelanguage.googleapis.com/v1beta/openai').trim().replace(/\/+$/, '');
    const apiKey = ((context.storage.get('api_key') as string) || '').trim();
    const model = ((context.storage.get('model') as string) || 'gemini-flash-latest').trim();

    const providerName = apiUrl.includes('generativelanguage.googleapis.com')
      ? 'Google Gemini'
      : apiUrl.includes('openai.com')
        ? 'OpenAI'
        : '로컬 LLM (Ollama 호환)';

    statusInfo.textContent = `${providerName} • ${model}`;

    const contextMode = (contextSelect.value || 'smart') as 'smart' | 'full' | 'none';
    const ctxResult = buildPromptContext(context, trimmedPrompt, contextMode);
    const promptWithContext = ctxResult.promptText;

    updateStep(0, 'completed', '컨텍스트 준비 완료', ctxResult.detail);
    updateStep(1, 'completed', 'AI API 연결 준비 완료', `${providerName} (${model})`);

    sendBtn.textContent = '중단';
    sendBtn.classList.remove('primary');
    sendBtn.classList.add('danger');
    sendBtn.onclick = () => abortActiveRequest('USER');

    statusTitle.textContent = '답변 생성 중...';
    updateStep(2, 'active', '서버 응답 대기 중...', 'AI 서버에 질의를 전송하고 답변 수신을 대기하고 있습니다.');

    try {
      const reply = await callAiChatApi({
        context,
        apiUrl,
        apiKey,
        model,
        userPromptWithContext: promptWithContext,
        signal: abortController.signal,
        onRetryStep: (attempt, maxRetries, waitSec, reason) => {
          updateStep(2, 'retry', reason, `트래픽 급증으로 인해 ${waitSec}초 후 자동으로 재시도합니다... (시도: ${attempt}/${maxRetries}회)`);
        },
        onRetryWaitDone: (attempt, maxRetries) => {
          updateStep(2, 'active', '서버 재요청 전송 중...', `재시도 (${attempt}/${maxRetries}) 응답 대기 중`);
        },
      });

      clearInterval(timerInterval);
      clearTimeout(timeoutTimer);

      const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
      updateStep(2, 'completed', '서버 응답 수신 완료', `응답 수신 (소요: ${totalSec}s)`);
      updateStep(3, 'active', '마크다운 렌더링 중...');

      statusCard.remove();

      const metaHeader = document.createElement('div');
      metaHeader.className = 'ai-completion-meta';
      metaHeader.innerHTML = `<span>답변 생성 완료 (${totalSec}s 소요)</span><span>${providerName} / ${model}</span>`;
      assistantBubble.append(metaHeader);

      const replyBody = document.createElement('div');
      replyBody.className = 'ai-reply-body';
      renderAssistantContent(replyBody, reply);
      assistantBubble.append(replyBody);

      if (isAutoApply) {
        const codeBlocks: string[] = [];
        const regex = /```(?:[a-zA-Z0-9_-]+)?([\s\S]*?)```/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(reply)) !== null) {
          if (m[1].trim()) codeBlocks.push(m[1].trim());
        }
        if (codeBlocks.length > 0) {
          const combinedCode = codeBlocks.join('\n\n');
          executeSmartApply(combinedCode, true);
        }
      }
    } catch (err: any) {
      clearInterval(timerInterval);
      clearTimeout(timeoutTimer);

      spinner.style.display = 'none';
      abortBtn.style.display = 'none';

      if (abortController.signal.aborted) {
        const reason = abortController.signal.reason;
        if (reason === 'TIMEOUT') {
          statusTitle.textContent = '서버 응답 시간 초과 (45초)';
          statusTitle.style.color = '#f87171';
          updateStep(2, 'error', '응답 대기 시간 초과 (45초)', 'AI 서버가 지정된 시간 내에 응답하지 못했습니다.');
          renderErrorActions(assistantBubble, trimmedPrompt, model, 'TIMEOUT');
        } else {
          statusTitle.textContent = '요청이 중단되었습니다';
          statusTitle.style.color = 'var(--fg-dim)';
          updateStep(2, 'error', '사용자에 의해 생성이 중단됨', '취소 버튼을 클릭하여 요청을 취소했습니다.');
        }
      } else {
        const errMsg = err.message || String(err);
        statusTitle.textContent = '오류 발생';
        statusTitle.style.color = '#ef4444';

        const is503 = errMsg.includes('503');
        const is404 = errMsg.includes('404');

        if (is503) {
          updateStep(2, 'error', 'Google AI 서버 일시적 과부하 (503)', '무료 티어 트래픽 집중으로 인해 현재 모델이 일시 지연되었습니다.');
          renderErrorActions(assistantBubble, trimmedPrompt, model, '503');
        } else if (is404) {
          updateStep(2, 'error', '모델 또는 엔드포인트를 찾을 수 없음 (404)', errMsg);
          renderErrorActions(assistantBubble, trimmedPrompt, model, '404');
        } else {
          updateStep(2, 'error', '요청 처리 실패', errMsg);
          renderErrorActions(assistantBubble, trimmedPrompt, model, 'GENERAL');
        }
      }
    } finally {
      if (activeAbortController === abortController) {
        activeAbortController = null;
      }
      sendBtn.textContent = '전송';
      sendBtn.classList.remove('danger');
      sendBtn.classList.add('primary');
      sendBtn.onclick = () => sendMessage(dockTextarea.value);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }
  }

  function renderErrorActions(
    targetContainer: HTMLElement,
    prompt: string,
    currentModel: string,
    reason: '503' | 'TIMEOUT' | '404' | 'GENERAL',
  ) {
    const box = document.createElement('div');
    box.className = 'ai-error-actions-box';

    const desc = document.createElement('div');
    desc.className = 'ai-error-actions-desc';

    if (reason === '503') {
      desc.textContent = 'Google Gemini 무료 티어 트래픽 집중으로 인해 요청이 일시 지연되었습니다. 잠시 후 다시 시도하시거나 다른 모델로 변경해 보세요.';
    } else if (reason === 'TIMEOUT') {
      desc.textContent = '서버 응답이 45초 동안 지연되었습니다. 네트워크 상태를 확인하시거나 다시 시도해 보세요.';
    } else if (reason === '404') {
      desc.textContent = '지정된 모델 또는 엔드포인트를 찾을 수 없습니다 (404). 공식 별칭인 gemini-flash-latest 또는 gemini-pro-latest를 사용하세요.';
    } else {
      desc.textContent = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 보세요.';
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'ai-error-actions-btn-row';

    const altModel = currentModel === 'gemini-flash-latest' ? 'gemini-pro-latest' : 'gemini-flash-latest';
    const switchBtn = document.createElement('button');
    switchBtn.className = 'small-btn';
    switchBtn.textContent = `${altModel} 모델로 전환 후 재시도`;
    switchBtn.onclick = () => {
      context.storage.set('model', altModel);
      modelInput.setValue(altModel);
      renderChips();
      context.ui.showToast(`모델이 ${altModel}(으)로 변경되었습니다.`, 'info');
      sendMessage(prompt);
    };

    const retryBtn = document.createElement('button');
    retryBtn.className = 'small-btn';
    retryBtn.textContent = '동일 모델로 다시 시도';
    retryBtn.onclick = () => {
      sendMessage(prompt);
    };

    btnRow.append(switchBtn, retryBtn);
    box.append(desc, btnRow);
    targetContainer.append(box);
  }

  return () => {
    if (activeAbortController) {
      activeAbortController.abort('UNMOUNT');
    }
    window.removeEventListener('mousemove', onResizerMouseMove);
    window.removeEventListener('mouseup', onResizerMouseUp);
    document.removeEventListener('click', onDocClick);
  };
}

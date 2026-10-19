/**
 * ui.ts
 * AI 어시스턴트 메인 패널 뷰 오케스트레이터
 */

import type { PluginContext } from '../../src/plugins/types.ts';
import { buildPromptContext, AI_TEMPLATES } from './context-builder.ts';
import { callAiChatApi } from './api.ts';
import { createSettingsPane } from './settings-view.ts';
import { createStatusCard } from './status-card.ts';
import {
  executeSmartApply,
  renderAssistantContent,
  renderErrorActions,
} from './message-renderer.ts';

export function buildAiAssistantView(context: PluginContext, container: HTMLElement): () => void {
  container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview ai-assistant-panel';
  container.replaceChildren();

  // 1. 상단 서브탭 바 (에이전트 / 설정)
  const subtabBar = document.createElement('div');
  subtabBar.className = 'ai-subtab-bar';

  const btnTabAgent = document.createElement('button');
  btnTabAgent.className = 'ai-subtab-btn active';
  btnTabAgent.textContent = '에이전트';

  const btnTabSettings = document.createElement('button');
  btnTabSettings.className = 'ai-subtab-btn';
  btnTabSettings.textContent = '설정';

  subtabBar.append(btnTabAgent, btnTabSettings);

  // 2. 에이전트 화면 패널
  const agentPane = document.createElement('div');
  agentPane.className = 'ai-pane ai-agent-view';

  // 3. 설정 화면 패널
  const settings = createSettingsPane(context);

  btnTabAgent.onclick = () => {
    btnTabAgent.classList.add('active');
    btnTabSettings.classList.remove('active');
    agentPane.hidden = false;
    settings.pane.hidden = true;
  };

  btnTabSettings.onclick = () => {
    btnTabSettings.classList.add('active');
    btnTabAgent.classList.remove('active');
    settings.pane.hidden = false;
    agentPane.hidden = true;
  };

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
  container.append(subtabBar, agentPane, settings.pane);

  const onDocClick = (e: MouseEvent) => {
    if (!templateMenu.hidden && !templateWrap.contains(e.target as Node)) {
      templateMenu.hidden = true;
    }
  };
  document.addEventListener('click', onDocClick);

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

    const status = createStatusCard({
      onAbort: () => abortActiveRequest('USER'),
    });
    assistantBubble.append(status.element);

    turnGroup.append(assistantBubble);
    chatHistory.append(turnGroup);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    const timeoutTimer = setTimeout(() => {
      if (activeAbortController === abortController) {
        abortController.abort('TIMEOUT');
      }
    }, 45000);

    const apiUrl = ((context.storage.get('api_url') as string) || 'https://generativelanguage.googleapis.com/v1beta/openai').trim().replace(/\/+$/, '');
    const apiKey = ((context.storage.get('api_key') as string) || '').trim();
    const model = ((context.storage.get('model') as string) || 'gemini-flash-latest').trim();

    const providerName = apiUrl.includes('generativelanguage.googleapis.com')
      ? 'Google Gemini'
      : apiUrl.includes('openai.com')
        ? 'OpenAI'
        : '로컬 LLM (Ollama 호환)';

    status.setProviderInfo(`${providerName} • ${model}`);

    const contextMode = (contextSelect.value || 'smart') as 'smart' | 'full' | 'none';
    const ctxResult = buildPromptContext(context, trimmedPrompt, contextMode);
    const promptWithContext = ctxResult.promptText;

    status.updateStep(0, 'completed', '컨텍스트 준비 완료', ctxResult.detail);
    status.updateStep(1, 'completed', 'AI API 연결 준비 완료', `${providerName} (${model})`);

    sendBtn.textContent = '중단';
    sendBtn.classList.remove('primary');
    sendBtn.classList.add('danger');
    sendBtn.onclick = () => abortActiveRequest('USER');

    status.setStatusTitle('답변 생성 중...');
    status.updateStep(2, 'active', '서버 응답 대기 중...', 'AI 서버에 질의를 전송하고 답변 수신을 대기하고 있습니다.');

    try {
      const reply = await callAiChatApi({
        context,
        apiUrl,
        apiKey,
        model,
        userPromptWithContext: promptWithContext,
        signal: abortController.signal,
        onRetryStep: (attempt, maxRetries, waitSec, reason) => {
          status.updateStep(2, 'retry', reason, `트래픽 급증으로 인해 ${waitSec}초 후 자동으로 재시도합니다... (시도: ${attempt}/${maxRetries}회)`);
        },
        onRetryWaitDone: (attempt, maxRetries) => {
          status.updateStep(2, 'active', '서버 재요청 전송 중...', `재시도 (${attempt}/${maxRetries}) 응답 대기 중`);
        },
      });

      const totalSec = status.stopTimer();
      clearTimeout(timeoutTimer);

      status.updateStep(2, 'completed', '서버 응답 수신 완료', `응답 수신 (소요: ${totalSec}s)`);
      status.updateStep(3, 'active', '마크다운 렌더링 중...');

      status.remove();

      const metaHeader = document.createElement('div');
      metaHeader.className = 'ai-completion-meta';
      metaHeader.innerHTML = `<span>답변 생성 완료 (${totalSec}s 소요)</span><span>${providerName} / ${model}</span>`;
      assistantBubble.append(metaHeader);

      const replyBody = document.createElement('div');
      replyBody.className = 'ai-reply-body';
      renderAssistantContent(context, replyBody, reply, (code, isAuto) => executeSmartApply(context, code, isAuto));
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
          executeSmartApply(context, combinedCode, true);
        }
      }
    } catch (err: any) {
      status.stopTimer();
      clearTimeout(timeoutTimer);
      status.hideSpinnerAndAbort();

      if (abortController.signal.aborted) {
        const reason = abortController.signal.reason;
        if (reason === 'TIMEOUT') {
          status.setStatusTitle('서버 응답 시간 초과 (45초)', '#f87171');
          status.updateStep(2, 'error', '응답 대기 시간 초과 (45초)', 'AI 서버가 지정된 시간 내에 응답하지 못했습니다.');
          renderErrorActions({
            targetContainer: assistantBubble,
            prompt: trimmedPrompt,
            currentModel: model,
            reason: 'TIMEOUT',
            onSwitchModel: (newModel) => {
              settings.setModel(newModel);
              context.ui.showToast(`모델이 ${newModel}(으)로 변경되었습니다.`, 'info');
              sendMessage(trimmedPrompt);
            },
            onRetry: () => sendMessage(trimmedPrompt),
          });
        } else {
          status.setStatusTitle('요청이 중단되었습니다', 'var(--fg-dim)');
          status.updateStep(2, 'error', '사용자에 의해 생성이 중단됨', '취소 버튼을 클릭하여 요청을 취소했습니다.');
        }
      } else {
        const errMsg = err.message || String(err);
        status.setStatusTitle('오류 발생', '#ef4444');

        const is503 = errMsg.includes('503');
        const is404 = errMsg.includes('404');

        if (is503) {
          status.updateStep(2, 'error', 'Google AI 서버 일시적 과부하 (503)', '무료 티어 트래픽 집중으로 인해 현재 모델이 일시 지연되었습니다.');
          renderErrorActions({
            targetContainer: assistantBubble,
            prompt: trimmedPrompt,
            currentModel: model,
            reason: '503',
            onSwitchModel: (newModel) => {
              settings.setModel(newModel);
              context.ui.showToast(`모델이 ${newModel}(으)로 변경되었습니다.`, 'info');
              sendMessage(trimmedPrompt);
            },
            onRetry: () => sendMessage(trimmedPrompt),
          });
        } else if (is404) {
          status.updateStep(2, 'error', '모델 또는 엔드포인트를 찾을 수 없음 (404)', errMsg);
          renderErrorActions({
            targetContainer: assistantBubble,
            prompt: trimmedPrompt,
            currentModel: model,
            reason: '404',
            onSwitchModel: (newModel) => {
              settings.setModel(newModel);
              context.ui.showToast(`모델이 ${newModel}(으)로 변경되었습니다.`, 'info');
              sendMessage(trimmedPrompt);
            },
            onRetry: () => sendMessage(trimmedPrompt),
          });
        } else {
          status.updateStep(2, 'error', '요청 처리 실패', errMsg);
          renderErrorActions({
            targetContainer: assistantBubble,
            prompt: trimmedPrompt,
            currentModel: model,
            reason: 'GENERAL',
            onSwitchModel: (newModel) => {
              settings.setModel(newModel);
              context.ui.showToast(`모델이 ${newModel}(으)로 변경되었습니다.`, 'info');
              sendMessage(trimmedPrompt);
            },
            onRetry: () => sendMessage(trimmedPrompt),
          });
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

  return () => {
    if (activeAbortController) {
      activeAbortController.abort('UNMOUNT');
    }
    window.removeEventListener('mousemove', onResizerMouseMove);
    window.removeEventListener('mouseup', onResizerMouseUp);
    document.removeEventListener('click', onDocClick);
  };
}

import type { MigotoPlugin, PluginContext } from '../../types.ts';

/**
 * AI 모딩 어시스턴트 플러그인
 * OpenAI 또는 로컬 Ollama 호환 API를 연동하여 INI 분석, 섹션 생성 및 질의응답을 수행합니다.
 */
const aiAssistantPlugin: MigotoPlugin = {
  activate(context: PluginContext) {
    context.ui.registerSidebarView({
      id: 'ai-assistant',
      title: 'AI 에이전트',
      icon: 'AI',
      render(container) {
        container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview ai-assistant-panel';
        container.replaceChildren();

        const header = document.createElement('div');
        header.className = 'panel-section-title';
        header.innerHTML = '<span>AI 모딩 어시스턴트</span>';

        // Config Section (Collapsible)
        const configDetails = document.createElement('details');
        configDetails.className = 'ai-config-details';
        const summary = document.createElement('summary');
        summary.textContent = 'API 연결 설정 (OpenAI / Ollama)';
        configDetails.append(summary);

        const configBox = document.createElement('div');
        configBox.className = 'ai-config-box';

        const urlRow = document.createElement('div');
        urlRow.className = 'form-row';
        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'API URL:';
        const urlInput = document.createElement('input');
        urlInput.className = 'plugin-input';
        urlInput.placeholder = 'https://api.openai.com/v1';
        urlInput.value = context.storage.get('api_url', 'https://api.openai.com/v1');
        urlInput.oninput = () => context.storage.set('api_url', urlInput.value.trim());
        urlRow.append(urlLabel, urlInput);

        const keyRow = document.createElement('div');
        keyRow.className = 'form-row';
        const keyLabel = document.createElement('label');
        keyLabel.textContent = 'API Key:';
        const keyInput = document.createElement('input');
        keyInput.type = 'password';
        keyInput.className = 'plugin-input';
        keyInput.placeholder = 'sk-... (Ollama는 비워둠)';
        keyInput.value = context.storage.get('api_key', '');
        keyInput.oninput = () => context.storage.set('api_key', keyInput.value.trim());
        keyRow.append(keyLabel, keyInput);

        const modelRow = document.createElement('div');
        modelRow.className = 'form-row';
        const modelLabel = document.createElement('label');
        modelLabel.textContent = '모델명:';
        const modelInput = document.createElement('input');
        modelInput.className = 'plugin-input';
        modelInput.placeholder = 'gpt-4o-mini 또는 llama3';
        modelInput.value = context.storage.get('model', 'gpt-4o-mini');
        modelInput.oninput = () => context.storage.set('model', modelInput.value.trim());
        modelRow.append(modelLabel, modelInput);

        configBox.append(urlRow, keyRow, modelRow);
        configDetails.append(configBox);

        // Quick Action Prompts
        const quickActionsRow = document.createElement('div');
        quickActionsRow.className = 'ai-quick-actions';

        const btnFix = document.createElement('button');
        btnFix.className = 'small-btn';
        btnFix.textContent = '[분석] 문법/오류 분석';

        const btnToggle = document.createElement('button');
        btnToggle.className = 'small-btn';
        btnToggle.textContent = '[생성] 토글 키 섹션 생성';

        const btnComment = document.createElement('button');
        btnComment.className = 'small-btn';
        btnComment.textContent = '[주석] 섹션 한글 주석';

        quickActionsRow.append(btnFix, btnToggle, btnComment);

        // Chat History Container
        const chatHistory = document.createElement('div');
        chatHistory.className = 'ai-chat-history';

        // Input area
        const inputArea = document.createElement('div');
        inputArea.className = 'ai-input-area';

        const attachRow = document.createElement('div');
        attachRow.className = 'form-check-row';
        const attachCheck = document.createElement('input');
        attachCheck.type = 'checkbox';
        attachCheck.id = 'ai-attach-file';
        attachCheck.checked = true;
        const attachLabel = document.createElement('label');
        attachLabel.htmlFor = 'ai-attach-file';
        attachLabel.textContent = '현재 열린 INI 파일 내용 함께 전달';
        attachRow.append(attachCheck, attachLabel);

        const promptTextarea = document.createElement('textarea');
        promptTextarea.className = 'plugin-input ai-textarea';
        promptTextarea.placeholder = 'AI에게 INI 모딩 관련 질문이나 코드 작성을 요청하세요...';
        promptTextarea.rows = 3;

        const sendBtn = document.createElement('button');
        sendBtn.className = 'primary ai-send-btn';
        sendBtn.textContent = '전송';

        inputArea.append(attachRow, promptTextarea, sendBtn);

        function appendMessage(role: 'user' | 'assistant', text: string) {
          const msgEl = document.createElement('div');
          msgEl.className = `ai-message ${role}`;

          const badge = document.createElement('div');
          badge.className = 'ai-message-badge';
          badge.textContent = role === 'user' ? '[질문]' : '[AI 어시스턴트]';
          msgEl.append(badge);

          const contentEl = document.createElement('div');
          contentEl.className = 'ai-message-content';

          // Extract code blocks if any
          const codeBlockRegex = /```(?:ini)?([\s\S]*?)```/g;
          let lastIdx = 0;
          let match: RegExpExecArray | null;

          while ((match = codeBlockRegex.exec(text)) !== null) {
            const textBefore = text.slice(lastIdx, match.index);
            if (textBefore) {
              const p = document.createElement('p');
              p.textContent = textBefore;
              contentEl.append(p);
            }

            const codeContent = match[1].trim();
            const codeBox = document.createElement('div');
            codeBox.className = 'ai-code-block';

            const pre = document.createElement('pre');
            pre.textContent = codeContent;
            codeBox.append(pre);

            const btnBar = document.createElement('div');
            btnBar.className = 'ai-code-bar';

            const insertBtn = document.createElement('button');
            insertBtn.className = 'small-btn';
            insertBtn.textContent = '에디터에 삽입';
            insertBtn.onclick = () => {
              context.editor.insertText(codeContent + '\n');
              context.ui.showToast('에디터에 코드가 삽입되었습니다.', 'info');
            };

            const copyBtn = document.createElement('button');
            copyBtn.className = 'small-btn';
            copyBtn.textContent = '복사';
            copyBtn.onclick = () => {
              navigator.clipboard.writeText(codeContent);
              context.ui.showToast('클립보드에 복사되었습니다.', 'info');
            };

            btnBar.append(insertBtn, copyBtn);
            codeBox.append(btnBar);
            contentEl.append(codeBox);

            lastIdx = match.index + match[0].length;
          }

          const remaining = text.slice(lastIdx);
          if (remaining) {
            const p = document.createElement('p');
            p.textContent = remaining;
            contentEl.append(p);
          }

          msgEl.append(contentEl);
          chatHistory.append(msgEl);
          chatHistory.scrollTop = chatHistory.scrollHeight;
        }

        async function sendMessage(userPrompt: string) {
          if (!userPrompt.trim()) return;
          const apiUrl = (context.storage.get('api_url', 'https://api.openai.com/v1') as string).replace(/\/+$/, '');
          const apiKey = context.storage.get('api_key', '') as string;
          const model = context.storage.get('model', 'gpt-4o-mini') as string;

          appendMessage('user', userPrompt);
          promptTextarea.value = '';

          const systemPrompt = `당신은 3DMigoto 및 XXMI (.ini) 모딩 전문 개발 도우미입니다.
사용자의 INI 코드를 분석하거나 요청에 맞는 정확한 INI 섹션([KeyToggle], [TextureOverride], [Constants], [CommandList] 등)을 작성하세요.
코드는 반드시 \`\`\`ini 코드 \`\`\` 마크다운 코드 블록으로 감싸서 작성해 주세요.`;

          let promptWithContext = userPrompt;
          if (attachCheck.checked) {
            const file = context.workspace.getCurrentFile();
            const text = context.editor.getText();
            promptWithContext += `\n\n[현재 열린 파일: ${file?.name || 'document.ini'}]\n\`\`\`ini\n${text}\n\`\`\``;
          }

          sendBtn.disabled = true;
          sendBtn.textContent = '답변 생성 중...';

          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

            const res = await context.fetch(`${apiUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: promptWithContext },
                ],
                temperature: 0.3,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`API 오류 (${res.status}): ${errText}`);
            }

            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content || '(응답 없음)';
            appendMessage('assistant', reply);
          } catch (err: any) {
            appendMessage('assistant', `[오류] 오류가 발생했습니다: ${err.message || err}`);
            context.ui.showToast('AI 응답 생성 실패', 'error');
          } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = '전송';
          }
        }

        sendBtn.onclick = () => sendMessage(promptTextarea.value);

        btnFix.onclick = () => {
          promptTextarea.value = '현재 INI 파일의 문법적 오류나 권장되지 않는 작성 방식을 검사하고 수정안을 제시해 줘.';
          sendMessage(promptTextarea.value);
        };

        btnToggle.onclick = () => {
          promptTextarea.value = 'F1 키를 누르면 텍스처를 켜고 끄는 완전한 [KeyToggle] 및 관련 [Constants], [TextureOverride] 섹션을 만들어 줘.';
          sendMessage(promptTextarea.value);
        };

        btnComment.onclick = () => {
          promptTextarea.value = '현재 파일의 각 섹션 위에 어떤 역할을 하는지 한국어로 상세한 주석을 달아줘.';
          sendMessage(promptTextarea.value);
        };

        container.append(header, configDetails, quickActionsRow, chatHistory, inputArea);
      },
    });
  },
  deactivate() {},
};

export default aiAssistantPlugin;
export { aiAssistantPlugin };

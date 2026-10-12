import { definePlugin, type PluginContext } from '../../api.ts';
import iconSvg from './icon.ts';

/**
 * AI 모딩 어시스턴트 플러그인
 * OpenAI 또는 로컬 Ollama 호환 API를 연동하여 INI 분석, 섹션 생성 및 질의응답을 수행합니다.
 */
export default definePlugin({
  activate(context: PluginContext) {
    context.ui.registerSidebarView({
      id: 'ai-assistant',
      title: 'AI 에이전트',
      icon: iconSvg,
      render(container) {
        container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview ai-assistant-panel';
        container.replaceChildren();

        // 1. 헤더 생성
        const header = context.ui.createPanelHeader('AI 모딩 어시스턴트');

        // 2. 설정 영역 API
        const urlInput = context.ui.createInput({
          label: 'API URL:',
          placeholder: 'https://generativelanguage.googleapis.com/v1beta/openai 또는 https://api.openai.com/v1',
          value: context.storage.get('api_url', 'https://api.openai.com/v1'),
          onInput: (v) => context.storage.set('api_url', v.trim()),
        });

        const keyInput = context.ui.createInput({
          label: 'API Key:',
          type: 'password',
          placeholder: 'Gemini 또는 OpenAI API 키 (Ollama는 비워둠)',
          value: context.storage.get('api_key', ''),
          onInput: (v) => context.storage.set('api_key', v.trim()),
        });

        const modelInput = context.ui.createInput({
          label: '모델명:',
          placeholder: 'gemini-flash-latest, gpt-4o-mini 등',
          value: context.storage.get('model', 'gpt-4o-mini'),
          onInput: (v) => context.storage.set('model', v.trim()),
        });

        const presetRow = document.createElement('div');
        presetRow.className = 'ai-quick-actions';
        presetRow.style.marginBottom = '6px';

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
            context.ui.showToast('Ollama 설정이 적용되었습니다. (Key는 비워둠)', 'info');
          },
        });

        presetRow.append(btnPresetGemini, btnPresetOpenAI, btnPresetOllama);

        const configDetails = context.ui.createDetails({
          summary: 'API 연결 설정 (Gemini / OpenAI / Ollama)',
          children: [presetRow, urlInput.row, keyInput.row, modelInput.row],
        });

        // 3. 퀵 액션 프롬프트 툴바 API
        const btnFix = context.ui.createButton({
          text: '[분석] 문법/오류 분석',
          variant: 'small',
          onClick: () => {
            promptTextarea.value = '현재 INI 파일의 문법적 오류나 권장되지 않는 작성 방식을 검사하고 수정안을 제시해 줘.';
            sendMessage(promptTextarea.value);
          },
        });

        const btnToggle = context.ui.createButton({
          text: '[생성] 토글 키 섹션 생성',
          variant: 'small',
          onClick: () => {
            promptTextarea.value = 'F1 키를 누르면 텍스처를 켜고 끄는 완전한 [KeyToggle] 및 관련 [Constants], [TextureOverride] 섹션을 만들어 줘.';
            sendMessage(promptTextarea.value);
          },
        });

        const btnComment = context.ui.createButton({
          text: '[주석] 섹션 한글 주석',
          variant: 'small',
          onClick: () => {
            promptTextarea.value = '현재 파일의 각 섹션 위에 어떤 역할을 하는지 한국어로 상세한 주석을 달아줘.';
            sendMessage(promptTextarea.value);
          },
        });

        const quickActionsRow = document.createElement('div');
        quickActionsRow.className = 'ai-quick-actions';
        quickActionsRow.append(btnFix, btnToggle, btnComment);

        // 4. 대화 내역 컨테이너
        const chatHistory = document.createElement('div');
        chatHistory.className = 'ai-chat-history';

        // 5. 입력 영역 API
        const inputArea = document.createElement('div');
        inputArea.className = 'ai-input-area';

        const attachCheck = context.ui.createCheckbox({
          id: 'ai-attach-file',
          label: '현재 열린 INI 파일 내용 함께 전달',
          checked: true,
        });

        const promptTextarea = document.createElement('textarea');
        promptTextarea.className = 'plugin-input ai-textarea';
        promptTextarea.placeholder = 'AI에게 INI 모딩 관련 질문이나 코드 작성을 요청하세요...';
        promptTextarea.rows = 3;

        const sendBtn = context.ui.createButton({
          text: '전송',
          variant: 'primary',
          onClick: () => sendMessage(promptTextarea.value),
        });

        inputArea.append(attachCheck.row, promptTextarea, sendBtn);

        function appendMessage(role: 'user' | 'assistant', text: string) {
          const msgEl = context.ui.createChatMessage({
            role,
            badge: role === 'user' ? '[질문]' : '[AI 어시스턴트]',
            content: text,
            onInsertCode: (code) => {
              context.editor.insertText(code + '\n');
              context.ui.showToast('에디터에 코드가 삽입되었습니다.', 'info');
            },
            onCopyCode: (code) => {
              navigator.clipboard.writeText(code);
              context.ui.showToast('클립보드에 복사되었습니다.', 'info');
            },
          });

          chatHistory.append(msgEl);
          chatHistory.scrollTop = chatHistory.scrollHeight;
        }

        async function sendMessage(userPrompt: string) {
          if (!userPrompt.trim()) return;
          let apiUrl = (context.storage.get('api_url', 'https://api.openai.com/v1') as string).replace(/\/+$/, '');
          const apiKey = (context.storage.get('api_key', '') as string).trim();
          let model = (context.storage.get('model', 'gpt-4o-mini') as string).trim();

          // Google Gemini OpenAI endpoint auto-correction & model migration
          if (apiUrl.includes('generativelanguage.googleapis.com')) {
            if (!apiUrl.endsWith('/openai')) {
              apiUrl = `${apiUrl}/openai`;
            }
            if (
              !model ||
              model === 'gemini-1.5-pro' ||
              model === 'gemini-1.5-flash' ||
              model === 'gemini-pro' ||
              model === 'gemini-2.5-flash' ||
              model === 'gemini-2.5-pro'
            ) {
              model = 'gemini-flash-latest';
            }
          }

          appendMessage('user', userPrompt);
          promptTextarea.value = '';

          const systemPrompt = `당신은 3DMigoto 및 XXMI (.ini) 모딩 전문 개발 도우미입니다.
사용자의 INI 코드를 분석하거나 요청에 맞는 정확한 INI 섹션([KeyToggle], [TextureOverride], [Constants], [CommandList] 등)을 작성하세요.
코드는 반드시 \`\`\`ini 코드 \`\`\` 마크다운 코드 블록으로 감싸서 작성해 주세요.`;

          let promptWithContext = userPrompt;
          if (attachCheck.isChecked()) {
            const file = context.workspace.getCurrentFile();
            const text = context.editor.getText();
            promptWithContext += `\n\n[현재 열린 파일: ${file?.name || 'document.ini'}]\n\`\`\`ini\n${text}\n\`\`\``;
          }

          sendBtn.disabled = true;
          sendBtn.textContent = '답변 생성 중...';

          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              if (apiUrl.includes('generativelanguage.googleapis.com')) {
                headers['x-goog-api-key'] = apiKey;
              }
            }

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

        container.append(header, configDetails, quickActionsRow, chatHistory, inputArea);
      },
    });
  },
  deactivate() {},
});

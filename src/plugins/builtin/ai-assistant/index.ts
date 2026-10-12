import { definePlugin, type PluginContext } from '../../api.ts';
import iconSvg from './icon.ts';

/**
 * AI 모딩 어시스턴트 플러그인
 * OpenAI 또는 Google Gemini, 로컬 Ollama 호환 API를 연동하여 INI 분석, 섹션 생성 및 질의응답을 수행합니다.
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
        const settingsPane = document.createElement('div');
        settingsPane.className = 'ai-pane ai-settings-view';
        settingsPane.hidden = true;

        // 탭 전환 핸들러
        btnTabAgent.onclick = () => {
          btnTabAgent.classList.add('active');
          btnTabSettings.classList.remove('active');
          agentPane.hidden = false;
          settingsPane.hidden = true;
        };

        btnTabSettings.onclick = () => {
          btnTabSettings.classList.add('active');
          btnTabAgent.classList.remove('active');
          settingsPane.hidden = false;
          agentPane.hidden = true;
        };

        // --- [설정 패널 구성] ---
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

        const modelInput = context.ui.createInput({
          label: '모델명:',
          placeholder: 'gemini-flash-latest, gpt-4o-mini 등',
          value: context.storage.get('model', 'gemini-flash-latest'),
          onInput: (v) => context.storage.set('model', v.trim()),
        });

        const presetCard = document.createElement('div');
        presetCard.className = 'ai-settings-card';

        const presetTitle = document.createElement('div');
        presetTitle.className = 'ai-settings-card-title';
        presetTitle.textContent = '빠른 프로바이더 설정';

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
        presetCard.append(presetTitle, presetRow);

        const configCard = document.createElement('div');
        configCard.className = 'ai-settings-card';
        const configTitle = document.createElement('div');
        configTitle.className = 'ai-settings-card-title';
        configTitle.textContent = '연결 정보 입력';
        configCard.append(configTitle, urlInput.row, keyRow, modelInput.row);

        const guideCard = document.createElement('div');
        guideCard.className = 'ai-settings-card';
        guideCard.style.fontSize = '11px';
        guideCard.style.color = 'var(--fg-dim)';
        guideCard.style.lineHeight = '1.5';
        guideCard.innerHTML = `
          <div style="font-weight:600;color:var(--fg);margin-bottom:4px;">안내사항</div>
          <div>- Google Gemini: Google AI Studio 키(AQ...) 입력 시 gemini-flash-latest 모델이 무료 제공됩니다.</div>
          <div>- OpenAI: platform.openai.com API 키 및 gpt-4o-mini 모델을 권장합니다.</div>
          <div>- Ollama: 로컬 PC에서 실행 중인 경우 키 없이 바로 연결할 수 있습니다.</div>
        `;

        settingsPane.append(presetCard, configCard, guideCard);

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

        // 옵션 체크박스 영역 (INI 전달 / 자동 반영)
        const dockOptions = document.createElement('div');
        dockOptions.className = 'ai-dock-options';

        const attachLabel = document.createElement('label');
        attachLabel.className = 'ai-attach-label';
        attachLabel.title = '현재 에디터에 열려 있는 INI 파일 내용을 AI에게 함께 전달합니다.';
        const attachInput = document.createElement('input');
        attachInput.type = 'checkbox';
        attachInput.checked = true;
        const attachText = document.createElement('span');
        attachText.textContent = 'INI 전달';
        attachLabel.append(attachInput, attachText);

        const autoApplyLabel = document.createElement('label');
        autoApplyLabel.className = 'ai-attach-label';
        autoApplyLabel.title = '답변 완료 시 현재 열린 파일의 해당 섹션을 스마트하게 자동 교체/반영합니다.';
        const autoApplyInput = document.createElement('input');
        autoApplyInput.type = 'checkbox';
        autoApplyInput.checked = context.storage.get('auto_apply', false);
        autoApplyInput.onchange = () => context.storage.set('auto_apply', autoApplyInput.checked);
        const autoApplyText = document.createElement('span');
        autoApplyText.textContent = '자동 반영';
        autoApplyLabel.append(autoApplyInput, autoApplyText);

        dockOptions.append(attachLabel, autoApplyLabel);

        // 템플릿 드롭다운 버튼 & 메뉴
        const templateWrap = document.createElement('div');
        templateWrap.className = 'ai-template-btn-wrap';

        const templateBtn = document.createElement('button');
        templateBtn.className = 'small-btn';
        templateBtn.textContent = '템플릿 ▾';

        const templateMenu = document.createElement('ul');
        templateMenu.className = 'ai-template-menu';
        templateMenu.hidden = true;

        const templates: Array<{ label: string; text?: string; isAction?: boolean }> = [
          {
            label: '[분석] 문법 및 오류 분석',
            text: '현재 INI 파일의 문법적 오류나 권장되지 않는 작성 방식을 검사하고 수정안을 제시해 줘.',
          },
          {
            label: '[생성] 토글 키 섹션 생성',
            text: 'F1 키를 누르면 텍스처를 켜고 끄는 완전한 [KeyToggle] 및 관련 [Constants], [TextureOverride] 섹션을 만들어 줘.',
          },
          {
            label: '[주석] 섹션 한글 상세 주석',
            text: '현재 파일의 각 섹션 위에 어떤 역할을 하는지 한국어로 상세한 주석을 달아줘.',
          },
          {
            label: '[생성] 텍스처 오버라이드 기본형',
            text: '해시 값을 기반으로 텍스처를 교체하는 표준 [TextureOverride] 섹션 템플릿을 작성해 줘.',
          },
          {
            label: '[생성] 상수 및 커맨드리스트 생성',
            text: '조건 분기 및 변수 제어를 위한 [Constants] 및 [CommandList] 섹션 예제를 만들어 줘.',
          },
          {
            label: '---',
          },
          {
            label: '[지우기] 대화 내역 초기화',
            isAction: true,
          },
        ];

        templates.forEach((item) => {
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

        // 하단 메인 입력창 및 전송 버튼
        const dockMain = document.createElement('div');
        dockMain.className = 'ai-input-dock-main';

        const dockTextarea = document.createElement('textarea');
        dockTextarea.className = 'ai-dock-textarea';
        dockTextarea.placeholder = 'AI에게 질문이나 코드 작성을 요청하세요... (Enter로 전송, Shift+Enter 줄바꿈)';
        dockTextarea.rows = 1;

        const adjustTextareaHeight = () => {
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

        const sendBtn = document.createElement('button');
        sendBtn.className = 'primary ai-dock-send-btn';
        sendBtn.textContent = '전송';

        // 키보드 단축키: Enter 전송, Shift+Enter 줄바꿈
        dockTextarea.onkeydown = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(dockTextarea.value);
          }
        };

        sendBtn.onclick = () => sendMessage(dockTextarea.value);

        dockMain.append(dockTextarea, sendBtn);
        inputDock.append(dockTop, dockMain);

        agentPane.append(chatHistory, inputDock);

        // 컨테이너 조립
        container.append(subtabBar, agentPane, settingsPane);

        // 템플릿 메뉴 외부 클릭 시 닫기
        const onDocClick = (e: MouseEvent) => {
          if (!templateMenu.hidden && !templateWrap.contains(e.target as Node)) {
            templateMenu.hidden = true;
          }
        };
        document.addEventListener('click', onDocClick);

        // 스마트 섹션 교체 실행 함수 (context.ini API 활용)
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

        // 마크다운 응답 렌더링 헬퍼
        function renderAssistantContent(targetEl: HTMLElement, text: string) {
          targetEl.replaceChildren();
          const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?([\s\S]*?)```/g;
          let lastIdx = 0;
          let match: RegExpExecArray | null;

          while ((match = codeBlockRegex.exec(text)) !== null) {
            const textBefore = text.slice(lastIdx, match.index);
            if (textBefore.trim()) {
              const p = document.createElement('p');
              p.textContent = textBefore.trim();
              targetEl.append(p);
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
            const p = document.createElement('p');
            p.textContent = remaining.trim();
            targetEl.append(p);
          }
        }

        // 대화 메시지 턴 전송
        async function sendMessage(userPrompt: string) {
          const trimmedPrompt = userPrompt.trim();
          if (!trimmedPrompt) return;

          // 첫 메시지 전송 시 초기 안내 상태 제거
          if (emptyState.parentElement) {
            emptyState.remove();
          }

          dockTextarea.value = '';
          dockTextarea.style.height = '38px';
          dockTextarea.style.overflowY = 'hidden';

          // 1. 대화 턴 그룹 생성
          const turnGroup = document.createElement('div');
          turnGroup.className = 'ai-turn-group';

          // 2. 상단 고정 사용자 질문 카드 (Sticky)
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

          // 3. 어시스턴트 답변 영역
          const assistantBubble = document.createElement('div');
          assistantBubble.className = 'ai-assistant-bubble';

          const loadingNotice = document.createElement('div');
          loadingNotice.style.color = 'var(--fg-dim)';
          loadingNotice.style.fontSize = '11px';
          loadingNotice.textContent = '답변을 생성하고 있습니다...';
          assistantBubble.append(loadingNotice);

          turnGroup.append(assistantBubble);
          chatHistory.append(turnGroup);
          chatHistory.scrollTop = chatHistory.scrollHeight;

          // 4. API 호출 준비
          let apiUrl = (context.storage.get('api_url', 'https://generativelanguage.googleapis.com/v1beta/openai') as string).replace(/\/+$/, '');
          const apiKey = (context.storage.get('api_key', '') as string).trim();
          let model = (context.storage.get('model', 'gemini-flash-latest') as string).trim();

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

          const systemPrompt = `당신은 3DMigoto 및 XXMI (.ini) 모딩 전문 개발 도우미입니다.
사용자의 INI 코드를 분석하거나 요청에 맞는 정확한 INI 섹션([KeyToggle], [TextureOverride], [Constants], [CommandList] 등)을 작성하세요.
코드는 반드시 \`\`\`ini 코드 \`\`\` 마크다운 코드 블록으로 감싸서 작성해 주세요.`;

          let promptWithContext = trimmedPrompt;
          if (attachInput.checked) {
            const file = context.workspace.getCurrentFile();
            const text = context.editor.getText();
            promptWithContext += `\n\n[현재 열린 파일: ${file?.name || 'document.ini'}]\n\`\`\`ini\n${text}\n\`\`\``;
          }

          sendBtn.disabled = true;
          sendBtn.textContent = '생성 중...';

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
            renderAssistantContent(assistantBubble, reply);

            // 자동 반영 옵션이 켜져 있는 경우 스마트 섹션 자동 교체 수행
            if (autoApplyInput.checked) {
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
            assistantBubble.replaceChildren();
            const errP = document.createElement('p');
            errP.style.color = '#ef4444';
            errP.textContent = `[오류] ${err.message || err}`;
            assistantBubble.append(errP);
            context.ui.showToast('AI 응답 생성 실패', 'error');
          } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = '전송';
            chatHistory.scrollTop = chatHistory.scrollHeight;
          }
        }

        return () => {
          document.removeEventListener('click', onDocClick);
        };
      },
    });
  },
  deactivate() {},
});

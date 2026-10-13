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

        // 저장된 모델이 404를 유발하는 레거시 모델명이면 최신 gemini-flash-latest로 자동 마이그레이션
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

        // 빠른 모델 선택 칩
        const modelChipsWrap = document.createElement('div');
        modelChipsWrap.className = 'ai-model-chips';

        const availableModels = [
          { name: 'gemini-flash-latest', label: 'gemini-flash-latest' },
          { name: 'gemini-pro-latest', label: 'gemini-pro-latest' },
          { name: 'gpt-4o-mini', label: 'gpt-4o-mini' },
          { name: 'gpt-4o', label: 'gpt-4o' },
        ];

        const renderChips = () => {
          modelChipsWrap.replaceChildren();
          const current = (context.storage.get('model', 'gemini-flash-latest') as string).trim();
          for (const m of availableModels) {
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

        presetRow.append(btnPresetGemini, btnPresetOpenAI, btnPresetOllama);
        presetCard.append(presetTitle, presetRow);

        const configCard = document.createElement('div');
        configCard.className = 'ai-settings-card';
        const configTitle = document.createElement('div');
        configTitle.className = 'ai-settings-card-title';
        configTitle.textContent = '연결 정보 입력';
        configCard.append(configTitle, urlInput.row, keyRow, modelInput.row, modelChipsWrap);

        const guideCard = document.createElement('div');
        guideCard.className = 'ai-settings-card';
        guideCard.style.fontSize = '11px';
        guideCard.style.color = 'var(--fg-dim)';
        guideCard.style.lineHeight = '1.5';
        guideCard.innerHTML = `
          <div style="font-weight:600;color:var(--fg);margin-bottom:4px;">안내사항</div>
          <div>- Google Gemini: Google AI Studio 키(AQ...) 입력 시 gemini-flash-latest 모델이 기본 제공됩니다.</div>
          <div>- 404 오류 발생 시: 모델명을 gemini-flash-latest 또는 gemini-pro-latest로 지정하세요.</div>
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

        // 옵션 영역 (컨텍스트 모드 선택 / 자동 반영)
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
            text: '현재 INI 파일의 문법적 오류나 권장되지 않는 작성 방식을 3DMigoto/XXMI 규격(elif 및 빌트인 키워드 지원) 기준으로 검사하고 개선안을 제시해 줘.',
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

        // 수평 스플릿 바 (입력창 높이 조절)
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

        // 스플릿 리사이저 드래그 이벤트 핸들러
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

        agentPane.append(chatHistory, dockResizer, inputDock);

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

        // HTML 안전 이스케이프 함수
        function escapeHtml(str: string): string {
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        // 인라인 마크다운 변환 함수 (인라인 코드, 볼드, 이탤릭, 링크)
        function formatInlineMarkdown(text: string): string {
          const safe = escapeHtml(text);
          const codeTokens: string[] = [];
          const tokenized = safe.replace(/`([^`]+)`/g, (_match, codeContent) => {
            const idx = codeTokens.length;
            codeTokens.push(`<code class="ai-inline-code">${codeContent}</code>`);
            return `\uFFF0CODE_${idx}\uFFF1`;
          });
          let formatted = tokenized.replace(/(\*\*\*|___)(.*?)\1/g, '<strong><em>$2</em></strong>');
          formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
          formatted = formatted.replace(/(?<!\w)(\*|_)(.*?)\1(?!\w)/g, '<em>$2</em>');
          formatted = formatted.replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-link">$1</a>',
          );
          formatted = formatted.replace(/\uFFF0CODE_(\d+)\uFFF1/g, (_m, idxStr) => {
            const idx = parseInt(idxStr, 10);
            return codeTokens[idx] || '';
          });
          return formatted;
        }

        // 블록 마크다운 파서 (제목, 목록, 인용문, 테이블, 단락, 가로선)
        function parseMarkdownToHtml(mdText: string): string {
          const lines = mdText.split(/\r?\n/);
          const out: string[] = [];
          let inUl = false;
          let inOl = false;
          let inBlockquote = false;
          let inTable = false;
          let tableHeaders: string[] = [];
          let tableRows: string[][] = [];
          let paraLines: string[] = [];

          const flushPara = () => {
            if (paraLines.length > 0) {
              const content = paraLines.map((l) => formatInlineMarkdown(l)).join('<br>');
              out.push(`<p class="ai-md-p">${content}</p>`);
              paraLines = [];
            }
          };

          const flushTable = () => {
            if (!inTable) return;
            let html = '<table class="ai-md-table">';
            if (tableHeaders.length > 0) {
              html += '<thead><tr>';
              for (const th of tableHeaders) {
                html += `<th>${formatInlineMarkdown(th)}</th>`;
              }
              html += '</tr></thead>';
            }
            if (tableRows.length > 0) {
              html += '<tbody>';
              for (const row of tableRows) {
                html += '<tr>';
                for (const cell of row) {
                  html += `<td>${formatInlineMarkdown(cell)}</td>`;
                }
                html += '</tr>';
              }
              html += '</tbody>';
            }
            html += '</table>';
            out.push(html);
            inTable = false;
            tableHeaders = [];
            tableRows = [];
          };

          const closeBlocks = () => {
            flushPara();
            flushTable();
            if (inUl) {
              out.push('</ul>');
              inUl = false;
            }
            if (inOl) {
              out.push('</ol>');
              inOl = false;
            }
            if (inBlockquote) {
              out.push('</blockquote>');
              inBlockquote = false;
            }
          };

          for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const trimmed = rawLine.trim();

            if (!trimmed) {
              closeBlocks();
              continue;
            }

            // 테이블 감지: | 컬럼 | 컬럼 |
            if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
              flushPara();
              if (inUl) { out.push('</ul>'); inUl = false; }
              if (inOl) { out.push('</ol>'); inOl = false; }
              if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }

              const isDivider = /^\|?(\s*:?-{2,}:?\s*\|)+\s*$/.test(trimmed);
              if (isDivider) {
                continue;
              }

              const cells = trimmed
                .slice(1, -1)
                .split('|')
                .map((c) => c.trim());

              if (!inTable) {
                inTable = true;
                tableHeaders = cells;
              } else {
                tableRows.push(cells);
              }
              continue;
            } else if (inTable) {
              flushTable();
            }

            // 가로선: ---, ***, ___
            if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
              closeBlocks();
              out.push('<hr class="ai-md-hr">');
              continue;
            }

            // 제목: # ~ ####
            const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
              closeBlocks();
              const level = Math.min(headerMatch[1].length + 2, 6);
              out.push(
                `<h${level} class="ai-md-h ai-md-h${level}">${formatInlineMarkdown(headerMatch[2])}</h${level}>`,
              );
              continue;
            }

            // 인용문: > 본문
            const quoteMatch = trimmed.match(/^>\s?(.*)$/);
            if (quoteMatch) {
              flushPara();
              if (inUl) { out.push('</ul>'); inUl = false; }
              if (inOl) { out.push('</ol>'); inOl = false; }
              if (!inBlockquote) {
                out.push('<blockquote class="ai-md-quote">');
                inBlockquote = true;
              }
              out.push(`<p>${formatInlineMarkdown(quoteMatch[1])}</p>`);
              continue;
            } else if (inBlockquote) {
              out.push('</blockquote>');
              inBlockquote = false;
            }

            // 비순서 목록: - 항목, * 항목
            const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
            if (ulMatch) {
              flushPara();
              if (inOl) { out.push('</ol>'); inOl = false; }
              if (!inUl) {
                out.push('<ul class="ai-md-ul">');
                inUl = true;
              }
              out.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
              continue;
            } else if (inUl && !rawLine.startsWith('  ') && !rawLine.startsWith('\t')) {
              out.push('</ul>');
              inUl = false;
            }

            // 순서 목록: 1. 항목
            const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            if (olMatch) {
              flushPara();
              if (inUl) { out.push('</ul>'); inUl = false; }
              if (!inOl) {
                out.push('<ol class="ai-md-ol">');
                inOl = true;
              }
              out.push(`<li>${formatInlineMarkdown(olMatch[1])}</li>`);
              continue;
            } else if (inOl && !rawLine.startsWith('  ') && !rawLine.startsWith('\t')) {
              out.push('</ol>');
              inOl = false;
            }

            paraLines.push(rawLine);
          }

          closeBlocks();
          return out.join('');
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

        // 진행 중인 요청 제어 및 지연 헬퍼
        let activeAbortController: AbortController | null = null;

        function abortActiveRequest(reason = 'USER') {
          if (activeAbortController) {
            activeAbortController.abort(reason);
            activeAbortController = null;
          }
        }

        function delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
          return new Promise((resolve, reject) => {
            if (signal?.aborted) {
              return reject(new DOMException('Aborted', 'AbortError'));
            }
            const timer = setTimeout(() => {
              resolve();
            }, ms);
            signal?.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true },
            );
          });
        }

        // 스마트 프롬프트 컨텍스트 빌더
        function buildPromptContext(
          userPrompt: string,
          mode: 'smart' | 'full' | 'none',
        ): {
          promptText: string;
          detail: string;
        } {
          if (mode === 'none') {
            return {
              promptText: userPrompt,
              detail: '단독 질의 모드 (에디터 코드 제외)',
            };
          }

          const file = context.workspace.getCurrentFile();
          const currentFileName = file?.name || 'document.ini';
          const fullText = context.editor.getText();
          const allLines = fullText.split('\n');
          const totalLines = allLines.length;

          if (mode === 'full') {
            return {
              promptText: `${userPrompt}\n\n[현재 열린 파일: ${currentFileName} (전체 코드가 전달되었습니다)]\n\`\`\`ini\n${fullText}\n\`\`\``,
              detail: `${currentFileName} (${totalLines}줄 전체 첨부)`,
            };
          }

          // --- [스마트 모드: 개요 + 커서 섹션 + 질문 연관 섹션 발췌] ---
          const doc = context.ini.parse(fullText);
          const cursor = context.editor.getCursor();
          const cursorLine = cursor?.lineNumber || 1;

          // 1. 현재 커서가 위치한 섹션 탐색
          const cursorSection = doc.sections.find(
            (s) => cursorLine >= s.startLine && cursorLine <= s.endLine,
          );

          // 2. 사용자 질문 키워드와 매칭되는 관련 섹션 선별
          const lowerPrompt = userPrompt.toLowerCase();
          const matchedSections: typeof doc.sections = [];

          for (const s of doc.sections) {
            if (cursorSection && s.name === cursorSection.name) continue;
            const lowerName = s.name.toLowerCase();

            const hasNameMatch = lowerPrompt.includes(lowerName);
            const hasPartMatch =
              ((lowerPrompt.includes('hair') || lowerPrompt.includes('헤어')) && lowerName.includes('hair')) ||
              ((lowerPrompt.includes('face') || lowerPrompt.includes('얼굴')) && lowerName.includes('face')) ||
              ((lowerPrompt.includes('body') || lowerPrompt.includes('바디') || lowerPrompt.includes('몸')) && lowerName.includes('body')) ||
              ((lowerPrompt.includes('skirt') || lowerPrompt.includes('치마')) && lowerName.includes('skirt')) ||
              ((lowerPrompt.includes('dress') || lowerPrompt.includes('드레스') || lowerPrompt.includes('옷')) && (lowerName.includes('dress') || lowerName.includes('body'))) ||
              ((lowerPrompt.includes('toggle') || lowerPrompt.includes('토글') || lowerPrompt.includes('키')) && (lowerName.startsWith('key') || lowerName.startsWith('constants'))) ||
              ((lowerPrompt.includes('command') || lowerPrompt.includes('커맨드')) && lowerName.startsWith('commandlist'));

            if (hasNameMatch || hasPartMatch) {
              matchedSections.push(s);
              if (matchedSections.length >= 3) break;
            }
          }

          // 변수나 토글 관련 질문일 경우 Constants 섹션 우선 보강
          const isVariableRelated =
            lowerPrompt.includes('토글') ||
            lowerPrompt.includes('toggle') ||
            lowerPrompt.includes('키') ||
            lowerPrompt.includes('key') ||
            lowerPrompt.includes('변수') ||
            lowerPrompt.includes('$');

          if (isVariableRelated) {
            const constSec = doc.getSection('Constants');
            if (constSec && constSec !== cursorSection && !matchedSections.includes(constSec)) {
              matchedSections.unshift(constSec);
            }
          }

          // 3. 파일 전체 구조 요약본 (Outline) 생성
          const outlineLines: string[] = [];
          outlineLines.push(`[문서 구조 요약 - 총 ${doc.sections.length}개 섹션 선언됨]`);

          for (const s of doc.sections) {
            const grp = context.ini.classifySection(s.name);
            const keyProp = s.properties['hash']
              ? `hash=${s.properties['hash']}`
              : s.properties['key']
                ? `key=${s.properties['key']}`
                : s.properties['type']
                  ? `type=${s.properties['type']}`
                  : '';
            outlineLines.push(`- [${s.name}] (${grp}${keyProp ? `, ${keyProp}` : ''}, 라인 ${s.startLine}~${s.endLine})`);
          }

          const constSecForVars = doc.getSection('Constants');
          const varNames = constSecForVars ? Object.keys(constSecForVars.variables) : [];
          if (varNames.length > 0) {
            outlineLines.push(`- 선언된 전역 변수: ${varNames.slice(0, 10).join(', ')}${varNames.length > 10 ? ' 외...' : ''}`);
          }

          // 4. 발췌 섹션 본문 묶음 생성
          const excerptBlocks: string[] = [];

          if (cursorSection) {
            excerptBlocks.push(`; [현재 에디터 커서 위치 섹션 (${cursorSection.name})]\n${cursorSection.fullText}`);
          }

          for (const ms of matchedSections) {
            excerptBlocks.push(`; [질문과 연관된 참고 섹션 (${ms.name})]\n${ms.fullText}`);
          }

          if (excerptBlocks.length === 0 && doc.sections.length > 0) {
            const firstSec = doc.sections[0];
            excerptBlocks.push(`; [파일 첫 번째 섹션 (${firstSec.name})]\n${firstSec.fullText}`);
          }

          const smartContextBody = [
            `[현재 열린 파일: ${currentFileName} - 스마트 요약 및 발췌 컨텍스트]`,
            outlineLines.join('\n'),
            '',
            '[수정 및 질문과 관련된 주요 섹션 본문 발췌]',
            excerptBlocks.join('\n\n'),
          ].join('\n');

          const sentLines = smartContextBody.split('\n').length;
          const savingsPercent = totalLines > 0 ? Math.max(0, Math.round(((totalLines - sentLines) / totalLines) * 100)) : 0;

          const targetNames: string[] = [];
          if (cursorSection) targetNames.push(`커서:[${cursorSection.name}]`);
          matchedSections.forEach((m) => targetNames.push(`연관:[${m.name}]`));

          const detail = `${currentFileName} (스마트 발췌: ${sentLines}줄 전달, 원본 ${totalLines}줄 대비 ${savingsPercent}% 토큰 절감, ${targetNames.join(', ') || '개요 전송'})`;

          return {
            promptText: `${userPrompt}\n\n${smartContextBody}`,
            detail,
          };
        }

        // 대화 메시지 턴 전송
        async function sendMessage(userPrompt: string) {
          const trimmedPrompt = userPrompt.trim();
          if (!trimmedPrompt) return;

          // 진행 중인 이전 요청이 있다면 중단
          if (activeAbortController) {
            abortActiveRequest('NEW_REQUEST');
          }

          const abortController = new AbortController();
          activeAbortController = abortController;

          // 첫 메시지 전송 시 초기 안내 상태 제거
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

          // 실시간 진행 상황 카드 생성
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

          // 실시간 단계 정의 및 갱신 헬퍼
          type StepStatus = 'pending' | 'active' | 'completed' | 'retry' | 'error';
          interface StatusStep {
            label: string;
            detail?: string;
            status: StepStatus;
          }

          const steps: StatusStep[] = [
            { label: '요청 컨텍스트 분석 및 준비', status: 'pending' },
            { label: 'AI API 서버 연결 준비', status: 'pending' },
            { label: '서버 응답 대기 중', status: 'pending' },
            { label: '응답 렌더링 및 완료', status: 'pending' },
          ];

          function updateStep(idx: number, status: StepStatus, label?: string, detail?: string) {
            if (steps[idx]) {
              steps[idx].status = status;
              if (label) steps[idx].label = label;
              if (detail !== undefined) steps[idx].detail = detail;
            }
            renderSteps();
          }

          function renderSteps() {
            stepsContainer.replaceChildren();
            for (const step of steps) {
              if (step.status === 'pending') continue;
              const row = document.createElement('div');
              row.className = `ai-status-step ${step.status}`;

              const dot = document.createElement('span');
              dot.className = 'ai-status-step-dot';
              dot.textContent =
                step.status === 'completed'
                  ? '[완료]'
                  : step.status === 'error'
                    ? '[오류]'
                    : step.status === 'retry'
                      ? '[재시도]'
                      : '[진행]';

              const textWrap = document.createElement('div');
              textWrap.style.display = 'flex';
              textWrap.style.flexDirection = 'column';

              const labelSpan = document.createElement('span');
              labelSpan.textContent = step.label;
              textWrap.append(labelSpan);

              if (step.detail) {
                const detailSpan = document.createElement('span');
                detailSpan.style.fontSize = '9.5px';
                detailSpan.style.color = 'var(--fg-dim)';
                detailSpan.textContent = step.detail;
                textWrap.append(detailSpan);
              }

              row.append(dot, textWrap);
              stepsContainer.append(row);
            }
          }

          // 타이머 및 타임아웃(45초) 가동
          const startTime = Date.now();
          const timerInterval = setInterval(() => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            timerEl.textContent = `${elapsed}s`;
          }, 100);

          const timeoutTimer = setTimeout(() => {
            abortController.abort('TIMEOUT');
          }, 45000);

          // 4. API 호출 준비 및 단계 진행
          updateStep(0, 'active', '컨텍스트 분석 중...');

          let apiUrl = (
            context.storage.get('api_url', 'https://generativelanguage.googleapis.com/v1beta/openai') as string
          ).replace(/\/+$/, '');
          const apiKey = (context.storage.get('api_key', '') as string).trim();
          let model = (context.storage.get('model', 'gemini-flash-latest') as string).trim();

          // Google Gemini OpenAI 엔드포인트 자동 정정 및 레거시 모델 보정
          if (apiUrl.includes('generativelanguage.googleapis.com')) {
            if (!apiUrl.endsWith('/openai')) {
              apiUrl = `${apiUrl}/openai`;
            }
            if (
              !model ||
              model.startsWith('gemini-2.') ||
              model.startsWith('gemini-1.') ||
              model === 'gemini-pro'
            ) {
              model = 'gemini-flash-latest';
              context.storage.set('model', 'gemini-flash-latest');
              modelInput.setValue('gemini-flash-latest');
              renderChips();
            }
          }

          const providerName = apiUrl.includes('generativelanguage.googleapis.com')
            ? 'Google Gemini'
            : apiUrl.includes('api.openai.com')
              ? 'OpenAI'
              : apiUrl.includes('localhost:11434')
                ? '로컬 Ollama'
                : '사용자 지정 API';

          statusInfo.textContent = `${providerName} / ${model}`;

          const systemPrompt = `당신은 3DMigoto 및 XXMI (.ini) 모딩 전문 개발 도우미입니다.
사용자가 제공한 [문서 구조 요약] 및 [관련 섹션 본문]을 바탕으로 질문의 의도를 분석하고 정확한 INI 코드를 작성하세요.

[3DMigoto / XXMI 문법 및 시스템 키워드 규칙]
1. 빌트인 시스템 변수 (중요):
   - 3DMigoto 및 XXMI 엔진에서 자체 제공하는 시스템 변수 및 상수들은 '$' 접두사를 붙이지 않는 정식 내장 키워드입니다:
     * 드로우 및 파이프라인: draw_type (또는 DRAW_TYPE), vertex_count, index_count, instance_count, first_vertex, first_index, first_instance, indirect_offset
     * 화면 및 해상도: rt_width, rt_height, res_width, res_height, window_width, window_height, scissor_left, scissor_top, scissor_right, scissor_bottom
     * 상태 및 시간: time, frame_time, fps, frame_number, draw_number, dispatch_number, hunting, sli, frame_analysis, cursor_showing, cursor_x, cursor_y, separation, convergence
   - 예시: 'if draw_type == 1' 또는 'if DRAW_TYPE == 1'은 3DMigoto/XXMI의 완전한 표준 정식 문법입니다.
   - 절대 이 키워드들을 사용자 변수로 오인하여 '$'를 붙이도록 하거나 [Constants]에 'global $DRAW_TYPE = 0' 등으로 선언하라고 잘못 지적하지 마십시오.
2. 사용자 정의 변수:
   - 모더가 정의하는 상태 변수나 토글 변수는 '$'로 시작합니다 (예: '$toggle', '$active', 'global $costume = 0').
   - 사용자 변수는 [Constants] 섹션에 선언되거나 [KeyToggle] 등에서 정의됩니다.
3. 조건문 문법 및 elif 지원 (매우 중요):
   - 3DMigoto 및 XXMI 파서는 'if', 'elif', 'else if', 'else', 'endif'를 공식적으로 완전하게 지원합니다.
   - 예시 구조:
     if <조건1>
         ...
     elif <조건2>
         ...
     else if <조건3>
         ...
     else
         ...
     endif
   - 'elif'와 'else if'는 3DMigoto/XXMI 파서가 지원하는 정식 표준 문법입니다. 절대로 'elif가 지원되지 않는다'고 잘못 답변하거나, 이를 별도의 개별 'if' 문으로 강제 분리하라고 안내하지 마십시오.
   - 조건 비교 연산자: '==', '!=', '>=', '<=', '>', '<' 등을 지원합니다 (단독 '='는 할당이므로 조건식에서는 '==' 사용).
   - 모든 조건 분기 블록('if ... elif ... else')은 마지막에 단 하나의 'endif'로 닫힙니다.

[중요 작성 규칙]
1. 파일 전체 코드를 처음부터 끝까지 다시 작성하지 마십시오.
2. 사용자의 요청에 따라 새로 생성하거나 수정해야 할 특정 섹션([KeyToggle], [TextureOverride], [Constants], [CommandList] 등) 단위만 마크다운 \`\`\`ini 코드 \`\`\` 블록으로 작성하십시오.
3. 에디터가 해당 섹션만 찾아 제자리(in-place)에 스마트 교체하므로, 변경이 필요한 섹션들만 온전하게 작성하면 됩니다.
4. 코드 블록 외의 추가 설명이나 가이드는 명확하고 간결하게 작성하십시오.`;

          const contextMode = (contextSelect.value || 'smart') as 'smart' | 'full' | 'none';
          const ctxResult = buildPromptContext(trimmedPrompt, contextMode);
          const promptWithContext = ctxResult.promptText;

          updateStep(0, 'completed', '컨텍스트 준비 완료', ctxResult.detail);
          updateStep(1, 'completed', 'AI API 연결 준비 완료', `${providerName} (${model})`);

          // 전송 버튼을 [중단] 버튼으로 전환
          sendBtn.textContent = '중단';
          sendBtn.classList.remove('primary');
          sendBtn.classList.add('danger');
          sendBtn.onclick = () => abortActiveRequest('USER');

          statusTitle.textContent = '답변 생성 중...';
          updateStep(2, 'active', '서버 응답 대기 중...', 'AI 서버에 질의를 전송하고 답변 수신을 대기하고 있습니다.');

          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              if (apiUrl.includes('generativelanguage.googleapis.com')) {
                headers['x-goog-api-key'] = apiKey;
              }
            }

            const maxRetries = 2;
            let attempt = 0;
            let replyData: any = null;

            while (attempt <= maxRetries) {
              attempt++;
              try {
                const res = await context.fetch(`${apiUrl}/chat/completions`, {
                  method: 'POST',
                  headers,
                  signal: abortController.signal,
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
                  if ((res.status === 503 || res.status === 429) && attempt <= maxRetries) {
                    const waitSec = attempt === 1 ? 2.0 : 3.5;
                    updateStep(
                      2,
                      'retry',
                      `서버 일시 과부하 (${res.status}) 감지`,
                      `트래픽 급증으로 인해 ${waitSec}초 후 자동으로 재시도합니다... (시도: ${attempt}/${maxRetries}회)`,
                    );
                    await delayWithAbort(waitSec * 1000, abortController.signal);
                    updateStep(2, 'active', '서버 재요청 전송 중...', `재시도 (${attempt}/${maxRetries}) 응답 대기 중`);
                    continue;
                  }
                  throw new Error(`API 오류 (${res.status}): ${errText}`);
                }

                replyData = await res.json();
                break;
              } catch (err: any) {
                if (abortController.signal.aborted) {
                  throw err;
                }
                if (attempt > maxRetries) {
                  throw err;
                }
                const waitSec = 2.0;
                updateStep(2, 'retry', '네트워크 응답 지연', `${waitSec}초 후 다시 연결을 시도합니다...`);
                await delayWithAbort(waitSec * 1000, abortController.signal);
              }
            }

            clearInterval(timerInterval);
            clearTimeout(timeoutTimer);

            const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
            updateStep(2, 'completed', '서버 응답 수신 완료', `응답 수신 (소요: ${totalSec}s)`);
            updateStep(3, 'active', '마크다운 렌더링 중...');

            const reply = replyData.choices?.[0]?.message?.content || '(응답 없음)';

            // 상태 카드를 깔끔한 메타 헤더로 대체
            statusCard.remove();

            const metaHeader = document.createElement('div');
            metaHeader.className = 'ai-completion-meta';
            metaHeader.innerHTML = `<span>답변 생성 완료 (${totalSec}s 소요)</span><span>${providerName} / ${model}</span>`;
            assistantBubble.append(metaHeader);

            const replyBody = document.createElement('div');
            replyBody.className = 'ai-reply-body';
            renderAssistantContent(replyBody, reply);
            assistantBubble.append(replyBody);

            // 자동 반영 옵션 활성화 시 스마트 병합 실행
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
                updateStep(
                  2,
                  'error',
                  '응답 대기 시간 초과 (45초)',
                  'AI 서버가 지정된 시간 내에 응답하지 못했습니다. 트래픽 과부하 상태일 수 있습니다.',
                );
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
                updateStep(
                  2,
                  'error',
                  'Google AI 서버 일시적 과부하 (503)',
                  '무료 티어 트래픽 집중으로 인해 현재 모델이 일시 지연되었습니다.',
                );
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

        // 에러 복구 및 대체 모델 전환 가이드 렌더러
        function renderErrorActions(
          container: HTMLElement,
          prompt: string,
          currentModel: string,
          reason: '503' | 'TIMEOUT' | '404' | 'GENERAL',
        ) {
          const box = document.createElement('div');
          box.style.marginTop = '8px';
          box.style.padding = '8px 10px';
          box.style.background = 'rgba(239, 68, 68, 0.08)';
          box.style.border = '1px solid rgba(239, 68, 68, 0.25)';
          box.style.borderRadius = '6px';
          box.style.display = 'flex';
          box.style.flexDirection = 'column';
          box.style.gap = '6px';

          const desc = document.createElement('div');
          desc.style.fontSize = '11px';
          desc.style.color = '#fca5a5';
          desc.style.lineHeight = '1.45';

          if (reason === '503') {
            desc.textContent =
              'Google Gemini 무료 티어 트래픽 집중으로 인해 요청이 일시 지연되었습니다. 잠시 후 다시 시도하시거나 다른 모델로 변경해 보세요.';
          } else if (reason === 'TIMEOUT') {
            desc.textContent =
              '서버 응답이 45초 동안 지연되었습니다. 네트워크 상태를 확인하시거나 다시 시도해 보세요.';
          } else if (reason === '404') {
            desc.textContent =
              '지정된 모델 또는 엔드포인트를 찾을 수 없습니다 (404). Google Gemini 공식 별칭인 gemini-flash-latest 또는 gemini-pro-latest를 사용하세요.';
          } else {
            desc.textContent = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 보세요.';
          }

          const btnRow = document.createElement('div');
          btnRow.style.display = 'flex';
          btnRow.style.gap = '6px';
          btnRow.style.flexWrap = 'wrap';

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
          container.append(box);
        }

        return () => {
          if (activeAbortController) {
            activeAbortController.abort('UNMOUNT');
          }
          window.removeEventListener('mousemove', onResizerMouseMove);
          window.removeEventListener('mouseup', onResizerMouseUp);
          document.removeEventListener('click', onDocClick);
        };
      },
    });
  },
  deactivate() { },
});

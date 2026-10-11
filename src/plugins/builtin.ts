import type { MigotoPlugin, PluginManifest } from './types';
import { decodeDDS } from './dds-decoder.ts';

export interface BuiltinPluginDef {
  manifest: PluginManifest;
  createPlugin: () => MigotoPlugin;
  standaloneScript: string;
}

// ============================================================================
// 1. Python 스크립트 실행기
// ============================================================================
const PYTHON_RUNNER_MANIFEST: PluginManifest = {
  id: 'python-runner',
  name: 'Python 스크립트 실행기',
  version: '1.0.0',
  description: '파이썬 스크립트를 에디터 내에서 직접 실행하고 출력 결과를 에디터에 반영합니다.',
  author: 'Migoto Studio',
  icon: '🐍',
  category: 'tools',
};

function createPythonRunnerPlugin(): MigotoPlugin {
  return {
    activate(context) {
      context.ui.registerSidebarView({
        id: 'python-runner-view',
        title: 'Python 실행기',
        icon: '🐍',
        render(container) {
          container.className = 'plugin-subview python-runner-panel';
          container.replaceChildren();

          // Header
          const header = document.createElement('div');
          header.className = 'panel-section-title';
          header.innerHTML = '<span>🐍 Python 실행기</span>';

          // Exec Command Row
          const cmdRow = document.createElement('div');
          cmdRow.className = 'form-row';
          const cmdLabel = document.createElement('label');
          cmdLabel.textContent = '실행 명령:';
          const cmdSelect = document.createElement('select');
          cmdSelect.className = 'plugin-select';
          ['python', 'py', 'python3'].forEach((cmd) => {
            const opt = document.createElement('option');
            opt.value = cmd;
            opt.textContent = cmd;
            cmdSelect.append(opt);
          });
          const savedCmd = context.storage.get('cmd', 'python');
          cmdSelect.value = savedCmd;
          cmdSelect.onchange = () => context.storage.set('cmd', cmdSelect.value);
          cmdRow.append(cmdLabel, cmdSelect);

          // Arguments Input
          const argsRow = document.createElement('div');
          argsRow.className = 'form-row';
          const argsLabel = document.createElement('label');
          argsLabel.textContent = '추가 인자:';
          const argsInput = document.createElement('input');
          argsInput.className = 'plugin-input';
          argsInput.placeholder = '예: --verbose output.ini';
          argsInput.value = context.storage.get('args', '');
          argsInput.oninput = () => context.storage.set('args', argsInput.value);
          argsRow.append(argsLabel, argsInput);

          // Pass current file checkbox
          const optRow = document.createElement('div');
          optRow.className = 'form-check-row';
          const passFileCheck = document.createElement('input');
          passFileCheck.type = 'checkbox';
          passFileCheck.id = 'py-pass-file';
          passFileCheck.checked = context.storage.get('pass_file', true);
          passFileCheck.onchange = () => context.storage.set('pass_file', passFileCheck.checked);
          const passFileLabel = document.createElement('label');
          passFileLabel.htmlFor = 'py-pass-file';
          passFileLabel.textContent = '현재 열린 INI 파일 경로를 인자로 전달';
          optRow.append(passFileCheck, passFileLabel);

          // Python script editor textarea
          const codeHeader = document.createElement('div');
          codeHeader.className = 'code-header-row';
          codeHeader.textContent = '실행할 Python 코드:';

          const codeTextarea = document.createElement('textarea');
          codeTextarea.className = 'plugin-code-editor';
          codeTextarea.spellcheck = false;
          codeTextarea.value = context.storage.get(
            'code',
            `# Migoto Studio Python Runner
import sys

print("Python 실행 환경이 정상 작동 중입니다!")
if len(sys.argv) > 1:
    print(f"인자 파일: {sys.argv[1]}")
`,
          );
          codeTextarea.oninput = () => context.storage.set('code', codeTextarea.value);

          // Output console area
          const consoleHeader = document.createElement('div');
          consoleHeader.className = 'console-header-row';
          consoleHeader.innerHTML = '<span>실행 결과 (Console)</span>';

          const clearBtn = document.createElement('button');
          clearBtn.className = 'small-btn';
          clearBtn.textContent = '지우기';

          const consoleOutput = document.createElement('pre');
          consoleOutput.className = 'plugin-console-output';
          consoleOutput.textContent = '(실행 버튼을 누르면 여기에 출력이 표시됩니다)';

          clearBtn.onclick = () => {
            consoleOutput.textContent = '';
          };
          consoleHeader.append(clearBtn);

          // Action Buttons Row
          const btnRow = document.createElement('div');
          btnRow.className = 'plugin-actions-row';

          const runBtn = document.createElement('button');
          runBtn.className = 'primary run-btn';
          runBtn.textContent = '▶ 스크립트 실행';

          const insertBtn = document.createElement('button');
          insertBtn.className = 'secondary';
          insertBtn.textContent = '에디터에 결과 삽입';
          insertBtn.disabled = true;

          runBtn.onclick = async () => {
            runBtn.disabled = true;
            runBtn.textContent = '실행 중…';
            consoleOutput.textContent = '프로세스 시작…\n';
            try {
              const code = codeTextarea.value;
              const cmd = cmdSelect.value;
              const extraArgs = argsInput.value.trim().split(/\s+/).filter(Boolean);

              const args = ['-c', code, ...extraArgs];
              if (passFileCheck.checked) {
                const cur = context.workspace.getCurrentFile();
                if (cur?.path) args.push(cur.path);
              }

              const cwd = context.workspace.getCurrentFolder() || undefined;
              const res = await context.system.exec(cmd, args, cwd);

              consoleOutput.textContent = '';
              if (res.stdout) consoleOutput.textContent += res.stdout;
              if (res.stderr) consoleOutput.textContent += (res.stdout ? '\n' : '') + res.stderr;
              if (!res.stdout && !res.stderr) {
                consoleOutput.textContent = `(출력 없음 - 종료 코드: ${res.exitCode})`;
              }

              insertBtn.disabled = !res.stdout;
              if (res.exitCode === 0) {
                context.ui.showToast('Python 실행 완료', 'info');
              } else {
                context.ui.showToast(`실행 실패 (종료 코드 ${res.exitCode})`, 'warn');
              }
            } catch (err) {
              consoleOutput.textContent += `\n[오류] ${err}`;
              context.ui.showToast('실행 오류 발생', 'error');
            } finally {
              runBtn.disabled = false;
              runBtn.textContent = '▶ 스크립트 실행';
            }
          };

          insertBtn.onclick = () => {
            const out = consoleOutput.textContent?.trim();
            if (out) {
              context.editor.insertText(out + '\n');
              context.ui.showToast('에디터에 결과가 삽입되었습니다.', 'info');
            }
          };

          btnRow.append(runBtn, insertBtn);

          container.append(
            header,
            cmdRow,
            argsRow,
            optRow,
            codeHeader,
            codeTextarea,
            btnRow,
            consoleHeader,
            consoleOutput,
          );
        },
      });
    },
  };
}

// ============================================================================
// 2. DDS 및 텍스처 에셋 뷰어
// ============================================================================
const ASSET_VIEWER_MANIFEST: PluginManifest = {
  id: 'asset-viewer',
  name: 'DDS / 텍스처 뷰어',
  version: '1.0.0',
  description: 'INI 문서의 텍스처(DDS/PNG)를 스캔하고 경량 내장 디코더로 즉시 캔버스에 미리보기합니다.',
  author: 'Migoto Studio',
  icon: '🖼',
  category: 'assets',
};

function createAssetViewerPlugin(): MigotoPlugin {
  return {
    activate(context) {
      context.ui.registerSidebarView({
        id: 'asset-viewer-view',
        title: '텍스처 뷰어',
        icon: '🖼',
        render(container) {
          container.className = 'plugin-subview asset-viewer-panel';
          container.replaceChildren();

          const header = document.createElement('div');
          header.className = 'panel-section-title';
          header.innerHTML = '<span>🖼 DDS / 텍스처 뷰어</span>';

          // Texture list in current INI
          const listTitleRow = document.createElement('div');
          listTitleRow.className = 'section-title-row';
          listTitleRow.innerHTML = '<span>현재 문서의 텍스처 파일</span>';

          const scanBtn = document.createElement('button');
          scanBtn.className = 'small-btn';
          scanBtn.textContent = '다시 스캔';

          const fileListEl = document.createElement('div');
          fileListEl.className = 'asset-file-list';

          // Canvas viewer area
          const previewCard = document.createElement('div');
          previewCard.className = 'asset-preview-card';

          const infoBadge = document.createElement('div');
          infoBadge.className = 'asset-info-badge';
          infoBadge.textContent = '텍스처를 선택해 미리보기';

          const canvasContainer = document.createElement('div');
          canvasContainer.className = 'asset-canvas-container checkerboard';

          const canvas = document.createElement('canvas');
          canvas.className = 'asset-canvas';
          canvasContainer.append(canvas);

          // Controls row
          const controlsRow = document.createElement('div');
          controlsRow.className = 'asset-controls-row';

          const alphaBtn = document.createElement('button');
          alphaBtn.className = 'small-btn active';
          alphaBtn.textContent = '알파 채널 ON';

          let showAlpha = true;
          let currentDdsData: { width: number; height: number; format: string; rgba: Uint8ClampedArray } | null = null;

          alphaBtn.onclick = () => {
            showAlpha = !showAlpha;
            alphaBtn.textContent = showAlpha ? '알파 채널 ON' : '알파 채널 OFF';
            alphaBtn.classList.toggle('active', showAlpha);
            if (currentDdsData) renderDecodedData(currentDdsData);
          };

          controlsRow.append(alphaBtn);
          previewCard.append(infoBadge, canvasContainer, controlsRow);

          function renderDecodedData(data: { width: number; height: number; format: string; rgba: Uint8ClampedArray }) {
            currentDdsData = data;
            canvas.width = data.width;
            canvas.height = data.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const imgData = ctx.createImageData(data.width, data.height);
            imgData.data.set(data.rgba);

            if (!showAlpha) {
              // Force alpha to 255
              for (let i = 3; i < imgData.data.length; i += 4) {
                imgData.data[i] = 255;
              }
            }

            ctx.putImageData(imgData, 0, 0);
            infoBadge.textContent = `${data.width} × ${data.height} (${data.format})`;
          }

          async function loadAndPreviewFile(fileNameOrPath: string) {
            infoBadge.textContent = `${fileNameOrPath} 로딩 중…`;
            try {
              let fullPath = fileNameOrPath;
              const folder = context.workspace.getCurrentFolder();
              if (folder && !fileNameOrPath.includes('/') && !fileNameOrPath.includes('\\')) {
                fullPath = `${folder}/${fileNameOrPath}`;
              }

              const isDds = /\.dds$/i.test(fileNameOrPath);
              if (isDds) {
                const bytes = await context.workspace.readBinaryFile(fullPath);
                if (bytes.length === 0) {
                  throw new Error('파일을 찾을 수 없거나 크기가 0입니다.');
                }
                const decoded = decodeDDS(bytes);
                renderDecodedData(decoded);
              } else {
                // PNG / JPG image
                const bytes = await context.workspace.readBinaryFile(fullPath);
                const blob = new Blob([bytes as unknown as BlobPart]);
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0);
                  infoBadge.textContent = `${img.width} × ${img.height} (Standard Image)`;
                  URL.revokeObjectURL(url);
                };
                img.onerror = () => {
                  infoBadge.textContent = '이미지를 디코딩할 수 없습니다.';
                  URL.revokeObjectURL(url);
                };
                img.src = url;
              }
            } catch (err) {
              infoBadge.textContent = `로드 실패: ${err}`;
            }
          }

          function scanTextures() {
            fileListEl.replaceChildren();
            const text = context.editor.getText();
            const regex = /(?:filename|Resource\w*)\s*=\s*([^\r\n;#]+?\.(?:dds|png|jpg|jpeg))/gi;
            const matches = new Set<string>();
            let m: RegExpExecArray | null;

            while ((m = regex.exec(text)) !== null) {
              const file = m[1].trim();
              if (file) matches.add(file);
            }

            if (matches.size === 0) {
              const empty = document.createElement('p');
              empty.className = 'hint';
              empty.textContent = '현재 문서에서 텍스처 파일(.dds/.png) 참조를 찾을 수 없습니다.';
              fileListEl.append(empty);
              return;
            }

            matches.forEach((file) => {
              const item = document.createElement('div');
              item.className = 'asset-file-item';
              item.innerHTML = `<span>📄 ${file}</span>`;
              item.onclick = () => {
                fileListEl.querySelectorAll('.asset-file-item').forEach((el) => el.classList.remove('active'));
                item.classList.add('active');
                loadAndPreviewFile(file);
              };
              fileListEl.append(item);
            });
          }

          scanBtn.onclick = scanTextures;
          listTitleRow.append(scanBtn);

          scanTextures();
          container.append(header, listTitleRow, fileListEl, previewCard);
        },
      });
    },
  };
}

// ============================================================================
// 3. AI 모딩 어시스턴트 / 에이전트 연동
// ============================================================================
const AI_ASSISTANT_MANIFEST: PluginManifest = {
  id: 'ai-assistant',
  name: 'AI 모딩 어시스턴트',
  version: '1.0.0',
  description: 'OpenAI, Ollama(로컬), 또는 호환 API를 연동하여 INI 문법 검사 및 코드 생성을 돕습니다.',
  author: 'Migoto Studio',
  icon: '🤖',
  category: 'ai',
};

function createAiAssistantPlugin(): MigotoPlugin {
  return {
    activate(context) {
      context.ui.registerSidebarView({
        id: 'ai-assistant-view',
        title: 'AI 어시스턴트',
        icon: '🤖',
        render(container) {
          container.className = 'plugin-subview ai-assistant-panel';
          container.replaceChildren();

          const header = document.createElement('div');
          header.className = 'panel-section-title';
          header.innerHTML = '<span>🤖 AI 모딩 어시스턴트</span>';

          // Config Section (Collapsible)
          const configDetails = document.createElement('details');
          configDetails.className = 'ai-config-details';
          const summary = document.createElement('summary');
          summary.textContent = '⚙ API 연결 설정 (OpenAI / Ollama)';
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
          btnFix.textContent = '🔍 문법/오류 분석';

          const btnToggle = document.createElement('button');
          btnToggle.className = 'small-btn';
          btnToggle.textContent = '⚡ 토글 키 섹션 생성';

          const btnComment = document.createElement('button');
          btnComment.className = 'small-btn';
          btnComment.textContent = '📝 섹션 한글 주석';

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
          promptTextarea.placeholder = 'AI에게 INI 모딩 관련 질문이나 코드 작성을 요청하세요…';
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
            badge.textContent = role === 'user' ? '👤 질문' : '🤖 AI 어시스턴트';
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
            sendBtn.textContent = '답변 생성 중…';

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
              appendMessage('assistant', `⚠️ 오류가 발생했습니다: ${err.message || err}`);
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
  };
}

// Built-in list
export const BUILTIN_PLUGINS: BuiltinPluginDef[] = [
  {
    manifest: PYTHON_RUNNER_MANIFEST,
    createPlugin: createPythonRunnerPlugin,
    standaloneScript: `// Python Runner Plugin\nexport default {\n  activate: (ctx) => console.log('Python Runner Activated'),\n};`,
  },
  {
    manifest: ASSET_VIEWER_MANIFEST,
    createPlugin: createAssetViewerPlugin,
    standaloneScript: `// Asset Viewer Plugin\nexport default {\n  activate: (ctx) => console.log('Asset Viewer Activated'),\n};`,
  },
  {
    manifest: AI_ASSISTANT_MANIFEST,
    createPlugin: createAiAssistantPlugin,
    standaloneScript: `// AI Assistant Plugin\nexport default {\n  activate: (ctx) => console.log('AI Assistant Activated'),\n};`,
  },
];

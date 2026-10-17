import type { SelectOption, FormConfig, FormFieldDef, FormInstance } from './types.ts';
import { CODE_TO_VK } from '../core/ini/keys.ts';
import { openKeyHelperModal, type KeyHelperModalOptions } from '../ui/modals/key-helper.ts';
import { openConfirmModal, openPromptModal, type ConfirmOptions, type PromptOptions } from '../ui/modals/confirm-ui.ts';
export type { ConfirmOptions, PromptOptions };

/**
 * 플러그인 전용 고수준 UI 빌더 API 구현체
 * 플러그인 개발자가 원시 DOM이나 복잡한 HTML 문자열 조작 없이 직관적인 메서드로
 * 일관된 고품질 UI 컴포넌트를 구성할 수 있도록 지원합니다.
 */
export function createUIBuilder() {
  return {
    createPanelHeader(title: string): HTMLElement {
      const header = document.createElement('div');
      header.className = 'panel-section-title';
      const span = document.createElement('span');
      span.textContent = title;
      header.append(span);
      return header;
    },

    createFormRow(label: string, control: HTMLElement): HTMLElement {
      const row = document.createElement('div');
      row.className = 'form-row';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      row.append(lbl, control);
      return row;
    },

    createSelect(options: {
      label?: string;
      options: Array<string | SelectOption>;
      value?: string;
      onChange?: (value: string) => void;
    }) {
      const select = document.createElement('select');
      select.className = 'plugin-select';

      options.options.forEach((opt) => {
        const optEl = document.createElement('option');
        if (typeof opt === 'string') {
          optEl.value = opt;
          optEl.textContent = opt;
        } else {
          optEl.value = opt.value;
          optEl.textContent = opt.label;
        }
        select.append(optEl);
      });

      if (options.value !== undefined) {
        select.value = options.value;
      }

      if (options.onChange) {
        select.onchange = () => options.onChange!(select.value);
      }

      const row = options.label
        ? this.createFormRow(options.label, select)
        : select;

      return {
        row,
        select,
        getValue: () => select.value,
        setValue: (v: string) => {
          select.value = v;
        },
      };
    },

    createInput(options: {
      label?: string;
      type?: string;
      placeholder?: string;
      value?: string;
      onInput?: (value: string) => void;
    }) {
      const input = document.createElement('input');
      input.className = 'plugin-input';
      if (options.type) input.type = options.type;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.value !== undefined) input.value = options.value;

      if (options.onInput) {
        input.oninput = () => options.onInput!(input.value);
      }

      const row = options.label
        ? this.createFormRow(options.label, input)
        : input;

      return {
        row,
        input,
        getValue: () => input.value,
        setValue: (v: string) => {
          input.value = v;
        },
      };
    },

    createCheckbox(options: {
      label: string;
      checked?: boolean;
      id?: string;
      onChange?: (checked: boolean) => void;
    }) {
      const row = document.createElement('div');
      row.className = 'form-check-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      if (options.id) checkbox.id = options.id;
      if (options.checked !== undefined) checkbox.checked = options.checked;

      if (options.onChange) {
        checkbox.onchange = () => options.onChange!(checkbox.checked);
      }

      const label = document.createElement('label');
      if (options.id) label.htmlFor = options.id;
      label.textContent = options.label;

      row.append(checkbox, label);

      return {
        row,
        checkbox,
        isChecked: () => checkbox.checked,
        setChecked: (c: boolean) => {
          checkbox.checked = c;
        },
      };
    },

    createButton(options: {
      text: string;
      variant?: 'primary' | 'secondary' | 'small' | 'danger';
      disabled?: boolean;
      onClick?: (e: MouseEvent) => void | Promise<void>;
    }): HTMLButtonElement {
      const btn = document.createElement('button');
      btn.textContent = options.text;
      const variant = options.variant || 'secondary';
      if (variant === 'small') {
        btn.className = 'small-btn';
      } else {
        btn.className = variant;
      }

      if (options.disabled !== undefined) btn.disabled = options.disabled;

      if (options.onClick) {
        btn.onclick = (e) => options.onClick!(e);
      }

      return btn;
    },

    createButtonRow(buttons: HTMLElement[]): HTMLElement {
      const row = document.createElement('div');
      row.className = 'plugin-actions-row';
      buttons.forEach((b) => row.append(b));
      return row;
    },

    createCodeEditor(options: {
      label?: string;
      value?: string;
      placeholder?: string;
      spellcheck?: boolean;
      rows?: number;
      onInput?: (value: string) => void;
    }) {
      const container = document.createElement('div');
      container.className = 'plugin-code-container';

      if (options.label) {
        const header = document.createElement('div');
        header.className = 'code-header-row';
        header.textContent = options.label;
        container.append(header);
      }

      const textarea = document.createElement('textarea');
      textarea.className = 'plugin-code-editor';
      textarea.spellcheck = options.spellcheck ?? false;
      if (options.placeholder) textarea.placeholder = options.placeholder;
      if (options.rows) textarea.rows = options.rows;
      if (options.value !== undefined) textarea.value = options.value;

      if (options.onInput) {
        textarea.oninput = () => options.onInput!(textarea.value);
      }

      container.append(textarea);

      return {
        container,
        textarea,
        getValue: () => textarea.value,
        setValue: (v: string) => {
          textarea.value = v;
        },
      };
    },

    createConsole(options: {
      title?: string;
      placeholder?: string;
      enableInput?: boolean;
      inputPlaceholder?: string;
      onInputSubmit?: (value: string) => void;
      onClear?: () => void;
    }) {
      const container = document.createElement('div');
      container.className = 'plugin-console-container';

      const header = document.createElement('div');
      header.className = 'console-header-row';

      const titleSpan = document.createElement('span');
      titleSpan.textContent = options.title || 'Console';
      header.append(titleSpan);

      const clearBtn = document.createElement('button');
      clearBtn.className = 'small-btn';
      clearBtn.textContent = '지우기';
      header.append(clearBtn);

      const output = document.createElement('pre');
      output.className = 'plugin-console-output';
      const defaultPlaceholder = options.placeholder || '';
      output.textContent = defaultPlaceholder;

      clearBtn.onclick = () => {
        output.textContent = '';
        if (options.onClear) options.onClear();
      };

      container.append(header, output);

      let inputEl: HTMLInputElement | null = null;
      let sendBtnEl: HTMLButtonElement | null = null;

      if (options.enableInput) {
        const inputRow = document.createElement('div');
        inputRow.className = 'plugin-console-input-row';

        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'plugin-input plugin-console-input';
        inputEl.placeholder = options.inputPlaceholder || '프로세스 표준 입력 (stdin) 입력 후 Enter...';

        sendBtnEl = document.createElement('button');
        sendBtnEl.className = 'small-btn plugin-console-send-btn';
        sendBtnEl.textContent = '전송';

        const submitInput = () => {
          const val = inputEl!.value;
          if (options.onInputSubmit) {
            options.onInputSubmit(val);
          }
        };

        sendBtnEl.onclick = submitInput;
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitInput();
          }
        });

        inputRow.append(inputEl, sendBtnEl);
        container.append(inputRow);
      }

      return {
        container,
        output,
        input: inputEl ?? undefined,
        append(text: string) {
          if (output.textContent === defaultPlaceholder) {
            output.textContent = '';
          }
          output.textContent += text;
          output.scrollTop = output.scrollHeight;
        },
        set(text: string) {
          output.textContent = text;
          output.scrollTop = output.scrollHeight;
        },
        clear() {
          output.textContent = '';
        },
        getInputValue() {
          return inputEl?.value ?? '';
        },
        setInputValue(val: string) {
          if (inputEl) inputEl.value = val;
        },
        clearInput() {
          if (inputEl) inputEl.value = '';
        },
      };
    },

    createDetails(options: {
      summary: string;
      children?: HTMLElement[];
      open?: boolean;
    }): HTMLDetailsElement {
      const details = document.createElement('details');
      details.className = 'ai-config-details';
      if (options.open) details.open = true;

      const summary = document.createElement('summary');
      summary.textContent = options.summary;
      details.append(summary);

      const contentBox = document.createElement('div');
      contentBox.className = 'ai-config-box';
      if (options.children) {
        options.children.forEach((c) => contentBox.append(c));
      }
      details.append(contentBox);

      return details;
    },

    createChatMessage(options: {
      role: 'user' | 'assistant';
      badge: string;
      content: string;
      onInsertCode?: (code: string) => void;
      onCopyCode?: (code: string) => void;
    }): HTMLElement {
      const msgEl = document.createElement('div');
      msgEl.className = `ai-message ${options.role}`;

      const badge = document.createElement('div');
      badge.className = 'ai-message-badge';
      badge.textContent = options.badge;
      msgEl.append(badge);

      const contentEl = document.createElement('div');
      contentEl.className = 'ai-message-content';

      const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?([\s\S]*?)```/g;
      let lastIdx = 0;
      let match: RegExpExecArray | null;

      while ((match = codeBlockRegex.exec(options.content)) !== null) {
        const textBefore = options.content.slice(lastIdx, match.index);
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

        if (options.onInsertCode) {
          const insertBtn = document.createElement('button');
          insertBtn.className = 'small-btn';
          insertBtn.textContent = '에디터에 삽입';
          insertBtn.onclick = () => options.onInsertCode!(codeContent);
          btnBar.append(insertBtn);
        }

        if (options.onCopyCode) {
          const copyBtn = document.createElement('button');
          copyBtn.className = 'small-btn';
          copyBtn.textContent = '복사';
          copyBtn.onclick = () => options.onCopyCode!(codeContent);
          btnBar.append(copyBtn);
        }

        codeBox.append(btnBar);
        contentEl.append(codeBox);

        lastIdx = match.index + match[0].length;
      }

      const remaining = options.content.slice(lastIdx);
      if (remaining) {
        const p = document.createElement('p');
        p.textContent = remaining;
        contentEl.append(p);
      }

      msgEl.append(contentEl);
      return msgEl;
    },

    createBadge(options: {
      text: string;
      variant?: 'info' | 'success' | 'warn' | 'error' | 'neutral';
    }): HTMLElement {
      const span = document.createElement('span');
      span.className = `plugin-badge badge-${options.variant || 'neutral'}`;
      span.textContent = options.text;
      return span;
    },

    createProgressBar(options?: {
      value?: number;
      max?: number;
      label?: string;
    }) {
      const container = document.createElement('div');
      container.className = 'plugin-progress-container';

      const header = document.createElement('div');
      header.className = 'plugin-progress-header';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = options?.label || '';
      const percentSpan = document.createElement('span');
      header.append(labelSpan, percentSpan);

      const track = document.createElement('div');
      track.className = 'plugin-progress-track';

      const fill = document.createElement('div');
      fill.className = 'plugin-progress-fill';
      track.append(fill);

      let currentVal = options?.value ?? 0;
      let currentMax = options?.max ?? 100;

      const update = () => {
        const pct = Math.min(100, Math.max(0, currentMax > 0 ? (currentVal / currentMax) * 100 : 0));
        fill.style.width = `${pct}%`;
        percentSpan.textContent = `${Math.round(pct)}%`;
      };
      update();

      container.append(header, track);

      return {
        container,
        setProgress(val: number, max?: number) {
          currentVal = val;
          if (max !== undefined) currentMax = max;
          update();
        },
        setLabel(text: string) {
          labelSpan.textContent = text;
        },
      };
    },

    createDivider(): HTMLElement {
      const hr = document.createElement('div');
      hr.className = 'plugin-divider';
      return hr;
    },

    createTable(options: {
      headers: string[];
      rows?: Array<Array<string | HTMLElement>>;
    }) {
      const container = document.createElement('div');
      container.className = 'plugin-table-container';

      const table = document.createElement('table');
      table.className = 'plugin-table';

      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      options.headers.forEach((h) => {
        const th = document.createElement('th');
        th.textContent = h;
        trHead.append(th);
      });
      thead.append(trHead);
      table.append(thead);

      const tbody = document.createElement('tbody');
      table.append(tbody);

      const renderRows = (rowsList: Array<Array<string | HTMLElement>>) => {
        tbody.replaceChildren();
        rowsList.forEach((row) => {
          const tr = document.createElement('tr');
          row.forEach((cell) => {
            const td = document.createElement('td');
            if (typeof cell === 'string') {
              td.textContent = cell;
            } else {
              td.append(cell);
            }
            tr.append(td);
          });
          tbody.append(tr);
        });
      };

      if (options.rows) renderRows(options.rows);
      container.append(table);

      return {
        container,
        table,
        tbody,
        setRows(rows: Array<Array<string | HTMLElement>>) {
          renderRows(rows);
        },
        addRow(row: Array<string | HTMLElement>) {
          const tr = document.createElement('tr');
          row.forEach((cell) => {
            const td = document.createElement('td');
            if (typeof cell === 'string') {
              td.textContent = cell;
            } else {
              td.append(cell);
            }
            tr.append(td);
          });
          tbody.append(tr);
        },
        clear() {
          tbody.replaceChildren();
        },
      };
    },

    createKeyInput(options: {
      label?: string;
      value?: string;
      placeholder?: string;
      description?: string;
      onChange?: (keyStr: string) => void;
    }) {
      const row = document.createElement('div');
      row.className = 'form-row plugin-key-input-row';

      if (options.label) {
        const lbl = document.createElement('label');
        lbl.textContent = options.label;
        row.append(lbl);
      }

      const wrap = document.createElement('div');
      wrap.className = 'plugin-key-input-wrap';

      const input = document.createElement('input');
      input.className = 'plugin-input plugin-key-field';
      input.type = 'text';
      input.value = options.value ?? 'VK_F4';
      if (options.placeholder) input.placeholder = options.placeholder;

      input.oninput = () => {
        options.onChange?.(input.value);
      };

      const captureBtn = document.createElement('button');
      captureBtn.type = 'button';
      captureBtn.className = 'small-btn plugin-key-capture-btn';
      captureBtn.textContent = '키 감지';
      captureBtn.title = '클릭 후 키보드를 누르면 단축키를 자동으로 감지합니다';

      let isListening = false;
      let cleanupListener: (() => void) | null = null;

      const stopListening = () => {
        isListening = false;
        captureBtn.textContent = '키 감지';
        captureBtn.classList.remove('listening');
        if (cleanupListener) {
          cleanupListener();
          cleanupListener = null;
        }
      };

      const startListening = () => {
        if (isListening) {
          stopListening();
          return;
        }
        isListening = true;
        captureBtn.textContent = '키 누르는 중...';
        captureBtn.classList.add('listening');

        const handler = (e: KeyboardEvent) => {
          if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

          e.preventDefault();
          e.stopPropagation();

          if (e.key === 'Escape') {
            stopListening();
            return;
          }

          const vk = CODE_TO_VK[e.code] || `VK_${e.key.toUpperCase()}`;
          const modifiers: string[] = [];
          if (e.ctrlKey) modifiers.push('ctrl');
          if (e.altKey) modifiers.push('alt');
          if (e.shiftKey) modifiers.push('shift');

          const keyBinding = modifiers.length > 0 ? `${modifiers.join(' ')} ${vk}` : vk;
          input.value = keyBinding;
          options.onChange?.(keyBinding);
          stopListening();
        };

        window.addEventListener('keydown', handler, { capture: true });
        cleanupListener = () => window.removeEventListener('keydown', handler, { capture: true });
      };

      const helperBtn = document.createElement('button');
      helperBtn.type = 'button';
      helperBtn.className = 'small-btn plugin-key-helper-btn';
      helperBtn.textContent = '키 도우미';
      helperBtn.title = '3DMigoto 키 조합 도우미 창을 엽니다';
      helperBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const selected = await openKeyHelperModal({
          title: options.label ? `${options.label} 설정` : '3DMigoto 키 입력 도우미',
          initialKey: input.value,
        });
        if (selected) {
          input.value = selected;
          options.onChange?.(selected);
        }
      });

      wrap.append(input, captureBtn, helperBtn);
      row.append(wrap);

      return {
        row,
        input,
        getValue: () => input.value,
        setValue: (v: string) => {
          input.value = v;
          options.onChange?.(v);
        },
      };
    },

    createCard(options: {
      title: string;
      subtitle?: string;
      badge?: { text: string; variant?: 'info' | 'success' | 'warn' | 'error' | 'neutral' };
      children?: HTMLElement[] | HTMLElement;
      content?: HTMLElement[] | HTMLElement;
      actions?: HTMLElement[];
    }): HTMLElement {
      const card = document.createElement('div');
      card.className = 'plugin-card plugin-ui-card';

      const header = document.createElement('div');
      header.className = 'plugin-card-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'plugin-card-title-wrap';

      const titleEl = document.createElement('div');
      titleEl.className = 'plugin-card-title';
      titleEl.textContent = options.title;
      titleWrap.append(titleEl);

      if (options.subtitle) {
        const subEl = document.createElement('div');
        subEl.className = 'plugin-card-subtitle';
        subEl.textContent = options.subtitle;
        titleWrap.append(subEl);
      }
      header.append(titleWrap);

      if (options.badge) {
        const badge = this.createBadge({
          text: options.badge.text,
          variant: options.badge.variant || 'neutral',
        });
        header.append(badge);
      }
      card.append(header);

      const rawContent = options.children ?? options.content;
      const childNodes: HTMLElement[] = rawContent
        ? Array.isArray(rawContent)
          ? rawContent
          : [rawContent]
        : [];
      if (childNodes.length > 0) {
        const body = document.createElement('div');
        body.className = 'plugin-card-body';
        childNodes.forEach((c) => body.append(c));
        card.append(body);
      }

      if (options.actions && options.actions.length > 0) {
        const footer = document.createElement('div');
        footer.className = 'plugin-card-footer';
        options.actions.forEach((a) => footer.append(a));
        card.append(footer);
      }

      return card;
    },

    createForm(config: FormConfig): FormInstance {
      const form = document.createElement('form');
      form.className = 'plugin-form';
      form.onsubmit = (e) => e.preventDefault();

      if (config.title || config.description) {
        const intro = document.createElement('div');
        intro.className = 'plugin-form-intro';
        if (config.title) {
          const h = document.createElement('h3');
          h.className = 'plugin-form-title';
          h.textContent = config.title;
          if (config.badge) {
            const badge = this.createBadge({ text: config.badge, variant: 'info' });
            badge.style.marginLeft = '8px';
            badge.style.verticalAlign = 'middle';
            h.append(badge);
          }
          intro.append(h);
        }
        if (config.description) {
          const p = document.createElement('p');
          p.className = 'plugin-form-desc';
          p.textContent = config.description;
          intro.append(p);
        }
        form.append(intro);
      }

      const values: Record<string, any> = { ...(config.initialValues || {}) };
      const fieldControls = new Map<string, { getValue: () => any; setValue: (v: any) => void }>();

      const renderField = (field: FormFieldDef): HTMLElement => {
        const initialVal = values[field.id] !== undefined ? values[field.id] : field.default;
        if (initialVal !== undefined) {
          values[field.id] = initialVal;
        }

        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'plugin-field-group';

        const updateValue = (newVal: any) => {
          values[field.id] = newVal;
          config.onChange?.(values, field.id);
        };

        let controlRow: HTMLElement;

        if (field.type === 'key') {
          const keyInput = this.createKeyInput({
            label: field.label,
            value: initialVal !== undefined ? String(initialVal) : 'VK_F4',
            placeholder: field.placeholder,
            onChange: updateValue,
          });
          fieldControls.set(field.id, {
            getValue: () => keyInput.getValue(),
            setValue: (v) => keyInput.setValue(v),
          });
          controlRow = keyInput.row;
        } else if (field.type === 'select') {
          const sel = this.createSelect({
            label: field.label,
            options: field.options || [],
            value: initialVal !== undefined ? String(initialVal) : undefined,
            onChange: updateValue,
          });
          fieldControls.set(field.id, {
            getValue: () => sel.getValue(),
            setValue: (v) => sel.setValue(v),
          });
          controlRow = sel.row;
        } else if (field.type === 'checkbox') {
          const chk = this.createCheckbox({
            label: field.label,
            checked: Boolean(initialVal),
            onChange: updateValue,
          });
          fieldControls.set(field.id, {
            getValue: () => chk.isChecked(),
            setValue: (v) => chk.setChecked(Boolean(v)),
          });
          controlRow = chk.row;
        } else if (field.type === 'textarea') {
          const txt = this.createCodeEditor({
            label: field.label,
            value: initialVal !== undefined ? String(initialVal) : '',
            placeholder: field.placeholder,
            rows: 4,
            onInput: updateValue,
          });
          fieldControls.set(field.id, {
            getValue: () => txt.getValue(),
            setValue: (v) => txt.setValue(v),
          });
          controlRow = txt.container;
        } else {
          const inp = this.createInput({
            label: field.label,
            type: field.type || 'text',
            value: initialVal !== undefined ? String(initialVal) : '',
            placeholder: field.placeholder,
            onInput: (val) => {
              const parsed = field.type === 'number' ? Number(val) : val;
              updateValue(parsed);
            },
          });
          if (field.min !== undefined) (inp.input as HTMLInputElement).min = String(field.min);
          if (field.max !== undefined) (inp.input as HTMLInputElement).max = String(field.max);
          if (field.step !== undefined) (inp.input as HTMLInputElement).step = String(field.step);

          fieldControls.set(field.id, {
            getValue: () => (field.type === 'number' ? Number(inp.getValue()) : inp.getValue()),
            setValue: (v) => inp.setValue(String(v)),
          });
          controlRow = inp.row;
        }

        fieldWrapper.append(controlRow);

        if (field.description) {
          const desc = document.createElement('div');
          desc.className = 'plugin-field-help';
          desc.textContent = field.description;
          fieldWrapper.append(desc);
        }

        return fieldWrapper;
      };

      const sections = config.sections || (config.fields ? [{ fields: config.fields }] : []);
      sections.forEach((sec) => {
        const secCard = document.createElement('div');
        secCard.className = 'plugin-form-section-card';

        if (sec.title || sec.description) {
          const secHeader = document.createElement('div');
          secHeader.className = 'plugin-section-header';
          if (sec.title) {
            const h4 = document.createElement('div');
            h4.className = 'plugin-section-title';
            h4.textContent = sec.title;
            secHeader.append(h4);
          }
          if (sec.description) {
            const sp = document.createElement('div');
            sp.className = 'plugin-section-desc';
            sp.textContent = sec.description;
            secHeader.append(sp);
          }
          secCard.append(secHeader);
        }

        const secBody = document.createElement('div');
        secBody.className = 'plugin-section-body';
        sec.fields.forEach((f) => {
          secBody.append(renderField(f));
        });
        secCard.append(secBody);
        form.append(secCard);
      });

      const actionsRow = document.createElement('div');
      actionsRow.className = 'plugin-form-actions';

      const submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = 'primary plugin-form-submit';
      submitBtn.textContent = config.submitLabel || '적용';

      submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '처리 중...';
        try {
          fieldControls.forEach((ctl, id) => {
            values[id] = ctl.getValue();
          });
          await config.onSubmit(values);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      };

      actionsRow.append(submitBtn);

      if (config.showReset) {
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'secondary';
        resetBtn.textContent = config.resetLabel || '초기화';
        resetBtn.onclick = () => {
          const defaults = config.initialValues || {};
          fieldControls.forEach((ctl, id) => {
            const defVal = defaults[id] ?? '';
            ctl.setValue(defVal);
            values[id] = defVal;
          });
          config.onReset?.();
        };
        actionsRow.append(resetBtn);
      }

      form.append(actionsRow);

      return {
        element: form,
        getValues: () => {
          fieldControls.forEach((ctl, id) => {
            values[id] = ctl.getValue();
          });
          return { ...values };
        },
        setValues: (newVals: Record<string, any>) => {
          Object.entries(newVals).forEach(([k, v]) => {
            values[k] = v;
            fieldControls.get(k)?.setValue(v);
          });
        },
        reset: () => {
          const defaults = config.initialValues || {};
          fieldControls.forEach((ctl, id) => {
            const defVal = defaults[id] ?? '';
            ctl.setValue(defVal);
            values[id] = defVal;
          });
        },
      };
    },

    /**
     * 3DMigoto 키 바인딩 설정 모달 창을 대화형으로 엽니다.
     * 사용자가 키를 선택하고 확인하면 선택된 3DMigoto 단축키 문자열(예: 'ctrl no_alt VK_F1')을 반환하고,
     * 취소하면 null을 반환합니다.
     */
    openKeyBindingModal(options?: KeyHelperModalOptions): Promise<string | null> {
      return openKeyHelperModal(options);
    },

    /**
     * openKeyBindingModal의 별칭 (동일 동작)
     */
    openKeyHelperModal(options?: KeyHelperModalOptions): Promise<string | null> {
      return openKeyHelperModal(options);
    },

    /**
     * 사용자에게 확인/취소를 묻는 비동기 대화상자를 표시합니다.
     */
    confirm(options: ConfirmOptions): Promise<boolean> {
      return openConfirmModal(options);
    },

    /**
     * 사용자에게 텍스트 입력을 받는 비동기 프롬프트 대화상자를 표시합니다.
     */
    prompt(options: PromptOptions): Promise<string | null> {
      return openPromptModal(options);
    },
  };
}


export type PluginUIBuilder = ReturnType<typeof createUIBuilder>;

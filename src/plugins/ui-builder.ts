import type { SelectOption, FormConfig, FormFieldDef, FormInstance } from './types.ts';
import { CODE_TO_VK } from '../core/ini/keys.ts';
import { openKeyHelperModal, type KeyHelperModalOptions } from '../ui/modals/key-helper.ts';
import { openConfirmModal, openPromptModal, type ConfirmOptions, type PromptOptions } from '../ui/modals/confirm-ui.ts';
import { platform } from '../platform/index.ts';
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

    createDivider(options?: DividerOptions): HTMLElement {
      const div = document.createElement('div');
      const isVert = options?.vertical ?? false;
      div.className = `plugin-divider ${isVert ? 'vertical' : 'horizontal'}${options?.className ? ` ${options.className}` : ''}`;
      if (options?.margin !== undefined) {
        const m = typeof options.margin === 'number' ? `${options.margin}px` : options.margin;
        div.style.margin = isVert ? `0 ${m}` : `${m} 0`;
      }
      return div;
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

    /**
     * 좌우(수평) 또는 상하(수직)로 패널을 나누고 사용자가 드래그하여 크기를 조절할 수 있는 스플릿 뷰를 생성합니다.
     */
    createSplitView(options?: SplitViewOptions): SplitViewInstance {
      const opts = options || {};
      const isHorizontal = (opts.direction || 'horizontal') === 'horizontal';
      const container = document.createElement('div');
      container.className = `plugin-split-container migoto-split-view plugin-split-${isHorizontal ? 'horizontal' : 'vertical'}${opts.className ? ` ${opts.className}` : ''}`;
      container.style.display = 'flex';
      container.style.flex = '1 1 0%';
      container.style.minHeight = '0';
      container.style.minWidth = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.overflow = 'hidden';
      container.style.position = 'relative';
      container.style.boxSizing = 'border-box';

      const firstPane = document.createElement('div');
      firstPane.className = 'plugin-split-pane plugin-split-first';
      firstPane.style.position = 'relative';
      firstPane.style.boxSizing = 'border-box';
      firstPane.style.display = 'flex';
      firstPane.style.flexDirection = 'column';
      firstPane.style.overflow = 'hidden';
      firstPane.style.minHeight = '0';
      firstPane.style.minWidth = '0';
      firstPane.style.flexShrink = '0';
      if (isHorizontal) {
        firstPane.style.height = '100%';
      } else {
        firstPane.style.width = '100%';
      }
      if (opts.first) firstPane.append(opts.first);

      const splitter = document.createElement('div');
      splitter.className = 'plugin-split-resizer';
      splitter.title = opts.resizable !== false ? '드래그하여 크기 조절 (더블 클릭: 기본 크기 복원)' : '';

      const secondPane = document.createElement('div');
      secondPane.className = 'plugin-split-pane plugin-split-second';
      secondPane.style.position = 'relative';
      secondPane.style.boxSizing = 'border-box';
      secondPane.style.display = 'flex';
      secondPane.style.flexDirection = 'column';
      secondPane.style.overflow = 'hidden';
      secondPane.style.minHeight = '0';
      secondPane.style.minWidth = '0';
      secondPane.style.flex = '1 1 0%';
      if (isHorizontal) {
        secondPane.style.height = '100%';
      } else {
        secondPane.style.width = '100%';
      }
      if (opts.second) secondPane.append(opts.second);

      const minFirst = opts.minFirstSize ?? 50;
      const minSecond = opts.minSecondSize ?? 50;

      const applySize = (size: number | string) => {
        const val = typeof size === 'number' ? `${size}px` : size;
        if (isHorizontal) {
          firstPane.style.width = val;
          firstPane.style.flexBasis = val;
        } else {
          firstPane.style.height = val;
          firstPane.style.flexBasis = val;
        }
      };

      let initialVal: number | string = opts.initialSize ?? '50%';
      if (opts.storageKey) {
        try {
          const saved = localStorage.getItem(opts.storageKey);
          if (saved !== null && saved !== '') {
            const num = parseFloat(saved);
            if (!Number.isNaN(num) && num >= minFirst) {
              initialVal = num;
            } else {
              initialVal = saved;
            }
          }
        } catch {}
      }
      applySize(initialVal);

      let isDragging = false;
      let startPos = 0;
      let startSize = 0;

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        const containerSize = isHorizontal ? rect.width : rect.height;
        const delta = isHorizontal ? e.clientX - startPos : e.clientY - startPos;
        const resizerSize = 5;
        const maxFirst = Math.max(minFirst, containerSize - resizerSize - minSecond);
        const newSize = Math.max(minFirst, Math.min(maxFirst, startSize + delta));

        applySize(newSize);

        const secondSize = Math.max(0, containerSize - resizerSize - newSize);
        opts.onResize?.(newSize, secondSize);

        if (opts.storageKey) {
          try {
            localStorage.setItem(opts.storageKey, String(Math.round(newSize)));
          } catch {}
        }
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        splitter.classList.remove('dragging');
        document.body.classList.remove(isHorizontal ? 'plugin-split-resizing-h' : 'plugin-split-resizing-v');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      if (opts.resizable !== false) {
        splitter.addEventListener('mousedown', (e: MouseEvent) => {
          e.preventDefault();
          isDragging = true;
          splitter.classList.add('dragging');
          document.body.classList.add(isHorizontal ? 'plugin-split-resizing-h' : 'plugin-split-resizing-v');
          startPos = isHorizontal ? e.clientX : e.clientY;
          const r = firstPane.getBoundingClientRect();
          startSize = isHorizontal ? r.width : r.height;

          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        });

        splitter.addEventListener('dblclick', () => {
          applySize(opts.initialSize ?? '50%');
          if (opts.storageKey) {
            try {
              localStorage.removeItem(opts.storageKey);
            } catch {}
          }
        });
      }

      container.append(firstPane, splitter, secondPane);

      return {
        container,
        firstPane,
        secondPane,
        splitter,
        setSize: (size: number | string) => applySize(size),
        getSize: () => {
          const r = firstPane.getBoundingClientRect();
          return isHorizontal ? r.width : r.height;
        },
        reset: () => {
          applySize(opts.initialSize ?? '50%');
          if (opts.storageKey) {
            try {
              localStorage.removeItem(opts.storageKey);
            } catch {}
          }
        },
        dispose: () => {
          onMouseUp();
        },
      };
    },

    /**
     * 가로 방향 Flexbox 레이아웃 컨테이너를 생성합니다.
     */
    createRow(options?: RowOptions): HTMLElement {
      const row = document.createElement('div');
      row.className = `plugin-row${options?.className ? ` ${options.className}` : ''}`;
      if (options?.gap !== undefined) {
        row.style.gap = typeof options.gap === 'number' ? `${options.gap}px` : options.gap;
      } else {
        row.style.gap = '8px';
      }
      if (options?.align) {
        row.style.alignItems = options.align === 'start' ? 'flex-start' : options.align === 'end' ? 'flex-end' : options.align;
      }
      if (options?.justify) {
        row.style.justifyContent = options.justify === 'start' ? 'flex-start' : options.justify === 'end' ? 'flex-end' : options.justify;
      }
      if (options?.wrap) {
        row.style.flexWrap = 'wrap';
      }
      if (options?.style) {
        Object.assign(row.style, options.style);
      }
      if (options?.children) {
        options.children.forEach((c) => row.append(c));
      }
      return row;
    },

    /**
     * 세로 방향 Flexbox 레이아웃 컨테이너를 생성합니다.
     */
    createColumn(options?: ColumnOptions): HTMLElement {
      const col = document.createElement('div');
      col.className = `plugin-column${options?.className ? ` ${options.className}` : ''}`;
      if (options?.gap !== undefined) {
        col.style.gap = typeof options.gap === 'number' ? `${options.gap}px` : options.gap;
      } else {
        col.style.gap = '8px';
      }
      if (options?.align) {
        col.style.alignItems = options.align === 'start' ? 'flex-start' : options.align === 'end' ? 'flex-end' : options.align;
      }
      if (options?.justify) {
        col.style.justifyContent = options.justify === 'start' ? 'flex-start' : options.justify === 'end' ? 'flex-end' : options.justify;
      }
      if (options?.style) {
        Object.assign(col.style, options.style);
      }
      if (options?.children) {
        options.children.forEach((c) => col.append(c));
      }
      return col;
    },

    /**
     * Grid 레이아웃 컨테이너를 생성합니다.
     */
    createGrid(options?: GridOptions): HTMLElement {
      const grid = document.createElement('div');
      grid.className = `plugin-grid${options?.className ? ` ${options.className}` : ''}`;
      const cols = options?.columns ?? 2;
      grid.style.gridTemplateColumns = typeof cols === 'number' ? `repeat(${cols}, 1fr)` : cols;
      if (options?.gap !== undefined) {
        grid.style.gap = typeof options.gap === 'number' ? `${options.gap}px` : options.gap;
      } else {
        grid.style.gap = '8px';
      }
      if (options?.style) {
        Object.assign(grid.style, options.style);
      }
      if (options?.children) {
        options.children.forEach((c) => grid.append(c));
      }
      return grid;
    },


    /**
     * 일관된 테마 스크롤바와 상/하단 스크롤 제어 메서드를 갖춘 스크롤 컨테이너를 생성합니다.
     */
    createScrollContainer(options?: ScrollContainerOptions): ScrollContainerInstance {
      const container = document.createElement('div');
      const dir = options?.direction || 'vertical';
      container.className = `plugin-scroll-container migoto-scroll-container scroll-${dir}${options?.className ? ` ${options.className}` : ''}`;

      container.style.flex = options?.flex !== undefined ? (typeof options.flex === 'number' ? `${options.flex} 1 0%` : options.flex) : '1 1 0%';
      container.style.minHeight = '0';
      container.style.minWidth = '0';
      container.style.width = options?.width !== undefined ? (typeof options.width === 'number' ? `${options.width}px` : options.width) : '100%';
      container.style.height = options?.height !== undefined ? (typeof options.height === 'number' ? `${options.height}px` : options.height) : '100%';
      container.style.boxSizing = 'border-box';
      container.style.scrollbarGutter = 'stable';
      container.style.scrollbarWidth = 'thin';

      if (options?.maxHeight !== undefined) {
        container.style.maxHeight = typeof options.maxHeight === 'number' ? `${options.maxHeight}px` : options.maxHeight;
      }
      if (options?.maxWidth !== undefined) {
        container.style.maxWidth = typeof options.maxWidth === 'number' ? `${options.maxWidth}px` : options.maxWidth;
      }
      if (options?.padding !== undefined) {
        container.style.padding = typeof options.padding === 'number' ? `${options.padding}px` : options.padding;
      }
      if (options?.style) {
        Object.assign(container.style, options.style);
      }

      const content = document.createElement('div');
      content.className = 'plugin-scroll-content';
      content.style.boxSizing = 'border-box';
      if (dir === 'vertical') {
        content.style.width = '100%';
        content.style.minHeight = '100%';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
      } else if (dir === 'horizontal') {
        content.style.height = '100%';
        content.style.minWidth = '100%';
        content.style.display = 'flex';
        content.style.flexDirection = 'row';
      } else {
        content.style.minWidth = '100%';
        content.style.minHeight = '100%';
      }

      if (options?.content) {
        const items = Array.isArray(options.content) ? options.content : [options.content];
        items.forEach((it) => content.append(it));
      }

      container.append(content);

      const scrollToBottom = (smooth = false) => {
        try {
          container.scrollTo({
            top: container.scrollHeight,
            left: dir === 'horizontal' || dir === 'both' ? container.scrollWidth : 0,
            behavior: smooth ? 'smooth' : 'auto',
          });
        } catch {
          container.scrollTop = container.scrollHeight;
        }
      };

      const scrollToTop = (smooth = false) => {
        try {
          container.scrollTo({ top: 0, left: 0, behavior: smooth ? 'smooth' : 'auto' });
        } catch {
          container.scrollTop = 0;
        }
      };

      const append = (...items: HTMLElement[]) => {
        items.forEach((it) => content.append(it));
        if (options?.autoScroll) {
          scrollToBottom();
        }
      };

      const clear = () => {
        content.replaceChildren();
      };

      return {
        container,
        content,
        append,
        clear,
        scrollToTop,
        scrollToBottom,
        getScrollTop: () => container.scrollTop,
        setScrollTop: (val: number) => {
          container.scrollTop = val;
        },
      };
    },

    /**
     * 인라인 탭 내비게이션 바 및 화면 전환 컨테이너를 생성합니다.
     */
    createTabs(options: TabsOptions): TabsInstance {
      const container = document.createElement('div');
      container.className = `plugin-tabs-container migoto-tabs-container${options.className ? ` ${options.className}` : ''}`;
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.flex = '1 1 0%';
      container.style.minHeight = '0';
      container.style.height = '100%';
      container.style.width = '100%';
      container.style.overflow = 'hidden';
      container.style.position = 'relative';
      container.style.boxSizing = 'border-box';

      const tabNav = document.createElement('div');
      tabNav.className = 'plugin-tab-nav';
      tabNav.style.flexShrink = '0';

      const tabContent = document.createElement('div');
      tabContent.className = 'plugin-tab-content';
      tabContent.style.display = 'flex';
      tabContent.style.flexDirection = 'column';
      tabContent.style.flex = '1 1 0%';
      tabContent.style.minHeight = '0';
      tabContent.style.height = '100%';
      tabContent.style.overflow = 'hidden';
      tabContent.style.position = 'relative';
      tabContent.style.width = '100%';
      tabContent.style.boxSizing = 'border-box';

      const buttons = new Map<string, HTMLButtonElement>();
      const panels = new Map<string, HTMLElement>();
      const badges = new Map<string, HTMLElement>();

      let activeTabId = options.defaultTab || options.tabs[0]?.id || '';

      const switchTab = (tabId: string) => {
        const targetTab = options.tabs.find((t) => t.id === tabId);
        if (!targetTab || targetTab.disabled) return;

        activeTabId = tabId;

        buttons.forEach((btn, id) => {
          const isActive = id === tabId;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', String(isActive));
        });

        panels.forEach((panel, id) => {
          panel.hidden = id !== tabId;
        });

        options.onChange?.(tabId);
      };

      options.tabs.forEach((tab) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `plugin-tab-btn${tab.id === activeTabId ? ' active' : ''}`;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(tab.id === activeTabId));
        if (tab.disabled) btn.disabled = true;

        if (tab.icon) {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'plugin-tab-icon';
          iconSpan.textContent = tab.icon;
          btn.append(iconSpan);
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = 'plugin-tab-label';
        labelSpan.textContent = tab.label;
        btn.append(labelSpan);

        if (tab.badge) {
          const badgeSpan = document.createElement('span');
          badgeSpan.className = 'plugin-tab-badge';
          badgeSpan.textContent = tab.badge;
          btn.append(badgeSpan);
          badges.set(tab.id, badgeSpan);
        }

        btn.onclick = () => switchTab(tab.id);
        buttons.set(tab.id, btn);
        tabNav.append(btn);

        const panel = document.createElement('div');
        panel.className = 'plugin-tab-panel';
        panel.setAttribute('role', 'tabpanel');
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.flex = '1 1 0%';
        panel.style.minHeight = '0';
        panel.style.height = '100%';
        panel.style.overflow = 'hidden';
        panel.style.position = 'relative';
        panel.style.width = '100%';
        panel.style.boxSizing = 'border-box';
        panel.hidden = tab.id !== activeTabId;
        panel.append(tab.content);
        panels.set(tab.id, panel);
        tabContent.append(panel);
      });

      container.append(tabNav, tabContent);

      return {
        container,
        tabNav,
        tabContent,
        switchTab,
        getActiveTab: () => activeTabId,
        setTabBadge: (tabId: string, badge?: string) => {
          let b = badges.get(tabId);
          if (badge) {
            if (!b) {
              b = document.createElement('span');
              b.className = 'plugin-tab-badge';
              badges.set(tabId, b);
              buttons.get(tabId)?.append(b);
            }
            b.textContent = badge;
            b.hidden = false;
          } else if (b) {
            b.hidden = true;
          }
        },
        setTabDisabled: (tabId: string, disabled: boolean) => {
          const btn = buttons.get(tabId);
          if (btn) btn.disabled = disabled;
          const tab = options.tabs.find((t) => t.id === tabId);
          if (tab) tab.disabled = disabled;
        },
      };
    },

    /**
     * 헤더 클릭 시 본문을 접거나 펼칠 수 있는 아코디언 컴포넌트를 생성합니다.
     */
    createCollapsible(options: CollapsibleOptions): CollapsibleInstance {
      const container = document.createElement('div');
      let isOpen = options.defaultOpen ?? true;
      container.className = `plugin-collapsible${isOpen ? ' open' : ''}${options.className ? ` ${options.className}` : ''}`;

      const header = document.createElement('div');
      header.className = 'plugin-collapsible-header';

      const left = document.createElement('div');
      left.className = 'plugin-collapsible-left';

      const chevron = document.createElement('span');
      chevron.className = 'plugin-collapsible-chevron';
      chevron.textContent = '▶';
      left.append(chevron);

      const titleWrap = document.createElement('div');
      titleWrap.className = 'plugin-collapsible-title-wrap';

      const titleEl = document.createElement('div');
      titleEl.className = 'plugin-collapsible-title';
      titleEl.textContent = options.title;
      titleWrap.append(titleEl);

      if (options.subtitle) {
        const subEl = document.createElement('div');
        subEl.className = 'plugin-collapsible-subtitle';
        subEl.textContent = options.subtitle;
        titleWrap.append(subEl);
      }
      left.append(titleWrap);

      if (options.badge) {
        const badge = this.createBadge({
          text: options.badge.text,
          variant: options.badge.variant || 'neutral',
        });
        badge.style.marginLeft = '6px';
        left.append(badge);
      }

      header.append(left);

      if (options.headerActions && options.headerActions.length > 0) {
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'plugin-collapsible-actions';
        options.headerActions.forEach((act) => {
          act.addEventListener('click', (e) => e.stopPropagation());
          actionsWrap.append(act);
        });
        header.append(actionsWrap);
      }

      const body = document.createElement('div');
      body.className = 'plugin-collapsible-body';
      body.hidden = !isOpen;

      const items = Array.isArray(options.content) ? options.content : [options.content];
      items.forEach((c) => body.append(c));

      const setOpen = (open: boolean) => {
        isOpen = open;
        container.classList.toggle('open', isOpen);
        body.hidden = !isOpen;
        options.onToggle?.(isOpen);
      };

      header.addEventListener('click', () => {
        setOpen(!isOpen);
      });

      container.append(header, body);

      return {
        container,
        header,
        body,
        toggle: () => setOpen(!isOpen),
        open: () => setOpen(true),
        close: () => setOpen(false),
        isOpen: () => isOpen,
        setTitle: (title: string) => {
          titleEl.textContent = title;
        },
      };
    },

    /**
     * 상호 배타적인 옵션(예: Cycle / Hold)을 선택할 수 있는 세그먼트 컨트롤 버튼 그룹을 생성합니다.
     */
    createSegmentedControl(options: SegmentedControlOptions): SegmentedControlInstance {
      const ctrl = document.createElement('div');
      ctrl.className = `plugin-segmented-control${options.className ? ` ${options.className}` : ''}`;
      ctrl.setAttribute('role', 'radiogroup');

      let currentValue = options.value ?? (
        typeof options.options[0] === 'string' ? options.options[0] : options.options[0]?.value ?? ''
      );

      const buttons = new Map<string, HTMLButtonElement>();

      const setValue = (val: string) => {
        currentValue = val;
        buttons.forEach((btn, v) => {
          const isActive = v === val;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-checked', String(isActive));
        });
        options.onChange?.(val);
      };

      options.options.forEach((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const icon = typeof opt === 'string' ? undefined : opt.icon;
        const title = typeof opt === 'string' ? undefined : opt.title;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `plugin-segment-btn${val === currentValue ? ' active' : ''}`;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(val === currentValue));
        if (title) btn.title = title;

        if (icon) {
          const iconSpan = document.createElement('span');
          iconSpan.textContent = icon;
          btn.append(iconSpan);
        }

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        btn.append(labelSpan);

        btn.onclick = () => {
          if (currentValue !== val) {
            setValue(val);
          }
        };

        buttons.set(val, btn);
        ctrl.append(btn);
      });

      const row = options.label ? this.createFormRow(options.label, ctrl) : ctrl;

      return {
        row,
        container: ctrl,
        getValue: () => currentValue,
        setValue: (v: string) => setValue(v),
        setDisabled: (disabled: boolean) => {
          buttons.forEach((btn) => {
            btn.disabled = disabled;
          });
        },
      };
    },

    /**
     * 돋보기 아이콘, 실시간 입력 디바운스, 원클릭 지우기(✕)가 포함된 검색 입력 필드를 생성합니다.
     */
    createSearchInput(options?: SearchInputOptions): SearchInputInstance {
      const opts = options || {};
      const wrap = document.createElement('div');
      wrap.className = `plugin-search-input-wrap${opts.className ? ` ${opts.className}` : ''}`;

      const icon = document.createElement('span');
      icon.className = 'plugin-search-icon';
      icon.textContent = '🔍';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'plugin-input plugin-search-field';
      input.placeholder = opts.placeholder || '검색…';
      if (opts.value) input.value = opts.value;

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'plugin-search-clear-btn';
      clearBtn.textContent = '✕';
      clearBtn.title = '지우기';
      clearBtn.hidden = !input.value;

      let debounceTimer: any = null;
      const debounceMs = opts.debounceMs ?? 150;

      const triggerSearch = (query: string) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          opts.onSearch?.(query);
        }, debounceMs);
      };

      input.oninput = () => {
        clearBtn.hidden = !input.value;
        triggerSearch(input.value);
      };

      input.onkeydown = (e) => {
        if (e.key === 'Escape') {
          clear();
        }
      };

      const clear = () => {
        input.value = '';
        clearBtn.hidden = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        opts.onClear?.();
        opts.onSearch?.('');
        input.focus();
      };

      clearBtn.onclick = () => clear();

      wrap.append(icon, input, clearBtn);

      const row = opts.label ? this.createFormRow(opts.label, wrap) : wrap;

      return {
        row,
        input,
        clearBtn,
        getValue: () => input.value,
        setValue: (val: string, runSearch = false) => {
          input.value = val;
          clearBtn.hidden = !val;
          if (runSearch) triggerSearch(val);
        },
        clear,
        focus: () => input.focus(),
      };
    },

    /**
     * 경로 입력창과 [찾아보기…] 버튼이 결합된 파일/폴더 선택 위젯을 생성합니다.
     */
    createFilePicker(options?: FilePickerOptions): FilePickerInstance {
      const opts = options || {};
      const wrap = document.createElement('div');
      wrap.className = `plugin-file-picker-wrap${opts.className ? ` ${opts.className}` : ''}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'plugin-input plugin-file-picker-field';
      if (opts.placeholder) input.placeholder = opts.placeholder;
      if (opts.value) input.value = opts.value;

      input.oninput = () => {
        opts.onChange?.(input.value);
      };

      const browseBtn = document.createElement('button');
      browseBtn.type = 'button';
      browseBtn.className = 'small-btn plugin-file-picker-btn';
      browseBtn.textContent = opts.buttonText || '찾아보기…';

      browseBtn.onclick = async () => {
        let picked: string | null = null;
        if (opts.onBrowse) {
          picked = await opts.onBrowse();
        } else {
          try {
            const fileRef = await platform().pickOpen();
            if (fileRef) {
              picked = fileRef.id || fileRef.name;
            }
          } catch {
            // dialog cancelled or failed
          }
        }

        if (picked) {
          input.value = picked;
          opts.onChange?.(picked);
        }
      };

      wrap.append(input, browseBtn);

      const row = opts.label ? this.createFormRow(opts.label, wrap) : wrap;

      return {
        row,
        input,
        browseBtn,
        getValue: () => input.value,
        setValue: (val: string) => {
          input.value = val;
          opts.onChange?.(val);
        },
      };
    },

    /**
     * 특정 요소에 마우스 호버 시 떠오르는 도움말 툴팁을 연결합니다. 반환된 함수를 호출하면 툴팁을 정리(해제)합니다.
     */
    attachTooltip(element: HTMLElement, options: string | TooltipOptions): () => void {
      const opts: TooltipOptions = typeof options === 'string' ? { text: options } : options;
      let tooltipEl: HTMLElement | null = null;
      let timer: any = null;

      const show = () => {
        if (tooltipEl) return;
        timer = setTimeout(() => {
          tooltipEl = document.createElement('div');
          tooltipEl.className = `plugin-tooltip${opts.className ? ` ${opts.className}` : ''}`;
          tooltipEl.textContent = opts.text;
          document.body.appendChild(tooltipEl);

          const targetRect = element.getBoundingClientRect();
          const tipRect = tooltipEl.getBoundingClientRect();
          const pos = opts.position || 'top';

          let top = 0;
          let left = 0;

          if (pos === 'top') {
            top = targetRect.top - tipRect.height - 6;
            left = targetRect.left + (targetRect.width - tipRect.width) / 2;
          } else if (pos === 'bottom') {
            top = targetRect.bottom + 6;
            left = targetRect.left + (targetRect.width - tipRect.width) / 2;
          } else if (pos === 'left') {
            top = targetRect.top + (targetRect.height - tipRect.height) / 2;
            left = targetRect.left - tipRect.width - 6;
          } else if (pos === 'right') {
            top = targetRect.top + (targetRect.height - tipRect.height) / 2;
            left = targetRect.right + 6;
          }

          left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, left));
          top = Math.max(8, Math.min(window.innerHeight - tipRect.height - 8, top));

          tooltipEl.style.top = `${top}px`;
          tooltipEl.style.left = `${left}px`;
        }, opts.delay ?? 200);
      };

      const hide = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (tooltipEl) {
          tooltipEl.remove();
          tooltipEl = null;
        }
      };

      element.addEventListener('mouseenter', show);
      element.addEventListener('mouseleave', hide);
      element.addEventListener('mousedown', hide);

      return () => {
        hide();
        element.removeEventListener('mouseenter', show);
        element.removeEventListener('mouseleave', hide);
        element.removeEventListener('mousedown', hide);
      };
    },

    /**
     * 파일 드래그 앤 드롭을 수신할 수 있는 드롭존 영역을 생성합니다.
     */
    createDropZone(options?: DropZoneOptions): DropZoneInstance {
      const opts = options || {};
      const container = document.createElement('div');
      container.className = `plugin-drop-zone${opts.className ? ` ${opts.className}` : ''}`;

      const icon = document.createElement('div');
      icon.className = 'plugin-drop-zone-icon';
      icon.textContent = opts.icon || '📁';

      const label = document.createElement('div');
      label.className = 'plugin-drop-zone-label';
      label.textContent = opts.label || '파일을 이곳으로 드래그 앤 드롭하세요';

      container.append(icon, label);

      let sublabel: HTMLElement | null = null;
      if (opts.sublabel) {
        sublabel = document.createElement('div');
        sublabel.className = 'plugin-drop-zone-sublabel';
        sublabel.textContent = opts.sublabel;
        container.append(sublabel);
      }

      const onDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        container.classList.add('dragover');
      };

      const onDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        container.classList.remove('dragover');
      };

      const onDrop = async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        container.classList.remove('dragover');

        if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

        let files = Array.from(e.dataTransfer.files);

        if (opts.accept && opts.accept.length > 0) {
          const lowerExts = opts.accept.map((ext) => ext.toLowerCase());
          files = files.filter((f) => {
            const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
            return lowerExts.some((acc) => acc === ext || f.type.includes(acc.replace('.', '')));
          });
        }

        if (files.length === 0) return;
        if (!opts.multiple) files = [files[0]];

        await opts.onDrop?.(files);
      };

      container.addEventListener('dragover', onDragOver);
      container.addEventListener('dragenter', onDragOver);
      container.addEventListener('dragleave', onDragLeave);
      container.addEventListener('drop', onDrop);

      if (opts.onClick) {
        container.addEventListener('click', opts.onClick);
      }

      return {
        container,
        setLabel: (newLabel: string, newSublabel?: string) => {
          label.textContent = newLabel;
          if (newSublabel !== undefined) {
            if (!sublabel) {
              sublabel = document.createElement('div');
              sublabel.className = 'plugin-drop-zone-sublabel';
              container.append(sublabel);
            }
            sublabel.textContent = newSublabel;
          }
        },
        dispose: () => {
          container.removeEventListener('dragover', onDragOver);
          container.removeEventListener('dragenter', onDragOver);
          container.removeEventListener('dragleave', onDragLeave);
          container.removeEventListener('drop', onDrop);
        },
      };
    },
  };
}

export interface SplitViewOptions {
  direction?: 'horizontal' | 'vertical';
  first?: HTMLElement;
  second?: HTMLElement;
  initialSize?: number | string;
  minFirstSize?: number;
  minSecondSize?: number;
  resizable?: boolean;
  storageKey?: string;
  onResize?: (firstSize: number, secondSize: number) => void;
  className?: string;
}

export interface SplitViewInstance {
  container: HTMLElement;
  firstPane: HTMLElement;
  secondPane: HTMLElement;
  splitter: HTMLElement;
  setSize: (size: number | string) => void;
  getSize: () => number;
  reset: () => void;
  dispose: () => void;
}

export interface RowOptions {
  children?: HTMLElement[];
  gap?: number | string;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  wrap?: boolean;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface ColumnOptions {
  children?: HTMLElement[];
  gap?: number | string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface GridOptions {
  columns?: number | string;
  gap?: number | string;
  children?: HTMLElement[];
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface DividerOptions {
  vertical?: boolean;
  margin?: number | string;
  className?: string;
}

export interface ScrollContainerOptions {
  content?: HTMLElement | HTMLElement[];
  direction?: 'vertical' | 'horizontal' | 'both';
  maxHeight?: number | string;
  maxWidth?: number | string;
  height?: number | string;
  width?: number | string;
  padding?: number | string;
  flex?: number | string;
  style?: Partial<CSSStyleDeclaration>;
  className?: string;
  autoScroll?: boolean;
}

export interface ScrollContainerInstance {
  container: HTMLElement;
  content: HTMLElement;
  append: (...items: HTMLElement[]) => void;
  clear: () => void;
  scrollToTop: (smooth?: boolean) => void;
  scrollToBottom: (smooth?: boolean) => void;
  getScrollTop: () => number;
  setScrollTop: (top: number) => void;
}

export interface TabDef {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  content: HTMLElement;
  disabled?: boolean;
}

export interface TabsOptions {
  tabs: TabDef[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export interface TabsInstance {
  container: HTMLElement;
  tabNav: HTMLElement;
  tabContent: HTMLElement;
  switchTab: (tabId: string) => void;
  getActiveTab: () => string;
  setTabBadge: (tabId: string, badge?: string) => void;
  setTabDisabled: (tabId: string, disabled: boolean) => void;
}

export interface CollapsibleOptions {
  title: string;
  subtitle?: string;
  badge?: { text: string; variant?: 'info' | 'success' | 'warn' | 'error' | 'neutral' };
  content: HTMLElement | HTMLElement[];
  defaultOpen?: boolean;
  headerActions?: HTMLElement[];
  onToggle?: (isOpen: boolean) => void;
  className?: string;
}

export interface CollapsibleInstance {
  container: HTMLElement;
  header: HTMLElement;
  body: HTMLElement;
  toggle: () => void;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  setTitle: (title: string) => void;
}

export interface SegmentOption {
  value: string;
  label: string;
  icon?: string;
  title?: string;
}

export interface SegmentedControlOptions {
  label?: string;
  options: Array<string | SegmentOption>;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export interface SegmentedControlInstance {
  row: HTMLElement;
  container: HTMLElement;
  getValue: () => string;
  setValue: (value: string) => void;
  setDisabled: (disabled: boolean) => void;
}

export interface SearchInputOptions {
  label?: string;
  placeholder?: string;
  value?: string;
  debounceMs?: number;
  onSearch?: (query: string) => void;
  onClear?: () => void;
  className?: string;
}

export interface SearchInputInstance {
  row: HTMLElement;
  input: HTMLInputElement;
  clearBtn: HTMLButtonElement;
  getValue: () => string;
  setValue: (value: string, triggerSearch?: boolean) => void;
  clear: () => void;
  focus: () => void;
}

export interface FilePickerOptions {
  label?: string;
  placeholder?: string;
  value?: string;
  buttonText?: string;
  title?: string;
  filter?: string;
  pickMode?: 'file' | 'folder';
  onChange?: (path: string) => void;
  onBrowse?: () => Promise<string | null> | string | null;
  className?: string;
}

export interface FilePickerInstance {
  row: HTMLElement;
  input: HTMLInputElement;
  browseBtn: HTMLButtonElement;
  getValue: () => string;
  setValue: (path: string) => void;
}

export interface TooltipOptions {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export interface DropZoneOptions {
  label?: string;
  sublabel?: string;
  icon?: string;
  accept?: string[];
  multiple?: boolean;
  onDrop?: (files: File[]) => void | Promise<void>;
  onClick?: () => void;
  className?: string;
}

export interface DropZoneInstance {
  container: HTMLElement;
  setLabel: (label: string, sublabel?: string) => void;
  dispose: () => void;
}

export type PluginUIBuilder = ReturnType<typeof createUIBuilder>;


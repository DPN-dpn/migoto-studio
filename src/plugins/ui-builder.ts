import type { SelectOption } from './types.ts';

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

      return {
        container,
        output,
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
  };
}

export type PluginUIBuilder = ReturnType<typeof createUIBuilder>;

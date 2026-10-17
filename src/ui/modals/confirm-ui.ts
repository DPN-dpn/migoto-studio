import { openModal } from './modal.ts';

export interface ConfirmModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
}

export type ConfirmOptions = string | ConfirmModalOptions;

export interface PromptModalOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export type PromptOptions = string | PromptModalOptions;

/**
 * 사용자에게 확인/취소를 묻는 비동기 대화상자를 표시합니다.
 */
export function openConfirmModal(options: ConfirmOptions): Promise<boolean> {
  const opts: ConfirmModalOptions =
    typeof options === 'string' ? { message: options } : options;

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    const finish = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    const body = document.createElement('div');
    body.className = 'confirm-dialog-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '14px';
    body.style.padding = '8px 0 4px';

    const msg = document.createElement('div');
    msg.className = 'confirm-message';
    msg.style.fontSize = '13px';
    msg.style.lineHeight = '1.6';
    msg.style.color = 'var(--fg)';
    msg.style.whiteSpace = 'pre-wrap';
    msg.textContent = opts.message;
    body.appendChild(msg);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '8px';
    footer.style.marginTop = '12px';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = opts.cancelText || '취소';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = opts.variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = opts.confirmText || '확인';
    if (opts.variant === 'danger') {
      confirmBtn.style.backgroundColor = '#ef4444';
      confirmBtn.style.color = '#ffffff';
    }

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    body.appendChild(footer);

    let closeModal: (() => void) | null = null;

    closeModal = openModal(opts.title || '확인', body, {
      autoHeight: true,
      className: 'modal-confirm-dialog',
      onClose: () => {
        finish(false);
      },
    });

    cancelBtn.addEventListener('click', () => {
      finish(false);
      closeModal?.();
    });

    confirmBtn.addEventListener('click', () => {
      finish(true);
      closeModal?.();
    });

    // Auto-focus confirm button
    setTimeout(() => {
      confirmBtn.focus();
    }, 50);
  });
}

/**
 * 사용자에게 텍스트 입력을 받는 비동기 프롬프트 대화상자를 표시합니다.
 * 취소하거나 Esc를 누르면 null을 반환합니다.
 */
export function openPromptModal(options: PromptOptions): Promise<string | null> {
  const opts: PromptModalOptions =
    typeof options === 'string' ? { message: options } : options;

  return new Promise<string | null>((resolve) => {
    let resolved = false;
    const finish = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    const body = document.createElement('div');
    body.className = 'prompt-dialog-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '12px';
    body.style.padding = '8px 0 4px';

    if (opts.message) {
      const msg = document.createElement('div');
      msg.className = 'prompt-message';
      msg.style.fontSize = '13px';
      msg.style.lineHeight = '1.6';
      msg.style.color = 'var(--fg)';
      msg.style.whiteSpace = 'pre-wrap';
      msg.textContent = opts.message;
      body.appendChild(msg);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-text prompt-input';
    input.style.width = '100%';
    input.style.padding = '8px 12px';
    input.style.fontSize = '13px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid var(--border)';
    input.style.backgroundColor = 'var(--bg-input, var(--bg-hover))';
    input.style.color = 'var(--fg)';
    input.style.outline = 'none';
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.defaultValue) input.value = opts.defaultValue;
    body.appendChild(input);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '8px';
    footer.style.marginTop = '12px';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = opts.cancelText || '취소';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = opts.confirmText || '확인';

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    body.appendChild(footer);

    let closeModal: (() => void) | null = null;

    closeModal = openModal(opts.title || '입력', body, {
      autoHeight: true,
      className: 'modal-prompt-dialog',
      onClose: () => {
        finish(null);
      },
    });

    cancelBtn.addEventListener('click', () => {
      finish(null);
      closeModal?.();
    });

    const submit = () => {
      finish(input.value);
      closeModal?.();
    };

    confirmBtn.addEventListener('click', submit);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });

    // Auto-focus and select input
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  });
}

/** Minimal modal dialog. Only one is open at a time; Esc, ✕ or a click on the backdrop closes it. */
let closeCurrent: (() => void) | null = null;

export function openModal(title: string, body: HTMLElement): () => void {
  closeCurrent?.();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const panel = document.createElement('section');
  panel.className = 'modal';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);

  const header = document.createElement('header');
  const h = document.createElement('h2');
  h.textContent = title;
  const x = document.createElement('button');
  x.className = 'modal-close';
  x.textContent = '✕';
  x.title = '닫기 (Esc)';
  header.append(h, x);

  body.classList.add('modal-body');
  panel.append(header, body);
  backdrop.append(panel);
  document.body.append(backdrop);

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (closeCurrent === close) closeCurrent = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };
  document.addEventListener('keydown', onKey, true);
  x.addEventListener('click', close);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });

  closeCurrent = close;
  return close;
}

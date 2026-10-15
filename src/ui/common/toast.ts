/**
 * Global toast notification utility.
 * Displays brief, non-intrusive status messages in the bottom-right corner.
 */
export function showToast(message: string, type: 'info' | 'warn' | 'error' = 'info'): void {
  let toastContainer = document.getElementById('global-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'global-toast-container';
    toastContainer.className = 'global-toast-container';
    document.body.append(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `plugin-toast toast-${type}`;
  const icon = type === 'error' ? '!' : type === 'warn' ? '!' : 'i';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${message}</span>`;
  toastContainer.append(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

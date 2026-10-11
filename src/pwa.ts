import { isDesktop } from './platform';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Initialize PWA Service Worker and Install Prompt functionality.
 * Only active in web browser environments (disabled in native Tauri desktop).
 */
export function initPwa() {
  if (isDesktop) {
    return;
  }

  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Relative path so it works in both dev (/) and GitHub Pages (/migoto-studio/)
      const swUrl = new URL('sw.js', window.location.href).href;
      navigator.serviceWorker
        .register(swUrl, { scope: './' })
        .then((reg) => {
          // Check for worker updates periodically
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] 새 버전이 백그라운드에 준비되었습니다.');
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker 등록 실패:', err);
        });
    });
  }

  // 2. Setup install prompt button
  const installBtn = document.getElementById('btn-pwa-install') as HTMLButtonElement | null;
  if (!installBtn) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  if (isStandalone) {
    installBtn.hidden = true;
    return;
  }

  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installBtn.disabled = true;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installBtn.hidden = true;
      }
    } finally {
      installBtn.disabled = false;
      deferredPrompt = null;
    }
  });

  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    deferredPrompt = null;
    console.log('[PWA] Migoto Studio가 기기에 성공적으로 설치되었습니다.');
  });
}

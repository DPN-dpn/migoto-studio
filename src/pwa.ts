import { isDesktop } from './platform';
import { showToast } from './ui/toast';

const PWA_INSTALLED_STORAGE_KEY = 'migoto_pwa_installed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Checks if the current window is running inside an installed standalone PWA session.
 */
export function isStandaloneSession(): boolean {
  if (isDesktop || typeof window === 'undefined') {
    return true;
  }

  // 1. Check URL parameters set by manifest start_url (?source=pwa)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('source') === 'pwa' || urlParams.get('mode') === 'standalone') {
    return true;
  }

  // 2. Check CSS display-mode media queries
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  ) {
    return true;
  }

  // 3. iOS Safari standalone property
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) {
    return true;
  }

  // 4. Android trusted web activity / webapp referrer
  if (document.referrer.startsWith('android-app://')) {
    return true;
  }

  return false;
}

/**
 * Checks if the app is already installed on this machine/browser.
 */
export async function checkIsAppInstalled(): Promise<boolean> {
  // If already running inside standalone app, it is 100% installed
  if (isStandaloneSession()) {
    return true;
  }

  // Check getInstalledRelatedApps API (Chromium 85+, Edge)
  if ('getInstalledRelatedApps' in navigator) {
    try {
      const getApps = (navigator as unknown as { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps;
      if (typeof getApps === 'function') {
        const related = await getApps.call(navigator);
        if (Array.isArray(related) && related.length > 0) {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

/**
 * Initialize PWA Service Worker and Install Prompt functionality.
 * Only active in web browser environments (disabled in native Tauri desktop).
 */
export function initPwa() {
  const installBtn = document.getElementById('btn-pwa-install') as HTMLButtonElement | null;

  if (isDesktop) {
    if (installBtn) {
      installBtn.hidden = true;
      installBtn.style.display = 'none';
    }
    return;
  }

  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = new URL('sw.js', window.location.href).href;
      navigator.serviceWorker
        .register(swUrl, { scope: './' })
        .then((reg) => {
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

  if (!installBtn) return;

  const hideBtn = () => {
    installBtn.hidden = true;
    installBtn.style.display = 'none';
  };

  const showBtn = () => {
    installBtn.hidden = false;
    installBtn.style.display = 'inline-flex';
  };

  // If already running inside standalone PWA window, hide button
  if (isStandaloneSession()) {
    hideBtn();
    return;
  }

  // On standard web browser tab, show the install button by default
  showBtn();

  // Listen to media query changes (e.g. if launched or resized into standalone)
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  standaloneQuery.addEventListener('change', (e) => {
    if (e.matches) {
      hideBtn();
    } else {
      showBtn();
    }
  });

  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;

    if (!isStandaloneSession()) {
      showBtn();
    }
  });

  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      installBtn.disabled = true;
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          hideBtn();
        }
      } finally {
        installBtn.disabled = false;
        deferredPrompt = null;
      }
    } else {
      showToast('브라우저 주소창 우측의 [설치] 아이콘을 클릭하거나 브라우저 메뉴에서 [앱으로 설치]를 선택하세요.', 'info');
    }
  });

  window.addEventListener('appinstalled', () => {
    hideBtn();
    deferredPrompt = null;
    console.log('[PWA] Migoto Studio가 기기에 성공적으로 설치되었습니다.');
  });
}


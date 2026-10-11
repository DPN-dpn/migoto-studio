import { isDesktop } from './platform';

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
    try {
      localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
    } catch {}
    return true;
  }

  // Check getInstalledRelatedApps API (Chromium 85+, Edge)
  if ('getInstalledRelatedApps' in navigator) {
    try {
      const getApps = (navigator as unknown as { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps;
      if (typeof getApps === 'function') {
        const related = await getApps.call(navigator);
        if (Array.isArray(related)) {
          if (related.length > 0) {
            try {
              localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
            } catch {}
            return true;
          } else {
            // Browser explicitly confirmed 0 installed related apps
            try {
              localStorage.removeItem(PWA_INSTALLED_STORAGE_KEY);
            } catch {}
            return false;
          }
        }
      }
    } catch {
      // Fallback to localStorage check below
    }
  }

  try {
    return localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
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

  // 2. Setup install prompt button
  const installBtn = document.getElementById('btn-pwa-install') as HTMLButtonElement | null;
  if (!installBtn) return;

  // Initial check: if already in standalone app or already installed, keep hidden
  const hideBtn = () => {
    installBtn.hidden = true;
    installBtn.style.display = 'none';
  };

  if (isStandaloneSession()) {
    hideBtn();
    try {
      localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
    } catch {}
    return;
  }

  // Proactively check if already installed on page load
  checkIsAppInstalled().then((alreadyInstalled) => {
    if (alreadyInstalled) {
      hideBtn();
    }
  });

  // Listen to media query changes (e.g. if launched or resized into standalone)
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  standaloneQuery.addEventListener('change', (e) => {
    if (e.matches) {
      hideBtn();
      try {
        localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
      } catch {}
    }
  });

  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', async (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;

    // Do NOT show if already running standalone or already installed!
    if (isStandaloneSession() || (await checkIsAppInstalled())) {
      hideBtn();
      return;
    }

    // Only show if definitely not installed
    installBtn.hidden = false;
    installBtn.style.removeProperty('display');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installBtn.disabled = true;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        hideBtn();
        try {
          localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
        } catch {}
      }
    } finally {
      installBtn.disabled = false;
      deferredPrompt = null;
    }
  });

  window.addEventListener('appinstalled', () => {
    hideBtn();
    deferredPrompt = null;
    try {
      localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
    } catch {}
    console.log('[PWA] Migoto Studio가 기기에 성공적으로 설치되었습니다.');
  });
}

import { openModal } from '../ui/modal';
import { platform } from '../platform';
import { getSettings } from '../core/settings';
import { renderMarkdown } from '../ui/markdown';

import { CURRENT_APP_VERSION, isNewerVersion } from './version';

export { CURRENT_APP_VERSION, isNewerVersion };
const REPO_OWNER = 'DPN-dpn';
const REPO_NAME = 'migoto-studio';
const GITHUB_RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const GITHUB_API_LATEST = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  isPortable?: boolean;
  canAutoInstall: boolean;
  downloadAndInstall?: (onProgress?: (percent: number) => void) => Promise<void>;
}

interface GitHubReleaseData {
  version: string;
  body: string;
  url: string;
  publishedAt: string;
  setupAssetUrl?: string;
  setupAssetName?: string;
}

/**
 * Open external URL in the system browser.
 */
export async function openExternalUrl(url: string) {
  if (platform().kind === 'desktop') {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_in_browser', { url });
      return;
    } catch {}
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Query latest release from GitHub API.
 */
async function fetchLatestFromGitHub(): Promise<GitHubReleaseData | null> {
  try {
    const res = await fetch(GITHUB_API_LATEST, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag = (data.tag_name || '').replace(/^v/i, '');

    const assets = Array.isArray(data.assets) ? data.assets : [];
    const setupAsset = assets.find(
      (a: any) =>
        typeof a.name === 'string' &&
        (a.name.endsWith('-setup.exe') || (a.name.endsWith('.exe') && !a.name.includes('portable'))),
    );

    return {
      version: tag,
      body: data.body || '',
      url: data.html_url || GITHUB_RELEASES_URL,
      publishedAt: data.published_at || '',
      setupAssetUrl: setupAsset?.browser_download_url,
      setupAssetName: setupAsset?.name,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the desktop app is running in portable mode.
 */
async function checkIsPortable(): Promise<boolean> {
  if (platform().kind !== 'desktop') return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('is_portable_mode');
  } catch {
    return false;
  }
}

/**
 * Check for updates.
 */
export async function checkUpdate(): Promise<UpdateInfo> {
  const currentVersion = CURRENT_APP_VERSION;
  const isPortable = await checkIsPortable();

  // 1. Desktop: try official Tauri Updater plugin (production desktop builds only)
  if (platform().kind === 'desktop' && !import.meta.env.DEV) {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update && isNewerVersion(currentVersion, update.version)) {
        return {
          hasUpdate: true,
          currentVersion,
          latestVersion: update.version,
          releaseDate: update.date,
          releaseNotes: update.body || '최신 개선사항 및 버그 수정이 포함되어 있습니다.',
          releaseUrl: `${GITHUB_RELEASES_URL}/tag/v${update.version}`,
          isPortable,
          canAutoInstall: !isPortable,
          downloadAndInstall: async (onProgress) => {
            let downloaded = 0;
            let contentLength = 0;
            await update.downloadAndInstall((event) => {
              if (event.event === 'Started') {
                contentLength = event.data.contentLength || 0;
              } else if (event.event === 'Progress') {
                downloaded += event.data.chunkLength;
                if (contentLength > 0 && onProgress) {
                  onProgress(Math.min(100, Math.round((downloaded / contentLength) * 100)));
                }
              }
            });
          },
        };
      }
    } catch (e) {
      console.warn('Tauri updater check returned error, falling back to GitHub API:', e);
    }
  }

  // 2. Fallback check via GitHub Releases API
  const gh = await fetchLatestFromGitHub();
  if (gh && isNewerVersion(currentVersion, gh.version)) {
    const canAutoInstall =
      platform().kind === 'desktop'
        ? Boolean(!isPortable && gh.setupAssetUrl)
        : true;

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion: gh.version,
      releaseDate: gh.publishedAt ? new Date(gh.publishedAt).toLocaleDateString() : undefined,
      releaseNotes: gh.body || '새로운 버전이 등록되었습니다.',
      releaseUrl: gh.url,
      isPortable,
      canAutoInstall,
      downloadAndInstall: async (onProgress) => {
        if (platform().kind === 'desktop' && gh.setupAssetUrl) {
          onProgress?.(30);
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('download_and_install_update', {
            url: gh.setupAssetUrl,
            version: gh.version,
          });
        } else {
          // Web / PWA refresh
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) await r.update();
          }
          window.location.reload();
        }
      },
    };
  }

  return {
    hasUpdate: false,
    currentVersion,
    latestVersion: gh ? gh.version : currentVersion,
    isPortable,
    canAutoInstall: false,
  };
}

/**
 * Shows the update result dialog.
 */
export function showUpdateModal(info: UpdateInfo) {
  const body = document.createElement('div');
  body.className = 'update-dialog';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = '14px';

  if (!info.hasUpdate) {
    const okBox = document.createElement('div');
    okBox.style.textAlign = 'center';
    okBox.style.padding = '16px 8px';

    const icon = document.createElement('div');
    icon.style.display = 'flex';
    icon.style.justifyContent = 'center';
    icon.style.marginBottom = '12px';
    icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

    const title = document.createElement('h3');
    title.style.margin = '0 0 6px';
    title.style.fontSize = '15px';
    title.textContent = '최신 버전을 사용 중입니다';

    const desc = document.createElement('p');
    desc.className = 'hint';
    desc.style.margin = '0';
    desc.textContent = `현재 버전(v${info.currentVersion})이 최신 빌드입니다.`;

    okBox.append(icon, title, desc);
    body.append(okBox);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'primary';
    closeBtn.style.alignSelf = 'flex-end';
    closeBtn.textContent = '확인';

    body.append(closeBtn);

    const close = openModal('업데이트 확인', body, { autoHeight: true });
    closeBtn.onclick = () => close();
    return;
  }

  // An update is available!
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.background = 'var(--bg)';
  header.style.padding = '10px 14px';
  header.style.borderRadius = '8px';
  header.style.border = '1px solid var(--border)';

  const verBox = document.createElement('div');
  verBox.innerHTML = `
    <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">새로운 버전이 출시되었습니다</div>
    <div style="font-size: 12px; color: var(--fg-dim);">
      현재 버전: <code>v${info.currentVersion}</code> &rarr; 최신 버전: <strong style="color: var(--accent);">v${info.latestVersion}</strong>
    </div>
  `;
  header.append(verBox);
  body.append(header);

  // Release notes
  const notesTitle = document.createElement('div');
  notesTitle.style.fontSize = '12px';
  notesTitle.style.fontWeight = '600';
  notesTitle.style.color = 'var(--fg-dim)';
  notesTitle.textContent = '릴리스 노트:';

  const notesBox = document.createElement('div');
  notesBox.className = 'update-release-notes markdown-body';
  notesBox.style.maxHeight = '280px';
  notesBox.style.overflowY = 'auto';
  notesBox.style.padding = '12px 14px';
  notesBox.style.background = 'var(--bg)';
  notesBox.style.border = '1px solid var(--border)';
  notesBox.style.borderRadius = '6px';
  renderMarkdown(
    notesBox,
    info.releaseNotes || '상세 개선사항 및 버그 수정이 포함되어 있습니다.',
    {
      onLinkClick: (url) => {
        openExternalUrl(url);
      },
    },
  );

  body.append(notesTitle, notesBox);

  // Status / hint
  const statusEl = document.createElement('div');
  statusEl.style.fontSize = '12px';
  statusEl.style.color = 'var(--fg-dim)';

  if (info.isPortable) {
    statusEl.innerHTML =
      '<strong>포터블 모드</strong>: 릴리스 페이지에서 최신 포터블 <code>.zip</code>을 받아 압축 해제하시면 데이터가 보존됩니다.';
  }
  body.append(statusEl);

  // Actions
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.style.gap = '8px';
  btnRow.style.marginTop = '6px';

  let closeDialog = () => {};

  if (info.canAutoInstall && info.downloadAndInstall) {
    const installBtn = document.createElement('button');
    installBtn.className = 'primary';
    installBtn.textContent = '지금 바로 업데이트';

    installBtn.onclick = async () => {
      installBtn.disabled = true;
      installBtn.textContent = '다운로드 및 설치 준비 중...';
      statusEl.textContent = '최신 설치 파일을 다운로드하고 있습니다. 다운로드가 완료되면 설치 프로그램이 자동으로 실행됩니다...';

      try {
        await info.downloadAndInstall!();
        statusEl.textContent = '설치 관리자를 실행합니다...';
        installBtn.textContent = '설치 실행 중...';

        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('relaunch_app');
        } catch {
          window.location.reload();
        }
      } catch (err: any) {
        console.error('Update install failed:', err);
        statusEl.style.color = '#ef4444';
        statusEl.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px;">자동 업데이트 실패 (${err?.message || err})</div>
          <div style="font-size: 12px; color: var(--fg); line-height: 1.5;">
            네트워크 연결 또는 권한 문제로 자동 설치를 완료하지 못했습니다.<br>
            GitHub 릴리스 페이지에서 최신 설치 파일(.exe) 또는 무설치 포터블(.zip)을 직접 다운로드해 주세요.
          </div>
        `;
        installBtn.disabled = false;
        installBtn.className = '';
        installBtn.textContent = '다시 시도';

        if (!btnRow.querySelector('.gh-release-fallback-btn')) {
          const ghBtn = document.createElement('button');
          ghBtn.className = 'primary gh-release-fallback-btn';
          ghBtn.textContent = 'GitHub 릴리스 페이지 열기';
          ghBtn.onclick = () => {
            openExternalUrl(info.releaseUrl || GITHUB_RELEASES_URL);
          };
          btnRow.prepend(ghBtn);
        }
      }
    };
    btnRow.append(installBtn);
  } else {
    // Portable mode or fallback
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'primary';
    downloadBtn.textContent = '최신 버전 다운로드';
    downloadBtn.onclick = () => {
      openExternalUrl(info.releaseUrl || GITHUB_RELEASES_URL);
    };
    btnRow.append(downloadBtn);
  }

  const laterBtn = document.createElement('button');
  laterBtn.textContent = '닫기';
  laterBtn.onclick = () => closeDialog();
  btnRow.append(laterBtn);

  body.append(btnRow);

  closeDialog = openModal('Migoto Studio 업데이트 알림', body, { autoHeight: true, className: 'modal-update' });
}

/**
 * Initiates an update check.
 * If silent = true, only shows modal when an update is found.
 */
export async function runUpdateCheck(silent = false) {
  try {
    const result = await checkUpdate();
    if (result.hasUpdate || !silent) {
      showUpdateModal(result);
    }
  } catch (e) {
    if (!silent) {
      const body = document.createElement('div');
      body.style.display = 'flex';
      body.style.flexDirection = 'column';
      body.style.gap = '12px';

      const msgBox = document.createElement('div');
      msgBox.innerHTML = `
        <div style="color: #ef4444; font-weight: 600; margin-bottom: 4px;">업데이트 확인 실패</div>
        <div style="font-size: 12px; color: var(--fg-dim); line-height: 1.5;">
          최신 버전을 확인하는 중 오류가 발생했습니다: ${e}<br>
          GitHub 릴리스 페이지에서 직접 최신 버전을 확인하고 다운로드하실 수 있습니다.
        </div>
      `;

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.justifyContent = 'flex-end';
      btnRow.style.gap = '8px';

      let closeDialog = () => {};
      const ghBtn = document.createElement('button');
      ghBtn.className = 'primary';
      ghBtn.textContent = 'GitHub 릴리스 페이지 열기';
      ghBtn.onclick = () => {
        openExternalUrl(GITHUB_RELEASES_URL);
        closeDialog();
      };

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '닫기';
      closeBtn.onclick = () => closeDialog();

      btnRow.append(ghBtn, closeBtn);
      body.append(msgBox, btnRow);

      closeDialog = openModal('업데이트 확인 실패', body, { autoHeight: true });
    }
  }
}

/**
 * Automatically check on startup if enabled in settings.
 */
export function checkOnStartup() {
  if (import.meta.env.DEV) {
    return;
  }
  const s = getSettings();
  if (s.checkForUpdatesOnStartup !== false) {
    setTimeout(() => {
      runUpdateCheck(true);
    }, 2500);
  }
}


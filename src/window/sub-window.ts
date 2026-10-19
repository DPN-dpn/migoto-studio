import type { SubWindowOptions, SubWindowHandle, NativeWindowHandle } from './types.ts';
import { isTauriEnvironment } from '../platform/index';
import { appLogger } from '../core/logger';
import { showToast } from '../ui/common/toast';
import { nativeWindowManager } from './native-window';

interface ActiveWindowItem {
  handle: SubWindowHandle;
  cleanup?: () => void;
  subWin?: Window | null;
  floatingEl?: HTMLElement | null;
  dockChip?: HTMLElement | null;
  pipWin?: Window | null;
}

let floatingStylesInjected = false;
let highestZIndex = 5000;

function ensureFloatingStyles() {
  if (floatingStylesInjected || typeof document === 'undefined') return;
  floatingStylesInjected = true;

  const style = document.createElement('style');
  style.id = 'migoto-floating-subwindow-styles';
  style.textContent = `
    .migoto-subwindow-dock-bar {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: row-reverse;
      gap: 8px;
      z-index: 100001;
      pointer-events: none;
    }

    .migoto-subwindow-dock-chip {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--bg-secondary, #161b22);
      border: 1px solid var(--border-color, #30363d);
      border-radius: 20px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
      font-size: 11px;
      font-weight: 500;
      color: var(--text-color, #e6edf3);
      cursor: pointer;
      user-select: none;
      transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
    }

    .migoto-subwindow-dock-chip:hover {
      transform: translateY(-2px);
      background: var(--bg-primary, #0d1117);
      border-color: var(--accent-color, #58a6ff);
    }

    .migoto-floating-subwindow {
      position: fixed;
      display: flex;
      flex-direction: column;
      background: var(--bg-primary, #0d1117);
      border: 1px solid var(--border-color, #30363d);
      border-radius: 8px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06);
      overflow: hidden;
      box-sizing: border-box;
      user-select: auto;
      transition: box-shadow 0.15s ease;
    }

    .migoto-floating-subwindow.is-active {
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px var(--accent-color, #58a6ff);
    }

    .migoto-floating-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: var(--bg-secondary, #161b22);
      border-bottom: 1px solid var(--border-color, #30363d);
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
      gap: 8px;
    }

    .migoto-floating-header:active {
      cursor: grabbing;
    }

    .migoto-floating-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1 1 auto;
    }

    .migoto-floating-title {
      font-weight: 600;
      font-size: 12px;
      color: var(--text-color, #e6edf3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .migoto-floating-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .migoto-floating-btn {
      background: transparent;
      border: none;
      color: var(--text-muted, #8b949e);
      width: 22px;
      height: 22px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 11px;
      line-height: 1;
      transition: background 0.15s ease, color 0.15s ease;
      padding: 0;
    }

    .migoto-floating-btn:hover {
      background: var(--bg-hover, rgba(255, 255, 255, 0.08));
      color: var(--text-color, #e6edf3);
    }

    .migoto-floating-btn.pip-btn.is-popped-out {
      color: var(--accent-color, #58a6ff);
      background: rgba(56, 139, 253, 0.18);
    }

    .migoto-floating-btn.close-btn:hover {
      background: rgba(248, 81, 73, 0.25);
      color: #ff7b72;
    }

    .migoto-floating-placeholder {
      display: none;
      flex: 1 1 0;
      min-height: 0;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;
      padding: 24px;
      text-align: center;
      box-sizing: border-box;
      user-select: none;
    }

    .migoto-floating-placeholder-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-color, #e6edf3);
    }

    .migoto-floating-placeholder-desc {
      font-size: 11px;
      max-width: 300px;
      line-height: 1.5;
      color: var(--text-muted, #8b949e);
    }

    .migoto-floating-dock-in-btn {
      margin-top: 6px;
      padding: 6px 14px;
      background: var(--bg-secondary, #21262d);
      border: 1px solid var(--border-color, #30363d);
      border-radius: 6px;
      color: var(--text-color, #e6edf3);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .migoto-floating-dock-in-btn:hover {
      background: var(--bg-hover, rgba(255, 255, 255, 0.08));
      border-color: var(--accent-color, #58a6ff);
      color: var(--accent-color, #58a6ff);
    }

    .migoto-floating-resize-r {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 100%;
      cursor: ew-resize;
      z-index: 10;
    }

    .migoto-floating-resize-b {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 6px;
      cursor: ns-resize;
      z-index: 10;
    }

    .migoto-floating-resize-br {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      cursor: nwse-resize;
      z-index: 11;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      color: var(--text-muted, #8b949e);
      opacity: 0.6;
    }

    .migoto-floating-resize-br:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

export class SubWindowManager {
  private activeWindows: Map<string, ActiveWindowItem> = new Map();
  private dockBar: HTMLElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.closeAllWindows();
      });
    }
  }

  /**
   * 플러그인 전용 서브 윈도우를 엽니다.
   * 브라우저 팝업 지원 시 팝업 창을 사용하며, Tauri 데스크톱 환경이거나
   * 팝업이 차단된 경우 앱 내 네이티브 플로팅 윈도우로 안전하게 폴백합니다.
   * 플로팅 창 상단의 PiP 버튼을 통해 언제든 별도의 독립 OS 윈도우로 분리(팝아웃) 가능합니다.
   */
  openSubWindow(
    pluginId: string,
    options: SubWindowOptions,
    onRegisterCleanup?: (cleanup: () => void) => void
  ): SubWindowHandle {
    const fullId = `plugin_${pluginId}_${options.id}`;

    // 1. 이미 열려 있는 서브창이 있으면 포커스 후 기존 핸들 반환
    const existing = this.activeWindows.get(fullId);
    if (existing && existing.handle.isOpen()) {
      existing.handle.focus();
      return existing.handle;
    }

    // 2. 데스크톱(Tauri) 환경이 아닌 웹 브라우저 환경에서만 팝업 시도
    let subWin: Window | null = null;
    if (!isTauriEnvironment() && options.preferPopout !== false) {
      const width = Math.max(200, options.width ?? 640);
      const height = Math.max(150, options.height ?? 520);
      const resizable = options.resizable !== false;
      const screenX = typeof window.screenX !== 'undefined' ? window.screenX : 0;
      const screenY = typeof window.screenY !== 'undefined' ? window.screenY : 0;
      const outerW = window.outerWidth || 1024;
      const outerH = window.outerHeight || 768;
      const left = Math.max(0, Math.round(screenX + (outerW - width) / 2));
      const top = Math.max(0, Math.round(screenY + (outerH - height) / 2));

      const features = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        `resizable=${resizable ? 'yes' : 'no'}`,
        'scrollbars=yes',
        'status=no',
        'menubar=no',
        'toolbar=no',
        'location=no',
      ].join(',');

      try {
        subWin = window.open('about:blank', `migoto_subwin_${pluginId}_${options.id}`, features);
      } catch {
        subWin = null;
      }
    }

    // 3. 브라우저 팝업 창이 정상 생성된 경우
    if (subWin && !subWin.closed && typeof subWin.closed !== 'undefined') {
      return this.openBrowserSubWindow(fullId, pluginId, options, subWin, onRegisterCleanup);
    }

    // 4. Tauri 환경 또는 팝업 차단 환경 -> 내장 플로팅 서브 윈도우 생성 (PiP 팝아웃 지원)
    return this.openFloatingSubWindow(fullId, pluginId, options, onRegisterCleanup);
  }

  /**
   * 브라우저 팝업 창을 통한 서브 윈도우 구현
   */
  private openBrowserSubWindow(
    fullId: string,
    _pluginId: string,
    options: SubWindowOptions,
    subWin: Window,
    onRegisterCleanup?: (cleanup: () => void) => void
  ): SubWindowHandle {
    const subDoc = subWin.document;
    subDoc.title = options.title || 'Migoto Studio Sub Window';

    // 메인 창 스타일 복제
    try {
      const headElements = document.head.querySelectorAll('style, link[rel="stylesheet"]');
      headElements.forEach((el) => {
        const clone = el.cloneNode(true);
        subDoc.head.appendChild(clone);
      });
      subDoc.documentElement.className = document.documentElement.className;
      subDoc.documentElement.style.cssText = document.documentElement.style.cssText;
    } catch (e) {
      console.warn('[SubWindowManager] 스타일 복제 경고:', e);
    }

    subDoc.body.style.cssText = `
      margin: 0;
      padding: 0;
      background-color: var(--bg-primary, #0d1117);
      color: var(--text-color, #e6edf3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      height: 100vh;
      width: 100vw;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      user-select: auto;
    `;

    // 헤더 바
    const headerBar = subDoc.createElement('div');
    headerBar.className = 'subwindow-header-bar';
    headerBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: var(--bg-secondary, #161b22);
      border-bottom: 1px solid var(--border-color, #30363d);
      font-size: 11px;
      color: var(--text-muted, #8b949e);
      user-select: none;
      flex-shrink: 0;
    `;

    const titleEl = subDoc.createElement('span');
    titleEl.textContent = options.title || '서브 윈도우';
    titleEl.style.cssText = `
      font-weight: 600;
      color: var(--text-color, #e6edf3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const modeBadge = subDoc.createElement('span');
    modeBadge.className = 'subwindow-mode-badge';
    modeBadge.style.cssText = `
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease;
    `;

    headerBar.appendChild(titleEl);
    headerBar.appendChild(modeBadge);
    subDoc.body.appendChild(headerBar);

    // 루트 컨텐츠
    const rootContainer = subDoc.createElement('div');
    rootContainer.className = 'plugin-subwindow-content';
    rootContainer.style.cssText = `
      flex: 1 1 0;
      min-height: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: auto;
      padding: 12px 16px;
      box-sizing: border-box;
      position: relative;
    `;
    subDoc.body.appendChild(rootContainer);

    let currentMode: 'alwaysOnTop' | 'parentLinked' | 'independent' = options.focusMode ?? 'parentLinked';
    let parentFocusCleanup: (() => void) | null = null;
    let subBlurCleanup: (() => void) | null = null;

    const updateModeBadgeUi = () => {
      if (currentMode === 'alwaysOnTop') {
        modeBadge.textContent = '📌 항상 맨 위';
        modeBadge.style.background = 'rgba(240, 136, 62, 0.2)';
        modeBadge.style.color = '#f0883e';
      } else if (currentMode === 'parentLinked') {
        modeBadge.textContent = '🔗 에디터 연동';
        modeBadge.style.background = 'rgba(56, 139, 253, 0.2)';
        modeBadge.style.color = '#58a6ff';
      } else {
        modeBadge.textContent = '🗗 독립 창';
        modeBadge.style.background = 'rgba(139, 148, 158, 0.2)';
        modeBadge.style.color = '#8b949e';
      }
    };

    const applyFocusMode = (mode: 'alwaysOnTop' | 'parentLinked' | 'independent') => {
      currentMode = mode;
      updateModeBadgeUi();

      if (parentFocusCleanup) { parentFocusCleanup(); parentFocusCleanup = null; }
      if (subBlurCleanup) { subBlurCleanup(); subBlurCleanup = null; }

      if (mode === 'parentLinked') {
        const onMainFocus = () => {
          if (subWin && !subWin.closed) subWin.focus();
        };
        window.addEventListener('focus', onMainFocus);
        parentFocusCleanup = () => window.removeEventListener('focus', onMainFocus);
      } else if (mode === 'alwaysOnTop') {
        const onMainFocus = () => {
          if (currentMode === 'alwaysOnTop' && subWin && !subWin.closed) subWin.focus();
        };
        window.addEventListener('focus', onMainFocus);

        let blurTimer: any = null;
        const onSubBlur = () => {
          if (currentMode !== 'alwaysOnTop' || !subWin || subWin.closed) return;
          clearTimeout(blurTimer);
          blurTimer = setTimeout(() => {
            if (currentMode === 'alwaysOnTop' && subWin && !subWin.closed) subWin.focus();
          }, 80);
        };
        subWin.addEventListener('blur', onSubBlur);

        parentFocusCleanup = () => {
          clearTimeout(blurTimer);
          window.removeEventListener('focus', onMainFocus);
        };
        subBlurCleanup = () => {
          clearTimeout(blurTimer);
          subWin.removeEventListener('blur', onSubBlur);
        };
      }
    };

    modeBadge.onclick = () => {
      if (currentMode === 'parentLinked') applyFocusMode('alwaysOnTop');
      else if (currentMode === 'alwaysOnTop') applyFocusMode('independent');
      else applyFocusMode('parentLinked');
    };

    applyFocusMode(currentMode);

    let userCleanup: (() => void) | void;
    let isDisposed = false;

    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;
      if (parentFocusCleanup) { parentFocusCleanup(); parentFocusCleanup = null; }
      if (subBlurCleanup) { subBlurCleanup(); subBlurCleanup = null; }
      this.activeWindows.delete(fullId);
      if (typeof userCleanup === 'function') {
        try { userCleanup(); } catch (e) { console.error('[SubWindowManager] cleanup 오류:', e); }
      }
      appLogger.info('plugin', `서브 윈도우 닫힘: "${options.title}"`);
    };

    const handle: SubWindowHandle = {
      close: () => {
        if (subWin && !subWin.closed) subWin.close();
        dispose();
      },
      focus: () => {
        if (subWin && !subWin.closed) subWin.focus();
      },
      setTitle: (newTitle: string) => {
        if (subWin && !subWin.closed) {
          subDoc.title = newTitle;
          titleEl.textContent = newTitle;
        }
      },
      resize: (newW: number, newH: number) => {
        if (subWin && !subWin.closed) {
          subWin.resizeTo(Math.max(100, newW), Math.max(100, newH));
        }
      },
      setFocusMode: (mode) => applyFocusMode(mode),
      isOpen: () => Boolean(subWin && !subWin.closed),
      getWindow: () => subWin && !subWin.closed ? subWin : null,
      togglePopout: async () => false,
      isPoppedOut: () => true,
    };

    subWin.addEventListener('beforeunload', () => dispose());

    if (onRegisterCleanup) {
      onRegisterCleanup(() => handle.close());
    }

    this.activeWindows.set(fullId, {
      handle,
      subWin,
      cleanup: dispose,
    });

    try {
      userCleanup = options.render(rootContainer, handle);
    } catch (e) {
      console.error('[SubWindowManager] render 실행 오류:', e);
    }

    appLogger.info('plugin', `서브 윈도우 생성 (브라우저 팝업): "${options.title}"`);
    return handle;
  }

  /**
   * 앱 내 네이티브 플로팅 서브 윈도우 구현 (Tauri 데스크톱 및 팝업 차단 환경 완벽 호환)
   * 상단 PiP(별도 창 분리) 버튼을 통해 Document Picture-in-Picture 기반의 독립 OS 윈도우로 팝아웃 지원
   */
  private openFloatingSubWindow(
    fullId: string,
    _pluginId: string,
    options: SubWindowOptions,
    onRegisterCleanup?: (cleanup: () => void) => void
  ): SubWindowHandle {
    ensureFloatingStyles();

    const minW = Math.max(240, options.minWidth ?? 280);
    const minH = Math.max(160, options.minHeight ?? 200);
    const width = Math.max(minW, options.width ?? 680);
    const height = Math.max(minH, options.height ?? 540);
    const resizable = options.resizable !== false;

    // 윈도우 캐스케이드 배치 계산
    const viewW = window.innerWidth || 1200;
    const viewH = window.innerHeight || 800;
    const cascadeOffset = (this.activeWindows.size % 8) * 26;
    let posX = Math.max(20, Math.round((viewW - width) / 2) + cascadeOffset);
    let posY = Math.max(40, Math.round((viewH - height) / 2) + cascadeOffset);

    if (posX + width > viewW) posX = Math.max(10, viewW - width - 20);
    if (posY + height > viewH) posY = Math.max(40, viewH - height - 20);

    // 플로팅 창 컨테이너 DOM 생성
    const floatingEl = document.createElement('div');
    floatingEl.className = 'migoto-floating-subwindow';
    floatingEl.style.width = `${width}px`;
    floatingEl.style.height = `${height}px`;
    floatingEl.style.left = `${posX}px`;
    floatingEl.style.top = `${posY}px`;

    let currentMode: 'alwaysOnTop' | 'parentLinked' | 'independent' = options.focusMode ?? 'parentLinked';

    const bringToFront = () => {
      highestZIndex += 1;
      floatingEl.style.zIndex = currentMode === 'alwaysOnTop' ? '100000' : String(highestZIndex);
      document.querySelectorAll('.migoto-floating-subwindow').forEach((el) => {
        el.classList.remove('is-active');
      });
      floatingEl.classList.add('is-active');
    };

    bringToFront();
    floatingEl.addEventListener('pointerdown', () => bringToFront());

    // 타이틀 바 (드래그 핸들)
    const headerBar = document.createElement('div');
    headerBar.className = 'migoto-floating-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'migoto-floating-title-group';

    const iconEl = document.createElement('span');
    iconEl.style.cssText = 'font-size: 13px; line-height: 1; flex-shrink: 0;';
    iconEl.textContent = '🗔';

    const titleEl = document.createElement('span');
    titleEl.className = 'migoto-floating-title';
    titleEl.textContent = options.title || '서브 윈도우';

    const modeBadge = document.createElement('span');
    modeBadge.className = 'subwindow-mode-badge';
    modeBadge.style.cssText = `
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease;
    `;

    titleGroup.appendChild(iconEl);
    titleGroup.appendChild(titleEl);
    titleGroup.appendChild(modeBadge);

    // 창 제어 버튼들 (PiP 별도 창 분리, 최소화, 최대화, 닫기)
    const controls = document.createElement('div');
    controls.className = 'migoto-floating-controls';

    const pipBtn = document.createElement('button');
    pipBtn.className = 'migoto-floating-btn pip-btn';
    pipBtn.title = '별도 윈도우로 분리 (PiP 팝아웃)';
    pipBtn.innerHTML = `
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <rect x="8" y="7" width="5" height="4" rx="1" fill="currentColor" opacity="0.3" />
        <polyline points="5 8 5 6 7 6" />
        <line x1="5" y1="6" x2="8" y2="9" />
      </svg>
    `;

    const minBtn = document.createElement('button');
    minBtn.className = 'migoto-floating-btn';
    minBtn.title = '최소화';
    minBtn.textContent = '⚊';

    const maxBtn = document.createElement('button');
    maxBtn.className = 'migoto-floating-btn';
    maxBtn.title = '최대화 / 복원';
    maxBtn.textContent = '□';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'migoto-floating-btn close-btn';
    closeBtn.title = '닫기';
    closeBtn.textContent = '✕';

    controls.appendChild(pipBtn);
    controls.appendChild(minBtn);
    controls.appendChild(maxBtn);
    controls.appendChild(closeBtn);

    headerBar.appendChild(titleGroup);
    headerBar.appendChild(controls);
    floatingEl.appendChild(headerBar);

    // 플러그인 컨텐츠 렌더링 영역
    const rootContainer = document.createElement('div');
    rootContainer.className = 'plugin-subwindow-content';
    rootContainer.style.cssText = `
      flex: 1 1 0;
      min-height: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: auto;
      padding: 12px 16px;
      box-sizing: border-box;
      position: relative;
    `;
    floatingEl.appendChild(rootContainer);

    // 별도 윈도우로 팝아웃 중일 때 표시할 플레이스홀더 영역
    const pipPlaceholder = document.createElement('div');
    pipPlaceholder.className = 'migoto-floating-placeholder';
    pipPlaceholder.innerHTML = `
      <div style="font-size: 32px; line-height: 1; opacity: 0.7;">⧉</div>
      <div class="migoto-floating-placeholder-title">별도 윈도우(PiP)에서 실행 중입니다</div>
      <div class="migoto-floating-placeholder-desc">독립된 OS 윈도우 창으로 분리되었습니다. 다른 모니터로 이동하거나 자유롭게 배치할 수 있습니다.</div>
      <button class="migoto-floating-dock-in-btn">내장 창으로 다시 가져오기</button>
    `;
    floatingEl.appendChild(pipPlaceholder);

    // 모드 배지 UI 갱신 함수
    const updateModeBadgeUi = () => {
      if (currentMode === 'alwaysOnTop') {
        modeBadge.textContent = '📌 항상 맨 위';
        modeBadge.style.background = 'rgba(240, 136, 62, 0.2)';
        modeBadge.style.color = '#f0883e';
        modeBadge.title = '다른 모든 패널과 대화상자보다 최상단에 고정됩니다. (클릭하여 전환)';
      } else if (currentMode === 'parentLinked') {
        modeBadge.textContent = '🔗 에디터 연동';
        modeBadge.style.background = 'rgba(56, 139, 253, 0.2)';
        modeBadge.style.color = '#58a6ff';
        modeBadge.title = '에디터 작업 영역과 연동되어 포커스 시 함께 전면으로 정렬됩니다. (클릭하여 전환)';
      } else {
        modeBadge.textContent = '🗗 독립 창';
        modeBadge.style.background = 'rgba(139, 148, 158, 0.2)';
        modeBadge.style.color = '#8b949e';
        modeBadge.title = '일반 플로팅 창 모드로 동작합니다. (클릭하여 전환)';
      }
    };

    const applyFocusMode = (mode: 'alwaysOnTop' | 'parentLinked' | 'independent') => {
      currentMode = mode;
      updateModeBadgeUi();
      bringToFront();
    };

    modeBadge.onclick = (e) => {
      e.stopPropagation();
      if (currentMode === 'parentLinked') applyFocusMode('alwaysOnTop');
      else if (currentMode === 'alwaysOnTop') applyFocusMode('independent');
      else applyFocusMode('parentLinked');
    };

    applyFocusMode(currentMode);

    // 헤더 드래그 이동 로직
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = posX;
    let initialTop = posY;

    headerBar.addEventListener('pointerdown', (e) => {
      // 버튼 또는 배지 클릭 시에는 드래그하지 않음
      if ((e.target as HTMLElement).closest('.migoto-floating-btn') || (e.target as HTMLElement).closest('.subwindow-mode-badge')) {
        return;
      }
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = floatingEl.offsetLeft;
      initialTop = floatingEl.offsetTop;
      bringToFront();
      e.preventDefault();

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging) return;
        const dx = ev.clientX - dragStartX;
        const dy = ev.clientY - dragStartY;
        const newLeft = Math.max(-floatingEl.offsetWidth + 80, Math.min(window.innerWidth - 80, initialLeft + dx));
        const newTop = Math.max(0, Math.min(window.innerHeight - 36, initialTop + dy));
        floatingEl.style.left = `${newLeft}px`;
        floatingEl.style.top = `${newTop}px`;
      };

      const onPointerUp = () => {
        isDragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // 최대화 및 복원 토글 로직
    let isMaximized = false;
    let normalBounds = { left: posX, top: posY, width, height };

    const toggleMaximize = () => {
      if (!isMaximized) {
        normalBounds = {
          left: floatingEl.offsetLeft,
          top: floatingEl.offsetTop,
          width: floatingEl.offsetWidth,
          height: floatingEl.offsetHeight,
        };
        floatingEl.style.left = '16px';
        floatingEl.style.top = '36px';
        floatingEl.style.width = `calc(100vw - 32px)`;
        floatingEl.style.height = `calc(100vh - 56px)`;
        maxBtn.textContent = '❐';
        maxBtn.title = '이전 크기로 복원';
        isMaximized = true;
      } else {
        floatingEl.style.left = `${normalBounds.left}px`;
        floatingEl.style.top = `${normalBounds.top}px`;
        floatingEl.style.width = `${normalBounds.width}px`;
        floatingEl.style.height = `${normalBounds.height}px`;
        maxBtn.textContent = '□';
        maxBtn.title = '최대화';
        isMaximized = false;
      }
      bringToFront();
    };

    maxBtn.onclick = (e) => {
      e.stopPropagation();
      toggleMaximize();
    };

    headerBar.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement).closest('.migoto-floating-btn') || (e.target as HTMLElement).closest('.subwindow-mode-badge')) return;
      toggleMaximize();
    });

    // 최소화 (하단 도크 칩으로 축소)
    let dockChip: HTMLElement | null = null;

    const restoreFromDock = () => {
      floatingEl.style.display = 'flex';
      if (dockChip) {
        dockChip.remove();
        dockChip = null;
      }
      bringToFront();
    };

    const minimizeToDock = () => {
      floatingEl.style.display = 'none';

      if (!this.dockBar || !document.body.contains(this.dockBar)) {
        this.dockBar = document.createElement('div');
        this.dockBar.className = 'migoto-subwindow-dock-bar';
        document.body.appendChild(this.dockBar);
      }

      dockChip = document.createElement('div');
      dockChip.className = 'migoto-subwindow-dock-chip';
      dockChip.title = `클릭하여 복원: ${options.title}`;
      dockChip.innerHTML = `<span>🗔</span><span>${options.title}</span><span style="opacity: 0.6; font-size: 10px;">↗</span>`;
      dockChip.onclick = () => restoreFromDock();
      this.dockBar.appendChild(dockChip);
    };

    minBtn.onclick = (e) => {
      e.stopPropagation();
      minimizeToDock();
    };

    // PiP (별도 OS 윈도우 팝아웃) 관리 로직
    let currentPipWin: Window | null = null;
    let currentNativeHandle: NativeWindowHandle | null = null;

    const dockIn = () => {
      if (currentNativeHandle && currentNativeHandle.isOpen()) {
        try {
          currentNativeHandle.close();
        } catch {}
      }
      currentNativeHandle = null;

      if (currentPipWin && !currentPipWin.closed) {
        try {
          currentPipWin.close();
        } catch {}
      }
      currentPipWin = null;

      if (dockChip) {
        dockChip.remove();
        dockChip = null;
      }

      // rootContainer를 다시 메인 floatingEl 내부로 복원
      if (rootContainer.parentElement !== floatingEl) {
        floatingEl.insertBefore(rootContainer, pipPlaceholder);
      }
      floatingEl.style.display = 'flex';
      rootContainer.style.display = 'flex';
      pipPlaceholder.style.display = 'none';
      pipBtn.classList.remove('is-popped-out');
      pipBtn.title = '별도 윈도우로 분리 (PiP 팝아웃)';
      bringToFront();
      appLogger.info('plugin', `서브 윈도우 내장 플로팅 창으로 복귀: "${options.title}"`);
    };

    const setupPopoutWindow = (targetWin: Window) => {
      currentPipWin = targetWin;
      const targetDoc = targetWin.document;
      targetDoc.title = options.title || 'Migoto Studio Sub Window';

      // 부모 창의 스타일시트 및 테마 속성 복제
      try {
        const headElements = document.head.querySelectorAll('style, link[rel="stylesheet"]');
        headElements.forEach((el) => {
          targetDoc.head.appendChild(el.cloneNode(true));
        });
        targetDoc.documentElement.className = document.documentElement.className;
        targetDoc.documentElement.style.cssText = document.documentElement.style.cssText;
      } catch (e) {
        console.warn('[SubWindowManager] PiP 스타일 복제 경고:', e);
      }

      targetDoc.body.style.cssText = `
        margin: 0;
        padding: 0;
        background-color: var(--bg-primary, #0d1117);
        color: var(--text-color, #e6edf3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        height: 100vh;
        width: 100vw;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-sizing: border-box;
      `;

      // 라이브 rootContainer DOM(Three.js/캔버스/이벤트)을 타깃 창으로 이동
      targetDoc.body.appendChild(rootContainer);
      rootContainer.style.height = '100%';
      rootContainer.style.width = '100%';

      // 기존 플로팅 창은 화면을 가리지 않도록 숨김 (우측 하단 칩 대신 하단 상태표시줄의 열린 창 드롭다운 연동)
      floatingEl.style.display = 'none';
      pipBtn.classList.add('is-popped-out');
      pipBtn.title = '에디터 내 플로팅 창으로 복원 (Dock In)';

      if (dockChip) {
        dockChip.remove();
        dockChip = null;
      }

      appLogger.info('plugin', `서브 윈도우 별도 OS 윈도우(PiP)로 분리 완료: "${options.title}"`);

      // 별도 창이 닫혔을 때 (사용자가 OS [X] 누르거나 창 종료)
      const onPopoutClosed = () => {
        targetWin.removeEventListener('pagehide', onPopoutClosed);
        targetWin.removeEventListener('unload', onPopoutClosed);
        targetWin.removeEventListener('beforeunload', onPopoutClosed);
        dockIn();
      };

      targetWin.addEventListener('pagehide', onPopoutClosed);
      targetWin.addEventListener('unload', onPopoutClosed);
      targetWin.addEventListener('beforeunload', onPopoutClosed);
    };

    const togglePopout = async (): Promise<boolean> => {
      if (currentNativeHandle && currentNativeHandle.isOpen()) {
        dockIn();
        return false;
      }
      if (currentPipWin && !currentPipWin.closed) {
        dockIn();
        return false;
      }

      const reqWidth = floatingEl.offsetWidth || width;
      const reqHeight = floatingEl.offsetHeight || height;

      // 1. 데스크톱(Tauri) 환경인 경우 -> NativeWindowManager를 통해 진짜 독립 OS 윈도우 창 띄우기
      if (isTauriEnvironment()) {
        try {
          const nativeHandle = await nativeWindowManager.openNativeWindow(_pluginId, {
            id: options.id,
            title: options.title,
            width: reqWidth,
            height: reqHeight,
            minWidth: options.minWidth,
            minHeight: options.minHeight,
            resizable: options.resizable,
            alwaysOnTop: currentMode === 'alwaysOnTop',
            entry: options.entry,
            initialData: options.initialData,
            isSubWindowPopout: true,
            onRestoreToSubWindow: () => dockIn(),
          });

          currentNativeHandle = nativeHandle;

          // 기존 화면의 플로팅 창은 숨김 (우하단 칩 대신 하단 상태표시줄에서 드롭다운으로 관리)
          floatingEl.style.display = 'none';
          pipBtn.classList.add('is-popped-out');
          pipBtn.title = '에디터 내 플로팅 창으로 복원 (Dock In)';

          if (dockChip) {
            dockChip.remove();
            dockChip = null;
          }

          const checkCloseTimer = setInterval(() => {
            if (!nativeHandle.isOpen()) {
              clearInterval(checkCloseTimer);
              if (currentNativeHandle === nativeHandle) {
                dockIn();
              }
            }
          }, 300);

          appLogger.info('plugin', `서브 윈도우 독립 OS 윈도우 전환: "${options.title}"`);
          return true;
        } catch (err: any) {
          console.error('[SubWindowManager] NativeWindow 열기 오류:', err);
          showToast(`독립 OS 윈도우 열기 오류: ${err.message || String(err)}`, 'error');
          return false;
        }
      }

      // 2. 웹 브라우저 환경인 경우: Document Picture-in-Picture 시도
      if ('documentPictureInPicture' in window && typeof (window as any).documentPictureInPicture?.requestWindow === 'function') {
        try {
          const pip = await (window as any).documentPictureInPicture.requestWindow({
            width: reqWidth,
            height: reqHeight,
          });
          setupPopoutWindow(pip);
          return true;
        } catch (e) {
          console.warn('[SubWindowManager] documentPictureInPicture 요청 실패, fallback 시도:', e);
        }
      }

      // 3. Fallback: window.open popup 시도 (일반 웹 브라우저 환경)
      try {
        const screenX = typeof window.screenX !== 'undefined' ? window.screenX : 0;
        const screenY = typeof window.screenY !== 'undefined' ? window.screenY : 0;
        const left = Math.max(0, Math.round(screenX + ((window.outerWidth || 1200) - reqWidth) / 2));
        const top = Math.max(0, Math.round(screenY + ((window.outerHeight || 800) - reqHeight) / 2));
        const features = `width=${reqWidth},height=${reqHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
        const popWin = window.open('about:blank', `migoto_pip_${fullId}`, features);
        if (popWin && !popWin.closed) {
          setupPopoutWindow(popWin);
          return true;
        }
      } catch (e) {
        console.warn('[SubWindowManager] window.open popup fallback 실패:', e);
      }

      showToast('현재 환경에서는 별도 OS 윈도우(PiP) 팝아웃이 지원되지 않아 내장 플로팅 창으로 유지됩니다.', 'warn');
      return false;
    };

    pipBtn.onclick = (e) => {
      e.stopPropagation();
      togglePopout();
    };

    pipPlaceholder.querySelector('.migoto-floating-dock-in-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dockIn();
    });

    // 크기 조절 (Resize) 핸들 생성
    if (resizable) {
      const resizeR = document.createElement('div');
      resizeR.className = 'migoto-floating-resize-r';

      const resizeB = document.createElement('div');
      resizeB.className = 'migoto-floating-resize-b';

      const resizeBR = document.createElement('div');
      resizeBR.className = 'migoto-floating-resize-br';
      resizeBR.innerHTML = `
        <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor">
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="4" cy="8" r="1.2" />
          <circle cx="8" cy="4" r="1.2" />
        </svg>
      `;

      const setupResizer = (handleEl: HTMLElement, onMove: (dx: number, dy: number, startW: number, startH: number) => void) => {
        handleEl.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          bringToFront();
          const startX = e.clientX;
          const startY = e.clientY;
          const startW = floatingEl.offsetWidth;
          const startH = floatingEl.offsetHeight;

          const onPointerMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            onMove(dx, dy, startW, startH);
          };

          const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
          };

          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
        });
      };

      setupResizer(resizeR, (dx, _dy, startW) => {
        floatingEl.style.width = `${Math.max(minW, startW + dx)}px`;
      });

      setupResizer(resizeB, (_dx, dy, _startW, startH) => {
        floatingEl.style.height = `${Math.max(minH, startH + dy)}px`;
      });

      setupResizer(resizeBR, (dx, dy, startW, startH) => {
        floatingEl.style.width = `${Math.max(minW, startW + dx)}px`;
        floatingEl.style.height = `${Math.max(minH, startH + dy)}px`;
      });

      floatingEl.appendChild(resizeR);
      floatingEl.appendChild(resizeB);
      floatingEl.appendChild(resizeBR);
    }

    document.body.appendChild(floatingEl);

    let userCleanup: (() => void) | void;
    let isDisposed = false;

    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;

      if (currentNativeHandle && currentNativeHandle.isOpen()) {
        try { currentNativeHandle.close(); } catch {}
        currentNativeHandle = null;
      }

      if (currentPipWin && !currentPipWin.closed) {
        try { currentPipWin.close(); } catch {}
      }
      currentPipWin = null;

      floatingEl.remove();
      if (dockChip) {
        dockChip.remove();
        dockChip = null;
      }
      this.activeWindows.delete(fullId);

      if (typeof userCleanup === 'function') {
        try { userCleanup(); } catch (e) { console.error('[SubWindowManager] cleanup 오류:', e); }
      }
      appLogger.info('plugin', `서브 윈도우 닫힘: "${options.title}"`);
    };

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      dispose();
    };

    const handle: SubWindowHandle = {
      close: () => dispose(),
      focus: () => {
        if (currentPipWin && !currentPipWin.closed) {
          currentPipWin.focus();
        } else {
          if (floatingEl.style.display === 'none') restoreFromDock();
          bringToFront();
        }
      },
      setTitle: (newTitle: string) => {
        titleEl.textContent = newTitle;
        if (currentPipWin && !currentPipWin.closed) {
          currentPipWin.document.title = newTitle;
        }
        if (dockChip) {
          const chipTitle = dockChip.querySelector('span:nth-child(2)');
          if (chipTitle) chipTitle.textContent = newTitle;
        }
      },
      resize: (newW: number, newH: number) => {
        floatingEl.style.width = `${Math.max(minW, newW)}px`;
        floatingEl.style.height = `${Math.max(minH, newH)}px`;
        if (currentPipWin && !currentPipWin.closed) {
          currentPipWin.resizeTo(Math.max(100, newW), Math.max(100, newH));
        }
      },
      setFocusMode: (mode) => applyFocusMode(mode),
      isOpen: () => !isDisposed,
      getWindow: () => (currentPipWin && !currentPipWin.closed ? currentPipWin : (typeof window !== 'undefined' ? window : null)),
      togglePopout: () => togglePopout(),
      isPoppedOut: () => Boolean(currentPipWin && !currentPipWin.closed),
    };

    if (onRegisterCleanup) {
      onRegisterCleanup(() => handle.close());
    }

    this.activeWindows.set(fullId, {
      handle,
      floatingEl,
      dockChip,
      cleanup: dispose,
    });

    try {
      userCleanup = options.render(rootContainer, handle);
    } catch (e) {
      console.error('[SubWindowManager] render 실행 오류:', e);
    }

    // 옵션에 preferPopout이 true로 설정된 경우 자동으로 PiP 팝아웃 시도
    if (options.preferPopout) {
      setTimeout(() => {
        togglePopout();
      }, 50);
    }

    appLogger.info('plugin', `서브 윈도우 생성 (플로팅 윈도우): "${options.title}" (모드: ${currentMode})`);
    return handle;
  }

  /**
   * 열려 있는 모든 서브 윈도우를 안전하게 닫습니다.
   */
  closeAllWindows() {
    for (const [, item] of this.activeWindows) {
      if (item.subWin && !item.subWin.closed) {
        try { item.subWin.close(); } catch {}
      }
      if (item.pipWin && !item.pipWin.closed) {
        try { item.pipWin.close(); } catch {}
      }
      if (item.floatingEl) {
        try { item.floatingEl.remove(); } catch {}
      }
      if (item.dockChip) {
        try { item.dockChip.remove(); } catch {}
      }
      if (item.cleanup) {
        item.cleanup();
      }
    }
    this.activeWindows.clear();
    if (this.dockBar) {
      try { this.dockBar.remove(); } catch {}
      this.dockBar = null;
    }
  }
}

// 싱글톤 인스턴스
export const subWindowManager = new SubWindowManager();

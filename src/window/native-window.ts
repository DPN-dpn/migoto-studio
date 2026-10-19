import type { NativeWindowOptions, NativeWindowHandle } from './types';
import { isTauriEnvironment } from '../platform/index';
import { appLogger } from '../core/logger';
import { showToast } from '../ui/common/toast';

interface ActiveNativeWindow {
  fullId: string;
  ownerId: string;
  handle: NativeWindowHandle;
  channel: BroadcastChannel;
  tauriWindow?: any;
  browserWindow?: Window | null;
  cleanup?: () => void;
}

/**
 * 범용 독립 OS 윈도우 관리자 (NativeWindowManager)
 * 코어 에디터 분리, 로그 뷰어, 플러그인 등 모든 영역에서 독립 OS 윈도우를 제어합니다.
 */
export class NativeWindowManager {
  private activeWindows: Map<string, ActiveNativeWindow> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.closeAllWindows();
      });
    }
  }

  /**
   * 독립 OS 윈도우를 엽니다.
   * Tauri 데스크톱 환경에서는 완전한 독립 WebviewWindow를 생성하며,
   * 웹 브라우저 환경에서는 팝업 창으로 안전하게 폴백합니다.
   *
   * @param ownerId 창의 소유자 식별자 ('app', 'core' 또는 플러그인 ID)
   * @param options 윈도우 생성 옵션
   * @param onRegisterCleanup 정리 콜백 등록 함수 (선택)
   */
  async openNativeWindow(
    ownerId: string = 'app',
    options: NativeWindowOptions,
    onRegisterCleanup?: (cleanup: () => void) => void
  ): Promise<NativeWindowHandle> {
    const fullId = `win_${ownerId}_${options.id}`;
    const logCategory = (ownerId === 'app' || ownerId === 'core') ? 'ui' : 'plugin';

    // 1. 이미 열려 있는 창이 있으면 포커스 후 기존 핸들 반환
    const existing = this.activeWindows.get(fullId);
    if (existing && existing.handle.isOpen()) {
      await existing.handle.focus();
      return existing.handle;
    }

    const width = Math.max(300, options.width ?? 800);
    const height = Math.max(200, options.height ?? 600);
    const minWidth = options.minWidth ? Math.max(200, options.minWidth) : undefined;
    const minHeight = options.minHeight ? Math.max(150, options.minHeight) : undefined;
    const resizable = options.resizable !== false;
    const alwaysOnTop = Boolean(options.alwaysOnTop);
    const center = options.center !== false;

    // 양방향 통신 채널 생성
    const channelName = `migoto_native_win_${ownerId}_${options.id}`;
    const channel = new BroadcastChannel(channelName);
    const messageListeners = new Set<(data: any) => void>();

    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'USER_MESSAGE') {
        messageListeners.forEach((listener) => {
          try {
            listener(msg.payload);
          } catch (e) {
            console.error('[NativeWindowManager] 메시지 리스너 실행 오류:', e);
          }
        });
      } else if (msg.type === 'WINDOW_READY') {
        // 서브 윈도우가 준비되면 초기 데이터 전송
        if (options.initialData !== undefined) {
          channel.postMessage({
            type: 'INIT_DATA',
            data: options.initialData,
          });
        }
      } else if (msg.type === 'LOG') {
        const { level, args } = msg;
        const msgStr = Array.isArray(args) ? args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') : String(args);
        if (level === 'error') appLogger.error(logCategory, `[OS창:${options.title}] ${msgStr}`);
        else if (level === 'warn') appLogger.warn(logCategory, `[OS창:${options.title}] ${msgStr}`);
        else appLogger.info(logCategory, `[OS창:${options.title}] ${msgStr}`);
      } else if (msg.type === 'WINDOW_CLOSED') {
        dispose();
      }
    };

    let isDisposed = false;
    let tauriWindow: any = null;
    let browserWindow: Window | null = null;

    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;

      try {
        channel.close();
      } catch {}

      if (tauriWindow) {
        const win = tauriWindow;
        tauriWindow = null;
        try {
          if (typeof win.close === 'function') {
            Promise.resolve(win.close()).catch(() => {});
          }
        } catch {}
      }

      if (browserWindow && !browserWindow.closed) {
        try {
          browserWindow.close();
        } catch {}
        browserWindow = null;
      }

      this.activeWindows.delete(fullId);
      appLogger.info(logCategory, `독립 OS 윈도우 닫힘: "${options.title}"`);
    };

    const queryParams = new URLSearchParams({
      native_window: 'true',
      owner: ownerId,
      plugin: ownerId, // 하위 호환성 유지
      win_id: options.id,
      title: options.title,
      entry: options.entry || '',
    });

    const targetUrl = `index.html?${queryParams.toString()}`;

    // 2. Tauri 데스크톱 환경인 경우
    if (isTauriEnvironment()) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const sanitizedLabel = `migoto_win_${ownerId}_${options.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');

        tauriWindow = new WebviewWindow(sanitizedLabel, {
          url: targetUrl,
          title: options.title,
          width,
          height,
          minWidth,
          minHeight,
          resizable,
          alwaysOnTop,
          center,
        });

        tauriWindow.once('tauri://error', (e: any) => {
          console.error('[NativeWindowManager] WebviewWindow 생성 실패:', e);
          showToast(`독립 윈도우 생성 실패: ${e?.message || String(e)}`, 'error');
          dispose();
        });

        tauriWindow.once('tauri://destroyed', () => {
          dispose();
        });
      } catch (err: any) {
        console.error('[NativeWindowManager] Tauri WebviewWindow 초기화 오류:', err);
        showToast(`독립 OS 윈도우 열기 오류: ${err.message || String(err)}`, 'error');
        dispose();
        throw err;
      }
    } else {
      // 3. 일반 웹 브라우저 환경인 경우 (window.open fallback)
      const screenX = typeof window.screenX !== 'undefined' ? window.screenX : 0;
      const screenY = typeof window.screenY !== 'undefined' ? window.screenY : 0;
      const left = Math.max(0, Math.round(screenX + ((window.outerWidth || 1200) - width) / 2));
      const top = Math.max(0, Math.round(screenY + ((window.outerHeight || 800) - height) / 2));

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
      ].join(',');

      try {
        browserWindow = window.open(targetUrl, `migoto_win_${ownerId}_${options.id}`, features);
        if (!browserWindow || browserWindow.closed) {
          throw new Error('브라우저의 팝업 차단으로 인해 독립 창을 띄울 수 없습니다.');
        }

        browserWindow.addEventListener('beforeunload', () => dispose());
      } catch (err: any) {
        showToast(err.message || '독립 창 생성 실패', 'warn');
        dispose();
        throw err;
      }
    }

    const handle: NativeWindowHandle = {
      close: async () => {
        dispose();
      },
      focus: async () => {
        if (tauriWindow) {
          try {
            await tauriWindow.setFocus();
          } catch {}
        } else if (browserWindow && !browserWindow.closed) {
          browserWindow.focus();
        }
      },
      setTitle: async (newTitle: string) => {
        if (tauriWindow) {
          try {
            await tauriWindow.setTitle(newTitle);
          } catch {}
        } else if (browserWindow && !browserWindow.closed) {
          browserWindow.document.title = newTitle;
        }
      },
      setSize: async (newW: number, newH: number) => {
        if (tauriWindow) {
          try {
            const { LogicalSize } = await import('@tauri-apps/api/dpi');
            await tauriWindow.setSize(new LogicalSize(Math.max(200, newW), Math.max(150, newH)));
          } catch {}
        } else if (browserWindow && !browserWindow.closed) {
          browserWindow.resizeTo(Math.max(200, newW), Math.max(150, newH));
        }
      },
      postMessage: (data: any) => {
        if (!isDisposed) {
          channel.postMessage({
            type: 'USER_MESSAGE',
            payload: data,
          });
        }
      },
      onMessage: (listener: (data: any) => void) => {
        messageListeners.add(listener);
        return () => {
          messageListeners.delete(listener);
        };
      },
      isOpen: () => !isDisposed,
    };

    if (onRegisterCleanup) {
      onRegisterCleanup(() => {
        handle.close();
      });
    }

    this.activeWindows.set(fullId, {
      fullId,
      ownerId,
      handle,
      channel,
      tauriWindow,
      browserWindow,
      cleanup: dispose,
    });

    appLogger.info(logCategory, `독립 OS 윈도우 생성 완료: "${options.title}"`);
    return handle;
  }

  /**
   * 열려 있는 모든 독립 OS 윈도우를 안전하게 닫습니다.
   */
  closeAllWindows() {
    for (const [, item] of this.activeWindows) {
      if (item.cleanup) {
        item.cleanup();
      }
    }
    this.activeWindows.clear();
  }
}

// 싱글톤 인스턴스
export const nativeWindowManager = new NativeWindowManager();

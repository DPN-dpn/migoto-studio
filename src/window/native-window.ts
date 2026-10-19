import type { NativeWindowOptions, NativeWindowHandle, ActiveNativeWindowInfo } from './types';
import { isTauriEnvironment } from '../platform/index';
import { appLogger } from '../core/logger';
import { showToast } from '../ui/common/toast';

interface ActiveNativeWindow {
  fullId: string;
  ownerId: string;
  id: string;
  title: string;
  isSubWindowPopout?: boolean;
  restoreToSubWindow?: () => void;
  handle: NativeWindowHandle;
  channel: BroadcastChannel;
  tauriWindow?: any;
  browserWindow?: Window | null;
  cleanup?: () => void;
  minimizedByMaster?: boolean;
}

/**
 * 범용 독립 OS 윈도우 관리자 (NativeWindowManager)
 * 코어 에디터 분리, 로그 뷰어, 플러그인 등 모든 영역에서 독립 OS 윈도우를 제어합니다.
 * 마스터(메인 에디터) 창과 종속 생명주기(종료, 최소화, 복원)를 동기화합니다.
 */
export class NativeWindowManager {
  private activeWindows: Map<string, ActiveNativeWindow> = new Map();
  private windowChangeListeners: Set<(windows: ActiveNativeWindowInfo[]) => void> = new Set();
  private isMasterMinimized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. 원본 창이 닫히면 모든 별도 OS 창도 강제 종료
      window.addEventListener('beforeunload', () => {
        this.closeAllWindows();
      });

      // 2. 원본 메인 창의 최소화 및 복원 감지 (Master-Slave 윈도우 상태 동기화)
      this.initMasterWindowSync();
    }
  }

  /**
   * 메인 창의 상태 변화(최소화 / 복원)를 감지하여 서브 OS 창들과 동기화
   */
  private initMasterWindowSync() {
    if (typeof document === 'undefined') return;

    // A. 웹 표준 visibilitychange 이벤트 (최소화/가려짐 감지)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.handleMasterMinimized();
      } else if (document.visibilityState === 'visible') {
        this.handleMasterRestored();
      }
    });

    // B. 데스크톱(Tauri) 환경: Tauri 윈도우 상태 정밀 동기화
    if (isTauriEnvironment()) {
      import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => {
          const appWin = getCurrentWindow();

          const checkState = async () => {
            try {
              const min = await appWin.isMinimized();
              if (min && !this.isMasterMinimized) {
                this.handleMasterMinimized();
              } else if (!min && this.isMasterMinimized) {
                this.handleMasterRestored();
              }
            } catch {}
          };

          window.addEventListener('focus', () => {
            this.handleMasterRestored();
          });
          window.addEventListener('blur', () => {
            setTimeout(checkState, 150);
          });
          // 0.5초 간격 안전 폴링 (OS 최소화 버튼 클릭 감지)
          setInterval(checkState, 500);
        })
        .catch(() => {});
    }
  }

  /**
   * 메인 창이 최소화되었을 때 모든 서브 윈도우도 함께 최소화
   */
  async handleMasterMinimized() {
    if (this.isMasterMinimized) return;
    this.isMasterMinimized = true;

    for (const item of this.activeWindows.values()) {
      if (item.tauriWindow) {
        try {
          const isMin = await item.tauriWindow.isMinimized();
          if (!isMin) {
            item.minimizedByMaster = true;
            await item.tauriWindow.minimize();
          }
        } catch {}
      }
    }
  }

  /**
   * 메인 창이 복원되었을 때, 메인 창에 의해 최소화되었던 서브 윈도우들도 함께 복원
   */
  async handleMasterRestored() {
    if (!this.isMasterMinimized) return;
    this.isMasterMinimized = false;

    for (const item of this.activeWindows.values()) {
      if (item.minimizedByMaster) {
        item.minimizedByMaster = false;
        if (item.tauriWindow) {
          try {
            await item.tauriWindow.unminimize();
            await item.tauriWindow.show();
          } catch {}
        }
      }
    }
  }

  /**
   * 열려 있는 윈도우 목록 변경 구독 (상태바 드롭다운 등에 실시간 반영)
   */
  onWindowsChange(listener: (windows: ActiveNativeWindowInfo[]) => void): () => void {
    this.windowChangeListeners.add(listener);
    // 즉시 현재 상태 발행
    try {
      listener(this.getActiveWindows());
    } catch (e) {
      console.error(e);
    }
    return () => {
      this.windowChangeListeners.delete(listener);
    };
  }

  private notifyWindowsChanged() {
    const list = this.getActiveWindows();
    this.windowChangeListeners.forEach((listener) => {
      try {
        listener(list);
      } catch (e) {
        console.error('[NativeWindowManager] 리스너 호출 오류:', e);
      }
    });
  }

  /**
   * 현재 열려 있는 모든 별도 OS 창 목록 반환
   */
  getActiveWindows(): ActiveNativeWindowInfo[] {
    return Array.from(this.activeWindows.values()).map((w) => ({
      fullId: w.fullId,
      ownerId: w.ownerId,
      id: w.id,
      title: w.title,
      isSubWindowPopout: w.isSubWindowPopout,
      restoreToSubWindow: w.restoreToSubWindow,
      handle: w.handle,
      close: () => w.handle.close(),
      focus: () => w.handle.focus(),
    }));
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
    const logCategory = ownerId === 'app' || ownerId === 'core' ? 'ui' : 'plugin';

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
      this.notifyWindowsChanged();
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
            await tauriWindow.unminimize().catch(() => {});
            await tauriWindow.show().catch(() => {});
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
      id: options.id,
      title: options.title,
      isSubWindowPopout: options.isSubWindowPopout,
      restoreToSubWindow: options.onRestoreToSubWindow,
      handle,
      channel,
      tauriWindow,
      browserWindow,
      cleanup: dispose,
    });

    this.notifyWindowsChanged();
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
    this.notifyWindowsChanged();
  }
}

// 싱글톤 인스턴스
export const nativeWindowManager = new NativeWindowManager();

import type { NativeSubWindowContext } from './types';
import { initPlatform, platform, isTauriEnvironment } from '../platform/index';
import { loadSettings } from '../core/workspace/settings';
import { linkPluginModules } from '../plugins/module-linker';
import { openConfirmModal, openPromptModal } from '../ui/modals/confirm-ui';
import { showToast } from '../ui/common/toast';

/**
 * 독립 OS 윈도우 프로세스 경량 부트스트래퍼
 * 메인 에디터 및 Monaco 에디터를 일절 로드하지 않고 수 밀리초 내에 즉시 실행됩니다.
 */
export async function bootNativeWindow(params: URLSearchParams): Promise<void> {
  const ownerId = params.get('owner') || params.get('plugin') || 'app';
  const pluginId = params.get('plugin') || ownerId;
  const winId = params.get('win_id') || '';
  const title = params.get('title') || 'Migoto Studio Sub Window';
  const entryFile = params.get('entry') || '';

  // 1. 플랫폼 초기화
  await initPlatform();
  const settings = await loadSettings();

  // 2. 창 제목 및 기본 테마 설정
  document.title = title;
  const isLight = settings.theme === 'light';
  document.documentElement.className = isLight ? 'theme-light' : 'theme-dark';
  document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');

  // 메인 에디터 DOM 구조를 깨끗하게 비우고 독립 창 컨테이너 생성
  document.body.innerHTML = '';
  document.body.style.cssText = `
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--bg-primary, #0d1117);
    color: var(--text-color, #e6edf3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
    font-size: 13px;
    box-sizing: border-box;
    user-select: auto;
  `;

  const rootContainer = document.createElement('div');
  rootContainer.id = 'migoto-native-window-root';
  rootContainer.style.cssText = `
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
    box-sizing: border-box;
  `;
  document.body.appendChild(rootContainer);

  // 3. 메인 창과의 통신 채널 연결
  const channelName = `migoto_native_win_${ownerId}_${winId}`;
  const channel = new BroadcastChannel(channelName);
  const userMessageListeners = new Set<(data: any) => void>();

  let initialData: any = undefined;

  channel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'USER_MESSAGE') {
      userMessageListeners.forEach((listener) => {
        try {
          listener(msg.payload);
        } catch (e) {
          console.error('[NativeSubWindow] listener error:', e);
        }
      });
    } else if (msg.type === 'INIT_DATA') {
      initialData = msg.data;
    } else if (msg.type === 'CLOSE_WINDOW') {
      windowClose();
    }
  };

  const windowClose = async () => {
    channel.postMessage({ type: 'WINDOW_CLOSED' });
    try {
      channel.close();
    } catch {}
    if (isTauriEnvironment()) {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        await getCurrentWebviewWindow().close();
      } catch {
        window.close();
      }
    } else {
      window.close();
    }
  };

  window.addEventListener('beforeunload', () => {
    channel.postMessage({ type: 'WINDOW_CLOSED' });
    try {
      channel.close();
    } catch {}
  });

  // 4. 서브윈도우 전용 컨텍스트(NativeSubWindowContext) 구축
  const context: NativeSubWindowContext = {
    container: rootContainer,
    initialData,
    window: {
      close: async () => windowClose(),
      focus: async () => {
        if (isTauriEnvironment()) {
          try {
            const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            await getCurrentWebviewWindow().setFocus();
          } catch {}
        } else {
          window.focus();
        }
      },
      setTitle: async (newTitle: string) => {
        document.title = newTitle;
        if (isTauriEnvironment()) {
          try {
            const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            await getCurrentWebviewWindow().setTitle(newTitle);
          } catch {}
        }
      },
      setSize: async (w: number, h: number) => {
        if (isTauriEnvironment()) {
          try {
            const { LogicalSize } = await import('@tauri-apps/api/dpi');
            const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            await getCurrentWebviewWindow().setSize(new LogicalSize(Math.max(200, w), Math.max(150, h)));
          } catch {}
        } else {
          window.resizeTo(Math.max(200, w), Math.max(150, h));
        }
      },
    },
    channel: {
      postMessage: (data: any) => {
        channel.postMessage({ type: 'USER_MESSAGE', payload: data });
      },
      onMessage: (listener: (data: any) => void) => {
        userMessageListeners.add(listener);
        return () => {
          userMessageListeners.delete(listener);
        };
      },
    },
    modals: {
      confirm: (options: any) => openConfirmModal(options),
      prompt: (options: any) => openPromptModal(options),
    },
    showToast: (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
      showToast(message, type);
    },
  };

  // 5. 메인 창에 준비 완료 알림
  channel.postMessage({ type: 'WINDOW_READY' });

  // 6. 엔트리 스크립트 실행 (플러그인인 경우)
  if (entryFile && platform().listDiskPlugins) {
    try {
      const diskList = await platform().listDiskPlugins!();
      const disk = diskList.find((p) => p.id === pluginId);

      if (disk && disk.files) {
        const fileEntry = disk.files[entryFile] || disk.files[`./${entryFile}`];
        if (fileEntry) {
          const linked = linkPluginModules(fileEntry, entryFile, disk.files);
          const mod = await import(/* @vite-ignore */ linked.entryUrl);
          const entryFn = mod.default || mod.run || mod.open || mod;
          if (typeof entryFn === 'function') {
            await entryFn(context);
          }
        } else {
          console.error(`[NativeSubWindow] 모듈 내 엔트리 파일을 찾을 수 없습니다: ${entryFile}`);
        }
      }
    } catch (err) {
      console.error('[NativeSubWindow] 엔트리 모듈 실행 오류:', err);
      rootContainer.innerHTML = `
        <div style="padding: 24px; color: #f85149; font-family: monospace;">
          <h3>⚠️ 독립 윈도우 실행 실패</h3>
          <p>${err instanceof Error ? err.message : String(err)}</p>
        </div>
      `;
    }
  }
}

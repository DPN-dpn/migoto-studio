import type { NativeSubWindowContext } from './types';
import type { DirEntry } from '../platform/types';
import { initPlatform, platform, isTauriEnvironment } from '../platform/index';
import { loadSettings } from '../core/workspace/settings';
import { linkPluginModules } from '../plugins/module-linker';
import { openConfirmModal, openPromptModal } from '../ui/modals/confirm-ui';
import { showToast } from '../ui/common/toast';
import { createUIBuilder } from '../plugins/ui-builder';
import { globToRegex } from '../core/workspace/search';

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
    } else if (msg.type === 'INIT_DATA' || msg.type === 'UPDATE_INITIAL_DATA') {
      initialData = msg.data;
      if (typeof context !== 'undefined' && context) {
        context.initialData = msg.data;
      }
      userMessageListeners.forEach((listener) => {
        try {
          listener({ type: msg.type, data: msg.data });
        } catch (e) {}
      });
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
    get initialData() {
      return initialData;
    },
    set initialData(val: any) {
      initialData = val;
    },
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
    ui: createUIBuilder(),
    workspace: {
      readTextFile: async (path: string) => {
        const ref = platform().refFromId(path);
        const loaded = await platform().readFile(ref);
        return loaded.text;
      },
      writeTextFile: async (path: string, text: string) => {
        const ref = platform().refFromId(path);
        await platform().writeFile(ref, text, 'utf-8', { enabled: false, keepDays: 0, maxPerFile: 0 });
      },
      readBinaryFile: async (path: string) => {
        if (platform().readBinaryFile) {
          return platform().readBinaryFile!(path);
        }
        return new Uint8Array();
      },
      writeBinaryFile: async (path: string, bytes: Uint8Array) => {
        if (platform().writeBinaryFile) {
          await platform().writeBinaryFile!(path, bytes);
        }
      },
      readDirectory: async (dirPath?: string) => platform().readDirectory(dirPath || ''),
      findFiles: async (globPattern: string, options?: { cwd?: string; maxResults?: number }) => {
        const targetCwd = options?.cwd;
        if (!targetCwd) return [];
        try {
          const allEntries = await platform().readDirectory(targetCwd);
          const filePaths: string[] = [];
          const traverse = (items: DirEntry[]) => {
            for (const it of items) {
              if ((it.isDir || it.isDirectory) && it.children) {
                traverse(it.children);
              } else if (!it.isDir && !it.isDirectory) {
                filePaths.push((it.id || it.path).replace(/\\/g, '/'));
              }
            }
          };
          traverse(allEntries);
          const re = globToRegex(globPattern);
          const normCwd = targetCwd.replace(/\\/g, '/').replace(/\/+$/, '');
          const matched = filePaths.filter((p) => {
            const rel = p.startsWith(normCwd + '/') ? p.slice(normCwd.length + 1) : p;
            const name = p.split('/').pop() || p;
            return re.test(rel) || re.test(p) || re.test(name);
          });
          return options?.maxResults && options.maxResults > 0 ? matched.slice(0, options.maxResults) : matched;
        } catch {
          return [];
        }
      },
      getCurrentFolder: () => null,
      getCurrentFile: () => null,
      onDidChangeActiveFolder: () => () => {},
      onDidChangeActiveFile: () => () => {},
    },
    logger: {
      info: (...args: any[]) => {
        console.log(`[OS창:${title}]`, ...args);
        channel.postMessage({ type: 'LOG', level: 'info', args });
      },
      warn: (...args: any[]) => {
        console.warn(`[OS창:${title}]`, ...args);
        channel.postMessage({ type: 'LOG', level: 'warn', args });
      },
      error: (...args: any[]) => {
        console.error(`[OS창:${title}]`, ...args);
        channel.postMessage({ type: 'LOG', level: 'error', args });
      },
      debug: (...args: any[]) => {
        console.debug(`[OS창:${title}]`, ...args);
      },
    },
  };

  // 5. 메인 창에 준비 완료 알림
  channel.postMessage({ type: 'WINDOW_READY' });

  // 6. 엔트리 스크립트 실행 (플러그인인 경우)
  if (platform().listDiskPlugins) {
    try {
      const diskList = await platform().listDiskPlugins!();
      const disk = diskList.find((p) => p.id === pluginId);

      if (disk && disk.files) {
        // 엔트리 파일 자동 탐색 폴백
        let targetFile = entryFile;
        if (!targetFile) {
          const candidates = ['subwindow.js', 'sub-window.js', 'window.js', disk.entryPath || 'index.js'];
          for (const cand of candidates) {
            if (disk.files[cand] || disk.files[`./${cand}`]) {
              targetFile = cand;
              break;
            }
          }
        }

        const fileEntry = targetFile ? (disk.files[targetFile] || disk.files[`./${targetFile}`]) : null;

        if (fileEntry && targetFile) {
          const linked = linkPluginModules(fileEntry, targetFile, disk.files);
          const mod = await import(/* @vite-ignore */ linked.entryUrl);
          const entryFn =
            typeof mod.default === 'function'
              ? mod.default
              : typeof mod.run === 'function'
              ? mod.run
              : typeof mod.open === 'function'
              ? mod.open
              : typeof mod.render === 'function'
              ? mod.render
              : typeof mod === 'function'
              ? mod
              : null;

          if (entryFn) {
            await entryFn(context);
            return;
          }
        }
      }

      // 엔트리 함수가 제공되지 않았을 때 친절한 가이드 화면 표시
      rootContainer.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; box-sizing: border-box;">
          <div style="font-size: 42px; margin-bottom: 12px; opacity: 0.85;">🗔</div>
          <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #e6edf3;">${title}</h2>
          <p style="margin: 0 0 20px 0; color: #8b949e; font-size: 13px; max-width: 480px; line-height: 1.6;">
            독립 OS 윈도우가 성공적으로 열렸습니다.<br/>
            이 창에 UI를 렌더링하려면 스크립트에 <code>export default function(context) { ... }</code> 진입점이 정의되어 있어야 합니다.
          </p>
          <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px 18px; font-size: 12px; text-align: left; color: #c9d1d9; max-width: 520px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace; line-height: 1.6;">
            <div style="color: #58a6ff; font-weight: 600; margin-bottom: 6px;">💡 플러그인 연동 가이드:</div>
            1. <code>openSubWindow</code> 옵션에 <code>entry: 'subwindow.js'</code>를 지정합니다.<br/>
            2. <code>subwindow.js</code>에 <code>export default async function(context) { ... }</code>를 구현하면 독립 OS 창 생성 시 이 함수가 즉시 호출되어 <code>context.container</code>에 UI를 그립니다.
          </div>
        </div>
      `;
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

import * as monaco from 'monaco-editor';
import { platform } from '../platform';
import type { DocumentManager } from '../core/documents';
import type { FileExplorer } from '../ui/explorer';
import { openModal } from '../ui/modal';
import { BUILTIN_PLUGINS } from './builtin';
import type { ActivityBar } from '../ui/activitybar';
import type {
  CustomViewerDefinition,
  MigotoPlugin,
  PluginContext,
  PluginInstance,
  PluginManifest,
  RegisteredSidebarView,
} from './types';

const STORAGE_ENABLED_PLUGINS = 'migoto_plugins_enabled';

export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private sidebarViews: Map<string, RegisteredSidebarView> = new Map();
  private customViewers: Map<string, CustomViewerDefinition> = new Map();
  private dynamicTabDisposers: Map<string, () => void> = new Map();
  private listeners: Set<() => void> = new Set();
  private statusBarEl: HTMLElement | null = null;
  private pluginStatusBarItems: Map<string, HTMLElement> = new Map();

  constructor(
    private doc: DocumentManager,
    private editor: monaco.editor.IStandaloneCodeEditor,
    private explorer?: FileExplorer,
    private activityBar?: ActivityBar,
  ) {
    this.statusBarEl = document.getElementById('statusbar');
    this.doc.setPluginManager(this);
  }

  getCustomViewer(ext: string): CustomViewerDefinition | undefined {
    return this.customViewers.get(ext.toLowerCase().replace(/^\./, ''));
  }

  setActivityBar(ab: ActivityBar) {
    this.activityBar = ab;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  getPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  getSidebarViews(): RegisteredSidebarView[] {
    return Array.from(this.sidebarViews.values());
  }

  async init(): Promise<void> {
    const savedStates: Record<string, boolean> = (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_ENABLED_PLUGINS) || '{}');
      } catch {
        return {};
      }
    })();

    // 1. Initialize built-in plugins
    for (const def of BUILTIN_PLUGINS) {
      const isEnabled = savedStates[def.manifest.id] !== false; // enabled by default
      const instance: PluginInstance = {
        manifest: def.manifest,
        enabled: isEnabled,
        isBuiltin: true,
      };
      this.plugins.set(def.manifest.id, instance);
      if (isEnabled) {
        await this.activatePlugin(instance, def.createPlugin());
      }
    }

    // 2. Discover & initialize disk plugins in Desktop environment
    await this.loadDiskPlugins(savedStates);

    this.notify();
  }

  private async loadDiskPlugins(savedStates: Record<string, boolean>): Promise<void> {
    if (!platform().listDiskPlugins) return;

    try {
      const diskList = await platform().listDiskPlugins!();

      // Ensure built-ins are written to disk if empty so users can inspect/edit them
      if (diskList.length === 0 && platform().saveDiskPlugin) {
        for (const def of BUILTIN_PLUGINS) {
          try {
            await platform().saveDiskPlugin!(
              def.manifest.id,
              JSON.stringify(def.manifest, null, 2),
              def.standaloneScript,
            );
          } catch {}
        }
      }

      for (const disk of diskList) {
        if (this.plugins.has(disk.id)) continue; // Built-in already registered

        let manifest: PluginManifest;
        try {
          manifest = JSON.parse(disk.manifestJson);
        } catch {
          manifest = {
            id: disk.id,
            name: disk.id,
            version: '1.0.0',
            description: '로컬 플러그인',
            author: 'Local',
          };
        }

        const isEnabled = savedStates[manifest.id] !== false;
        const instance: PluginInstance = {
          manifest,
          enabled: isEnabled,
          isBuiltin: false,
          path: disk.path,
          scriptContent: disk.scriptContent,
        };
        this.plugins.set(manifest.id, instance);

        if (isEnabled && disk.scriptContent) {
          await this.loadAndActivateScriptPlugin(instance, disk.scriptContent);
        }
      }
    } catch (err) {
      console.warn('[plugins] Failed to load disk plugins:', err);
    }
  }

  private async loadAndActivateScriptPlugin(
    instance: PluginInstance,
    scriptContent: string,
  ): Promise<void> {
    try {
      // Dynamic ES module evaluation via Blob URL
      const blob = new Blob([scriptContent], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const mod = await import(/* @vite-ignore */ url);
      URL.revokeObjectURL(url);

      const plugin: MigotoPlugin = mod.default || mod;
      await this.activatePlugin(instance, plugin);
    } catch (err: any) {
      instance.error = err.message || String(err);
      console.error(`[plugins] Failed to activate plugin "${instance.manifest.name}":`, err);
    }
  }

  private async activatePlugin(instance: PluginInstance, plugin: MigotoPlugin): Promise<void> {
    const unregisterViews: string[] = [];
    const unregisterStatusItems: string[] = [];
    const unregisterCustomViewers: string[] = [];

    const context = this.createContext(instance.manifest, {
      onRegisterView: (view) => {
        this.sidebarViews.set(view.id, view);
        unregisterViews.push(view.id);

        if (this.activityBar) {
          const sidebarEl = document.getElementById('sidebar');
          let panelEl = document.getElementById(`sidebar-panel-${view.id}`);
          if (!panelEl) {
            panelEl = document.createElement('div');
            panelEl.id = `sidebar-panel-${view.id}`;
            panelEl.className = 'sidebar-panel dynamic-plugin-panel';
            panelEl.hidden = true;
            sidebarEl?.appendChild(panelEl);
          }

          panelEl.replaceChildren();
          const cleanup = view.render(panelEl);

          const reg = this.activityBar.registerDynamicTab({
            id: view.id,
            icon: view.icon || '🧩',
            title: view.title,
            panelEl,
          });

          this.dynamicTabDisposers.set(view.id, () => {
            reg.dispose();
            if (typeof cleanup === 'function') {
              try { cleanup(); } catch {}
            }
            panelEl?.remove();
          });
        }

        this.notify();
      },
      onRegisterStatusItem: (id, el) => {
        this.pluginStatusBarItems.set(id, el);
        unregisterStatusItems.push(id);
      },
      onRegisterCustomViewer: (def) => {
        def.extensions.forEach((ext) => {
          const norm = ext.toLowerCase().replace(/^\./, '');
          this.customViewers.set(norm, def);
          unregisterCustomViewers.push(norm);
        });
      },
    });

    try {
      await plugin.activate(context);
      instance.instance = plugin;
      instance.error = undefined;
      instance.cleanup = () => {
        try {
          plugin.deactivate?.();
        } catch {}
        unregisterViews.forEach((vId) => {
          this.sidebarViews.delete(vId);
          const disposer = this.dynamicTabDisposers.get(vId);
          if (disposer) {
            disposer();
            this.dynamicTabDisposers.delete(vId);
          }
        });
        unregisterStatusItems.forEach((sId) => {
          this.pluginStatusBarItems.get(sId)?.remove();
          this.pluginStatusBarItems.delete(sId);
        });
        unregisterCustomViewers.forEach((ext) => {
          this.customViewers.delete(ext);
        });
      };
    } catch (err: any) {
      instance.error = err.message || String(err);
      console.error(`[plugins] Exception in plugin activate (${instance.manifest.id}):`, err);
    }
  }

  async togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
    const p = this.plugins.get(pluginId);
    if (!p || p.enabled === enabled) return;

    p.enabled = enabled;

    const savedStates: Record<string, boolean> = (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_ENABLED_PLUGINS) || '{}');
      } catch {
        return {};
      }
    })();
    savedStates[pluginId] = enabled;
    localStorage.setItem(STORAGE_ENABLED_PLUGINS, JSON.stringify(savedStates));

    if (!enabled) {
      p.cleanup?.();
      p.cleanup = undefined;
      p.instance = undefined;
    } else {
      if (p.isBuiltin) {
        const def = BUILTIN_PLUGINS.find((b) => b.manifest.id === pluginId);
        if (def) await this.activatePlugin(p, def.createPlugin());
      } else if (p.scriptContent) {
        await this.loadAndActivateScriptPlugin(p, p.scriptContent);
      }
    }

    this.notify();
  }

  isEnabled(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.enabled ?? false;
  }

  async deletePlugin(pluginId: string): Promise<boolean> {
    const p = this.plugins.get(pluginId);
    if (!p) return false;
    if (p.isBuiltin) {
      this.showToast('내장 플러그인은 삭제할 수 없습니다.', 'warn');
      return false;
    }

    if (p.enabled) {
      await this.togglePlugin(pluginId, false);
    }

    if (p.path && platform().deleteEntry) {
      try {
        await platform().deleteEntry!(p.path);
      } catch (err) {
        this.showToast(`플러그인 삭제 실패: ${err}`, 'error');
        return false;
      }
    }

    this.plugins.delete(pluginId);

    try {
      const savedStates: Record<string, boolean> = JSON.parse(
        localStorage.getItem(STORAGE_ENABLED_PLUGINS) || '{}',
      );
      delete savedStates[pluginId];
      localStorage.setItem(STORAGE_ENABLED_PLUGINS, JSON.stringify(savedStates));
    } catch {}

    this.notify();
    this.showToast(`플러그인 "${p.manifest.name}"이(가) 삭제되었습니다.`, 'info');
    return true;
  }

  async createPluginTemplate(id: string, name: string, description = ''): Promise<boolean> {
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanId) {
      this.showToast('올바른 플러그인 ID를 입력해주세요.', 'warn');
      return false;
    }

    if (this.plugins.has(cleanId)) {
      this.showToast('이미 존재하는 플러그인 ID입니다.', 'warn');
      return false;
    }

    const manifest: PluginManifest = {
      id: cleanId,
      name: name.trim() || cleanId,
      version: '1.0.0',
      description: description.trim() || '사용자 정의 플러그인입니다.',
      author: 'User',
      icon: '🧩',
      category: 'tools',
    };

    const starterScript = `// ${manifest.name} (${manifest.id})
export default {
  activate(context) {
    console.log('[plugin] ${manifest.name} activated');
    context.ui.showToast('${manifest.name} 플러그인이 로드되었습니다!', 'info');

    // 필요 시 사이드바 패널 등록 (좌측 툴바에 탭 추가):
    // context.ui.registerSidebarView({
    //   id: '${cleanId}',
    //   title: '${manifest.name}',
    //   icon: '🧩',
    //   render(container) {
    //     container.innerHTML = '<div style="padding:16px;"><h3>${manifest.name}</h3><p>플러그인 화면</p></div>';
    //   }
    // });
  },
  deactivate() {
    console.log('[plugin] ${manifest.name} deactivated');
  }
};
`;

    if (platform().saveDiskPlugin) {
      try {
        await platform().saveDiskPlugin!(cleanId, JSON.stringify(manifest, null, 2), starterScript);
        this.showToast(`플러그인 "${manifest.name}"이(가) 생성되었습니다.`, 'info');
        await this.init();
        return true;
      } catch (err) {
        this.showToast(`플러그인 생성 실패: ${err}`, 'error');
        return false;
      }
    }
    return false;
  }

  async openPluginsFolder(): Promise<void> {
    if (platform().openPluginsFolder) {
      await platform().openPluginsFolder!();
    }
  }

  showToast(message: string, type: 'info' | 'warn' | 'error' = 'info'): void {
    let toastContainer = document.getElementById('plugin-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'plugin-toast-container';
      document.body.append(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `plugin-toast toast-${type}`;
    const icon = type === 'error' ? '⛔' : type === 'warn' ? '⚠' : 'ℹ';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${message}</span>`;
    toastContainer.append(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  private createContext(
    manifest: PluginManifest,
    callbacks: {
      onRegisterView: (view: RegisteredSidebarView) => void;
      onRegisterStatusItem: (id: string, el: HTMLElement) => void;
      onRegisterCustomViewer: (def: CustomViewerDefinition) => void;
    },
  ): PluginContext {
    return {
      manifest,

      editor: {
        getText: () => this.editor.getValue(),
        getSelectedText: () => {
          const sel = this.editor.getSelection();
          if (!sel) return '';
          return this.editor.getModel()?.getValueInRange(sel) ?? '';
        },
        insertText: (text: string) => {
          const sel = this.editor.getSelection();
          const pos = this.editor.getPosition();
          const range = sel && !sel.isEmpty()
            ? sel
            : new monaco.Range(pos?.lineNumber || 1, pos?.column || 1, pos?.lineNumber || 1, pos?.column || 1);

          this.editor.pushUndoStop();
          this.editor.executeEdits('plugin', [{ range, text }]);
          this.editor.pushUndoStop();
          this.editor.focus();
        },
        replaceSelection: (text: string) => {
          const sel = this.editor.getSelection();
          if (!sel) return;
          this.editor.pushUndoStop();
          this.editor.executeEdits('plugin', [{ range: sel, text }]);
          this.editor.pushUndoStop();
          this.editor.focus();
        },
        setCursor: (line: number, col: number) => {
          this.editor.setPosition({ lineNumber: line, column: col });
          this.editor.revealPositionInCenter({ lineNumber: line, column: col });
          this.editor.focus();
        },
        getCursor: () => {
          const p = this.editor.getPosition();
          return { lineNumber: p?.lineNumber || 1, column: p?.column || 1 };
        },
        registerCustomViewer: (viewer: CustomViewerDefinition) => {
          callbacks.onRegisterCustomViewer(viewer);
        },
      },

      workspace: {
        getCurrentFile: () => {
          const file = this.doc.file;
          if (!file) return null;
          return {
            name: this.doc.fileName,
            path: file.id,
            location: file.location,
          };
        },
        getCurrentFolder: () => {
          if (this.explorer && this.explorer.hasFolder) {
            return (this.explorer as any).currentFolder?.id ?? null;
          }
          return null;
        },
        openFile: async (pathOrName: string) => {
          const ref = platform().refFromId(pathOrName);
          await this.doc.openFile(ref);
        },
        saveCurrentFile: async () => {
          await this.doc.save();
        },
        readTextFile: async (path: string) => {
          const ref = platform().refFromId(path);
          const loaded = await platform().readFile(ref);
          return loaded.text;
        },
        readBinaryFile: async (path: string) => {
          if (platform().readBinaryFile) {
            return platform().readBinaryFile!(path);
          }
          return new Uint8Array();
        },
      },

      ui: {
        registerSidebarView: (options) => {
          callbacks.onRegisterView({
            id: options.id,
            pluginId: manifest.id,
            title: options.title,
            icon: options.icon,
            render: options.render,
          });
        },
        showModal: (title: string, render: (container: HTMLElement, close: () => void) => void) => {
          const body = document.createElement('div');
          body.className = 'plugin-modal-body';
          let closeFn: (() => void) | null = null;
          closeFn = openModal(title, body);
          render(body, () => closeFn?.());
        },
        showToast: (message: string, type?: 'info' | 'warn' | 'error') => {
          this.showToast(message, type);
        },
        registerStatusBarItem: (options) => {
          if (!this.statusBarEl) return;
          const btn = document.createElement('button');
          btn.className = 'status-btn plugin-status-item';
          btn.textContent = options.text;
          if (options.tooltip) btn.title = options.tooltip;
          if (options.onClick) btn.onclick = options.onClick;
          this.statusBarEl.append(btn);
          callbacks.onRegisterStatusItem(options.id, btn);
        },
      },

      system: {
        exec: async (command: string, args: string[] = [], cwd?: string) => {
          if (platform().execProcess) {
            return platform().execProcess!(command, args, cwd);
          }
          return {
            stdout: '',
            stderr: '이 플랫폼에서는 외부 프로세스 실행이 지원되지 않습니다.',
            exitCode: 1,
          };
        },
      },

      storage: {
        get: <T = any>(key: string, defaultValue?: T): T => {
          try {
            const raw = localStorage.getItem(`migoto_plugin_${manifest.id}_${key}`);
            if (raw === null) return defaultValue as T;
            return JSON.parse(raw);
          } catch {
            return defaultValue as T;
          }
        },
        set: <T = any>(key: string, value: T): void => {
          try {
            localStorage.setItem(`migoto_plugin_${manifest.id}_${key}`, JSON.stringify(value));
          } catch {}
        },
      },

      fetch: (input, init) => window.fetch(input, init),
    };
  }
}

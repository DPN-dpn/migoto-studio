import { monaco } from '../core/monaco';
import { platform } from '../platform';
import { validatePluginZip, type ExtractedPlugin } from './zip';
import type { DocumentManager } from '../core/documents';
import type { FileExplorer } from '../ui/explorer';
import { openModal } from '../ui/modal';
import { showToast } from '../ui/toast';
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

export { validatePluginZip, type ExtractedPlugin };

export interface CreatePluginTemplateOptions {
  id: string;
  name: string;
  icon?: string;
  author?: string;
  location?: string;
  description?: string;
}

const STORAGE_ENABLED_PLUGINS = 'migoto_plugins_enabled';

export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private sidebarViews: Map<string, RegisteredSidebarView> = new Map();
  private customViewers: Map<string, CustomViewerDefinition> = new Map();
  private dynamicTabDisposers: Map<string, () => void> = new Map();
  private listeners: Set<() => void> = new Set();
  private statusBarEl: HTMLElement | null = null;
  private pluginStatusBarItems: Map<string, HTMLElement> = new Map();

  private doc: DocumentManager;
  private editor: monaco.editor.IStandaloneCodeEditor;
  private explorer?: FileExplorer;
  private activityBar?: ActivityBar;

  constructor(
    doc: DocumentManager,
    editor: monaco.editor.IStandaloneCodeEditor,
    explorer?: FileExplorer,
    activityBar?: ActivityBar,
  ) {
    this.doc = doc;
    this.editor = editor;
    this.explorer = explorer;
    this.activityBar = activityBar;
    this.statusBarEl = document.getElementById('statusbar');
    this.doc.setViewerProvider(this);
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

  private getStoredPluginOrder(): string[] {
    try {
      const raw = localStorage.getItem('migoto_plugin_order');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveStoredPluginOrder(order: string[]): void {
    try {
      localStorage.setItem('migoto_plugin_order', JSON.stringify(order));
    } catch { }
  }

  getPluginOrder(): string[] {
    const stored = this.getStoredPluginOrder();
    const allIds = Array.from(this.plugins.keys());
    const valid = stored.filter((id) => allIds.includes(id));
    for (const id of allIds) {
      if (!valid.includes(id)) valid.push(id);
    }
    return valid;
  }

  getPlugins(): PluginInstance[] {
    const order = this.getPluginOrder();
    const list = Array.from(this.plugins.values());
    return list.sort((a, b) => {
      const idxA = order.indexOf(a.manifest.id);
      const idxB = order.indexOf(b.manifest.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }

  movePluginOrder(id: string, direction: 'up' | 'down'): void {
    const order = this.getPluginOrder();
    const idx = order.indexOf(id);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      const tmp = order[idx - 1];
      order[idx - 1] = order[idx];
      order[idx] = tmp;
    } else if (direction === 'down' && idx < order.length - 1) {
      const tmp = order[idx + 1];
      order[idx + 1] = order[idx];
      order[idx] = tmp;
    }
    this.saveStoredPluginOrder(order);
    this.activityBar?.reorderDynamicTabs(order);
    this.notify();
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
          } catch { }
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
          this.activityBar.reorderDynamicTabs(this.getPluginOrder());

          this.dynamicTabDisposers.set(view.id, () => {
            reg.dispose();
            if (typeof cleanup === 'function') {
              try { cleanup(); } catch { }
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
        } catch { }
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
    } catch { }

    this.notify();
    this.showToast(`플러그인 "${p.manifest.name}"이(가) 삭제되었습니다.`, 'info');
    return true;
  }

  async installPluginFromZip(): Promise<boolean> {
    if (!platform().pickPluginZip) {
      this.showToast('플러그인 파일 선택이 지원되지 않는 환경입니다.', 'warn');
      return false;
    }

    let bytes: Uint8Array | null = null;
    try {
      bytes = await platform().pickPluginZip!();
    } catch (err) {
      this.showToast(`파일 선택 실패: ${err}`, 'error');
      return false;
    }

    if (!bytes || bytes.length === 0) {
      return false; // User cancelled
    }

    let extracted: ExtractedPlugin;
    try {
      extracted = validatePluginZip(bytes);
    } catch (err: any) {
      this.showToast(err?.message || '유효하지 않은 플러그인 압축파일입니다.', 'error');
      return false;
    }

    const { manifest, files, manifestJson, scriptContent } = extracted;

    if (BUILTIN_PLUGINS.some((b) => b.manifest.id === manifest.id)) {
      this.showToast(`기본 내장 플러그인 ID("${manifest.id}")는 덮어쓸 수 없습니다.`, 'error');
      return false;
    }

    if (platform().kind === 'desktop' && platform().getPluginsDir && platform().writeBinaryFile) {
      try {
        const pluginsDir = await platform().getPluginsDir!();
        const baseFolder = `${pluginsDir.replace(/\\/g, '/')}/${manifest.id}`;

        for (const [relPath, fileData] of Object.entries(files)) {
          const fullPath = `${baseFolder}/${relPath}`;
          await platform().writeBinaryFile!(fullPath, fileData);
        }
      } catch (err) {
        this.showToast(`플러그인 파일 저장 실패: ${err}`, 'error');
        return false;
      }
    } else if (platform().saveDiskPlugin) {
      try {
        await platform().saveDiskPlugin!(manifest.id, manifestJson, scriptContent);
      } catch (err) {
        this.showToast(`플러그인 저장 실패: ${err}`, 'error');
        return false;
      }
    }

    await this.init();

    if (!this.isEnabled(manifest.id)) {
      await this.togglePlugin(manifest.id, true);
    }

    const extraNote = platform().kind === 'web'
      ? ' (브라우저 저장소에 설치되었습니다)'
      : '';
    this.showToast(`플러그인 "${manifest.name}" 설치가 완료되었습니다!${extraNote}`, 'info');
    return true;
  }

  async createPluginTemplate(
    optionsOrId: string | CreatePluginTemplateOptions,
    nameArg = '',
    descArg = '',
  ): Promise<boolean> {
    let rawId: string;
    let name: string;
    let icon: string;
    let author: string;
    let location: string;
    let description: string;

    if (typeof optionsOrId === 'object') {
      rawId = optionsOrId.id;
      name = optionsOrId.name;
      icon = optionsOrId.icon?.trim() || '🧩';
      author = optionsOrId.author?.trim() || '사용자';
      location = optionsOrId.location?.trim() || '좌측 사이드바 탭';
      description = optionsOrId.description?.trim() || '사용자 정의 플러그인입니다.';
    } else {
      rawId = optionsOrId;
      name = nameArg;
      icon = '🧩';
      author = '사용자';
      location = '좌측 사이드바 탭';
      description = descArg || '사용자 정의 플러그인입니다.';
    }

    const cleanId = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
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
      description,
      author,
      icon,
      category: 'tools',
      location,
    };

    const starterScript = `// ${manifest.name} (${manifest.id})
// 제작자: ${manifest.author}
// 위치: ${manifest.location}
export default {
  activate(context) {
    console.log('[plugin] ${manifest.name} activated');
    context.ui.showToast('${manifest.name} 플러그인이 로드되었습니다!', 'info');

    // 사이드바 패널 등록 (좌측 툴바에 ${manifest.icon} 탭 추가):
    context.ui.registerSidebarView({
      id: '${cleanId}',
      title: '${manifest.name}',
      icon: '${manifest.icon}',
      render(container) {
        container.innerHTML = \`<div style="padding:16px;">
          <h3>${manifest.icon} ${manifest.name}</h3>
          <p>${manifest.description}</p>
          <p style="font-size:12px;color:#888;">제작: ${manifest.author} | 위치: ${manifest.location}</p>
        </div>\`;
      }
    });
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
    showToast(message, type);
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
          } catch { }
        },
      },

      fetch: (input, init) => window.fetch(input, init),
    };
  }
}

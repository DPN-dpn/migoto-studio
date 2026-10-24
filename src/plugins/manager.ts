import { monaco } from '../core/editor/monaco';
import { platform } from '../platform';
import type { DirEntry } from '../platform/types';
import { validatePluginZip, type ExtractedPlugin } from './zip';
import { linkPluginModules } from './module-linker';
import { appLogger } from '../core/logger';
import type { DocumentManager } from '../core/workspace/documents';
import type { FileExplorer } from '../ui/panels/explorer';
import { openModal } from '../ui/modals/modal';
import { showToast } from '../ui/common/toast';
import { getSettings, onSettingsChange } from '../core/workspace/settings';
import {
  flashLineHighlight,
  setCustomDefinitionResolver,
  setCustomReferencesResolver,
  type SymbolOccurrence,
} from '../core/ini/symbol-nav';
import { proposeEditorChanges } from '../core/editor/inline-review';
import type { ActivityBar } from '../ui/layout/activitybar';
import {
  registerAllowedResource,
  registerAllowedVariable,
  registerAllowedUsedResource,
  registerAllowedUsedVariable,
  clearAllowedVariables,
  clearAllowedResources,
  isAllowedResource,
  isAllowedVariable,
} from '../core/ini/lint';
import { registerPluginTemplate } from '../core/ini/templates';
import {
  parseIni,
  classifyIniSection,
  mergeIniSections,
  formatIniSection,
  formatKeyToggleSection,
  deleteIniSection,
  getSectionRaw,
  setSectionRaw,
  parseSectionLines,
  type IniSectionLine,
} from '../core/ini/ini';
import {
  parseKeyBinding,
  formatKeyBinding,
  formatDisplayKey,
  VK_KEY_LIST,
} from '../core/ini/keys';
import { openRestore } from '../ui/modals/restore-ui';
import { openConfirmModal, openPromptModal, type ConfirmOptions, type PromptOptions } from '../ui/modals/confirm-ui';
import {
  searchInText,
  buildSearchRegex,
  matchesPattern,
  globToRegex,
  BINARY_EXTENSIONS as SEARCH_BINARY_EXTENSIONS,
} from '../core/workspace/search';
import { extractSymbols } from '../core/ini/symbols';
import { slotManager } from '../core/slots/slot-manager';
import type { ModelSlot, TextureSlotResolver } from '../core/slots/types';
import type {
  CustomDefinitionProvider,
  CustomLintRule,
  CustomReferenceProvider,
  CustomViewerDefinition,
  MigotoPlugin,
  PluginContext,
  PluginInstance,
  PluginManifest,
  PluginMenuGroup,
  PluginMenuItemDef,
  PluginTemplate,
  RegisteredSidebarView,
  SymbolLocation,
  FormConfig,
  FormInstance,
  PluginDiffOptions,
  PluginTabInfo,
  WorkspaceSearchOptions,
  WorkspaceSearchResult,
  IniSymbolsResult,
  DiagnosticFilter,
  DiagnosticFilterContext,
  LintDiagnostic,
  ProposeChangesOptions,
  ProposeChangesResult,
  SubWindowOptions,
  SubWindowHandle,
  NativeWindowOptions,
  NativeWindowHandle,
  PluginLifecycleAction,
  PluginLifecycleEvent,
} from './types';
import { createUIBuilder } from './ui-builder';
import { subWindowManager, nativeWindowManager } from '../window';

import {
  parseGitHubUrl,
  fetchGitHubPluginRelease,
  downloadZipBytes,
  checkGitHubPluginUpdate,
  type PluginGitHubSource,
  type GitHubPluginReleaseInfo,
} from './github';

import {
  checkAllDependencies,
  topologicalSortPlugins,
  parseDependencySpec,
  type DependencyCheckResult,
} from './dependency';

export { validatePluginZip, type ExtractedPlugin };
export { type PluginGitHubSource };

export interface CreatePluginTemplateOptions {
  id: string;
  name: string;
  icon?: string;
  author?: string;
  location?: string;
  description?: string;
}

const STORAGE_ENABLED_PLUGINS = 'migoto_plugins_enabled';
const STORAGE_PLUGIN_ORDER_VERSION = 'migoto_plugin_order_v';
const STORAGE_PLUGIN_GITHUB_SOURCES = 'migoto_plugin_github_sources';

export const DEFAULT_PLUGIN_ORDER: readonly string[] = [
  'custom-lint',
  'zzmi-support',
  'texture-library',
  'python-runner',
  'ai-assistant',
];

export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private sidebarViews: Map<string, RegisteredSidebarView> = new Map();
  private customViewers: Map<string, CustomViewerDefinition> = new Map();
  private dynamicTabDisposers: Map<string, () => void> = new Map();
  private listeners: Set<() => void> = new Set();
  private pluginLifecycleListeners: Set<(event: PluginLifecycleEvent) => void> = new Set();
  private statusBarEl: HTMLElement | null = null;
  private pluginStatusBarItems: Map<string, HTMLElement> = new Map();
  private customLintRules: Map<string, CustomLintRule> = new Map();
  private diagnosticFilters: Set<DiagnosticFilter> = new Set();
  private customDefinitionProviders: CustomDefinitionProvider[] = [];
  private customReferenceProviders: CustomReferenceProvider[] = [];
  private pluginMenuItems: Map<string, { manifest: PluginManifest; items: PluginMenuItemDef[] }> = new Map();
  private githubSources: Map<string, PluginGitHubSource> = new Map();
  private isCheckingUpdates = false;
  private pluginApis: Map<string, any> = new Map();

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
    this.loadGitHubSources();

    // Register plugin symbol resolution providers into the core symbol navigation system
    setCustomDefinitionResolver(async (target, model) => {
      if (this.customDefinitionProviders.length === 0) return null;
      const loc = await this.resolveCustomDefinition(target, model);
      if (!loc) return null;
      return this.symbolLocationToOccurrence(loc, target);
    });

    setCustomReferencesResolver(async (target, model) => {
      if (this.customReferenceProviders.length === 0) return [];
      const locs = await this.resolveCustomReferences(target, model);
      if (!locs || locs.length === 0) return [];
      return locs.map((loc) => this.symbolLocationToOccurrence(loc, target));
    });
  }

  private isLinting = false;
  private lintTrigger?: () => void;

  setLintTrigger(fn: () => void): void {
    this.lintTrigger = fn;
  }

  triggerLint(): void {
    if (this.isLinting) return;
    this.lintTrigger?.();
  }

  getCustomViewer(ext: string): CustomViewerDefinition | undefined {
    return this.customViewers.get(ext.toLowerCase().replace(/^\./, ''));
  }

  getPluginMenuItems(): PluginMenuGroup[] {
    const order = this.getPluginOrder();
    const groups: PluginMenuGroup[] = [];
    for (const [pluginId, group] of this.pluginMenuItems) {
      const pluginInstance = this.plugins.get(pluginId);
      if (pluginInstance && pluginInstance.enabled && group.items.length > 0) {
        groups.push({
          pluginId,
          pluginName: group.manifest.name || pluginId,
          icon: group.manifest.icon,
          items: [...group.items],
        });
      }
    }
    return groups.sort((a, b) => {
      const idxA = order.indexOf(a.pluginId);
      const idxB = order.indexOf(b.pluginId);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
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

  registerDefinitionProvider(provider: CustomDefinitionProvider): () => void {
    this.customDefinitionProviders.push(provider);
    return () => {
      this.customDefinitionProviders = this.customDefinitionProviders.filter((p) => p !== provider);
    };
  }

  registerReferenceProvider(provider: CustomReferenceProvider): () => void {
    this.customReferenceProviders.push(provider);
    return () => {
      this.customReferenceProviders = this.customReferenceProviders.filter((p) => p !== provider);
    };
  }

  private symbolLocationToOccurrence(loc: SymbolLocation, target: any): SymbolOccurrence {
    const rawPath = loc.filePath || '';
    const norm = rawPath.replace(/\\/g, '/');
    const baseName = norm.split('/').pop() || rawPath;

    const openTab = this.doc.allTabs.find((t) => {
      const tPath = (t.file?.id || t.title || '').replace(/\\/g, '/');
      return (
        tPath === norm ||
        tPath.endsWith(`/${norm}`) ||
        norm.endsWith(`/${tPath}`) ||
        t.title === baseName
      );
    });

    const uri = openTab ? openTab.model.uri : monaco.Uri.file(rawPath);

    return {
      title: baseName,
      filePath: rawPath,
      fileRef: openTab?.file || (this.explorer && this.explorer.hasFolder ? this.explorer.getFileRef(rawPath) : null),
      tabId: openTab?.id,
      uri,
      range: {
        startLineNumber: loc.lineNumber,
        startColumn: loc.startColumn,
        endLineNumber: loc.lineNumber,
        endColumn: loc.endColumn,
      },
      lineContent: loc.lineContent || '',
      section: loc.section || '',
      isDefinition: loc.isDefinition ?? true,
      kind: target.kind || 'variable',
      matchedText: target.name || '',
    };
  }

  private createSymbolContext(model: monaco.editor.ITextModel) {
    const curFile = this.doc.file
      ? {
          name: this.doc.fileName,
          path: this.doc.file.id,
          location: this.doc.file.location,
        }
      : {
          name: this.doc.fileName,
          path: this.doc.fileName,
          location: 'memory',
        };
    const curFolder =
      this.explorer && this.explorer.hasFolder
        ? (this.explorer as any).currentFolder?.id ?? null
        : null;

    return {
      model: {
        getValue: () => model.getValue(),
        getLineContent: (n: number) => model.getLineContent(n),
        getLineCount: () => model.getLineCount(),
      },
      file: curFile,
      folder: curFolder,
      getAllFiles: (): string[] => {
        const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
        const list: string[] = [];
        const seen = new Set<string>();
        const isSame = (a: string, b: string) => a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
        const add = (p: string) => {
          const n = norm(p);
          for (const s of seen) {
            if (isSame(s, n)) return;
          }
          seen.add(n);
          list.push(p);
        };
        // 탭(절대경로)과 탐색기(상대경로)가 같은 파일을 가리키므로 하나로 합친다.
        for (const tab of this.doc.allTabs) {
          if (tab.file?.id) add(tab.file.id);
          else if (tab.title) add(tab.title);
        }
        if (this.explorer && this.explorer.hasFolder) {
          for (const f of this.explorer.getAllFilePaths()) add(f);
        }
        return list;
      },
      readTextFile: async (relOrAbsPath: string): Promise<string> => {
        const cleanNoSlash = relOrAbsPath.trim().replace(/^["']|["']$/g, '').trim().replace(/\\/g, '/');
        const baseName = cleanNoSlash.split('/').pop() || cleanNoSlash;
        for (const tab of this.doc.allTabs) {
          const tf = tab.file;
          const p = (tf?.id || tab.title || '').replace(/\\/g, '/');
          if (p === cleanNoSlash || p.endsWith(`/${cleanNoSlash}`) || cleanNoSlash.endsWith(`/${p}`) || tab.title === baseName) {
            return tab.model.getValue();
          }
        }
        if (this.explorer && this.explorer.hasFolder) {
          const fileRef = this.explorer.getFileRef(relOrAbsPath);
          if (fileRef) {
            const loaded = await platform().readFile(fileRef);
            return loaded.text;
          }
        }
        let clean = relOrAbsPath.trim().replace(/^["']|["']$/g, '').trim();
        if (curFolder && !clean.includes(':') && !clean.startsWith('/') && !clean.startsWith('\\')) {
          clean = `${curFolder.replace(/\\/g, '/')}/${clean.replace(/\\/g, '/')}`;
        }
        const ref = platform().refFromId(clean);
        const loaded = await platform().readFile(ref);
        return loaded.text;
      },
    };
  }

  async resolveCustomDefinition(target: any, model: monaco.editor.ITextModel): Promise<SymbolLocation | null> {
    const ctx = this.createSymbolContext(model);
    for (const prov of this.customDefinitionProviders) {
      try {
        const res = await prov.provideDefinition(target, ctx);
        if (res) return res;
      } catch (err) {
        console.warn('[PluginManager] Definition provider error:', err);
      }
    }
    return null;
  }

  async resolveCustomReferences(target: any, model: monaco.editor.ITextModel): Promise<SymbolLocation[]> {
    const ctx = this.createSymbolContext(model);
    const results: SymbolLocation[] = [];
    for (const prov of this.customReferenceProviders) {
      try {
        const list = await prov.provideReferences(target, ctx);
        if (list && list.length > 0) {
          results.push(...list);
        }
      } catch (err) {
        console.warn('[PluginManager] Reference provider error:', err);
      }
    }
    return results;
  }

  private loadGitHubSources(): void {
    try {
      const raw = localStorage.getItem(STORAGE_PLUGIN_GITHUB_SOURCES);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.githubSources = new Map(Object.entries(parsed));
      }
    } catch {}
  }

  private saveGitHubSources(): void {
    try {
      const obj = Object.fromEntries(this.githubSources);
      localStorage.setItem(STORAGE_PLUGIN_GITHUB_SOURCES, JSON.stringify(obj));
    } catch {}
  }

  getGitHubSource(pluginId: string): PluginGitHubSource | undefined {
    return this.githubSources.get(pluginId);
  }

  private getStoredPluginOrder(): string[] {
    try {
      const raw = localStorage.getItem('migoto_plugin_order');
      if (!raw) return [...DEFAULT_PLUGIN_ORDER];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((id) => (id === 'resource-checker' ? 'custom-lint' : id))
          .filter((id, idx, arr) => arr.indexOf(id) === idx);
      }
      return [...DEFAULT_PLUGIN_ORDER];
    } catch {
      return [...DEFAULT_PLUGIN_ORDER];
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
    for (const defId of DEFAULT_PLUGIN_ORDER) {
      if (allIds.includes(defId) && !valid.includes(defId)) {
        valid.push(defId);
      }
    }
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


  async checkFileExists(relPath: string): Promise<boolean> {
    if (this.explorer && this.explorer.hasFolder) {
      if (this.explorer.hasFile(relPath)) return true;
    }

    let clean = relPath.trim().replace(/^["']|["']$/g, '').trim().replace(/\\/g, '/');
    if (clean.startsWith('./')) clean = clean.slice(2);
    if (!clean) return false;

    const curFolder = this.explorer && this.explorer.hasFolder ? (this.explorer as any).currentFolder?.id ?? null : null;
    if (curFolder && platform().readBinaryFile) {
      try {
        const full = `${curFolder.replace(/\\/g, '/')}/${clean}`;
        const buf = await platform().readBinaryFile!(full);
        if (buf && buf.length >= 0) return true;
      } catch {}
    }

    const curFile = this.doc.file?.id;
    if (curFile && platform().readBinaryFile) {
      const lastSlash = Math.max(curFile.lastIndexOf('/'), curFile.lastIndexOf('\\'));
      if (lastSlash > 0) {
        const iniDir = curFile.substring(0, lastSlash);
        try {
          const full2 = `${iniDir.replace(/\\/g, '/')}/${clean}`;
          const buf2 = await platform().readBinaryFile!(full2);
          if (buf2 && buf2.length >= 0) return true;
        } catch {}
      }
    }

    return false;
  }

  async runCustomLintRules(model: monaco.editor.ITextModel): Promise<monaco.editor.IMarkerData[]> {
    if (this.customLintRules.size === 0) return [];
    this.isLinting = true;
    try {
      const markers: monaco.editor.IMarkerData[] = [];
      const curFile = this.doc.file ? {
        name: this.doc.fileName,
        path: this.doc.file.id,
        location: this.doc.file.location,
      } : null;
      const curFolder = this.explorer && this.explorer.hasFolder ? (this.explorer as any).currentFolder?.id ?? null : null;

      const fileExistsHelper = async (relPath: string): Promise<boolean> => {
        return this.checkFileExists(relPath);
      };

      const ctx = {
        model: {
          getLineCount: () => model.getLineCount(),
          getLineContent: (n: number) => model.getLineContent(n),
          getValue: () => model.getValue(),
        },
        file: curFile,
        folder: curFolder,
        fileExists: fileExistsHelper,
        readTextFile: async (relOrAbsPath: string): Promise<string> => {
          let clean = relOrAbsPath.trim().replace(/^["']|["']$/g, '').trim();
          if (curFolder && !clean.includes(':') && !clean.startsWith('/') && !clean.startsWith('\\')) {
            clean = `${curFolder.replace(/\\/g, '/')}/${clean.replace(/\\/g, '/')}`;
          }
          const ref = platform().refFromId(clean);
          const loaded = await platform().readFile(ref);
          return loaded.text;
        },
        getAllFiles: (): string[] => {
          return this.explorer && this.explorer.hasFolder ? this.explorer.getAllFilePaths() : [];
        },
        isAllowedResource: (name: string) => isAllowedResource(name),
        isAllowedVariable: (name: string) => isAllowedVariable(name),
      };

      for (const rule of this.customLintRules.values()) {
        try {
          const diags = await rule.check(ctx);
          for (const d of diags) {
            const sev = d.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : d.severity === 'info'
              ? monaco.MarkerSeverity.Info
              : monaco.MarkerSeverity.Warning;

            markers.push({
              severity: sev,
              message: d.message,
              startLineNumber: d.startLineNumber,
              startColumn: d.startColumn,
              endLineNumber: d.endLineNumber,
              endColumn: d.endColumn,
            });
          }
        } catch (err) {
          console.warn(`[PluginManager] Custom lint rule "${rule.name}" failed:`, err);
        }
      }

      return markers;
    } finally {
      this.isLinting = false;
    }
  }

  filterDiagnostics(
    markers: monaco.editor.IMarkerData[],
    model: monaco.editor.ITextModel,
  ): monaco.editor.IMarkerData[] {
    if (this.diagnosticFilters.size === 0) return markers;

    const curFile = this.doc.file
      ? {
          name: this.doc.fileName,
          path: this.doc.file.id,
          location: this.doc.file.location,
        }
      : null;
    const curFolder =
      this.explorer && this.explorer.hasFolder
        ? ((this.explorer as any).currentFolder?.id ?? null)
        : null;

    const ctx: DiagnosticFilterContext = {
      model: {
        getLineCount: () => model.getLineCount(),
        getLineContent: (n: number) => model.getLineContent(n),
        getValue: () => model.getValue(),
      },
      file: curFile,
      folder: curFolder,
    };

    return markers.filter((marker) => {
      const diag: LintDiagnostic = {
        message: marker.message,
        severity:
          marker.severity === monaco.MarkerSeverity.Error
            ? 'error'
            : marker.severity === monaco.MarkerSeverity.Info
            ? 'info'
            : 'warning',
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        endLineNumber: marker.endLineNumber,
        endColumn: marker.endColumn,
      };

      for (const filter of this.diagnosticFilters) {
        try {
          if (!filter(diag, ctx)) {
            return false;
          }
        } catch (err) {
          console.warn('[PluginManager] Diagnostic filter error:', err);
        }
      }
      return true;
    });
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

    // Migrate saved state from legacy 'resource-checker' to 'custom-lint'
    if (savedStates['resource-checker'] !== undefined) {
      if (savedStates['custom-lint'] === undefined) {
        savedStates['custom-lint'] = savedStates['resource-checker'];
      }
      delete savedStates['resource-checker'];
      try {
        localStorage.setItem(STORAGE_ENABLED_PLUGINS, JSON.stringify(savedStates));
      } catch {}
    }

    for (const p of this.plugins.values()) {
      try {
        p.cleanup?.();
      } catch { }
      p.cleanup = undefined;
      p.instance = undefined;
    }
    this.plugins.clear();

    await this.loadDiskPlugins(savedStates);

    // Clean up stale IDs in savedStates and plugin order that no longer exist
    const currentPluginIds = new Set(this.plugins.keys());
    let statesChanged = false;
    for (const id of Object.keys(savedStates)) {
      if (!currentPluginIds.has(id)) {
        delete savedStates[id];
        statesChanged = true;
      }
    }
    if (statesChanged) {
      try {
        localStorage.setItem(STORAGE_ENABLED_PLUGINS, JSON.stringify(savedStates));
      } catch {}
    }

    const orderVersion = localStorage.getItem(STORAGE_PLUGIN_ORDER_VERSION);
    let storedOrder = this.getStoredPluginOrder();
    if (!orderVersion) {
      // 기존에 기본 플러그인들만 있었거나 순서를 직접 변경하지 않은 경우, 신규 DEFAULT_PLUGIN_ORDER로 마이그레이션
      const isOnlyDefaults = storedOrder.every((id) => DEFAULT_PLUGIN_ORDER.includes(id));
      if (isOnlyDefaults) {
        storedOrder = DEFAULT_PLUGIN_ORDER.filter((id) => currentPluginIds.has(id));
      }
      try {
        localStorage.setItem(STORAGE_PLUGIN_ORDER_VERSION, '1');
      } catch {}
    }

    const cleanedOrder = storedOrder.filter((id) => currentPluginIds.has(id));
    for (const id of currentPluginIds) {
      if (!cleanedOrder.includes(id)) {
        cleanedOrder.push(id);
      }
    }
    this.saveStoredPluginOrder(cleanedOrder);

    this.activityBar?.reorderDynamicTabs(this.getPluginOrder());
    this.notify();

    // 저장된 GitHub 플러그인들의 최신 릴리스 버전 체크 (백그라운드 비동기)
    this.checkPluginUpdates().catch(() => {});
  }

  private async loadDiskPlugins(savedStates: Record<string, boolean>): Promise<void> {
    if (!platform().listDiskPlugins) return;

    try {
      const diskList = await platform().listDiskPlugins!();

      for (const disk of diskList) {
        // Prune legacy resource-checker plugin if still present on disk
        if (disk.id === 'resource-checker' || disk.path.toLowerCase().endsWith('resource-checker')) {
          if (platform().deleteEntry) {
            try {
              await platform().deleteEntry!(disk.path || disk.id);
            } catch (err) {
              console.warn('[plugins] Failed to prune legacy resource-checker folder:', err);
            }
          }
          continue;
        }

        let manifest: PluginManifest;
        try {
          manifest = JSON.parse(disk.manifestJson);
        } catch {
          console.warn(`[plugins] Skipping plugin with invalid manifest (${disk.id})`);
          continue;
        }

        if (!manifest || typeof manifest.id !== 'string' || !manifest.id.trim()) {
          console.warn(`[plugins] Skipping plugin with missing id:`, disk);
          continue;
        }

        // On web platform, python-runner is not supported
        if (platform().kind === 'web' && manifest.id === 'python-runner') {
          continue;
        }

        if (!disk.scriptContent || typeof disk.scriptContent !== 'string') {
          console.warn(`[plugins] Skipping plugin without scriptContent (${manifest.id})`);
          continue;
        }

        const isEnabled = savedStates[manifest.id] !== false;
        const instance: PluginInstance = {
          manifest,
          enabled: isEnabled,
          isBuiltin: false,
          path: disk.path,
          scriptContent: disk.scriptContent,
          entryPath: disk.entryPath,
          files: disk.files,
        };
        this.plugins.set(manifest.id, instance);
      }

      // Topologically sort enabled plugins so dependencies activate before dependents
      const enabledWithScript = Array.from(this.plugins.values()).filter(
        (p) => p.enabled && p.scriptContent,
      );
      const { sorted } = topologicalSortPlugins(enabledWithScript);
      for (const instance of sorted) {
        if (instance.scriptContent) {
          await this.loadAndActivateScriptPlugin(instance, instance.scriptContent);
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
    let linkedDisposer: (() => void) | undefined;
    try {
      // Dynamic ES module evaluation via Virtual Module Linker
      const entryName = instance.entryPath || instance.manifest.main || 'index.js';
      const linked = linkPluginModules(scriptContent, entryName, instance.files);
      linkedDisposer = linked.dispose;

      const mod = await import(/* @vite-ignore */ linked.entryUrl);
      const plugin: MigotoPlugin = mod.default || mod;
      await this.activatePlugin(instance, plugin, linked.dispose);
    } catch (err: any) {
      if (linkedDisposer) {
        try { linkedDisposer(); } catch {}
      }
      instance.error = err.message || String(err);
      console.error(`[plugins] Failed to activate plugin "${instance.manifest.name}":`, err);
    }
  }

  private async activatePlugin(
    instance: PluginInstance,
    plugin: MigotoPlugin,
    moduleDisposer?: () => void,
  ): Promise<void> {
    // Verify dependencies before activation
    const depResults = checkAllDependencies(instance.manifest, (id) => this.plugins.get(id));
    const unsatisfied = depResults.filter((r) => !r.satisfied);
    if (unsatisfied.length > 0) {
      instance.dependencyErrors = unsatisfied;
      instance.error = `종속성 미충족: ${unsatisfied.map((r) => `${r.id} (${r.message})`).join(', ')}`;
      console.warn(`[plugins] Cannot activate plugin "${instance.manifest.name}" due to unsatisfied dependencies:`, unsatisfied);
      if (moduleDisposer) {
        try { moduleDisposer(); } catch {}
      }
      return;
    }
    instance.dependencyErrors = undefined;
    instance.error = undefined;

    const unregisterViews: string[] = [];
    const unregisterStatusItems: string[] = [];
    const unregisterCustomViewers: string[] = [];
    const unregisterCleanups = new Set<() => void>();

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
            pluginId: view.pluginId,
            icon: view.icon || 'PLG',
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
      onRegisterCleanup: (fn) => {
        unregisterCleanups.add(fn);
      },
      onRemoveCleanup: (fn) => {
        unregisterCleanups.delete(fn);
      },
    });

    try {
      const exportedApi = await plugin.activate(context);
      if (exportedApi && typeof exportedApi === 'object' && !this.pluginApis.has(instance.manifest.id)) {
        this.pluginApis.set(instance.manifest.id, exportedApi);
      }
      instance.instance = plugin;
      instance.error = undefined;
      instance.dependencyErrors = undefined;
      instance.cleanup = () => {
        try {
          plugin.deactivate?.();
        } catch { }
        this.pluginApis.delete(instance.manifest.id);
        unregisterCleanups.forEach((fn) => {
          try { fn(); } catch { }
        });
        unregisterCleanups.clear();
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
        if (moduleDisposer) {
          try {
            moduleDisposer();
          } catch {}
        }
      };
      appLogger.info('Plugin', `플러그인 활성화: "${instance.manifest.name}" (v${instance.manifest.version})`);
      await this.retryActivatingDependents(instance.manifest.id);
    } catch (err: any) {
      instance.error = err.message || String(err);
      appLogger.error('Plugin', `플러그인 활성화 실패: "${instance.manifest.name}"`, err);
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
      this.pluginApis.delete(pluginId);
      if (this.customLintRules.size === 0) {
        clearAllowedVariables();
        clearAllowedResources();
      }
      appLogger.info('Plugin', `플러그인 비활성화: "${p.manifest.name}"`);
      this.emitLifecycle('deactivated', pluginId, p.manifest);

      // 종속하고 있던 활성화 플러그인들의 작동 중단 처리
      for (const dep of this.getActiveDependents(pluginId)) {
        dep.cleanup?.();
        dep.cleanup = undefined;
        dep.instance = undefined;
        dep.dependencyErrors = this.checkPluginDependencies(dep.manifest.id);
        dep.error = `종속성 미충족: ${dep.dependencyErrors.filter((r) => !r.satisfied).map((r) => r.id).join(', ')}`;
        appLogger.warn('Plugin', `종속 플러그인 "${dep.manifest.name}"의 필수 종속성(${p.manifest.name}) 비활성화로 작동이 중단되었습니다.`);
        this.emitLifecycle('deactivated', dep.manifest.id, dep.manifest);
      }
    } else if (p.scriptContent) {
      await this.loadAndActivateScriptPlugin(p, p.scriptContent);
      this.emitLifecycle('activated', pluginId, p.manifest);
      await this.retryActivatingDependents(pluginId);
    }

    this.notify();
    this.triggerLint();
  }

  /**
   * 플러그인 생명주기(활성화, 비활성화, 설치, 삭제) 이벤트 리스너를 등록합니다.
   */
  onDidPluginChange(listener: (event: PluginLifecycleEvent) => void): () => void {
    this.pluginLifecycleListeners.add(listener);
    return () => this.pluginLifecycleListeners.delete(listener);
  }

  private emitLifecycle(action: PluginLifecycleAction, pluginId: string, manifest?: PluginManifest) {
    const m: PluginManifest = manifest || this.plugins.get(pluginId)?.manifest || {
      id: pluginId,
      name: pluginId,
      version: '0.0.0',
      description: '',
      author: '',
    };
    const event: PluginLifecycleEvent = { action, pluginId, manifest: m };
    this.pluginLifecycleListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn(`[PluginManager] plugin lifecycle listener error:`, err);
      }
    });
  }

  isEnabled(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.enabled ?? false;
  }

  async deletePlugin(pluginId: string): Promise<boolean> {
    const p = this.plugins.get(pluginId);
    if (!p) return false;

    if (p.enabled) {
      await this.togglePlugin(pluginId, false);
    }

    if (platform().deleteEntry) {
      try {
        await platform().deleteEntry!(p.path || pluginId);
      } catch (err) {
        this.showToast(`플러그인 삭제 실패: ${err}`, 'error');
        return false;
      }
    }

    this.plugins.delete(pluginId);
    this.pluginApis.delete(pluginId);
    if (this.githubSources.has(pluginId)) {
      this.githubSources.delete(pluginId);
      this.saveGitHubSources();
    }

    const storedOrder = this.getStoredPluginOrder().filter((id) => id !== pluginId);
    this.saveStoredPluginOrder(storedOrder);

    try {
      const savedStates: Record<string, boolean> = JSON.parse(
        localStorage.getItem(STORAGE_ENABLED_PLUGINS) || '{}',
      );
      delete savedStates[pluginId];
      localStorage.setItem(STORAGE_ENABLED_PLUGINS, JSON.stringify(savedStates));
    } catch { }

    this.notify();
    this.emitLifecycle('uninstalled', pluginId, p.manifest);
    this.showToast(`플러그인 "${p.manifest.name}"이(가) 삭제되었습니다.`, 'info');
    return true;
  }

  /**
   * 플러그인 ZIP 압축 바이트 배열로부터 플러그인을 검증하고 시스템에 설치합니다.
   */
  async installPluginFromBytes(
    bytes: Uint8Array,
    sourceMeta?: { owner: string; repo: string; url: string },
  ): Promise<PluginManifest | null> {
    appLogger.info('Plugin', `플러그인 압축 파일 분석 중... (${(bytes.byteLength / 1024).toFixed(1)} KB)`);
    let extracted: ExtractedPlugin;
    try {
      extracted = validatePluginZip(bytes);
    } catch (err: any) {
      const msg = err?.message || '유효하지 않은 플러그인 압축파일입니다.';
      appLogger.error('Plugin', `플러그인 압축 파일 검증 실패: ${msg}`);
      this.showToast(msg, 'error');
      return null;
    }

    const { manifest, files, manifestJson, scriptContent } = extracted;
    appLogger.info('Plugin', `플러그인 패키지 확인 완료: "${manifest.name}" (ID: ${manifest.id}, v${manifest.version})`);
    const isAlreadyInstalled = this.plugins.has(manifest.id);
    const prevOrder = this.getPluginOrder();

    const textFiles: Record<string, string> = {};
    const textDecoder = new TextDecoder('utf-8');
    for (const [relPath, fileData] of Object.entries(files)) {
      try {
        textFiles[relPath] = textDecoder.decode(fileData);
      } catch {}
    }

    if (platform().kind === 'desktop' && platform().getPluginsDir && platform().writeBinaryFile) {
      try {
        const pluginsDir = await platform().getPluginsDir!();
        const baseFolder = `${pluginsDir.replace(/\\/g, '/')}/${manifest.id}`;

        // 플러그인 업데이트 시 파일명 변경 등으로 인한 구버전 잔여 파일이 남지 않도록 기존 폴더를 먼저 제거 후 재설치
        if (platform().deleteEntry) {
          try {
            await platform().deleteEntry!(baseFolder);
          } catch {}
        }

        for (const [relPath, fileData] of Object.entries(files)) {
          const fullPath = `${baseFolder}/${relPath}`;
          await platform().writeBinaryFile!(fullPath, fileData);
        }
        appLogger.info('Plugin', `플러그인 파일 설치 완료: ${baseFolder} (${Object.keys(files).length}개 파일 저장됨)`);
      } catch (err) {
        appLogger.error('Plugin', `플러그인 파일 저장 실패: ${err}`);
        this.showToast(`플러그인 파일 저장 실패: ${err}`, 'error');
        return null;
      }
    } else if (platform().saveDiskPlugin) {
      try {
        await platform().saveDiskPlugin!(manifest.id, manifestJson, scriptContent, textFiles);
        appLogger.info('Plugin', `플러그인 저장 완료 (웹 스토리지): ${manifest.id}`);
      } catch (err) {
        appLogger.error('Plugin', `플러그인 저장 실패: ${err}`);
        this.showToast(`플러그인 저장 실패: ${err}`, 'error');
        return null;
      }
    }

    // GitHub 출처 정보 등록 및 갱신
    if (sourceMeta) {
      this.githubSources.set(manifest.id, {
        owner: sourceMeta.owner,
        repo: sourceMeta.repo,
        url: sourceMeta.url,
        installedVersion: manifest.version,
        lastCheckedVersion: manifest.version,
        updateAvailable: false,
        checkedAt: Date.now(),
      });
      this.saveGitHubSources();
    } else {
      const existingSource = this.githubSources.get(manifest.id);
      if (existingSource) {
        existingSource.installedVersion = manifest.version;
        existingSource.updateAvailable = false;
        this.saveGitHubSources();
      }
    }

    await this.init();

    if (!isAlreadyInstalled) {
      // 신규 추가된 플러그인은 항상 플러그인 목록의 맨 밑(끝)에 위치하도록 보장
      const order = prevOrder.filter((id) => id !== manifest.id);
      order.push(manifest.id);
      for (const id of this.plugins.keys()) {
        if (!order.includes(id)) {
          order.push(id);
        }
      }
      this.saveStoredPluginOrder(order);
      this.activityBar?.reorderDynamicTabs(order);
      this.notify();
    }

    if (!this.isEnabled(manifest.id)) {
      await this.togglePlugin(manifest.id, true);
    }

    this.emitLifecycle('installed', manifest.id, manifest);
    return manifest;
  }

  /**
   * 로컬 .zip 압축파일을 선택받아 플러그인을 설치합니다.
   */
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

    const manifest = await this.installPluginFromBytes(bytes);
    if (!manifest) return false;

    const extraNote = platform().kind === 'web'
      ? ' (브라우저 저장소에 설치되었습니다)'
      : '';
    this.showToast(`플러그인 "${manifest.name}" 설치가 완료되었습니다!${extraNote}`, 'info');
    return true;
  }

  /**
   * GitHub 저장소 또는 Release 링크로부터 플러그인을 다운로드하여 설치합니다.
   */
  async installPluginFromGitHub(urlStr: string): Promise<boolean> {
    appLogger.info('Plugin', `GitHub 플러그인 추가 시도: "${urlStr}"`);
    const ref = parseGitHubUrl(urlStr);
    if (!ref) {
      appLogger.warn('Plugin', `GitHub 링크 형식이 올바르지 않습니다: "${urlStr}"`);
      this.showToast('올바른 GitHub 저장소 링크를 입력해주세요 (예: https://github.com/owner/repo 또는 owner/repo)', 'warn');
      return false;
    }

    appLogger.info('Plugin', `GitHub 저장소 확인: ${ref.owner}/${ref.repo}${ref.tag ? ` (지정: ${ref.tag})` : ''}`);
    this.showToast(`GitHub 릴리스 정보 확인 중... (${ref.owner}/${ref.repo})`, 'info');

    let releaseInfo: GitHubPluginReleaseInfo;
    try {
      releaseInfo = await fetchGitHubPluginRelease(ref);
      appLogger.info(
        'Plugin',
        `GitHub 릴리스 정보 조회 완료: v${releaseInfo.version} (${releaseInfo.isArchiveFallback ? '브랜치 아카이브' : 'Releases 에셋'}) - URL: ${releaseInfo.zipUrl}`,
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      appLogger.error('Plugin', `GitHub 릴리스 확인 실패: ${msg}`);
      this.showToast(`GitHub 릴리스 확인 실패: ${msg}`, 'error');
      return false;
    }

    this.showToast(`플러그인 다운로드 중... (v${releaseInfo.version})`, 'info');
    appLogger.info('Plugin', `플러그인 ZIP 다운로드 시작: ${releaseInfo.zipUrl}`);

    let bytes: Uint8Array;
    try {
      bytes = await downloadZipBytes(releaseInfo.zipUrl);
      appLogger.info('Plugin', `플러그인 다운로드 완료: ${(bytes.byteLength / 1024).toFixed(1)} KB 수신`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      appLogger.error('Plugin', `다운로드 실패: ${msg}`);
      this.showToast(`다운로드 실패: ${msg}`, 'error');
      return false;
    }

    const manifest = await this.installPluginFromBytes(bytes, {
      owner: ref.owner,
      repo: ref.repo,
      url: urlStr.trim(),
    });

    if (!manifest) {
      appLogger.error('Plugin', '플러그인 설치 작업 중단됨');
      return false;
    }

    appLogger.info('Plugin', `GitHub 플러그인 "${manifest.name}" (v${manifest.version}) 설치 완료!`);
    this.showToast(`GitHub 플러그인 "${manifest.name}" (v${manifest.version}) 설치가 완료되었습니다!`, 'info');
    return true;
  }

  /**
   * GitHub 출처가 등록된 플러그인들의 최신 버전을 비동기로 확인합니다.
   */
  async checkPluginUpdates(): Promise<void> {
    if (this.isCheckingUpdates || this.githubSources.size === 0) return;
    this.isCheckingUpdates = true;

    let changed = false;
    try {
      for (const [pluginId, source] of Array.from(this.githubSources.entries())) {
        if (!this.plugins.has(pluginId)) {
          this.githubSources.delete(pluginId);
          changed = true;
          continue;
        }

        const inst = this.plugins.get(pluginId)!;
        source.installedVersion = inst.manifest.version;

        const update = await checkGitHubPluginUpdate(source);
        if (update) {
          if (
            source.updateAvailable !== update.updateAvailable ||
            source.lastCheckedVersion !== update.latestVersion
          ) {
            source.updateAvailable = update.updateAvailable;
            source.lastCheckedVersion = update.latestVersion;
            source.latestZipUrl = update.zipUrl;
            source.checkedAt = Date.now();
            changed = true;
            if (update.updateAvailable) {
              appLogger.info(
                'Plugin',
                `플러그인 "${inst.manifest.name}" 새 업데이트 발견: v${source.installedVersion} -> v${update.latestVersion}`,
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn('[PluginManager] Failed to check plugin updates:', err);
    } finally {
      this.isCheckingUpdates = false;
      if (changed) {
        this.saveGitHubSources();
        this.notify();
      }
    }
  }

  /**
   * GitHub 출처 플러그인을 최신 릴리스 버전으로 자동 업데이트합니다.
   */
  async updatePluginFromGitHub(pluginId: string): Promise<boolean> {
    const source = this.githubSources.get(pluginId);
    if (!source) {
      this.showToast('GitHub 출처 정보가 없는 플러그인입니다.', 'warn');
      return false;
    }

    const inst = this.plugins.get(pluginId);
    const pluginName = inst?.manifest.name || pluginId;

    appLogger.info('Plugin', `플러그인 "${pluginName}" GitHub 업데이트 시작 (${source.owner}/${source.repo})`);
    this.showToast(`"${pluginName}" 최신 업데이트 다운로드 중...`, 'info');

    try {
      const release = await fetchGitHubPluginRelease({ owner: source.owner, repo: source.repo });
      const bytes = await downloadZipBytes(release.zipUrl);
      const manifest = await this.installPluginFromBytes(bytes, {
        owner: source.owner,
        repo: source.repo,
        url: source.url,
      });

      if (manifest) {
        appLogger.info('Plugin', `"${manifest.name}" 플러그인이 v${manifest.version}(으)로 성공적으로 업데이트되었습니다.`);
        this.showToast(`"${manifest.name}" 플러그인이 v${manifest.version}(으)로 성공적으로 업데이트되었습니다!`, 'info');
        return true;
      }
      return false;
    } catch (err: any) {
      const msg = err?.message || String(err);
      appLogger.error('Plugin', `업데이트 실패: ${msg}`);
      this.showToast(`업데이트 실패: ${msg}`, 'error');
      return false;
    }
  }

  /**
   * 플러그인 인스턴스를 반환합니다.
   */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 플러그인이 외부에 노출한 API 객체를 반환합니다.
   */
  getPluginApi<T = any>(pluginId: string): T | undefined {
    return this.pluginApis.get(pluginId);
  }

  /**
   * 플러그인의 공개 API 등록 여부를 확인합니다.
   */
  hasPluginApi(pluginId: string): boolean {
    return this.pluginApis.has(pluginId);
  }

  /**
   * 플러그인의 종속성 상태(충족 여부, 누락 항목, 버전 불일치)를 검사합니다.
   */
  checkPluginDependencies(pluginId: string): DependencyCheckResult[] {
    const p = this.plugins.get(pluginId);
    return p ? checkAllDependencies(p.manifest, (id) => this.plugins.get(id)) : [];
  }

  /**
   * 특정 플러그인을 종속성으로 선언하고 있는 활성화된 플러그인 목록을 반환합니다.
   */
  getActiveDependents(pluginId: string): PluginInstance[] {
    const list: PluginInstance[] = [];
    for (const p of this.plugins.values()) {
      if (p.enabled && p.manifest.dependencies && pluginId in p.manifest.dependencies) {
        list.push(p);
      }
    }
    return list;
  }

  /**
   * 플러그인 종속성을 설치하거나 활성화합니다.
   * 로컬에 이미 있으나 비활성화된 경우 활성화하고, GitHub URL이 지정된 경우 다운로드하여 설치합니다.
   */
  async installDependency(dependencyId: string, spec?: string): Promise<boolean> {
    const existing = this.plugins.get(dependencyId);
    if (existing) {
      if (!existing.enabled) {
        await this.togglePlugin(dependencyId, true);
        return true;
      }
      return true;
    }

    let targetSpec = spec;
    if (!targetSpec) {
      for (const p of this.plugins.values()) {
        if (p.manifest.dependencies && p.manifest.dependencies[dependencyId]) {
          targetSpec = p.manifest.dependencies[dependencyId];
          break;
        }
      }
    }

    if (!targetSpec) {
      appLogger.warn('Plugin', `종속성 "${dependencyId}"의 설치 출처(GitHub URL)를 찾을 수 없습니다.`);
      return false;
    }

    const parsed = parseDependencySpec(dependencyId, targetSpec);
    if (parsed.gitHubUrl) {
      appLogger.info('Plugin', `종속성 "${dependencyId}" 다운로드 및 설치 시작: ${parsed.gitHubUrl}`);
      const ok = await this.installPluginFromGitHub(parsed.gitHubUrl);
      if (ok) {
        await this.retryActivatingDependents(dependencyId);
      }
      return ok;
    }

    appLogger.warn('Plugin', `종속성 "${dependencyId}"에 유효한 GitHub URL이 지정되지 않았습니다: ${targetSpec}`);
    return false;
  }

  /**
   * 종속성 미충족으로 대기 중이던 플러그인들의 재활성화를 시도합니다.
   */
  private async retryActivatingDependents(activatedPluginId: string): Promise<void> {
    for (const p of this.plugins.values()) {
      if (
        p.enabled &&
        !p.instance &&
        p.scriptContent &&
        p.manifest.dependencies &&
        activatedPluginId in p.manifest.dependencies
      ) {
        const checkResults = checkAllDependencies(p.manifest, (id) => this.plugins.get(id));
        if (checkResults.every((r) => r.satisfied)) {
          p.dependencyErrors = undefined;
          p.error = undefined;
          await this.loadAndActivateScriptPlugin(p, p.scriptContent);
        }
      }
    }
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
      icon = optionsOrId.icon?.trim() || 'puzzle';
      author = optionsOrId.author?.trim() || '사용자';
      location = optionsOrId.location?.trim() || '좌측 사이드바 탭';
      description = optionsOrId.description?.trim() || '사용자 정의 플러그인입니다.';
    } else {
      rawId = optionsOrId;
      name = nameArg;
      icon = 'puzzle';
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
        const prevOrder = this.getPluginOrder();
        await platform().saveDiskPlugin!(cleanId, JSON.stringify(manifest, null, 2), starterScript);
        this.showToast(`플러그인 "${manifest.name}"이(가) 생성되었습니다.`, 'info');
        await this.init();

        const order = prevOrder.filter((id) => id !== cleanId);
        order.push(cleanId);
        for (const id of this.plugins.keys()) {
          if (!order.includes(id)) {
            order.push(id);
          }
        }
        this.saveStoredPluginOrder(order);
        this.activityBar?.reorderDynamicTabs(order);
        this.notify();

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
      onRegisterCleanup: (fn: () => void) => void;
      onRemoveCleanup: (fn: () => void) => void;
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
        setText: (text: string) => {
          const model = this.editor.getModel();
          if (model) {
            this.editor.pushUndoStop();
            this.editor.executeEdits('plugin', [{ range: model.getFullModelRange(), text }]);
            this.editor.pushUndoStop();
          } else {
            this.editor.setValue(text);
          }
        },
        getLine: (lineNumber: number) => {
          return this.editor.getModel()?.getLineContent(lineNumber) ?? '';
        },
        getLineCount: () => {
          return this.editor.getModel()?.getLineCount() ?? 1;
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
        onDidChangeText: (listener: (text: string) => void) => {
          const disp = this.editor.onDidChangeModelContent(() => {
            listener(this.editor.getValue());
          });
          const cleanup = () => disp.dispose();
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        onDidChangeCursor: (listener: (cursor: { lineNumber: number; column: number }) => void) => {
          const disp = this.editor.onDidChangeCursorPosition((e) => {
            listener({ lineNumber: e.position.lineNumber, column: e.position.column });
          });
          const cleanup = () => disp.dispose();
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerContextMenuAction: (options: {
          id: string;
          label: string;
          contextMenuGroupId?: string;
          contextMenuOrder?: number;
          onClick: () => void;
        }) => {
          const action = this.editor.addAction({
            id: `plugin-${manifest.id}-${options.id}`,
            label: options.label,
            contextMenuGroupId: options.contextMenuGroupId || 'navigation',
            contextMenuOrder: options.contextMenuOrder,
            run: () => options.onClick(),
          });
          const cleanup = () => action.dispose();
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerCustomViewer: (viewer: CustomViewerDefinition) => {
          callbacks.onRegisterCustomViewer(viewer);
        },
        registerLintRule: (rule: CustomLintRule) => {
          const ruleKey = `${manifest.id}:${rule.id}`;
          this.customLintRules.set(ruleKey, rule);
          this.triggerLint();
          const cleanup = () => {
            this.customLintRules.delete(ruleKey);
            this.triggerLint();
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerDefinitionProvider: (provider: CustomDefinitionProvider) => {
          const cleanup = this.registerDefinitionProvider(provider);
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerReferenceProvider: (provider: CustomReferenceProvider) => {
          const cleanup = this.registerReferenceProvider(provider);
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        proposeChanges: async (newText: string, options?: ProposeChangesOptions): Promise<ProposeChangesResult> => {
          return await proposeEditorChanges(this.editor, newText, options, this.doc.currentTabId);
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
        openFile: async (pathOrName: string, line?: number, col?: number) => {
          const clean = pathOrName.replace(/\\/g, '/');
          const base = clean.split('/').pop() || clean;
          const openTab = this.doc.allTabs.find((t) => {
            if (t.file && t.file.id.replace(/\\/g, '/') === clean) return true;
            if (t.file && t.file.id.replace(/\\/g, '/').endsWith(`/${clean}`)) return true;
            if (t.title === base || t.title === pathOrName) return true;
            return false;
          });

          if (openTab) {
            this.doc.switchTab(openTab.id);
          } else {
            let ref = this.explorer && this.explorer.hasFolder ? this.explorer.getFileRef(pathOrName) : null;
            if (!ref) {
              ref = platform().refFromId(pathOrName);
            }
            await this.doc.openFile(ref);
          }

          if (typeof line === 'number') {
            this.editor.setPosition({ lineNumber: line, column: col || 1 });
            this.editor.revealLineInCenter(line);
            this.editor.focus();
            flashLineHighlight(this.editor, line);
          }
        },
        saveCurrentFile: async () => {
          await this.doc.save();
        },
        readTextFile: async (path: string) => {
          const ref = platform().refFromId(path);
          const loaded = await platform().readFile(ref);
          return loaded.text;
        },
        writeTextFile: async (path: string, text: string) => {
          const ref = platform().refFromId(path);
          await platform().writeFile(ref, text, 'utf-8', { enabled: false, keepDays: 0, maxPerFile: 0 });
          this.doc.notifyFileSaved(path, ref.name);
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
          } else {
            const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = path.split(/[\/\\]/).pop() || 'download.bin';
            a.click();
            URL.revokeObjectURL(url);
          }
        },
        readDirectory: async (dirPath?: string) => {
          const target = dirPath || (this.explorer && this.explorer.hasFolder ? (this.explorer as any).currentFolder?.id : null);
          if (!target) return [];
          try {
            return await platform().readDirectory(target);
          } catch {
            return [];
          }
        },
        pickFile: async () => {
          const picked = await platform().pickOpen();
          return picked ? picked.id : null;
        },
        showInFolder: async (path: string) => {
          if (platform().showInFolder) {
            await platform().showInFolder!(path);
          }
        },
        onDidChangeActiveFile: (listener: (file: { name: string; path: string; location: string } | null) => void) => {
          const unlisten = this.doc.onChange(() => {
            const file = this.doc.file;
            listener(file ? { name: this.doc.fileName, path: file.id, location: file.location } : null);
          });
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        onDidChangeActiveFolder: (listener: (folder: string | null) => void) => {
          if (!this.explorer || typeof (this.explorer as any).onDidChangeFolder !== 'function') {
            return () => {};
          }
          const unlisten = (this.explorer as any).onDidChangeFolder((folder: any) => {
            listener(folder ? folder.id : null);
          });
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        onDidSaveFile: (listener: (file: { path: string; name: string }) => void) => {
          const unlisten = this.doc.onDidSaveFile(listener);
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        onDidCloseTab: (listener: (tab: { tabId: string; filePath: string | null; title: string }) => void) => {
          const unlisten = this.doc.onDidCloseTab(listener);
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        onDidClearMemory: (listener: (event: { reason: 'folder_closed' | 'folder_changed' | 'reset' }) => void) => {
          const unlisten = this.doc.onDidResetWorkspace(listener);
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        onDidResetWorkspace: (listener: (event: { reason: 'folder_closed' | 'folder_changed' | 'reset' }) => void) => {
          const unlisten = this.doc.onDidResetWorkspace(listener);
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        findFiles: async (globPattern: string, options?: { cwd?: string; maxResults?: number }): Promise<string[]> => {
          const targetCwd = options?.cwd || (this.explorer && this.explorer.hasFolder ? (this.explorer as any).currentFolder?.id : null);
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
        search: async (query: string, options?: WorkspaceSearchOptions): Promise<WorkspaceSearchResult[]> => {
          if (!query) return [];
          const regex = buildSearchRegex(query, {
            matchCase: options?.caseSensitive,
            wholeWord: options?.wholeWord,
            isRegex: options?.isRegex,
          });

          const results: WorkspaceSearchResult[] = [];
          const scannedTabFileIds = new Set<string>();
          const scannedNames = new Set<string>();

          // 1. Search Open Tabs
          for (const tab of this.doc.allTabs) {
            const tabName = tab.title || '이름 없음';
            if (tab.file?.id) scannedTabFileIds.add(tab.file.id);
            scannedNames.add(tabName.toLowerCase());

            const displayPath = tab.file?.location || tab.file?.id || tabName;
            if (options?.includePatterns && !options.includePatterns.some((p) => matchesPattern(displayPath, p) || matchesPattern(tabName, p))) continue;
            if (options?.excludePatterns && options.excludePatterns.some((p) => matchesPattern(displayPath, p) || matchesPattern(tabName, p))) continue;

            const text = tab.model.getValue();
            const matches = searchInText(text, regex);
            for (const m of matches) {
              results.push({
                filePath: displayPath,
                fileName: tabName,
                line: m.lineNumber,
                column: m.startColumn,
                lineContent: m.lineContent,
                matchedText: m.matchedText,
              });
            }
          }

          // 2. Search Explorer files
          if (this.explorer && this.explorer.hasFolder) {
            const allFiles = this.explorer.getAllFiles();
            for (const fileInfo of allFiles) {
              if (fileInfo.fileRef.id && scannedTabFileIds.has(fileInfo.fileRef.id)) continue;
              if (scannedNames.has(fileInfo.name.toLowerCase())) {
                const isOpen = this.doc.allTabs.some(
                  (t) => t.file?.id === fileInfo.fileRef.id || t.title === fileInfo.name || t.file?.name === fileInfo.name,
                );
                if (isOpen) continue;
              }

              const ext = fileInfo.relPath.split('.').pop()?.toLowerCase() ?? '';
              if (SEARCH_BINARY_EXTENSIONS.has(ext)) continue;

              if (options?.includePatterns && !options.includePatterns.some((p) => matchesPattern(fileInfo.relPath, p) || matchesPattern(fileInfo.name, p))) continue;
              if (options?.excludePatterns && options.excludePatterns.some((p) => matchesPattern(fileInfo.relPath, p) || matchesPattern(fileInfo.name, p))) continue;

              try {
                const loaded = await platform().readFile(fileInfo.fileRef);
                if (!loaded || typeof loaded.text !== 'string') continue;
                const matches = searchInText(loaded.text, regex);
                for (const m of matches) {
                  results.push({
                    filePath: fileInfo.relPath,
                    fileName: fileInfo.name,
                    line: m.lineNumber,
                    column: m.startColumn,
                    lineContent: m.lineContent,
                    matchedText: m.matchedText,
                  });
                }
              } catch {}
            }
          }

          return results;
        },
        createBackup: async (filePath?: string, label?: string): Promise<string | null> => {
          const ref = filePath
            ? (this.explorer && this.explorer.hasFolder ? this.explorer.getFileRef(filePath) : null) ?? platform().refFromId(filePath)
            : this.doc.file;
          if (!ref) return null;
          if (platform().createBackup) {
            return await platform().createBackup!(ref, label);
          }
          return null;
        },
        getOpenTabs: (): PluginTabInfo[] => {
          return this.doc.allTabs.map((t) => ({
            id: t.id,
            title: t.title,
            path: t.file?.id ?? null,
            isDirty: this.doc.isTabDirty(t),
            kind: t.kind,
            isActive: t.id === this.doc.activeTab.id,
          }));
        },
        closeTab: async (tabId: string): Promise<boolean> => {
          return await this.doc.closeTab(tabId);
        },
        focusTab: (tabId: string): void => {
          this.doc.switchTab(tabId);
        },
      },

      linter: {
        registerRule: (rule: CustomLintRule) => {
          const ruleKey = `${manifest.id}:${rule.id}`;
          this.customLintRules.set(ruleKey, rule);
          this.triggerLint();
          const cleanup = () => {
            this.customLintRules.delete(ruleKey);
            this.triggerLint();
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerDiagnosticFilter: (filter: DiagnosticFilter) => {
          this.diagnosticFilters.add(filter);
          this.triggerLint();
          const cleanup = () => {
            this.diagnosticFilters.delete(filter);
            this.triggerLint();
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerAllowedResource: (pattern: string | RegExp | ((name: string) => boolean)) => {
          const unregister = registerAllowedResource(pattern);
          const cleanup = () => {
            unregister();
            callbacks.onRemoveCleanup(cleanup);
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerAllowedVariable: (pattern: string | RegExp | ((name: string) => boolean)) => {
          const unregister = registerAllowedVariable(pattern);
          const cleanup = () => {
            unregister();
            callbacks.onRemoveCleanup(cleanup);
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerAllowedUsedResource: (pattern: string | RegExp | ((name: string) => boolean)) => {
          const unregister = registerAllowedUsedResource(pattern);
          const cleanup = () => {
            unregister();
            callbacks.onRemoveCleanup(cleanup);
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerAllowedUsedVariable: (pattern: string | RegExp | ((name: string) => boolean)) => {
          const unregister = registerAllowedUsedVariable(pattern);
          const cleanup = () => {
            unregister();
            callbacks.onRemoveCleanup(cleanup);
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerDefinitionProvider: (provider: CustomDefinitionProvider) => {
          const cleanup = this.registerDefinitionProvider(provider);
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerReferenceProvider: (provider: CustomReferenceProvider) => {
          const cleanup = this.registerReferenceProvider(provider);
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
      },

      languages: {
        registerDefinitionProvider: (provider: CustomDefinitionProvider) => {
          const cleanup = this.registerDefinitionProvider(provider);
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
        registerReferenceProvider: (provider: CustomReferenceProvider) => {
          const cleanup = this.registerReferenceProvider(provider);
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
      },

      templates: {
        registerTemplate: (template: PluginTemplate) => {
          const unregister = registerPluginTemplate(template);
          const cleanup = () => {
            unregister();
          };
          callbacks.onRegisterCleanup(cleanup);
          return cleanup;
        },
      },

      ini: {
        parse: (text?: string) => parseIni(text !== undefined ? text : this.editor.getValue()),
        classifySection: (name: string) => classifyIniSection(name),
        merge: (targetText: string, sourceText: string, options?: { appendNew?: boolean }) =>
          mergeIniSections(targetText, sourceText, options),
        formatSection: (
          name: string,
          properties: Record<string, string>,
          options?: { comments?: string[]; variables?: Record<string, string> },
        ) => formatIniSection(name, properties, options),
        formatKeyToggle: (options: {
          sectionName?: string;
          key: string;
          type?: 'cycle' | 'hold';
          states?: number | string[];
          variableName?: string;
          condition?: string;
          comments?: string[];
        }) => formatKeyToggleSection(options),
        parseKeyBinding: (text: string) => parseKeyBinding(text),
        formatKeyBinding: (options: Parameters<typeof formatKeyBinding>[0]) => formatKeyBinding(options),
        getKeyList: () => VK_KEY_LIST,
        getSections: (text?: string) => {
          const doc = parseIni(text !== undefined ? text : this.editor.getValue());
          return doc.sections;
        },
        findSection: (nameOrPattern: string | RegExp, text?: string) => {
          const doc = parseIni(text !== undefined ? text : this.editor.getValue());
          if (typeof nameOrPattern === 'string') {
            return doc.getSection(nameOrPattern);
          }
          return doc.sections.find((s) => nameOrPattern.test(s.name));
        },
        getVariables: (text?: string) => {
          const doc = parseIni(text !== undefined ? text : this.editor.getValue());
          const vars: Record<string, string> = {};
          const lines = doc.preamble.split('\n');
          for (const l of lines) {
            const m = l.match(/^\s*(\$[a-zA-Z0-9_]+)\s*=\s*([^;\r\n]*)/);
            if (m) vars[m[1]] = m[2].trim();
          }
          for (const sec of doc.sections) {
            Object.assign(vars, sec.variables);
          }
          return vars;
        },
        upsertSection: (
          name: string,
          properties: Record<string, string>,
          options?: { comments?: string[]; variables?: Record<string, string>; replaceExisting?: boolean },
        ) => {
          const currentText = this.editor.getValue();
          const newSectionText = formatIniSection(name, properties, options);
          const merged = mergeIniSections(currentText, newSectionText, {
            appendNew: options?.replaceExisting === false ? false : true,
          });
          const model = this.editor.getModel();
          if (model) {
            this.editor.pushUndoStop();
            this.editor.executeEdits('plugin-ini-upsert', [
              { range: model.getFullModelRange(), text: merged.newText },
            ]);
            this.editor.pushUndoStop();
          } else {
            this.editor.setValue(merged.newText);
          }
        },
        deleteSection: (name: string) => {
          const currentText = this.editor.getValue();
          const res = deleteIniSection(currentText, name);
          if (res.deleted) {
            const model = this.editor.getModel();
            if (model) {
              this.editor.pushUndoStop();
              this.editor.executeEdits('plugin-ini-delete', [
                { range: model.getFullModelRange(), text: res.newText },
              ]);
              this.editor.pushUndoStop();
            } else {
              this.editor.setValue(res.newText);
            }
          }
          return res.deleted;
        },
        extractSymbols: (text?: string): IniSymbolsResult => {
          const rawText = text !== undefined ? text : this.editor.getValue();
          const lines = rawText.split('\n');
          const modelLike = {
            getLineCount: () => lines.length,
            getLineContent: (n: number) => lines[n - 1] ?? '',
          };
          const syms = extractSymbols(modelLike);
          const variables: Record<string, string> = {};
          syms.variables.forEach((v, k) => {
            variables[k] = v;
          });
          return {
            variables,
            resources: syms.resources,
            commandLists: syms.commandLists,
            sections: syms.sections,
          };
        },
        formatDisplayKey: (rawKey?: string | null) => formatDisplayKey(rawKey),
        getSectionRaw: (sectionName: string, text?: string) =>
          getSectionRaw(text !== undefined ? text : this.editor.getValue(), sectionName),
        setSectionRaw: (sectionName: string, rawContent: string) => {
          const currentText = this.editor.getValue();
          const newText = setSectionRaw(currentText, sectionName, rawContent);
          const model = this.editor.getModel();
          if (model) {
            this.editor.pushUndoStop();
            this.editor.executeEdits('plugin-ini-set-raw', [
              { range: model.getFullModelRange(), text: newText },
            ]);
            this.editor.pushUndoStop();
          } else {
            this.editor.setValue(newText);
          }
        },
        parseSectionLines: (sectionNameOrBlock: string, text?: string) => {
          if (text !== undefined) {
            return parseSectionLines(text, sectionNameOrBlock);
          }
          if (sectionNameOrBlock.includes('\n') || /^\s*\[/.test(sectionNameOrBlock)) {
            return parseSectionLines(sectionNameOrBlock);
          }
          return parseSectionLines(this.editor.getValue(), sectionNameOrBlock);
        },
      },

      ui: {
        ...createUIBuilder(),
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
        openTab: (options: {
          id: string;
          title: string;
          icon?: string;
          render: (container: HTMLElement) => void | (() => void);
        }) => {
          const tabId = `plugin_${manifest.id}_${options.id}`;
          this.doc.openCustomTab({
            id: tabId,
            title: options.title,
            icon: options.icon ?? manifest.icon,
            render: (rootContainer) => {
              const tabBody = document.createElement('div');
              tabBody.className = 'migoto-tab-editor-content plugin-tab-editor-content';
              tabBody.style.cssText =
                'height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden; position: relative; box-sizing: border-box; flex: 1 1 0; min-height: 0; min-width: 0; padding: 8px 10px;';
              rootContainer.replaceChildren(tabBody);
              return options.render(tabBody);
            },
          });

          const close = () => {
            this.doc.closeTab(tabId);
          };
          const focus = () => {
            this.doc.switchTab(tabId);
          };

          const cleanup = () => {
            close();
          };
          callbacks.onRegisterCleanup(cleanup);

          return { close, focus };
        },
        openFormTab: (options: {
          id: string;
          title: string;
          icon?: string;
          form: FormConfig;
        }) => {
          let formInstance: FormInstance | null = null;
          const tabId = `plugin_${manifest.id}_${options.id}`;
          this.doc.openCustomTab({
            id: tabId,
            title: options.title,
            icon: options.icon ?? manifest.icon,
            render: (container: HTMLElement) => {
              container.className = 'plugin-form-tab-container';
              const builder = createUIBuilder();
              formInstance = builder.createForm(options.form);
              container.replaceChildren(formInstance.element);
              return () => {
                formInstance = null;
              };
            },
          });

          const close = () => {
            this.doc.closeTab(tabId);
          };
          const focus = () => {
            this.doc.switchTab(tabId);
          };

          const cleanup = () => {
            close();
          };
          callbacks.onRegisterCleanup(cleanup);

          return {
            close,
            focus,
            getValues: () => formInstance?.getValues() ?? {},
            setValues: (vals: Record<string, any>) => formInstance?.setValues(vals),
            reset: () => formInstance?.reset(),
          };
        },
        registerMenuItem: (options: {
          label: string;
          shortcut?: string;
          action: () => void;
        }) => {
          const itemDef: PluginMenuItemDef = {
            label: options.label,
            shortcut: options.shortcut,
            action: options.action,
          };

          let group = this.pluginMenuItems.get(manifest.id);
          if (!group) {
            group = { manifest, items: [] };
            this.pluginMenuItems.set(manifest.id, group);
          }
          group.items.push(itemDef);
          this.notify();

          const unregister = () => {
            const g = this.pluginMenuItems.get(manifest.id);
            if (g) {
              g.items = g.items.filter((it) => it !== itemDef);
              if (g.items.length === 0) {
                this.pluginMenuItems.delete(manifest.id);
              }
              this.notify();
            }
          };
          callbacks.onRegisterCleanup(unregister);
          return unregister;
        },
        openDiffTab: (options: PluginDiffOptions) => {
          const diffTab = this.doc.openDiffTab({
            title: options.title,
            originalTitle: options.originalTitle,
            modifiedTitle: options.modifiedTitle,
            originalText: options.originalText,
            modifiedText: options.modifiedText,
            languageId: options.languageId,
          });

          const close = () => {
            this.doc.closeTab(diffTab.id);
          };
          const focus = () => {
            this.doc.switchTab(diffTab.id);
          };

          const cleanup = () => {
            close();
          };
          callbacks.onRegisterCleanup(cleanup);

          return { id: diffTab.id, close, focus };
        },
        openRestoreModal: (filePath?: string) => {
          const ref = filePath
            ? (this.explorer && this.explorer.hasFolder ? this.explorer.getFileRef(filePath) : null) ?? platform().refFromId(filePath)
            : null;
          openRestore(this.doc, ref);
        },
        confirm: (options: ConfirmOptions) => openConfirmModal(options),
        prompt: (options: PromptOptions) => openPromptModal(options),
        openSubWindow: (options: SubWindowOptions) => {
          return subWindowManager.openSubWindow(manifest.id, options, callbacks.onRegisterCleanup);
        },
        openNativeWindow: (options: NativeWindowOptions) => {
          return nativeWindowManager.openNativeWindow(manifest.id, options, callbacks.onRegisterCleanup);
        },
        getTheme: (): 'dark' | 'light' => {
          return getSettings().theme || 'dark';
        },
        onDidChangeTheme: (listener: (event: { theme: 'dark' | 'light' }) => void) => {
          let lastTheme = getSettings().theme || 'dark';
          const unlisten = onSettingsChange((s) => {
            const currentTheme = s.theme || 'dark';
            if (currentTheme !== lastTheme) {
              lastTheme = currentTheme;
              listener({ theme: currentTheme });
            }
          });
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
      },

      slots: {
        getSlots: () => slotManager.getSlots(),
        getSlot: (part: string) => slotManager.getSlot(part),
        onDidChangeSlots: (listener: (slots: ModelSlot[]) => void) => {
          const unlisten = slotManager.onDidChangeSlots(listener);
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        refreshSlots: async () => {
          const res = await slotManager.analyzeWorkspace(this.doc, this.explorer);
          return res.slots;
        },
        setPartMapping: (sectionName: string, part: string) => {
          slotManager.setPartMapping(sectionName, part);
        },
        setTextureSlot: (sectionName: string, slotId: string, textureFile: string, slotType?: any) => {
          slotManager.setTextureSlot(sectionName, slotId, textureFile, slotType);
        },
        removeTextureSlot: (sectionName: string, slotId: string) => {
          slotManager.removeTextureSlot(sectionName, slotId);
        },
        getDetectedTextureFiles: () => slotManager.getDetectedTextureFiles(),
        registerTextureSlotResolver: (resolver: TextureSlotResolver) => {
          const unregister = slotManager.registerTextureSlotResolver(resolver);
          callbacks.onRegisterCleanup(unregister);
          return unregister;
        },
      },

      plugins: {
        getPlugins: () => {
          return Array.from(this.plugins.values()).map((p) => ({
            id: p.manifest.id,
            name: p.manifest.name,
            version: p.manifest.version,
            enabled: p.enabled,
            isBuiltin: p.isBuiltin,
          }));
        },
        isEnabled: (pluginId: string) => this.isEnabled(pluginId),
        onDidChangePlugins: (listener: (event: PluginLifecycleEvent) => void) => {
          const unlisten = this.onDidPluginChange(listener);
          callbacks.onRegisterCleanup(unlisten);
          return unlisten;
        },
        installFromGitHub: (url: string) => this.installPluginFromGitHub(url),
        checkUpdates: () => this.checkPluginUpdates(),
        getGitHubSource: (pluginId: string) => this.getGitHubSource(pluginId),
        registerApi: (api: any) => {
          this.pluginApis.set(manifest.id, api);
        },
        getPluginApi: <T = any>(targetId: string): T | undefined => {
          return this.getPluginApi<T>(targetId);
        },
        hasPluginApi: (targetId: string) => this.hasPluginApi(targetId),
        checkDependencies: (targetId: string) => this.checkPluginDependencies(targetId),
        installDependency: (dependencyId: string, spec?: string) =>
          this.installDependency(dependencyId, spec),
      },

      system: {
        exec: async (command: string, args: string[] = [], cwd?: string, stdin?: string) => {
          if (platform().execProcess) {
            return platform().execProcess!(command, args, cwd, stdin);
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

      logger: appLogger.createPluginLogger(manifest.id, manifest.name),
    };
  }
}

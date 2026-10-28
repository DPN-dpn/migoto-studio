import './style.css';
import { monaco, pruneRedundantContextActions } from './core/editor/monaco';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { initPlatform, platform } from './platform';

import { LANGUAGE_ID, registerMigotoLanguage, upstreamGrammarVersion } from './core/editor/grammar';
import { defineThemes, THEME_DARK, THEME_LIGHT } from './core/editor/theme';
import { DocumentManager, ENCODING_LABELS, type Encoding } from './core/workspace/documents';
import { TabBar } from './ui/layout/tabbar';
import { FileExplorer } from './ui/panels/explorer';
import { SearchPanel } from './ui/panels/search-panel';
import { TemplatePanel } from './ui/panels/template-panel';
import { ConsolePanel } from './ui/panels/console-panel';
import { appLogger } from './core/logger';
import { PluginManager } from './plugins';
import { PluginPanel } from './ui/panels/plugin-panel';
import { SlotMatchingPanel } from './ui/panels/slot-panel';
import { slotManager } from './core/slots/slot-manager';
import { ActivityBar } from './ui/layout/activitybar';
import { MenuBar } from './ui/layout/menubar';
import { getSettings, loadSettings, onSettingsChange } from './core/workspace/settings';
import { OutlinePanel } from './ui/panels/outline';
import { registerSnippetCompletions, initCustomTemplates } from './core/ini/templates';
import { openSettings } from './ui/modals/settings-ui';
import { openHelp } from './ui/modals/help-ui';
import { lintModel, optionsFromSettings, isAllowedResource, isAllowedVariable } from './core/ini/lint';
import { registerSmartCompletions } from './core/editor/completions';
import { registerFoldingProvider } from './core/editor/folding';
import { DiffViewer } from './ui/views/diff-viewer';
import { initInlineReview } from './core/editor/inline-review';
import { openCompareDialog } from './ui/modals/diff-dialog';
import { openKeyHelperModal } from './ui/modals/key-helper';
import {
  registerSymbolProviders,
  jumpToDefinition,
  showReferencesDialog,
  setCoreDefinitionResolver,
  setCoreReferencesResolver,
} from './core/ini/symbol-nav';
import {
  buildWorkspaceIndex,
  createCoreDefinitionProvider,
  createCoreReferenceProvider,
  checkNamespaceDiagnostics,
} from './core/workspace/namespace';
import { checkResourceFileExistence } from './core/workspace/file-check';
import { initPwa } from './pwa';
import { checkOnStartup } from './updater/updater';
import { CURRENT_APP_VERSION } from './updater/version';
import { initStatusBarWindowsMenu, nativeWindowManager, subWindowManager } from './window';

// Only the base editor worker is needed (no TS/JSON/CSS language services).
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function boot() {
  const urlParams = new URLSearchParams(window.location.search || window.location.hash.replace(/^#\??/, ''));
  if (urlParams.get('native_window') === 'true') {
    const { bootNativeWindow } = await import('./window/native-boot');
    await bootNativeWindow(urlParams);
    return;
  }

  await initPlatform();
  initPwa();
  appLogger.info('App', `Migoto Studio v${CURRENT_APP_VERSION} 시작됨 (${platform().kind} 환경)`);
  const settings = await loadSettings();
  await initCustomTemplates();

  const verBadge = $('app-version-badge');
  if (verBadge) {
    verBadge.textContent = `v${CURRENT_APP_VERSION}`;
    verBadge.title = `Migoto Studio v${CURRENT_APP_VERSION} (클릭 시 도움말 및 정보)`;
    verBadge.addEventListener('click', () => openHelp());
  }
  // Drop expired safety backups (best effort; never blocks startup).
  platform().pruneBackups({ keepDays: settings.backupKeepDays, maxPerFile: settings.backupMaxPerFile }).catch(() => {});
  defineThemes();
  await registerMigotoLanguage();
  registerSnippetCompletions();
  registerSmartCompletions();
  registerFoldingProvider(monaco);

  const editor = monaco.editor.create($('editor'), {
    value: '',
    language: LANGUAGE_ID,
    theme: settings.theme === 'dark' ? THEME_DARK : THEME_LIGHT,
    automaticLayout: true,
    fontFamily: "'Cascadia Code', 'D2Coding', Consolas, monospace",
    smoothScrolling: true,
    scrollBeyondLastLine: false,
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
      useShadows: false,
    },
  });

  // ---- 3DMigoto Key Helper Context Menu Action ----
  const isKeyLineContextKey = editor.createContextKey<boolean>('isKeyLine', false);
  const updateKeyLineContext = (lineNum?: number) => {
    const model = editor.getModel();
    if (!model) {
      isKeyLineContextKey.set(false);
      return;
    }
    const targetLine = lineNum ?? (editor.getPosition()?.lineNumber || 1);
    if (targetLine <= 0 || targetLine > model.getLineCount()) {
      isKeyLineContextKey.set(false);
      return;
    }
    const content = model.getLineContent(targetLine);
    isKeyLineContextKey.set(/^\s*key\s*=/i.test(content));
  };

  editor.onDidChangeCursorPosition((e) => {
    updateKeyLineContext(e.position.lineNumber);
  });

  editor.onContextMenu((e) => {
    if (e.target && e.target.position) {
      updateKeyLineContext(e.target.position.lineNumber);
    } else {
      updateKeyLineContext();
    }
  });

  editor.addAction({
    id: 'migoto-edit-key-binding',
    label: '3DMigoto 키 바인딩 편집 (키 도우미)...',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK],
    precondition: 'isKeyLine',
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 1,
    run: () => {
      openKeyHelperModal(editor);
    },
  });

  const doc = new DocumentManager(editor, $('custom-viewer-container'));
  initInlineReview(doc, editor);
  registerSymbolProviders(monaco, doc);
  pruneRedundantContextActions();
  const diffViewer = new DiffViewer($('diff-container'), doc);
  doc.setDiffViewer(diffViewer);
  const outline = new OutlinePanel(editor, doc, $('sidebar'), $('sidebar-panel-outline'), $('sidebar-resizer'));
  const explorer = new FileExplorer($('sidebar-panel-explorer'), doc);
  const searchPanel = new SearchPanel($('sidebar-panel-search'), doc, editor, explorer);
  new TemplatePanel($('sidebar-panel-templates'), editor, doc);

  // Core Workspace Namespace & Cross-file Navigation Providers
  const workspaceHelper = {
    readDirectory: async () => (explorer && explorer.hasFolder ? (explorer as any).readDirectory?.() ?? [] : []),
    readTextFile: async (path: string) => (explorer && explorer.hasFolder ? (explorer as any).readTextFile?.(path) ?? '' : ''),
  };
  const coreDefProvider = createCoreDefinitionProvider(workspaceHelper);
  const coreRefProvider = createCoreReferenceProvider(workspaceHelper);

  setCoreDefinitionResolver(async (target, currentModel, currentDoc) => {
    const ctx = {
      folder: explorer && explorer.hasFolder,
      file: currentDoc.file ? { path: currentDoc.file.id, name: currentDoc.fileName } : undefined,
      model: currentModel,
      getAllFiles: () => (explorer && explorer.hasFolder ? (explorer as any).getAllFiles?.() ?? [] : []),
    };
    const loc = await coreDefProvider.provideDefinition(target, ctx);
    if (!loc) return null;
    return {
      title: loc.filePath.split(/[\\/]/).pop() || loc.filePath,
      filePath: loc.filePath,
      uri: monaco.Uri.file(loc.filePath),
      range: {
        startLineNumber: loc.lineNumber,
        startColumn: loc.startColumn,
        endLineNumber: loc.lineNumber,
        endColumn: loc.endColumn,
      },
      lineContent: loc.lineContent || '',
      section: loc.section || '',
      isDefinition: true,
      kind: target.kind,
      matchedText: target.name,
    };
  });

  setCoreReferencesResolver(async (target, currentModel, currentDoc) => {
    const ctx = {
      folder: explorer && explorer.hasFolder,
      file: currentDoc.file ? { path: currentDoc.file.id, name: currentDoc.fileName } : undefined,
      model: currentModel,
      getAllFiles: () => (explorer && explorer.hasFolder ? (explorer as any).getAllFiles?.() ?? [] : []),
    };
    const locs = await coreRefProvider.provideReferences(target, ctx);
    return locs.map((loc) => ({
      title: loc.filePath.split(/[\\/]/).pop() || loc.filePath,
      filePath: loc.filePath,
      uri: monaco.Uri.file(loc.filePath),
      range: {
        startLineNumber: loc.lineNumber,
        startColumn: loc.startColumn,
        endLineNumber: loc.lineNumber,
        endColumn: loc.endColumn,
      },
      lineContent: loc.lineContent || '',
      section: loc.section || '',
      isDefinition: Boolean(loc.isDefinition),
      kind: target.kind,
      matchedText: target.name,
    }));
  });

  let activityBar: ActivityBar;

  // ---- Global Search Helper ----
  const openFindInFiles = () => {
    activityBar?.switchTo('search');
    const sel = editor.getSelection();
    const model = editor.getModel();
    let text = '';
    if (sel && model && !sel.isEmpty()) {
      text = model.getValueInRange(sel);
    }
    searchPanel.focusSearch(text);
  };

  // Global Ctrl+Shift+F shortcut
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      openFindInFiles();
    }
  });

  // ---- Symbol Navigation Actions (F12 / Shift+F12 / Ctrl+Shift+F) ----
  editor.addAction({
    id: 'migoto-go-to-definition',
    label: '정의로 이동 (Go to Definition)',
    keybindings: [monaco.KeyCode.F12],
    contextMenuGroupId: '10_navigation',
    contextMenuOrder: 1,
    run: () => {
      jumpToDefinition(editor, doc);
    },
  });

  editor.addAction({
    id: 'migoto-find-references',
    label: '참조 및 사용 위치 찾기 (Find References)...',
    keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
    contextMenuGroupId: '10_navigation',
    contextMenuOrder: 2,
    run: () => {
      showReferencesDialog(editor, doc);
    },
  });

  editor.addAction({
    id: 'migoto-find-in-files',
    label: '전체 파일에서 찾기 (Find in Files)...',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
    contextMenuGroupId: '10_navigation',
    contextMenuOrder: 3,
    run: () => {
      openFindInFiles();
    },
  });
  const pluginManager = new PluginManager(doc, editor, explorer);
  new PluginPanel($('sidebar-panel-plugins'), pluginManager);
  const slotPanel = new SlotMatchingPanel($('sidebar-panel-slots'), doc, editor, explorer);
  slotManager.attachWorkspace(doc, explorer);
  new TabBar(doc, $('tabbar'), $('btn-new-tab'), $('tab-menu'));

  // ---- Activity Bar (세로 툴바) ----
  activityBar = new ActivityBar(
    $('activity-bar'),
    $('act-explorer'),
    $('act-search'),
    $('act-outline'),
    $('act-templates'),
    $('act-plugins'),
    $('sidebar-panel-explorer'),
    $('sidebar-panel-search'),
    $('sidebar-panel-outline'),
    $('sidebar-panel-templates'),
    $('sidebar-panel-plugins'),
    outline,
    () => openSettings(),
    $('act-slots'),
    $('sidebar-panel-slots'),
  );

  pluginManager.setActivityBar(activityBar);

  // Initialize plugins
  await pluginManager.init();

  // Jump to next error/warning function
  const jumpNextLint = () => {
    if (currentMarkers.length === 0) return;
    const curPos = editor.getPosition();
    const curLine = curPos?.lineNumber ?? 1;
    const curCol = curPos?.column ?? 1;

    const next = currentMarkers.find(
      (m) => m.startLineNumber > curLine || (m.startLineNumber === curLine && m.startColumn > curCol),
    ) ?? currentMarkers[0];

    editor.setPosition({ lineNumber: next.startLineNumber, column: next.startColumn });
    editor.revealPositionInCenter({ lineNumber: next.startLineNumber, column: next.startColumn });
    editor.focus();
  };

  // ---- Console Output Panel ----
  const consolePanel = new ConsolePanel(
    $('console-panel'),
    $('console-resizer'),
    editor,
  );

  editor.addAction({
    id: 'migoto-toggle-console',
    label: '출력 콘솔창 표시/숨기기 (Toggle Console)',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote],
    run: () => consolePanel.toggle(),
  });

  // Statusbar console button
  const statusConsoleBtn = $('status-console');
  const statusConsoleText = $('status-console-text');
  statusConsoleBtn?.addEventListener('click', () => consolePanel.toggle());

  const updateStatusConsole = () => {
    const entries = appLogger.getEntries();
    const errs = entries.filter((e) => e.level === 'error').length;
    const warns = entries.filter((e) => e.level === 'warn').length;
    if (!statusConsoleBtn || !statusConsoleText) return;

    if (errs > 0) {
      statusConsoleBtn.className = 'status-btn has-error';
      statusConsoleText.textContent = `콘솔 (오류 ${errs})`;
    } else if (warns > 0) {
      statusConsoleBtn.className = 'status-btn has-warn';
      statusConsoleText.textContent = `콘솔 (경고 ${warns})`;
    } else {
      statusConsoleBtn.className = 'status-btn';
      statusConsoleText.textContent = '콘솔';
    }
  };
  appLogger.subscribe(updateStatusConsole);
  appLogger.onClear(updateStatusConsole);
  updateStatusConsole();
  initStatusBarWindowsMenu();

  // ---- Top Menu Bar ----
  new MenuBar($('menubar'), {
    doc,
    editor,
    explorer,
    activityBar,
    pluginManager,
    consolePanel,
    onJumpLint: jumpNextLint,
    onGoToDefinition: () => jumpToDefinition(editor, doc),
    onFindReferences: () => showReferencesDialog(editor, doc),
    onFindInFiles: openFindInFiles,
  });

  // ---- settings -> UI / editor ----
  const applySettings = () => {
    const s = getSettings();
    document.documentElement.dataset.theme = s.theme;
    monaco.editor.setTheme(s.theme === 'dark' ? THEME_DARK : THEME_LIGHT);
    editor.updateOptions({
      fontSize: s.fontSize,
      wordWrap: s.wordWrap ? 'on' : 'off',
      minimap: { enabled: s.minimap },
      renderWhitespace: s.whitespace,
    });
    diffViewer.updateTheme(s.theme as 'dark' | 'light');
    diffViewer.updateOptions({ fontSize: s.fontSize });
    outline.setVisible(s.showOutline);
  };
  onSettingsChange(applySettings);
  applySettings();

  // ---- linter (오류 검사) ----
  const lintBtn = $('status-lint');
  let currentMarkers: monaco.editor.IMarkerData[] = [];
  let lintTimer = 0;
  let lintRunId = 0;
  let lastLintSummary = '';

  const runLint = async () => {
    const currentRunId = ++lintRunId;
    const model = editor.getModel();
    if (!model) return;
    const s = getSettings();
    const baseMarkers = lintModel(model, optionsFromSettings(s, explorer.hasFolder));
    const coreFolderMarkers: monaco.editor.IMarkerData[] = [];

    if (explorer.hasFolder && s.lintEnabled) {
      try {
        const wsHelper = {
          readDirectory: async () => (explorer as any).readDirectory?.() ?? [],
          readTextFile: async (p: string) => (explorer as any).readTextFile?.(p) ?? '',
        };
        const wsCtx = {
          folder: explorer.hasFolder,
          file: doc.file ? { path: doc.file.id, name: doc.fileName } : undefined,
          model,
          getAllFiles: () => (explorer as any).getAllFiles?.() ?? [],
        };

        const index = await buildWorkspaceIndex(wsCtx, wsHelper);
        if (currentRunId !== lintRunId) return;

        const nsMarkers = checkNamespaceDiagnostics(model, index, {
          isAllowedVariable,
          isAllowedResource,
        });
        const fileMarkers = await checkResourceFileExistence(model, async (relPath) => {
          return pluginManager.checkFileExists(relPath);
        });

        coreFolderMarkers.push(...nsMarkers, ...fileMarkers);
      } catch (err) {
        console.warn('[main] Core workspace lint error:', err);
      }
    }

    const customMarkers = await pluginManager.runCustomLintRules(model);
    if (currentRunId !== lintRunId) {
      // Discard stale result if a newer lint run has started
      return;
    }

    const rawMarkers = [...baseMarkers, ...coreFolderMarkers, ...customMarkers];
    currentMarkers = pluginManager.filterDiagnostics(rawMarkers, model);
    monaco.editor.setModelMarkers(model, 'migoto-lint', currentMarkers);

    // Also refresh markers for any other open text tabs
    for (const tab of doc.allTabs) {
      if (tab.kind === 'text' && tab.model !== model) {
        const markers = lintModel(tab.model, optionsFromSettings(s, explorer.hasFolder));
        const filtered = pluginManager.filterDiagnostics(markers, tab.model);
        monaco.editor.setModelMarkers(tab.model, 'migoto-lint', filtered);
      }
    }

    const errors = currentMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Error);
    const warnings = currentMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Warning);
    const infos = currentMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Info);

    if (currentMarkers.length === 0) {
      lintBtn.textContent = '문제 없음';
      lintBtn.className = 'status-btn clean';
      lintBtn.title = s.lintEnabled ? '문서에 문법 오류가 없습니다' : '실시간 오류 검사가 꺼져 있습니다 (설정에서 켤 수 있습니다)';
    } else {
      const parts: string[] = [];
      if (errors.length > 0) parts.push(`오류 ${errors.length}개`);
      if (warnings.length > 0) parts.push(`경고 ${warnings.length}개`);
      if (infos.length > 0) parts.push(`알림 ${infos.length}개`);

      const prefix = errors.length > 0 ? '[오류] ' : warnings.length > 0 ? '[경고] ' : '[알림] ';
      lintBtn.textContent = `${prefix}${parts.join(', ')}`;
      lintBtn.className = `status-btn ${errors.length > 0 ? 'has-error' : warnings.length > 0 ? 'has-warn' : 'has-info'}`;
      lintBtn.title = '클릭하여 다음 문제 위치로 이동';
    }

    const summary = `${errors.length}-${warnings.length}`;
    if (lastLintSummary !== summary) {
      lastLintSummary = summary;
      if (errors.length > 0 || warnings.length > 0) {
        appLogger.warn('Linter', `검사 완료: 오류 ${errors.length}개, 경고 ${warnings.length}개 발견`);
      }
    }
  };

  const scheduleLint = () => {
    window.clearTimeout(lintTimer);
    lintTimer = window.setTimeout(runLint, 250);
  };

  pluginManager.setLintTrigger(() => {
    scheduleLint();
  });

  editor.onDidChangeModelContent(scheduleLint);
  editor.onDidChangeModel(() => {
    scheduleLint();
    updatePos();
  });
  doc.onChange(scheduleLint);
  onSettingsChange(runLint);

  lintBtn.addEventListener('click', jumpNextLint);

  // ---- status bar / title ----
  const posEl = $('status-pos');
  const updatePos = () => {
    const p = editor.getPosition();
    if (p) posEl.textContent = `줄 ${p.lineNumber}, 열 ${p.column}`;
  };
  editor.onDidChangeCursorPosition(updatePos);
  updatePos();

  const encSelect = $<HTMLSelectElement>('status-encoding');
  for (const [value, label] of Object.entries(ENCODING_LABELS)) {
    encSelect.add(new Option(label, value));
  }
  encSelect.addEventListener('change', () => doc.setEncoding(encSelect.value as Encoding));
  $('status-eol').addEventListener('click', () => doc.toggleEol());

  const refreshDocUi = () => {
    const nameEl = $('file-name');
    nameEl.textContent = doc.fileName;
    nameEl.title = doc.file?.location ?? '';
    nameEl.classList.toggle('dirty', doc.isDirty);
    encSelect.value = doc.encoding;
    $('status-eol').textContent = doc.eol;
    const title = `${doc.isDirty ? '● ' : ''}${doc.fileName} - Migoto Studio`;
    document.title = title;
    platform().setTitle(title);
    runLint();
  };
  doc.onChange(refreshDocUi);
  refreshDocUi();
  $('status-grammar').textContent = `문법: migoto-ini v${upstreamGrammarVersion}`;

  // ---- Global keyboard shortcuts ----
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      openHelp();
      return;
    }
    if (e.key === 'F7') {
      e.preventDefault();
      jumpNextLint();
      return;
    }
    if (!e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const run = (fn: () => unknown) => { e.preventDefault(); fn(); };
    if (key === 's') run(() => (e.shiftKey ? doc.saveAs() : doc.save()));
    else if (key === 'o') run(() => (e.shiftKey ? (activityBar.switchTo('explorer'), explorer.openFolderDialog()) : doc.openDialog()));
    else if (key === 'n') run(() => doc.newFile());
    else if (key === 'w') run(() => doc.closeActiveTab());
    else if (key === 'b') run(() => activityBar.toggleSidebar());
    else if (key === 'e' && e.shiftKey) run(() => activityBar.switchTo('explorer'));
    else if (key === 'd' && e.shiftKey) run(() => openCompareDialog(doc));
    else if (key === 'k' && e.shiftKey) run(() => openKeyHelperModal(editor));
    else if (key === 'x' && e.shiftKey) run(() => activityBar.switchTo('plugins'));
    else if (key === 'tab') run(() => (e.shiftKey ? doc.prevTab() : doc.nextTab()));
    else if (key === 'pageup') run(() => doc.prevTab());
    else if (key === 'pagedown') run(() => doc.nextTab());
    else if (key === '`' || key === '~') run(() => consolePanel.toggle());
    else if (key === ',') run(() => openSettings());
  }, true);

  // ---- drag & drop a file onto the window ----
  const hint = document.createElement('div');
  hint.id = 'drop-hint';
  hint.textContent = '여기에 놓아서 열기';
  document.body.append(hint);
  await platform().onFileDrop(async (ref) => {
    const isDir = await platform().isPathDir?.(ref.id);
    if (isDir) {
      activityBar.switchTo('explorer');
      await explorer.openFolder({ id: ref.id, name: ref.name });
    } else {
      await doc.openFile(ref);
    }
  }, (hovering) => hint.classList.toggle('show', hovering));

  // ---- ask before closing with unsaved changes ----
  await platform().onCloseRequest(async () => {
    const shouldClose = await doc.confirmDiscard();
    if (shouldClose) {
      try {
        await nativeWindowManager.closeAllWindows();
      } catch {}
      try {
        subWindowManager.closeAllWindows();
      } catch {}
    }
    return shouldClose;
  });

  // ---- sync active tab when window gains focus ----
  window.addEventListener('focus', () => {
    doc.syncActiveTabWithDisk();
  });

  // ---- check for newer releases in background ----
  checkOnStartup();
}

boot().catch((e) => {
  console.error(e);
  $('editor').textContent = `에디터를 시작하지 못했습니다: ${e}`;
});

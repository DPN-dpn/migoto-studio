import './style.css';
import { monaco } from './monaco';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { initPlatform, platform } from './platform';

import { LANGUAGE_ID, registerMigotoLanguage, upstreamGrammarVersion } from './grammar';
import { defineThemes, THEME_DARK, THEME_LIGHT } from './theme';
import { DocumentManager, ENCODING_LABELS, type Encoding } from './documents';
import { TabBar } from './tabbar';
import { FileExplorer } from './explorer';
import { TemplatePanel } from './template-panel';
import { ActivityBar } from './activitybar';
import { MenuBar } from './menubar';
import { getSettings, loadSettings, onSettingsChange } from './settings';
import { OutlinePanel } from './outline';
import { registerSnippetCompletions } from './templates';
import { openSettings } from './settings-ui';
import { openHelp } from './help-ui';
import { lintModel, optionsFromSettings } from './lint';
import { registerSmartCompletions } from './completions';
import { initPwa } from './pwa';
import { checkOnStartup } from './updater';

// Only the base editor worker is needed (no TS/JSON/CSS language services).
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function boot() {
  await initPlatform();
  initPwa();
  const settings = await loadSettings();
  // Drop expired safety backups (best effort; never blocks startup).
  platform().pruneBackups({ keepDays: settings.backupKeepDays, maxPerFile: settings.backupMaxPerFile }).catch(() => {});
  defineThemes();
  await registerMigotoLanguage();
  registerSnippetCompletions();
  registerSmartCompletions();

  const editor = monaco.editor.create($('editor'), {
    value: '',
    language: LANGUAGE_ID,
    theme: settings.theme === 'dark' ? THEME_DARK : THEME_LIGHT,
    automaticLayout: true,
    fontFamily: "'Cascadia Code', 'D2Coding', Consolas, monospace",
    smoothScrolling: true,
    scrollBeyondLastLine: false,
  });

  const doc = new DocumentManager(editor);
  const outline = new OutlinePanel(editor, $('sidebar'), $('sidebar-panel-outline'), $('sidebar-resizer'));
  const explorer = new FileExplorer($('sidebar-panel-explorer'), doc);
  new TemplatePanel($('sidebar-panel-templates'), editor);
  new TabBar(doc, $('tabbar'), $('btn-new-tab'), $('tab-menu'));

  // ---- Activity Bar (세로 툴바) ----
  const activityBar = new ActivityBar(
    $('activity-bar'),
    $('act-explorer'),
    $('act-outline'),
    $('act-templates'),
    $('sidebar-panel-explorer'),
    $('sidebar-panel-outline'),
    $('sidebar-panel-templates'),
    outline,
    () => openSettings(),
    () => openHelp(),
  );

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

  // ---- Top Menu Bar ----
  new MenuBar($('menubar'), {
    doc,
    editor,
    explorer,
    activityBar,
    onJumpLint: jumpNextLint,
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
    outline.setVisible(s.showOutline);
  };
  onSettingsChange(applySettings);
  applySettings();

  // ---- linter (오류 검사) ----
  const lintBtn = $('status-lint');
  let currentMarkers: monaco.editor.IMarkerData[] = [];
  let lintTimer = 0;

  const runLint = () => {
    const model = editor.getModel();
    if (!model) return;
    const s = getSettings();
    currentMarkers = lintModel(model, optionsFromSettings(s));
    monaco.editor.setModelMarkers(model, 'migoto-lint', currentMarkers);

    const errors = currentMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Error);
    const warnings = currentMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Warning);
    const infos = currentMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Info);

    if (currentMarkers.length === 0) {
      lintBtn.textContent = '✓ 문제 없음';
      lintBtn.className = 'status-btn clean';
      lintBtn.title = s.lintEnabled ? '문서에 문법 오류가 없습니다' : '실시간 오류 검사가 꺼져 있습니다 (설정에서 켤 수 있습니다)';
    } else {
      const parts: string[] = [];
      if (errors.length > 0) parts.push(`오류 ${errors.length}개`);
      if (warnings.length > 0) parts.push(`경고 ${warnings.length}개`);
      if (infos.length > 0) parts.push(`알림 ${infos.length}개`);

      lintBtn.textContent = `${errors.length > 0 ? '⛔ ' : warnings.length > 0 ? '⚠ ' : 'ℹ '}${parts.join(', ')}`;
      lintBtn.className = `status-btn ${errors.length > 0 ? 'has-error' : warnings.length > 0 ? 'has-warn' : 'has-info'}`;
      lintBtn.title = '클릭하여 다음 문제 위치로 이동';
    }
  };

  const scheduleLint = () => {
    window.clearTimeout(lintTimer);
    lintTimer = window.setTimeout(runLint, 250);
  };

  editor.onDidChangeModelContent(scheduleLint);
  editor.onDidChangeModel(() => {
    scheduleLint();
    updatePos();
  });
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
    else if (key === 'tab') run(() => (e.shiftKey ? doc.prevTab() : doc.nextTab()));
    else if (key === 'pageup') run(() => doc.prevTab());
    else if (key === 'pagedown') run(() => doc.nextTab());
    else if (key === ',') run(() => openSettings());
  }, true);

  // ---- drag & drop a file onto the window ----
  const hint = document.createElement('div');
  hint.id = 'drop-hint';
  hint.textContent = '여기에 놓아서 열기';
  document.body.append(hint);
  await platform().onFileDrop((ref) => doc.openFile(ref), (hovering) => hint.classList.toggle('show', hovering));

  // ---- ask before closing with unsaved changes ----
  await platform().onCloseRequest(() => doc.confirmDiscard());

  // ---- check for newer releases in background ----
  checkOnStartup();
}

boot().catch((e) => {
  console.error(e);
  $('editor').textContent = `에디터를 시작하지 못했습니다: ${e}`;
});

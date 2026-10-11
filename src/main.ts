import './style.css';
import { monaco } from './monaco';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { invoke } from '@tauri-apps/api/core';

import { LANGUAGE_ID, registerMigotoLanguage, upstreamGrammarVersion } from './grammar';
import { defineThemes, THEME_DARK, THEME_LIGHT } from './theme';
import { DocumentManager, ENCODING_LABELS, type Encoding } from './documents';
import { getSettings, loadSettings, onSettingsChange, updateSettings } from './settings';
import { OutlinePanel } from './outline';
import { TEMPLATES, insertTemplate, registerSnippetCompletions } from './templates';
import { openSettings } from './settings-ui';
import { openRestore } from './restore-ui';

// Only the base editor worker is needed (no TS/JSON/CSS language services).
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function boot() {
  const settings = await loadSettings();
  // Drop expired safety backups (best effort; never blocks startup).
  invoke('cleanup_backups', { keepDays: settings.backupKeepDays, maxPerFile: settings.backupMaxPerFile }).catch(() => {});
  defineThemes();
  await registerMigotoLanguage();
  registerSnippetCompletions();

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
  const outline = new OutlinePanel(editor, $('sidebar'));
  const appWindow = getCurrentWindow();

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
    nameEl.title = doc.path ?? '';
    nameEl.classList.toggle('dirty', doc.isDirty);
    encSelect.value = doc.encoding;
    $('status-eol').textContent = doc.eol;
    const title = `${doc.isDirty ? '● ' : ''}${doc.fileName} - Migoto Studio`;
    document.title = title;
    appWindow.setTitle(title).catch(() => {});
  };
  doc.onChange(refreshDocUi);
  refreshDocUi();
  $('status-grammar').textContent = `문법: migoto-ini v${upstreamGrammarVersion}`;

  // ---- toolbar actions ----
  $('btn-new').addEventListener('click', () => doc.newFile());
  $('btn-open').addEventListener('click', () => doc.openDialog());
  $('btn-save').addEventListener('click', () => doc.save());
  $('btn-saveas').addEventListener('click', () => doc.saveAs());
  $('btn-restore').addEventListener('click', () => openRestore(doc));
  $('btn-settings').addEventListener('click', () => openSettings());
  $('btn-outline').addEventListener('click', () => updateSettings({ showOutline: !getSettings().showOutline }));
  $('btn-theme').addEventListener('click', () =>
    updateSettings({ theme: getSettings().theme === 'dark' ? 'light' : 'dark' }));

  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const run = (fn: () => unknown) => { e.preventDefault(); fn(); };
    if (key === 's') run(() => (e.shiftKey ? doc.saveAs() : doc.save()));
    else if (key === 'o') run(() => doc.openDialog());
    else if (key === 'n') run(() => doc.newFile());
    else if (key === ',') run(() => openSettings());
  }, true);

  // ---- popup menus (recent files, insert) ----
  const menus = [$('recent-menu'), $('insert-menu')];
  const closeMenus = () => menus.forEach((m) => { m.hidden = true; });
  const openMenu = (menu: HTMLElement, button: HTMLElement) => {
    const wasOpen = !menu.hidden;
    closeMenus();
    if (wasOpen) return;
    menu.style.left = `${Math.min(button.offsetLeft, window.innerWidth - 340)}px`;
    menu.hidden = false;
  };
  const item = (text: string, onClick?: () => void, sub?: string) => {
    const li = document.createElement('li');
    li.textContent = text;
    if (sub) li.append(Object.assign(document.createElement('small'), { textContent: sub }));
    if (onClick) li.addEventListener('click', () => { closeMenus(); onClick(); });
    else li.className = 'empty';
    return li;
  };

  $('btn-recent').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('recent-menu');
    menu.replaceChildren();
    const recent = getSettings().recentFiles;
    if (recent.length === 0) menu.append(item('최근에 연 파일이 없습니다'));
    for (const path of recent) {
      const li = item(path, () => doc.openPath(path));
      li.title = path;
      menu.append(li);
    }
    openMenu(menu, $('btn-recent'));
  });

  $('btn-insert').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('insert-menu');
    menu.replaceChildren();
    let lastGroup = '';
    for (const t of TEMPLATES) {
      if (t.group !== lastGroup) {
        lastGroup = t.group;
        const g = document.createElement('li');
        g.className = 'group';
        g.textContent = t.group;
        menu.append(g);
      }
      menu.append(item(t.label, () => insertTemplate(editor, t), t.description));
    }
    openMenu(menu, $('btn-insert'));
  });

  document.addEventListener('click', closeMenus);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

  // ---- drag & drop a file onto the window ----
  const hint = document.createElement('div');
  hint.id = 'drop-hint';
  hint.textContent = '여기에 놓아서 열기';
  document.body.append(hint);
  await getCurrentWebview().onDragDropEvent((event) => {
    const p = event.payload;
    if (p.type === 'enter' || p.type === 'over') hint.classList.add('show');
    else hint.classList.remove('show');
    if (p.type === 'drop' && p.paths.length > 0) doc.openPath(p.paths[0]);
  });

  // ---- ask before closing with unsaved changes ----
  await appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    if (await doc.confirmDiscard()) await appWindow.destroy();
  });
}

boot().catch((e) => {
  console.error(e);
  $('editor').textContent = `에디터를 시작하지 못했습니다: ${e}`;
});

import type { monaco } from '../../core/editor/monaco';
import type { DocumentManager } from '../../core/workspace/documents';
import { platform, type FileRef } from '../../platform/index';
import type { FileExplorer } from './explorer';
import { flashLineHighlight } from '../../core/ini/symbol-nav';
import { showToast } from '../common/toast';
import { openConfirmModal } from '../modals/confirm-ui';
import { appLogger } from '../../core/logger';

import {
  type SearchMatch,
  BINARY_EXTENSIONS,
  escapeRegex,
  buildSearchRegex,
  matchesPattern,
  searchInText,
} from '../../core/workspace/search';

export { type SearchMatch } from '../../core/workspace/search';

export interface SearchFileResult {
  filePath: string;
  fileName: string;
  fileRef?: FileRef | null;
  tabId?: string;
  matches: SearchMatch[];
  isCollapsed?: boolean;
}

const CHEVRON_SVG = `
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 4 10 8 6 12"></polyline>
  </svg>
`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class SearchPanel {
  private query = '';
  private replaceText = '';
  private isReplaceVisible = false;
  private matchCase = false;
  private wholeWord = false;
  private isRegex = false;
  private isDetailsVisible = false;
  private includePattern = '';
  private excludePattern = '';

  private results: SearchFileResult[] = [];
  private isSearching = false;
  private searchTimer: number | null = null;

  // DOM Elements
  private searchInput!: HTMLInputElement;
  private replaceInput!: HTMLInputElement;
  private caseBtn!: HTMLButtonElement;
  private wordBtn!: HTMLButtonElement;
  private regexBtn!: HTMLButtonElement;
  private toggleReplaceBtn!: HTMLButtonElement;
  private replaceRow!: HTMLElement;
  private detailsRow!: HTMLElement;
  private includeInput!: HTMLInputElement;
  private excludeInput!: HTMLInputElement;
  private summaryEl!: HTMLElement;
  private listEl!: HTMLElement;

  constructor(
    private root: HTMLElement,
    private doc: DocumentManager,
    private editor: monaco.editor.IStandaloneCodeEditor,
    private explorer: FileExplorer,
  ) {
    this.render();
  }

  private render() {
    this.root.replaceChildren();

    // 1. Panel Header
    const header = document.createElement('div');
    header.className = 'search-panel-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'search-panel-title-row';

    const title = document.createElement('h2');
    title.textContent = '검색';
    titleRow.append(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'search-header-actions';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'search-action-btn';
    refreshBtn.title = '검색 새로고침';
    refreshBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    `;
    refreshBtn.addEventListener('click', () => this.runSearch());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'search-action-btn';
    clearBtn.title = '검색어 및 결과 지우기';
    clearBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    clearBtn.addEventListener('click', () => this.clearSearch());

    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.className = 'search-action-btn';
    toggleAllBtn.title = '모든 결과 접기 / 펼치기';
    toggleAllBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
      </svg>
    `;
    toggleAllBtn.addEventListener('click', () => this.toggleCollapseAll());

    headerActions.append(refreshBtn, clearBtn, toggleAllBtn);
    titleRow.append(headerActions);
    header.append(titleRow);

    // 2. Search Box & Inputs
    const controlsWrap = document.createElement('div');
    controlsWrap.className = 'search-controls-wrap';

    // Search Row
    const searchRow = document.createElement('div');
    searchRow.className = 'search-input-row';

    this.toggleReplaceBtn = document.createElement('button');
    this.toggleReplaceBtn.className = 'search-toggle-btn toggle-replace-btn';
    this.toggleReplaceBtn.title = '바꾸기 토글';
    this.toggleReplaceBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
    this.toggleReplaceBtn.addEventListener('click', () => this.toggleReplace());

    const inputWrap = document.createElement('div');
    inputWrap.className = 'search-field-wrap';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'search-field-input';
    this.searchInput.placeholder = '전체 검색 (Ctrl+Shift+F)';
    this.searchInput.spellcheck = false;
    this.searchInput.addEventListener('input', () => {
      this.query = this.searchInput.value;
      this.scheduleSearch();
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.runSearch();
      }
    });

    const optButtons = document.createElement('div');
    optButtons.className = 'search-option-buttons';

    this.caseBtn = this.createOptionBtn('Aa', '대/소문자 구분 (Alt+C)', () => {
      this.matchCase = !this.matchCase;
      this.caseBtn.classList.toggle('active', this.matchCase);
      this.runSearch();
    });

    this.wordBtn = this.createOptionBtn('\\b', '단어 단위 (Alt+W)', () => {
      this.wholeWord = !this.wholeWord;
      this.wordBtn.classList.toggle('active', this.wholeWord);
      this.runSearch();
    });

    this.regexBtn = this.createOptionBtn('.*', '정규식 사용 (Alt+R)', () => {
      this.isRegex = !this.isRegex;
      this.regexBtn.classList.toggle('active', this.isRegex);
      this.runSearch();
    });

    optButtons.append(this.caseBtn, this.wordBtn, this.regexBtn);
    inputWrap.append(this.searchInput, optButtons);
    searchRow.append(this.toggleReplaceBtn, inputWrap);

    // Replace Row
    this.replaceRow = document.createElement('div');
    this.replaceRow.className = 'search-input-row search-replace-row';
    this.replaceRow.hidden = true;

    const replaceSpacer = document.createElement('div');
    replaceSpacer.className = 'search-spacer';

    const replaceInputWrap = document.createElement('div');
    replaceInputWrap.className = 'search-field-wrap';

    this.replaceInput = document.createElement('input');
    this.replaceInput.type = 'text';
    this.replaceInput.className = 'search-field-input';
    this.replaceInput.placeholder = '바꿀 내용';
    this.replaceInput.spellcheck = false;
    this.replaceInput.addEventListener('input', () => {
      this.replaceText = this.replaceInput.value;
    });

    const replaceAllBtn = document.createElement('button');
    replaceAllBtn.className = 'search-btn-replace-all';
    replaceAllBtn.title = '모두 바꾸기';
    replaceAllBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <line x1="9" y1="15" x2="15" y2="15"></line>
        <line x1="12" y1="12" x2="12" y2="18"></line>
      </svg>
      <span>모두 바꾸기</span>
    `;
    replaceAllBtn.addEventListener('click', () => this.replaceAll());

    replaceInputWrap.append(this.replaceInput);
    this.replaceRow.append(replaceSpacer, replaceInputWrap, replaceAllBtn);

    // Filter Scope Row (Details)
    const detailsToggleBtn = document.createElement('button');
    detailsToggleBtn.className = 'search-details-toggle';
    detailsToggleBtn.innerHTML = `<span>세부 파일 필터</span><span class="chevron">▼</span>`;
    detailsToggleBtn.addEventListener('click', () => {
      this.isDetailsVisible = !this.isDetailsVisible;
      this.detailsRow.hidden = !this.isDetailsVisible;
      detailsToggleBtn.classList.toggle('expanded', this.isDetailsVisible);
    });

    this.detailsRow = document.createElement('div');
    this.detailsRow.className = 'search-details-row';
    this.detailsRow.hidden = true;

    this.includeInput = document.createElement('input');
    this.includeInput.type = 'text';
    this.includeInput.className = 'search-filter-input';
    this.includeInput.placeholder = '포함할 파일 (예: *.ini, d3dx.ini)';
    this.includeInput.addEventListener('input', () => {
      this.includePattern = this.includeInput.value.trim();
      this.scheduleSearch();
    });

    this.excludeInput = document.createElement('input');
    this.excludeInput.type = 'text';
    this.excludeInput.className = 'search-filter-input';
    this.excludeInput.placeholder = '제외할 파일 (예: backup/*, cache)';
    this.excludeInput.addEventListener('input', () => {
      this.excludePattern = this.excludeInput.value.trim();
      this.scheduleSearch();
    });

    this.detailsRow.append(this.includeInput, this.excludeInput);

    controlsWrap.append(searchRow, this.replaceRow, detailsToggleBtn, this.detailsRow);
    header.append(controlsWrap);

    // 3. Summary row
    this.summaryEl = document.createElement('div');
    this.summaryEl.className = 'search-summary-bar';
    this.summaryEl.textContent = '검색어를 입력하세요.';

    // 4. Results List
    this.listEl = document.createElement('div');
    this.listEl.className = 'search-results-list';

    this.root.append(header, this.summaryEl, this.listEl);
  }

  private createOptionBtn(text: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-opt-btn';
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private toggleReplace() {
    this.isReplaceVisible = !this.isReplaceVisible;
    this.replaceRow.hidden = !this.isReplaceVisible;
    this.toggleReplaceBtn.classList.toggle('expanded', this.isReplaceVisible);
    if (this.isReplaceVisible) {
      this.replaceInput.focus();
    }
  }

  private scheduleSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => {
      this.runSearch();
    }, 200);
  }

  private clearSearch() {
    this.query = '';
    this.searchInput.value = '';
    this.results = [];
    this.summaryEl.textContent = '검색어를 입력하세요.';
    this.listEl.replaceChildren();
    this.searchInput.focus();
  }

  private toggleCollapseAll() {
    if (this.results.length === 0) return;
    const allCollapsed = this.results.every((r) => r.isCollapsed);
    this.results.forEach((r) => {
      r.isCollapsed = !allCollapsed;
    });
    this.renderResults();
  }

  /**
   * Focuses and activates search panel with optional text.
   */
  focusSearch(initialText = '') {
    if (initialText) {
      this.query = initialText;
      this.searchInput.value = initialText;
    }
    this.searchInput.focus();
    this.searchInput.select();
    if (this.query.trim()) {
      this.runSearch();
    }
  }

  /**
   * Executes the global search across workspace files and open tabs.
   */
  async runSearch() {
    const rawQuery = this.query.trim();
    if (!rawQuery) {
      this.results = [];
      this.summaryEl.textContent = '검색어를 입력하세요.';
      this.listEl.replaceChildren();
      return;
    }

    let regex: RegExp;
    try {
      regex = buildSearchRegex(rawQuery, {
        matchCase: this.matchCase,
        wholeWord: this.wholeWord,
        isRegex: this.isRegex,
      });
    } catch (err: any) {
      this.summaryEl.innerHTML = `<span class="search-error">유효하지 않은 정규식: ${escapeHtml(err.message)}</span>`;
      this.listEl.replaceChildren();
      return;
    }

    this.isSearching = true;
    this.summaryEl.textContent = '검색 중...';

    const results: SearchFileResult[] = [];
    const scannedTabFileIds = new Set<string>();
    const scannedNames = new Set<string>();

    // 1. Search Open Tabs first (live unsaved contents)
    for (const tab of this.doc.allTabs) {
      if (tab.kind !== 'text') continue;
      const tabName = tab.title || '이름 없음';
      if (tab.file?.id) scannedTabFileIds.add(tab.file.id);
      scannedNames.add(tabName.toLowerCase());

      const displayPath = tab.file?.location || tab.file?.id || tabName;
      if (this.includePattern && !matchesPattern(displayPath, this.includePattern) && !matchesPattern(tabName, this.includePattern)) continue;
      if (this.excludePattern && (matchesPattern(displayPath, this.excludePattern) || matchesPattern(tabName, this.excludePattern))) continue;

      const text = tab.model.getValue();
      const matches = searchInText(text, regex);
      if (matches.length > 0) {
        results.push({
          filePath: displayPath,
          fileName: tabName,
          fileRef: tab.file,
          tabId: tab.id,
          matches,
          isCollapsed: false,
        });
      }
    }

    // 2. Search Unopened Workspace Files (if explorer folder is open)
    if (this.explorer && this.explorer.hasFolder) {
      const allFiles = this.explorer.getAllFiles();

      for (const fileInfo of allFiles) {
        // Skip if already searched in open tabs
        if (fileInfo.fileRef.id && scannedTabFileIds.has(fileInfo.fileRef.id)) continue;
        if (scannedNames.has(fileInfo.name.toLowerCase())) {
          const isOpen = this.doc.allTabs.some(
            (t) => t.file?.id === fileInfo.fileRef.id || t.title === fileInfo.name || t.file?.name === fileInfo.name,
          );
          if (isOpen) continue;
        }

        // Skip binary extensions
        const ext = fileInfo.relPath.split('.').pop()?.toLowerCase() ?? '';
        if (BINARY_EXTENSIONS.has(ext)) continue;

        if (this.includePattern && !matchesPattern(fileInfo.relPath, this.includePattern) && !matchesPattern(fileInfo.name, this.includePattern)) continue;
        if (this.excludePattern && (matchesPattern(fileInfo.relPath, this.excludePattern) || matchesPattern(fileInfo.name, this.excludePattern))) continue;

        try {
          const loaded = await platform().readFile(fileInfo.fileRef);
          if (!loaded || typeof loaded.text !== 'string') continue;

          const matches = searchInText(loaded.text, regex);
          if (matches.length > 0) {
            results.push({
              filePath: fileInfo.relPath,
              fileName: fileInfo.name,
              fileRef: fileInfo.fileRef,
              matches,
              isCollapsed: false,
            });
          }
        } catch {
          // Skip inaccessible or locked files
        }
      }
    }

    this.results = results;
    this.isSearching = false;

    // Total counts
    const totalFiles = results.length;
    const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

    if (totalFiles === 0) {
      this.summaryEl.textContent = '일치하는 결과가 없습니다.';
    } else {
      this.summaryEl.textContent = `${totalFiles}개 파일에서 ${totalMatches}개 결과 발견`;
      appLogger.info('Search', `'${this.query}' 검색 완료: ${totalFiles}개 파일에서 ${totalMatches}건 발견`);
    }

    this.renderResults();
  }

  private renderResults() {
    this.listEl.replaceChildren();

    if (this.results.length === 0) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'search-empty-hint';
      emptyHint.textContent = this.query ? '결과 없음' : '검색어를 입력하면 전체 파일에서 찾습니다.';
      this.listEl.append(emptyHint);
      return;
    }

    for (const fileResult of this.results) {
      const fileGroup = document.createElement('div');
      fileGroup.className = `search-file-group ${fileResult.isCollapsed ? 'collapsed' : ''}`;

      // File Header
      const fileHeader = document.createElement('div');
      fileHeader.className = 'search-file-header';
      fileHeader.tabIndex = 0;

      const chevron = document.createElement('span');
      chevron.className = 'search-file-chevron';
      chevron.innerHTML = CHEVRON_SVG;

      const fileNameSpan = document.createElement('span');
      fileNameSpan.className = 'search-file-name';
      fileNameSpan.textContent = fileResult.fileName;
      fileNameSpan.title = fileResult.filePath;

      const pathSpan = document.createElement('span');
      pathSpan.className = 'search-file-path';
      pathSpan.textContent = fileResult.filePath;

      const badge = document.createElement('span');
      badge.className = 'search-file-badge';
      badge.textContent = String(fileResult.matches.length);

      fileHeader.append(chevron, fileNameSpan, pathSpan, badge);

      fileHeader.addEventListener('click', () => {
        fileResult.isCollapsed = !fileResult.isCollapsed;
        fileGroup.classList.toggle('collapsed', fileResult.isCollapsed);
        matchesList.hidden = Boolean(fileResult.isCollapsed);
      });

      // Matches List
      const matchesList = document.createElement('div');
      matchesList.className = 'search-file-matches';
      matchesList.hidden = Boolean(fileResult.isCollapsed);

      for (const match of fileResult.matches) {
        const item = document.createElement('div');
        item.className = 'search-match-item';
        item.tabIndex = 0;

        const lineNum = document.createElement('span');
        lineNum.className = 'search-match-line';
        lineNum.textContent = `${match.lineNumber}:`;

        const codeSnippet = document.createElement('span');
        codeSnippet.className = 'search-match-snippet';
        codeSnippet.innerHTML = this.highlightSnippet(match.lineContent, match.matchedText);

        item.append(lineNum, codeSnippet);

        item.addEventListener('click', async () => {
          await this.openMatch(fileResult, match);
        });

        matchesList.append(item);
      }

      fileGroup.append(fileHeader, matchesList);
      this.listEl.append(fileGroup);
    }
  }

  private highlightSnippet(line: string, match: string): string {
    const escapedLine = escapeHtml(line);
    const escapedMatch = escapeHtml(match);
    if (!escapedMatch) return escapedLine;

    const re = new RegExp(escapeRegex(escapedMatch), this.matchCase ? 'g' : 'gi');
    return escapedLine.replace(re, '<mark class="search-match">$&</mark>');
  }

  private async openMatch(fileResult: SearchFileResult, match: SearchMatch) {
    if (fileResult.tabId) {
      this.doc.switchTab(fileResult.tabId);
    } else if (fileResult.fileRef) {
      await this.doc.openFile(fileResult.fileRef);
    }

    this.editor.revealLineInCenter(match.lineNumber);
    this.editor.setSelection({
      startLineNumber: match.lineNumber,
      startColumn: match.startColumn,
      endLineNumber: match.lineNumber,
      endColumn: match.endColumn,
    });
    this.editor.focus();
    flashLineHighlight(this.editor, match.lineNumber);
  }

  /**
   * Replace all occurrences across files.
   */
  private async replaceAll() {
    if (this.results.length === 0) {
      showToast('바꿀 검색 결과가 없습니다.', 'info');
      return;
    }

    const totalMatches = this.results.reduce((acc, r) => acc + r.matches.length, 0);
    const confirmMsg = `${this.results.length}개 파일에서 총 ${totalMatches}개의 '${this.query}' 항목을 '${this.replaceText}'(으)로 모두 바꾸시겠습니까?`;

    const confirmed = await openConfirmModal({
      title: '일괄 바꾸기',
      message: confirmMsg,
      confirmText: '모두 바꾸기',
      variant: 'primary',
    });
    if (!confirmed) return;

    for (const fileResult of this.results) {
      // If open in a tab:
      const tab = this.doc.allTabs.find(
        (t) => t.id === fileResult.tabId || t.file?.id === fileResult.filePath,
      );

      if (tab) {
        const edits = fileResult.matches.map((m) => ({
          range: {
            startLineNumber: m.lineNumber,
            startColumn: m.startColumn,
            endLineNumber: m.lineNumber,
            endColumn: m.endColumn,
          },
          text: this.replaceText,
        }));
        tab.model.pushStackElement();
        tab.model.pushEditOperations([], edits, () => null);
        tab.model.pushStackElement();
      } else if (fileResult.fileRef) {
        // Read file, replace, and save
        try {
          const loaded = await platform().readFile(fileResult.fileRef);
          if (loaded.text) {
            let replacedText: string;
            if (this.isRegex) {
              const regex = new RegExp(this.query, this.matchCase ? 'g' : 'gi');
              replacedText = loaded.text.replace(regex, this.replaceText);
            } else if (this.wholeWord) {
              const regex = new RegExp(`\\b${escapeRegex(this.query)}\\b`, this.matchCase ? 'g' : 'gi');
              replacedText = loaded.text.replace(regex, this.replaceText);
            } else {
              const regex = new RegExp(escapeRegex(this.query), this.matchCase ? 'g' : 'gi');
              replacedText = loaded.text.replace(regex, this.replaceText);
            }
            await platform().writeFile(fileResult.fileRef, replacedText, loaded.encoding, { enabled: false, keepDays: 0, maxPerFile: 0 });
          }
        } catch (err: any) {
          console.error(`파일 저장 실패 (${fileResult.filePath}):`, err);
        }
      }
    }

    showToast(`총 ${totalMatches}개 항목이 바뀌었습니다.`, 'info');
    await this.runSearch();
  }
}

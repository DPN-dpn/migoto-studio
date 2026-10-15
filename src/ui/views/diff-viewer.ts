import { monaco } from '../../core/editor/monaco';
import type { DocumentManager, DocumentTab } from '../../core/workspace/documents';
import { getSettings } from '../../core/workspace/settings';
import { THEME_DARK, THEME_LIGHT } from '../../core/editor/theme';
import { showToast } from '../common/toast';

/**
 * Built-in Monaco Diff Viewer component.
 * Provides rich visual side-by-side or inline difference comparison,
 * change statistics, jump to prev/next difference, and apply modifications back to editor.
 */
export class DiffViewer {
  private diffEditor: monaco.editor.IStandaloneDiffEditor;
  private origLabelEl: HTMLElement;
  private modLabelEl: HTMLElement;
  private statsBadgeEl: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private layoutBtn: HTMLButtonElement;
  private applyBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private mountEl: HTMLElement;
  private isSideBySide = true;
  private currentTabId: string | null = null;

  constructor(
    private container: HTMLElement,
    private doc: DocumentManager,
  ) {
    this.container.replaceChildren();
    this.container.className = 'diff-container-panel';

    // 1. Header Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'diff-header-bar';

    // 1.1 Titles
    const titlesWrap = document.createElement('div');
    titlesWrap.className = 'diff-header-titles';

    const origBadge = document.createElement('span');
    origBadge.className = 'diff-badge diff-badge-orig';
    origBadge.textContent = '원본';

    this.origLabelEl = document.createElement('span');
    this.origLabelEl.className = 'diff-label diff-label-orig';
    this.origLabelEl.textContent = '원본 파일';

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'diff-arrow-separator';
    arrowSpan.textContent = '↔';

    const modBadge = document.createElement('span');
    modBadge.className = 'diff-badge diff-badge-mod';
    modBadge.textContent = '수정본';

    this.modLabelEl = document.createElement('span');
    this.modLabelEl.className = 'diff-label diff-label-mod';
    this.modLabelEl.textContent = '수정본 파일';

    this.statsBadgeEl = document.createElement('span');
    this.statsBadgeEl.className = 'diff-stats-badge is-clean';
    this.statsBadgeEl.textContent = '비교 중…';

    titlesWrap.append(origBadge, this.origLabelEl, arrowSpan, modBadge, this.modLabelEl, this.statsBadgeEl);

    // 1.2 Actions
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'diff-header-actions';

    this.prevBtn = document.createElement('button');
    this.prevBtn.className = 'diff-action-btn';
    this.prevBtn.title = '이전 변경점으로 이동 (Alt+F5)';
    this.prevBtn.textContent = '◀ 이전 변경';
    this.prevBtn.onclick = () => this.diffEditor.goToDiff('previous');

    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'diff-action-btn';
    this.nextBtn.title = '다음 변경점으로 이동 (F5)';
    this.nextBtn.textContent = '다음 변경 ▶';
    this.nextBtn.onclick = () => this.diffEditor.goToDiff('next');

    this.layoutBtn = document.createElement('button');
    this.layoutBtn.className = 'diff-action-btn';
    this.layoutBtn.title = '나란히 보기 / 한 줄로 보기 전환';
    this.layoutBtn.textContent = '한 줄로 보기';
    this.layoutBtn.onclick = () => {
      this.isSideBySide = !this.isSideBySide;
      this.diffEditor.updateOptions({ renderSideBySide: this.isSideBySide });
      this.layoutBtn.textContent = this.isSideBySide ? '한 줄로 보기' : '나란히 보기';
    };

    this.applyBtn = document.createElement('button');
    this.applyBtn.className = 'diff-action-btn diff-btn-primary';
    this.applyBtn.title = '수정본 내용을 현재 원본 에디터 문서에 덮어씁니다';
    this.applyBtn.textContent = '✓ 에디터에 적용';
    this.applyBtn.onclick = () => {
      if (this.currentTabId) {
        const ok = this.doc.applyDiffToSource(this.currentTabId);
        if (ok) {
          showToast('수정본 내용이 원본 에디터에 적용되었습니다.', 'info');
        }
      }
    };

    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'diff-action-btn';
    this.closeBtn.title = '비교 탭 닫기 (Ctrl+W)';
    this.closeBtn.textContent = '닫기';
    this.closeBtn.onclick = () => {
      if (this.currentTabId) {
        this.doc.closeTab(this.currentTabId);
      }
    };

    actionsWrap.append(this.prevBtn, this.nextBtn, this.layoutBtn, this.applyBtn, this.closeBtn);
    toolbar.append(titlesWrap, actionsWrap);

    // 2. Editor Mount Element
    this.mountEl = document.createElement('div');
    this.mountEl.className = 'diff-editor-mount';

    this.container.append(toolbar, this.mountEl);

    // 3. Create Monaco Diff Editor
    const settings = getSettings();
    this.diffEditor = monaco.editor.createDiffEditor(this.mountEl, {
      automaticLayout: true,
      renderSideBySide: this.isSideBySide,
      readOnly: false,
      originalEditable: false,
      fontFamily: "'Cascadia Code', 'D2Coding', Consolas, monospace",
      fontSize: settings.fontSize,
      theme: settings.theme === 'dark' ? THEME_DARK : THEME_LIGHT,
      smoothScrolling: true,
      scrollBeyondLastLine: false,
      renderIndicators: true,
      enableSplitViewResizing: true,
    });

    this.diffEditor.onDidUpdateDiff(() => {
      const lineChanges = this.diffEditor.getLineChanges();
      if (!lineChanges || lineChanges.length === 0) {
        this.statsBadgeEl.textContent = '내용 일치 (차이 없음)';
        this.statsBadgeEl.className = 'diff-stats-badge is-clean';
      } else {
        let added = 0;
        let deleted = 0;
        for (const c of lineChanges) {
          if (c.originalEndLineNumber >= c.originalStartLineNumber && c.originalStartLineNumber > 0) {
            deleted += (c.originalEndLineNumber - c.originalStartLineNumber + 1);
          }
          if (c.modifiedEndLineNumber >= c.modifiedStartLineNumber && c.modifiedStartLineNumber > 0) {
            added += (c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1);
          }
        }
        this.statsBadgeEl.textContent = `${lineChanges.length}곳 차이 (+${added}줄, -${deleted}줄)`;
        this.statsBadgeEl.className = 'diff-stats-badge is-modified';
      }
    });

    // Keyboard shortcuts inside diff viewer
    window.addEventListener('keydown', (e) => {
      if (this.container.hidden) return;
      if (e.key === 'F5' && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        this.diffEditor.goToDiff('next');
      } else if (e.key === 'F5' && e.altKey) {
        e.preventDefault();
        this.diffEditor.goToDiff('previous');
      }
    });
  }

  showDiffTab(tab: DocumentTab) {
    if (tab.kind !== 'diff' || !tab.diffInfo) return;

    this.currentTabId = tab.id;
    this.origLabelEl.textContent = tab.diffInfo.originalTitle;
    this.modLabelEl.textContent = tab.diffInfo.modifiedTitle;
    this.origLabelEl.title = tab.diffInfo.originalTitle;
    this.modLabelEl.title = tab.diffInfo.modifiedTitle;

    this.applyBtn.hidden = !tab.diffInfo.sourceTabId;

    this.diffEditor.setModel({
      original: tab.diffInfo.originalModel,
      modified: tab.diffInfo.modifiedModel,
    });

    requestAnimationFrame(() => {
      this.diffEditor.layout();
    });
  }

  updateTheme(theme: 'dark' | 'light') {
    monaco.editor.setTheme(theme === 'dark' ? THEME_DARK : THEME_LIGHT);
  }

  updateOptions(options: monaco.editor.IDiffEditorOptions) {
    this.diffEditor.updateOptions(options);
  }

  layout() {
    this.diffEditor.layout();
  }

  dispose() {
    this.diffEditor.dispose();
  }
}

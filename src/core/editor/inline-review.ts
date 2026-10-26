import { monaco } from './monaco';
import { computeLineDiff, DiffHunk } from './diff';
import type { DocumentManager } from '../workspace/documents';

export interface ProposeChangesOptions {
  title?: string;
  description?: string;
  highlightOnly?: boolean;
}

export interface ProposeChangesResult {
  accepted: boolean;
}

interface TabReviewSession {
  tabId: string;
  tabTitle: string;
  editor: monaco.editor.IStandaloneCodeEditor;
  model: monaco.editor.ITextModel;
  originalText: string;
  initialOriginalText: string;
  wasCleanBefore: boolean;
  hunks: DiffHunk[];
  decorationIds: string[];
  zoneIds: string[];
  isAttached: boolean;
  resolve: (res: ProposeChangesResult) => void;
  resolved: boolean;
}

const tabSessions = new Map<string, TabReviewSession>();
let globalDoc: DocumentManager | null = null;
let boundEditor: monaco.editor.IStandaloneCodeEditor | null = null;
let isKeyHandlerBound = false;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getOrCreateStickyBar(): HTMLElement | null {
  let stickyBar = document.getElementById('inline-diff-sticky-bar');
  if (!stickyBar) {
    stickyBar = document.createElement('div');
    stickyBar.id = 'inline-diff-sticky-bar';
    stickyBar.className = 'inline-diff-sticky-bar';
    stickyBar.style.display = 'none';

    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
      editorContainer.appendChild(stickyBar);
    }
  }
  return stickyBar;
}

function hideStickyBar() {
  const stickyBar = document.getElementById('inline-diff-sticky-bar');
  if (stickyBar) {
    stickyBar.style.display = 'none';
    stickyBar.replaceChildren();
  }
}

function getCurrentActiveTabId(): string {
  if (globalDoc?.currentTabId) {
    return globalDoc.currentTabId;
  }
  if (boundEditor) {
    return boundEditor.getModel()?.uri.toString() || 'default';
  }
  return 'default';
}

function ensureKeyHandler() {
  if (isKeyHandlerBound) return;
  isKeyHandlerBound = true;

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      const activeTabId = getCurrentActiveTabId();
      if (!activeTabId) return;
      const session = tabSessions.get(activeTabId);
      if (!session || !session.isAttached || session.resolved) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finishSession(session, false);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        finishSession(session, true);
      }
    },
    true,
  );
}

function updateStickyBar(session: TabReviewSession) {
  const stickyBar = getOrCreateStickyBar();
  if (!stickyBar) return;
  stickyBar.replaceChildren();

  const infoEl = document.createElement('div');
  infoEl.className = 'inline-diff-sticky-info';

  const tabTag = session.tabTitle
    ? `<span class="inline-diff-tab-tag">${escapeHtml(session.tabTitle)}</span>`
    : '';

  infoEl.innerHTML = `${tabTag}<span class="inline-diff-sticky-badge">${session.hunks.length}</span>개의 인라인 변경 사항 검토 중`;
  stickyBar.appendChild(infoEl);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'inline-diff-sticky-actions';

  const btnAcceptAll = document.createElement('button');
  btnAcceptAll.type = 'button';
  btnAcceptAll.className = 'inline-diff-btn accept';
  btnAcceptAll.innerHTML = '<span>✓ 모두 수락</span> <kbd>Ctrl+Enter</kbd>';
  btnAcceptAll.title = '이 파일의 모든 변경 사항 일괄 수락 (Ctrl+Enter)';
  btnAcceptAll.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    finishSession(session, true);
  };

  const btnDiscardAll = document.createElement('button');
  btnDiscardAll.type = 'button';
  btnDiscardAll.className = 'inline-diff-btn discard';
  btnDiscardAll.innerHTML = '<span>✕ 모두 되돌리기</span> <kbd>Esc</kbd>';
  btnDiscardAll.title = '이 파일의 모든 변경 사항 취소 및 원본 복원 (Esc)';
  btnDiscardAll.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    finishSession(session, false);
  };

  btnGroup.appendChild(btnAcceptAll);
  btnGroup.appendChild(btnDiscardAll);
  stickyBar.appendChild(btnGroup);
  stickyBar.style.display = 'flex';
}

function attachSession(session: TabReviewSession) {
  if (session.resolved) return;
  const editor = session.editor;
  const model = session.model;

  // Verify that the editor is currently displaying this session's model
  if (editor.getModel() !== model) {
    return;
  }

  // Remove existing zones if any
  if (session.zoneIds.length > 0) {
    editor.changeViewZones((accessor) => {
      for (const zid of session.zoneIds) {
        accessor.removeZone(zid);
      }
    });
    session.zoneIds = [];
  }

  const layoutInfo = editor.getLayoutInfo();
  const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight) || 19;
  const fontInfo = editor.getOption(monaco.editor.EditorOption.fontInfo);
  const contentLeft = layoutInfo.contentLeft || 60;
  const ACTION_BAR_HEIGHT = 26;

  editor.changeViewZones((accessor) => {
    session.hunks.forEach((hunk, idx) => {
      const afterLine = Math.max(0, hunk.modifiedStart - 1);
      const zoneDom = document.createElement('div');
      zoneDom.className = 'inline-diff-hunk-zone';
      zoneDom.style.pointerEvents = 'auto';
      zoneDom.style.cursor = 'default';

      // 1. Action Row
      const actionRow = document.createElement('div');
      actionRow.className = 'inline-diff-hunk-actions';
      actionRow.style.paddingLeft = `${contentLeft}px`;
      actionRow.style.height = `${ACTION_BAR_HEIGHT}px`;
      actionRow.style.pointerEvents = 'auto';
      actionRow.style.cursor = 'default';

      const label = document.createElement('span');
      label.className = 'inline-diff-hunk-label';
      label.textContent = `변경 #${idx + 1}`;
      actionRow.appendChild(label);

      const btnAccept = document.createElement('button');
      btnAccept.type = 'button';
      btnAccept.className = 'inline-diff-hunk-btn accept';
      btnAccept.title = '이 변경만 수락';
      btnAccept.innerHTML = '✓ 수락';
      btnAccept.style.cursor = 'pointer';
      btnAccept.style.pointerEvents = 'auto';
      const onAcceptClick = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        resolveSingleHunk(session, idx, true);
      };
      btnAccept.addEventListener('pointerdown', (e) => e.stopPropagation());
      btnAccept.addEventListener('mousedown', (e) => e.stopPropagation());
      btnAccept.addEventListener('mouseup', (e) => e.stopPropagation());
      btnAccept.addEventListener('click', onAcceptClick);

      const btnDiscard = document.createElement('button');
      btnDiscard.type = 'button';
      btnDiscard.className = 'inline-diff-hunk-btn discard';
      btnDiscard.title = '이 변경 되돌리기';
      btnDiscard.innerHTML = '✕ 되돌리기';
      btnDiscard.style.cursor = 'pointer';
      btnDiscard.style.pointerEvents = 'auto';
      const onDiscardClick = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        resolveSingleHunk(session, idx, false);
      };
      btnDiscard.addEventListener('pointerdown', (e) => e.stopPropagation());
      btnDiscard.addEventListener('mousedown', (e) => e.stopPropagation());
      btnDiscard.addEventListener('mouseup', (e) => e.stopPropagation());
      btnDiscard.addEventListener('click', onDiscardClick);

      actionRow.appendChild(btnAccept);
      actionRow.appendChild(btnDiscard);
      zoneDom.appendChild(actionRow);

      // 2. Deleted lines
      let deletedLinesHeight = 0;
      if (hunk.originalLines.length > 0) {
        deletedLinesHeight = hunk.originalLines.length * lineHeight;
        const deleteContainer = document.createElement('div');
        deleteContainer.className = 'inline-diff-viewzone-delete';
        deleteContainer.style.height = `${deletedLinesHeight}px`;

        for (const lineText of hunk.originalLines) {
          const lineEl = document.createElement('div');
          lineEl.className = 'inline-diff-line-delete';
          lineEl.style.height = `${lineHeight}px`;
          lineEl.style.lineHeight = `${lineHeight}px`;
          lineEl.style.paddingLeft = `${contentLeft}px`;
          if (fontInfo?.fontFamily) lineEl.style.fontFamily = fontInfo.fontFamily;
          if (fontInfo?.fontSize) lineEl.style.fontSize = `${fontInfo.fontSize}px`;

          const prefix = document.createElement('span');
          prefix.className = 'inline-diff-prefix';
          prefix.textContent = '- ';
          const code = document.createElement('span');
          code.className = 'inline-diff-text';
          code.textContent = lineText || ' ';
          lineEl.appendChild(prefix);
          lineEl.appendChild(code);
          deleteContainer.appendChild(lineEl);
        }
        zoneDom.appendChild(deleteContainer);
      }

      const totalPx = ACTION_BAR_HEIGHT + deletedLinesHeight;
      zoneDom.style.height = `${totalPx}px`;

      const zoneId = accessor.addZone({
        afterLineNumber: afterLine,
        heightInPx: totalPx,
        domNode: zoneDom,
        suppressMouseDown: false,
      });
      session.zoneIds.push(zoneId);
    });
  });

  session.isAttached = true;
  updateStickyBar(session);
}

function detachSession(session: TabReviewSession) {
  if (!session.isAttached) return;
  if (session.zoneIds.length > 0) {
    session.editor.changeViewZones((accessor) => {
      for (const zid of session.zoneIds) {
        accessor.removeZone(zid);
      }
    });
    session.zoneIds = [];
  }
  session.isAttached = false;
  hideStickyBar();
}

function finishSession(session: TabReviewSession, accepted: boolean) {
  if (session.resolved) return;
  session.resolved = true;

  // Detach viewzones
  if (session.zoneIds.length > 0) {
    session.editor.changeViewZones((accessor) => {
      for (const zid of session.zoneIds) {
        accessor.removeZone(zid);
      }
    });
    session.zoneIds = [];
  }
  session.isAttached = false;

  // Clear decorations on this model
  session.editor.deltaDecorations(session.decorationIds, []);
  session.decorationIds = [];

  // Remove from map
  tabSessions.delete(session.tabId);

  // If this session's tab was active, hide sticky bar
  const currentActiveTabId = getCurrentActiveTabId();
  if (currentActiveTabId === session.tabId || !tabSessions.has(currentActiveTabId)) {
    hideStickyBar();
  }

  if (!accepted) {
    // Revert model text to initial original text
    session.editor.pushUndoStop();
    session.editor.executeEdits('propose-changes-discard', [
      { range: session.model.getFullModelRange(), text: session.initialOriginalText },
    ]);
    session.editor.pushUndoStop();

    if (session.wasCleanBefore && globalDoc) {
      globalDoc.markTabClean(session.tabId);
    }
  }

  session.editor.focus();
  session.resolve({ accepted });
}

function resolveSingleHunk(session: TabReviewSession, hunkIdx: number, acceptHunk: boolean) {
  const hunk = session.hunks[hunkIdx];
  if (!hunk || session.resolved) return;

  const editor = session.editor;
  const model = session.model;

  if (acceptHunk) {
    // [수락] 해당 변경 사항을 기준 원본(originalText)에 반영하여 diff 재계산 시 제외되도록 처리
    const origLines = session.originalText.split(/\r?\n/);
    origLines.splice(hunk.originalStart - 1, hunk.originalLines.length, ...hunk.modifiedLines);
    session.originalText = origLines.join(model.getEOL());
  } else {
    // [되돌리기] 해당 변경 사항을 에디터 모델에서 원래 줄로 복구
    const viewState = editor.saveViewState();
    const modelLines = model.getValue().split(/\r?\n/);
    modelLines.splice(hunk.modifiedStart - 1, hunk.modifiedLines.length, ...hunk.originalLines);
    const newModelText = modelLines.join(model.getEOL());

    editor.pushUndoStop();
    editor.executeEdits('revert-hunk', [{ range: model.getFullModelRange(), text: newModelText }]);
    editor.pushUndoStop();
    if (viewState) {
      editor.restoreViewState(viewState);
    }
  }

  // 기준 원본과 현재 모델 내용 간의 diff 재계산
  const updatedText = model.getValue();
  session.hunks = computeLineDiff(session.originalText, updatedText);

  if (session.hunks.length === 0) {
    const hasChangesAccepted = updatedText !== session.initialOriginalText;
    finishSession(session, hasChangesAccepted);
    if (!hasChangesAccepted && session.wasCleanBefore && globalDoc) {
      globalDoc.markTabClean(session.tabId);
    }
    return;
  }

  // 남은 변경 사항에 대한 녹색 하이라이트(데코레이션) 갱신
  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  for (const h of session.hunks) {
    if (h.modifiedLines.length > 0) {
      const startLine = h.modifiedStart;
      const endLine = h.modifiedStart + h.modifiedLines.length - 1;
      decorations.push({
        range: new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine)),
        options: {
          isWholeLine: true,
          className: 'inline-diff-line-insert',
          linesDecorationsClassName: 'inline-diff-gutter-insert',
          overviewRuler: {
            color: 'rgba(46, 160, 67, 0.6)',
            position: monaco.editor.OverviewRulerLane.Left,
          },
        },
      });
    }
  }
  session.decorationIds = editor.deltaDecorations(session.decorationIds, decorations);

  // 뷰존 재배치 및 스티키 바 갱신
  attachSession(session);
}

export function syncInlineReviewForTab(activeTabId: string) {
  // 1. Clean up sessions of closed tabs
  if (globalDoc) {
    const existingIds = new Set(globalDoc.allTabs.map((t) => t.id));
    for (const [tabId, session] of tabSessions.entries()) {
      if (!existingIds.has(tabId)) {
        finishSession(session, false);
      }
    }
  }

  // 2. Detach viewzones from inactive tabs
  for (const [tabId, session] of tabSessions.entries()) {
    if (tabId !== activeTabId && session.isAttached) {
      detachSession(session);
    }
  }

  // 3. Attach session for active tab if exists
  const activeSession = tabSessions.get(activeTabId);
  if (activeSession && !activeSession.resolved) {
    attachSession(activeSession);
  } else {
    hideStickyBar();
  }
}

export function detachTabZones(tabId: string) {
  const session = tabSessions.get(tabId);
  if (session && session.isAttached) {
    detachSession(session);
  }
}

export function initInlineReview(doc: DocumentManager, editor: monaco.editor.IStandaloneCodeEditor) {
  globalDoc = doc;
  boundEditor = editor;
  ensureKeyHandler();

  doc.onBeforeSwitchTab((fromTabId) => {
    detachTabZones(fromTabId);
  });

  doc.onChange(() => {
    syncInlineReviewForTab(doc.currentTabId);
  });

  editor.onDidChangeModel(() => {
    syncInlineReviewForTab(doc.currentTabId);
  });
}

export async function proposeEditorChanges(
  editor: monaco.editor.IStandaloneCodeEditor,
  proposedText: string,
  _options?: ProposeChangesOptions,
  targetTabId?: string,
): Promise<ProposeChangesResult> {
  const model = editor.getModel();
  if (!model) return { accepted: false };

  boundEditor = editor;
  ensureKeyHandler();

  const tabId = targetTabId || getCurrentActiveTabId();
  const targetTab = globalDoc?.allTabs.find((t) => t.id === tabId);
  const tabTitle = targetTab?.title || '';
  const wasCleanBefore = targetTab ? !globalDoc?.isTabDirty(targetTab) : false;

  // Cancel any existing session for this specific tab
  const existingSession = tabSessions.get(tabId);
  if (existingSession) {
    finishSession(existingSession, false);
  }

  const originalText = model.getValue();
  if (originalText === proposedText) {
    return { accepted: true };
  }

  // 1. Compute diff hunks
  const hunks = computeLineDiff(originalText, proposedText);
  if (hunks.length === 0) {
    return { accepted: true };
  }

  // 2. Temporarily apply proposed edits
  editor.pushUndoStop();
  editor.executeEdits('propose-changes', [
    { range: model.getFullModelRange(), text: proposedText },
  ]);
  editor.pushUndoStop();

  // Scroll to first hunk
  const firstHunk = hunks[0];
  const firstModLine = Math.max(1, firstHunk.modifiedStart);
  editor.revealLineInCenter(firstModLine);
  editor.setPosition({ lineNumber: firstModLine, column: 1 });

  // 3. Highlight modified lines (green decorations)
  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  for (const hunk of hunks) {
    if (hunk.modifiedLines.length > 0) {
      const startLine = hunk.modifiedStart;
      const endLine = hunk.modifiedStart + hunk.modifiedLines.length - 1;
      decorations.push({
        range: new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine)),
        options: {
          isWholeLine: true,
          className: 'inline-diff-line-insert',
          linesDecorationsClassName: 'inline-diff-gutter-insert',
          overviewRuler: {
            color: 'rgba(46, 160, 67, 0.6)',
            position: monaco.editor.OverviewRulerLane.Left,
          },
        },
      });
    }
  }

  const decorationIds = editor.deltaDecorations([], decorations);

  return new Promise<ProposeChangesResult>((resolve) => {
    const session: TabReviewSession = {
      tabId,
      tabTitle,
      editor,
      model,
      originalText,
      initialOriginalText: originalText,
      wasCleanBefore,
      hunks,
      decorationIds,
      zoneIds: [],
      isAttached: false,
      resolve,
      resolved: false,
    };

    tabSessions.set(tabId, session);

    // If this tab is the active tab, attach immediately
    if (tabId === getCurrentActiveTabId()) {
      attachSession(session);
    }
  });
}

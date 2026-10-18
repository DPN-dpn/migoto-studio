import { monaco } from './monaco';
import { computeLineDiff, DiffHunk } from './diff';

export interface ProposeChangesOptions {
  title?: string;
  description?: string;
  highlightOnly?: boolean;
}

export interface ProposeChangesResult {
  accepted: boolean;
}

interface ActiveSession {
  cancel: () => void;
  accept: () => void;
  hunkCount: number;
}

let activeReviewSession: ActiveSession | null = null;

export async function proposeEditorChanges(
  editor: monaco.editor.IStandaloneCodeEditor,
  proposedText: string,
  _options?: ProposeChangesOptions,
): Promise<ProposeChangesResult> {
  const model = editor.getModel();
  if (!model) return { accepted: false };

  // If there's an ongoing session, cancel it first
  if (activeReviewSession) {
    activeReviewSession.cancel();
    activeReviewSession = null;
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

  // 2. Temporarily apply the proposed changes to the editor
  editor.pushUndoStop();
  editor.executeEdits('propose-changes', [
    { range: model.getFullModelRange(), text: proposedText },
  ]);
  editor.pushUndoStop();

  // Scroll to first changed hunk
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
    let resolved = false;

    // 4. Create ViewZones for deleted lines and hunk actions
    const zoneIds: string[] = [];

    // Helper to accept/discard a single hunk
    const resolveHunk = (hunkIdx: number, acceptHunk: boolean) => {
      const hunk = hunks[hunkIdx];
      if (!hunk) return;

      const currentModel = editor.getModel();
      if (!currentModel) return;

      if (!acceptHunk) {
        // Revert this hunk back to original lines
        const modStart = hunk.modifiedStart;
        const modCount = hunk.modifiedLines.length;
        const origText = hunk.originalLines.join(currentModel.getEOL());

        editor.pushUndoStop();
        if (modCount > 0) {
          const modEnd = modStart + modCount - 1;
          const range = new monaco.Range(modStart, 1, modEnd, currentModel.getLineMaxColumn(modEnd));
          editor.executeEdits('revert-hunk', [{ range, text: origText }]);
        } else {
          // Pure insertion revert (delete inserted lines)
          const range = new monaco.Range(modStart, 1, modStart, 1);
          editor.executeEdits('revert-hunk', [{ range, text: origText.length ? origText + currentModel.getEOL() : '' }]);
        }
        editor.pushUndoStop();
      }

      // Check if all hunks are resolved
      hunks.splice(hunkIdx, 1);
      if (hunks.length === 0) {
        finish(acceptHunk);
      } else {
        // Re-propose remaining changes with updated text
        const updatedText = currentModel.getValue();
        finish(acceptHunk);
        proposeEditorChanges(editor, updatedText);
      }
    };

    const layoutInfo = editor.getLayoutInfo();
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight) || 19;
    const fontInfo = editor.getOption(monaco.editor.EditorOption.fontInfo);
    const contentLeft = layoutInfo.contentLeft || 60;
    const ACTION_BAR_HEIGHT = 26;

    editor.changeViewZones((accessor) => {
      hunks.forEach((hunk, idx) => {
        const afterLine = Math.max(0, hunk.modifiedStart - 1);

        const zoneDom = document.createElement('div');
        zoneDom.className = 'inline-diff-hunk-zone';

        // 1. Inline hunk action bar (displayed right at the top of the change)
        const actionRow = document.createElement('div');
        actionRow.className = 'inline-diff-hunk-actions';
        actionRow.style.paddingLeft = `${contentLeft}px`;
        actionRow.style.height = `${ACTION_BAR_HEIGHT}px`;

        const label = document.createElement('span');
        label.className = 'inline-diff-hunk-label';
        label.textContent = `변경 #${idx + 1}`;
        actionRow.appendChild(label);

        const btnAccept = document.createElement('button');
        btnAccept.className = 'inline-diff-hunk-btn accept';
        btnAccept.title = '이 변경만 수락';
        btnAccept.innerHTML = '✓ 수락';
        btnAccept.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          resolveHunk(idx, true);
        };

        const btnDiscard = document.createElement('button');
        btnDiscard.className = 'inline-diff-hunk-btn discard';
        btnDiscard.title = '이 변경 되돌리기';
        btnDiscard.innerHTML = '✕ 되돌리기';
        btnDiscard.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          resolveHunk(idx, false);
        };

        actionRow.appendChild(btnAccept);
        actionRow.appendChild(btnDiscard);
        zoneDom.appendChild(actionRow);

        // 2. Deleted original lines block
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
          suppressMouseDown: true,
        });
        zoneIds.push(zoneId);
      });
    });

    // 5. Sticky Header Bar at the top of the editor
    let stickyBar = document.getElementById('inline-diff-sticky-bar');
    if (!stickyBar) {
      stickyBar = document.createElement('div');
      stickyBar.id = 'inline-diff-sticky-bar';
      stickyBar.className = 'inline-diff-sticky-bar';

      const editorContainer = document.getElementById('editor-container');
      if (editorContainer) {
        editorContainer.appendChild(stickyBar);
      }
    }

    stickyBar.replaceChildren();

    const infoEl = document.createElement('div');
    infoEl.className = 'inline-diff-sticky-info';
    infoEl.innerHTML = `<span class="inline-diff-sticky-badge">${hunks.length}</span>개의 인라인 변경 사항 검토 중`;
    stickyBar.appendChild(infoEl);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'inline-diff-sticky-actions';

    const btnAcceptAll = document.createElement('button');
    btnAcceptAll.className = 'inline-diff-btn accept';
    btnAcceptAll.innerHTML = '<span>✓ 모두 수락</span> <kbd>Ctrl+Enter</kbd>';
    btnAcceptAll.title = '모든 변경 사항 일괄 수락 (Ctrl+Enter)';
    btnAcceptAll.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      finish(true);
    };

    const btnDiscardAll = document.createElement('button');
    btnDiscardAll.className = 'inline-diff-btn discard';
    btnDiscardAll.innerHTML = '<span>✕ 모두 되돌리기</span> <kbd>Esc</kbd>';
    btnDiscardAll.title = '모든 변경 사항 취소 및 원본 복원 (Esc)';
    btnDiscardAll.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      finish(false);
    };

    btnGroup.appendChild(btnAcceptAll);
    btnGroup.appendChild(btnDiscardAll);
    stickyBar.appendChild(btnGroup);
    stickyBar.style.display = 'flex';

    const cleanup = () => {
      // Hide sticky bar
      if (stickyBar) {
        stickyBar.style.display = 'none';
        stickyBar.replaceChildren();
      }

      // Remove decorations
      editor.deltaDecorations(decorationIds, []);

      // Remove viewzones
      editor.changeViewZones((accessor) => {
        for (const zid of zoneIds) {
          accessor.removeZone(zid);
        }
      });

      // Unbind key listeners
      window.removeEventListener('keydown', keyHandler, true);
      activeReviewSession = null;
    };

    const finish = (accepted: boolean) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      if (!accepted) {
        // Rollback text
        editor.pushUndoStop();
        editor.executeEdits('propose-changes-discard', [
          { range: model.getFullModelRange(), text: originalText },
        ]);
        editor.pushUndoStop();
      }

      editor.focus();
      resolve({ accepted });
    };

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      }
    };

    window.addEventListener('keydown', keyHandler, true);

    activeReviewSession = {
      cancel: () => finish(false),
      accept: () => finish(true),
      hunkCount: hunks.length,
    };
  });
}

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

class ReviewToolbarWidget implements monaco.editor.IContentWidget {
  private domNode: HTMLElement;
  private id: string;
  private lineNumber: number;

  constructor(
    id: string,
    lineNumber: number,
    title: string,
    description: string,
    onAccept: () => void,
    onDiscard: () => void,
  ) {
    this.id = id;
    this.lineNumber = lineNumber;

    this.domNode = document.createElement('div');
    this.domNode.className = 'inline-diff-toolbar';

    const header = document.createElement('div');
    header.className = 'inline-diff-toolbar-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'inline-diff-toolbar-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (description) {
      const descEl = document.createElement('span');
      descEl.className = 'inline-diff-toolbar-desc';
      descEl.textContent = description;
      header.appendChild(descEl);
    }

    const actions = document.createElement('div');
    actions.className = 'inline-diff-toolbar-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'inline-diff-btn accept';
    acceptBtn.innerHTML = '<span>✓ 수락</span> <kbd>Ctrl+Enter</kbd>';
    acceptBtn.title = '변경사항 적용 (Ctrl+Enter)';
    acceptBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onAccept();
    };

    const discardBtn = document.createElement('button');
    discardBtn.className = 'inline-diff-btn discard';
    discardBtn.innerHTML = '<span>✕ 되돌리기</span> <kbd>Esc</kbd>';
    discardBtn.title = '변경사항 취소 (Esc)';
    discardBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onDiscard();
    };

    actions.appendChild(acceptBtn);
    actions.appendChild(discardBtn);

    this.domNode.appendChild(header);
    this.domNode.appendChild(actions);
  }

  getId(): string {
    return this.id;
  }

  getDomNode(): HTMLElement {
    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition | null {
    return {
      position: { lineNumber: Math.max(1, this.lineNumber), column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.EXACT],
    };
  }
}

let activeReviewSession: {
  cancel: () => void;
} | null = null;

export async function proposeEditorChanges(
  editor: monaco.editor.IStandaloneCodeEditor,
  proposedText: string,
  options?: ProposeChangesOptions,
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

  // 4. Create ViewZones for deleted lines (red strikethrough zone)
  const zoneIds: string[] = [];
  editor.changeViewZones((accessor) => {
    for (const hunk of hunks) {
      if (hunk.originalLines.length > 0) {
        // Position view zone after line (hunk.modifiedStart - 1)
        const afterLine = Math.max(0, hunk.modifiedStart - 1);

        const zoneDom = document.createElement('div');
        zoneDom.className = 'inline-diff-viewzone-delete';
        for (const lineText of hunk.originalLines) {
          const lineEl = document.createElement('div');
          lineEl.className = 'inline-diff-line-delete';
          const prefix = document.createElement('span');
          prefix.className = 'inline-diff-prefix';
          prefix.textContent = '- ';
          const code = document.createElement('span');
          code.className = 'inline-diff-text';
          code.textContent = lineText || ' ';
          lineEl.appendChild(prefix);
          lineEl.appendChild(code);
          zoneDom.appendChild(lineEl);
        }

        const zoneId = accessor.addZone({
          afterLineNumber: afterLine,
          heightInLines: hunk.originalLines.length,
          domNode: zoneDom,
          suppressMouseDown: true,
        });
        zoneIds.push(zoneId);
      }
    }
  });

  return new Promise<ProposeChangesResult>((resolve) => {
    let resolved = false;

    // 5. Floating action widget
    const widgetId = `inline-diff-toolbar-${Date.now()}`;
    const toolbar = new ReviewToolbarWidget(
      widgetId,
      firstModLine,
      options?.title || '변경 제안 검토',
      options?.description || `${hunks.length}개 블록 변경됨`,
      () => finish(true),
      () => finish(false),
    );

    editor.addContentWidget(toolbar);
    editor.layoutContentWidget(toolbar);

    const cleanup = () => {
      // Remove widget
      editor.removeContentWidget(toolbar);

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
    };
  });
}

import type { monaco } from '../editor/monaco.ts';
let monacoRef: typeof monaco | null = null;
import type { DocumentManager } from '../workspace/documents.ts';
import { platform, type FileRef } from '../../platform/index.ts';
import { showToast } from '../../ui/common/toast.ts';

export const LANGUAGE_ID = 'migoto';

export type SymbolKind = 'variable' | 'section' | 'namespace';

export interface SymbolTarget {
  name: string;        // e.g. "$swapvar", "TextureOverrideBody"
  cleanName: string;   // e.g. "swapvar", "TextureOverrideBody"
  kind: SymbolKind;
  namespace?: string;  // e.g. "Raiden"
  rawMatch: string;
  range: monaco.IRange;
}

export interface SymbolOccurrence {
  title: string;        // Tab/File title e.g. "main.ini"
  filePath?: string;    // Relative or absolute path
  fileRef?: FileRef | null;
  tabId?: string;
  uri: monaco.Uri;
  range: monaco.IRange;
  lineContent: string;
  section: string;      // Enclosing section e.g. "[Constants]"
  isDefinition: boolean;
  kind: SymbolKind;
  matchedText: string;
}

/**
 * Strips comments from line respecting quotes.
 */
function cleanLineCode(line: string): string {
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ';' || (ch === '/' && line[i + 1] === '/')) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Resolves the symbol under cursor at the specified position.
 */
export function getSymbolAtPosition(
  model: monaco.editor.ITextModel,
  position: monaco.IPosition,
): SymbolTarget | null {
  const lineNum = position.lineNumber;
  const col = position.column;
  const rawLine = model.getLineContent(lineNum);
  const code = cleanLineCode(rawLine);

  // 1. Inside section header: `[SectionName]`
  const secHeaderMatch = /^\s*\[([^\]\r\n]+)\]/.exec(code);
  if (secHeaderMatch) {
    const startCol = code.indexOf('[') + 2; // 1-based, inside bracket
    const endCol = code.indexOf(']', startCol - 1) + 1; // 1-based exclusive
    if (col >= startCol - 1 && col <= endCol) {
      const secName = secHeaderMatch[1].trim();
      return {
        name: `[${secName}]`,
        cleanName: secName,
        kind: 'section',
        rawMatch: secHeaderMatch[0],
        range: {
          startLineNumber: lineNum,
          startColumn: startCol - 1,
          endLineNumber: lineNum,
          endColumn: endCol,
        },
      };
    }
  }

  // 2. Variable reference or declaration: `\$[a-zA-Z0-9_.\-\\]+`
  const varRe = /\$([a-zA-Z0-9_\\/](?:[a-zA-Z0-9_.\-\\\/]*[a-zA-Z0-9_\\/])?)/g;
  let vm: RegExpExecArray | null;
  while ((vm = varRe.exec(code)) !== null) {
    const startCol = vm.index + 1; // 1-based
    const endCol = startCol + vm[0].length;
    if (col >= startCol && col <= endCol) {
      const rawVar = vm[0]; // e.g. "$swapvar" or "$\Raiden\costume" or "$\ShaderFixes\help.ini\notification_timeout"
      const content = vm[1]; // e.g. "swapvar" or "\Raiden\costume"

      // Check namespace: $\Raiden\costume or $\ShaderFixes\help.ini\notification_timeout
      let namespace: string | undefined;
      let cleanVar = content;
      if (content.includes('\\')) {
        const parts = content.split('\\').filter(Boolean);
        if (parts.length >= 2) {
          namespace = parts.slice(0, -1).join('\\');
          cleanVar = parts[parts.length - 1];
        }
      }

      return {
        name: rawVar,
        cleanName: cleanVar,
        kind: 'variable',
        namespace,
        rawMatch: rawVar,
        range: {
          startLineNumber: lineNum,
          startColumn: startCol,
          endLineNumber: lineNum,
          endColumn: endCol,
        },
      };
    }
  }

  // 3. Section references on key/value lines:
  // e.g. run = CommandListSwap, vb0 = ResourceIB, ref TargetSection
  // or CommandList\Raiden\Action, ResourceTest.01
  const wordAtPos = model.getWordAtPosition(position);
  let candidateWord = wordAtPos?.word ?? '';
  let tokenStartCol = wordAtPos?.startColumn ?? col;
  let tokenEndCol = wordAtPos?.endColumn ?? col;

  if (!candidateWord && col - 1 < code.length && /[a-zA-Z0-9_.\-\\]/.test(code[col - 1])) {
    let start = col - 1;
    let end = col - 1;
    while (start > 0 && /[a-zA-Z0-9_.\-\\]/.test(code[start - 1])) {
      start--;
    }
    while (end < code.length && /[a-zA-Z0-9_.\-\\]/.test(code[end])) {
      end++;
    }
    const token = code.slice(start, end).replace(/^[.\-]+|[.\-]+$/g, '');
    if (token) {
      candidateWord = token;
      tokenStartCol = start + 1;
      tokenEndCol = tokenStartCol + token.length;
    }
  } else if (candidateWord) {
    let start = tokenStartCol - 1;
    let end = tokenEndCol - 1;
    while (start > 0 && /[a-zA-Z0-9_.\-\\]/.test(code[start - 1])) {
      start--;
    }
    while (end < code.length && /[a-zA-Z0-9_.\-\\]/.test(code[end])) {
      end++;
    }
    const expanded = code.slice(start, end).replace(/^[.\-]+|[.\-]+$/g, '');
    if (expanded && expanded.length > candidateWord.length) {
      candidateWord = expanded;
      tokenStartCol = start + 1;
      tokenEndCol = tokenStartCol + expanded.length;
    }
  }

  if (candidateWord) {
    // Check if the line has section assignment or if word starts with common 3DMigoto section prefixes
    const isSectionContext =
      /(?:(?:pre\s+|post\s+)?run|vb\d+|ib|[a-z]{2}-[tu]\d+|Resource|ref)\s*=/i.test(code) ||
      /\bref\s+/i.test(code);

    const isKnownSectionPrefix =
      /^(?:commandlist|resource|textureoverride|shaderoverride|shaderregex|customshader|constants|key)/i.test(candidateWord);

    // Also check namespace pattern like CommandList\Raiden\Action on line
    const nsSecMatch = /(?:CommandList|Resource)\\[a-zA-Z0-9_.\-\\\/]+/i.exec(code);
    if (nsSecMatch) {
      const matchStart = nsSecMatch.index + 1;
      const matchEnd = matchStart + nsSecMatch[0].length;
      if (col >= matchStart && col <= matchEnd) {
        const parts = nsSecMatch[0].split('\\').filter(Boolean);
        const namespace = parts.length > 2 ? parts[1] : undefined;
        const cleanName = parts[parts.length - 1];
        return {
          name: nsSecMatch[0],
          cleanName: parts.length > 2 ? `${parts[0]}${cleanName}` : nsSecMatch[0],
          kind: 'section',
          namespace,
          rawMatch: nsSecMatch[0],
          range: {
            startLineNumber: lineNum,
            startColumn: matchStart,
            endLineNumber: lineNum,
            endColumn: matchEnd,
          },
        };
      }
    }

    if (isSectionContext || isKnownSectionPrefix) {
      return {
        name: candidateWord,
        cleanName: candidateWord,
        kind: 'section',
        rawMatch: candidateWord,
        range: {
          startLineNumber: lineNum,
          startColumn: tokenStartCol,
          endLineNumber: lineNum,
          endColumn: tokenEndCol,
        },
      };
    }

    // Check if candidateWord matches an existing section header in this model
    const secExistRe = new RegExp(`^\\s*\\[\\s*${escapeRegExp(candidateWord)}\\s*\\]`, 'im');
    if (secExistRe.test(model.getValue())) {
      return {
        name: candidateWord,
        cleanName: candidateWord,
        kind: 'section',
        rawMatch: candidateWord,
        range: {
          startLineNumber: lineNum,
          startColumn: tokenStartCol,
          endLineNumber: lineNum,
          endColumn: tokenEndCol,
        },
      };
    }
  }

  return null;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Searches a text model for occurrences and definitions of target symbol.
 */
export function scanModelOccurrences(
  model: monaco.editor.ITextModel,
  target: SymbolTarget,
  title: string,
  tabId?: string,
  fileRef?: FileRef | null,
  filePath?: string,
): SymbolOccurrence[] {
  const results: SymbolOccurrence[] = [];
  const lineCount = model.getLineCount();
  let currentSection = '';

  const targetCleanLower = target.cleanName.toLowerCase();
  const targetNameLower = target.name.toLowerCase();

  for (let line = 1; line <= lineCount; line++) {
    const rawLine = model.getLineContent(line);
    const code = cleanLineCode(rawLine);
    const trimmed = code.trim();
    if (!trimmed) continue;

    // 1. Check section header
    const secMatch = /^\s*\[([^\]\r\n]+)\]/.exec(code);
    if (secMatch) {
      currentSection = secMatch[1].trim();
      const currentSecLower = currentSection.toLowerCase();

      if (target.kind === 'section') {
        // Strict match: cleanName or full name
        if (
          currentSecLower === targetCleanLower ||
          currentSecLower === targetNameLower
        ) {
          const bracketIdx = rawLine.indexOf('[');
          results.push({
            title,
            tabId,
            fileRef,
            filePath,
            uri: model.uri,
            range: {
              startLineNumber: line,
              startColumn: bracketIdx + 2,
              endLineNumber: line,
              endColumn: bracketIdx + 2 + currentSection.length,
            },
            lineContent: trimmed,
            section: `[${currentSection}]`,
            isDefinition: true,
            kind: 'section',
            matchedText: `[${currentSection}]`,
          });
        }
      }
      continue;
    }

    // 2. Scan variable occurrences
    if (target.kind === 'variable') {
      const varRe = /\$([a-zA-Z0-9_\\/](?:[a-zA-Z0-9_.\-\\\/]*[a-zA-Z0-9_\\/])?)/g;
      let vm: RegExpExecArray | null;

      while ((vm = varRe.exec(code)) !== null) {
        const fullMatched = vm[0]; // e.g. "$swapvar" or "$\Raiden\costume"
        const innerContent = vm[1]; // e.g. "swapvar" or "Raiden\costume"
        const innerLower = innerContent.toLowerCase();

        // Strict match within open model
        const isMatch =
          innerLower === targetCleanLower ||
          fullMatched.toLowerCase() === targetNameLower;

        if (isMatch) {
          const startCol = vm.index + 1;
          const endCol = startCol + fullMatched.length;

          // Determine if this is definition:
          // Line has global/persist/local $var, or is in [Constants] $var = ...
          const isConstSec = currentSection.toLowerCase() === 'constants';
          const isDeclModifier = /\b(?:global|persist|local)\s+\$/i.test(code);
          const isAssign = /^\s*(?:persist\s+|global\s+|local\s+)*\$[a-zA-Z0-9_.\-\\\/]+\s*=/i.test(code);
          const isKeyCycle = /^key/i.test(currentSection) && /^\s*\$[a-zA-Z0-9_.\-\\\/]+\s*=\s*[0-9,\s]+/i.test(code);

          const isDef = (isDeclModifier && isAssign) || (isConstSec && isAssign) || isKeyCycle;

          results.push({
            title,
            tabId,
            fileRef,
            filePath,
            uri: model.uri,
            range: {
              startLineNumber: line,
              startColumn: startCol,
              endLineNumber: line,
              endColumn: endCol,
            },
            lineContent: trimmed,
            section: currentSection ? `[${currentSection}]` : '(전역)',
            isDefinition: isDef,
            kind: 'variable',
            matchedText: fullMatched,
          });
        }
      }
    }

    // 3. Scan section references
    if (target.kind === 'section') {
      const wordRe = new RegExp(`(?<![a-zA-Z0-9_.\-])${escapeRegExp(target.cleanName)}(?![a-zA-Z0-9_.\-])`, 'gi');
      let wm: RegExpExecArray | null;

      while ((wm = wordRe.exec(code)) !== null) {
        const startCol = wm.index + 1;
        const endCol = startCol + wm[0].length;

        results.push({
          title,
          tabId,
          fileRef,
          filePath,
          uri: model.uri,
          range: {
            startLineNumber: line,
            startColumn: startCol,
            endLineNumber: line,
            endColumn: endCol,
          },
          lineContent: trimmed,
          section: currentSection ? `[${currentSection}]` : '(전역)',
          isDefinition: false,
          kind: 'section',
          matchedText: wm[0],
        });
      }
    }
  }

  return results;
}

/**
 * Finds definition of a symbol within the current model synchronously.
 */
export function findDefinitionSync(
  target: SymbolTarget,
  currentModel: monaco.editor.ITextModel,
  doc: DocumentManager,
): SymbolOccurrence | null {
  // Current model only (strict single file core feature)
  const currentOccs = scanModelOccurrences(
    currentModel,
    target,
    doc.fileName,
    doc.currentTabId,
    doc.file,
  );
  return currentOccs.find((o) => o.isDefinition) ?? null;
}

/**
 * Finds all occurrences within the current model synchronously.
 */
export function findAllOccurrencesSync(
  target: SymbolTarget,
  currentModel: monaco.editor.ITextModel,
  doc: DocumentManager,
): SymbolOccurrence[] {
  // Current model only (strict single file core feature)
  return scanModelOccurrences(
    currentModel,
    target,
    doc.fileName,
    doc.currentTabId,
    doc.file,
  );
}

/**
 * Highlights a target line with a smooth fade-out animation.
 */
let highlightCollection: monaco.editor.IEditorDecorationsCollection | null = null;
let highlightTimer: number | null = null;

export function flashLineHighlight(
  editor: monaco.editor.IStandaloneCodeEditor,
  lineNumber: number,
) {
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }
  if (highlightCollection) {
    highlightCollection.clear();
  }

  highlightCollection = editor.createDecorationsCollection([
    {
      range: {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: 'symbol-target-flash',
      },
    },
  ]);

  highlightTimer = window.setTimeout(() => {
    highlightCollection?.clear();
    highlightCollection = null;
    highlightTimer = null;
  }, 1800);
}

export type CustomDefinitionResolver = (
  target: SymbolTarget,
  currentModel: monaco.editor.ITextModel,
  doc: DocumentManager,
) => Promise<SymbolOccurrence | null>;

export type CustomReferencesResolver = (
  target: SymbolTarget,
  currentModel: monaco.editor.ITextModel,
  doc: DocumentManager,
) => Promise<SymbolOccurrence[]>;

let customDefinitionResolver: CustomDefinitionResolver | null = null;
let customReferencesResolver: CustomReferencesResolver | null = null;

export function setCustomDefinitionResolver(resolver: CustomDefinitionResolver | null) {
  customDefinitionResolver = resolver;
}

export function setCustomReferencesResolver(resolver: CustomReferencesResolver | null) {
  customReferencesResolver = resolver;
}

/**
 * Action: Jump to definition (F12) - Plugins can provide cross-file namespace definitions via API.
 */
export async function jumpToDefinition(
  editor: monaco.editor.IStandaloneCodeEditor,
  doc: DocumentManager,
): Promise<boolean> {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return false;

  const target = getSymbolAtPosition(model, pos);
  if (!target) {
    showToast('커서 위치에 탐색할 섹션이나 변수가 없습니다.', 'info');
    return false;
  }

  // 1. Try plugin-provided definition resolver (e.g. cross-file same namespace from custom-lint)
  let def: SymbolOccurrence | null = null;
  if (customDefinitionResolver) {
    try {
      def = await customDefinitionResolver(target, model, doc);
    } catch (err) {
      console.warn('[symbol-nav] Custom definition resolver error:', err);
    }
  }

  // 2. Fallback to core single-file synchronous definition search
  if (!def) {
    def = findDefinitionSync(target, model, doc);
  }

  if (!def) {
    showToast(`선언된 위치를 찾을 수 없습니다: ${target.name}`, 'warn');
    return false;
  }

  // Check if cursor is already right at the definition in current file
  const isCurrentModel =
    def.uri.toString() === model.uri.toString() ||
    (def.filePath && doc.file?.id && def.filePath.toLowerCase().replace(/\\/g, '/') === doc.file.id.toLowerCase().replace(/\\/g, '/')) ||
    (def.title && doc.fileName && def.title.toLowerCase() === doc.fileName.toLowerCase());

  if (isCurrentModel && def.range.startLineNumber === pos.lineNumber) {
    showToast(`현재 위치가 ${target.name}의 선언부입니다. (Shift+F12로 사용된 곳 검색)`, 'info');
    return true;
  }

  await jumpToOccurrence(editor, doc, def);
  showToast(`[선언 이동] ${target.name} (${def.title} : Line ${def.range.startLineNumber})`, 'info');
  return true;
}

/**
 * Jumps editor and document tabs to the given occurrence.
 */
export async function jumpToOccurrence(
  editor: monaco.editor.IStandaloneCodeEditor,
  doc: DocumentManager,
  occ: SymbolOccurrence,
) {
  // If occurrence belongs to another tab
  if (occ.tabId && occ.tabId !== doc.currentTabId) {
    doc.switchTab(occ.tabId);
  } else if (occ.fileRef && (!doc.file || doc.file.id !== occ.fileRef.id)) {
    await doc.openFile(occ.fileRef);
  } else if (occ.filePath) {
    const normOccPath = occ.filePath.replace(/\\/g, '/').toLowerCase();
    const baseOccName = normOccPath.split('/').pop() || normOccPath;
    const targetTab = doc.allTabs.find((t) => {
      const tPath = (t.file?.id || t.title || '').replace(/\\/g, '/').toLowerCase();
      return (
        tPath === normOccPath ||
        tPath.endsWith(`/${normOccPath}`) ||
        normOccPath.endsWith(`/${tPath}`) ||
        t.title.toLowerCase() === baseOccName
      );
    });
    if (targetTab) {
      doc.switchTab(targetTab.id);
    } else {
      const ref = occ.fileRef || (occ.filePath ? platform().refFromId(occ.filePath) : null);
      if (ref) {
        await doc.openFile(ref);
      }
    }
  }

  editor.revealLineInCenter(occ.range.startLineNumber);
  editor.setPosition({
    lineNumber: occ.range.startLineNumber,
    column: occ.range.startColumn,
  });
  editor.focus();
  flashLineHighlight(editor, occ.range.startLineNumber);
}

/**
 * Action: Show references dialog (Shift+F12) - Plugins can provide cross-file namespace references via API.
 */
export async function showReferencesDialog(
  editor: monaco.editor.IStandaloneCodeEditor,
  doc: DocumentManager,
) {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return;

  const target = getSymbolAtPosition(model, pos);
  if (!target) {
    showToast('커서 위치에 탐색할 섹션이나 변수가 없습니다.', 'info');
    return;
  }

  // 1. Try plugin-provided references resolver (e.g. cross-file same namespace from custom-lint)
  let occs: SymbolOccurrence[] = [];
  if (customReferencesResolver) {
    try {
      occs = await customReferencesResolver(target, model, doc);
    } catch (err) {
      console.warn('[symbol-nav] Custom reference resolver error:', err);
    }
  }

  // 2. Fallback to core single-file synchronous references search
  if (occs.length === 0) {
    occs = findAllOccurrencesSync(target, model, doc);
  }

  if (occs.length === 0) {
    showToast(`참조 또는 사용된 위치를 찾을 수 없습니다: ${target.name}`, 'warn');
    return;
  }

  const { openReferencesModal } = await import('../../ui/modals/references-modal.ts');
  openReferencesModal(editor, doc, target, occs);
}

/**
 * Register Monaco Definition and Reference Providers.
 */
export function registerSymbolProviders(
  monacoInstance: typeof monaco,
  doc: DocumentManager,
) {
  monacoRef = monacoInstance;

  // 1. Definition Provider (F12, Ctrl+Click)
  monacoInstance.languages.registerDefinitionProvider(LANGUAGE_ID, {
    async provideDefinition(model, position) {
      const target = getSymbolAtPosition(model, position);
      if (!target) return null;

      let def: SymbolOccurrence | null = null;
      if (customDefinitionResolver) {
        try {
          def = await customDefinitionResolver(target, model, doc);
        } catch {}
      }
      if (!def) {
        def = findDefinitionSync(target, model, doc);
      }
      if (!def) return null;

      return {
        uri: def.uri,
        range: def.range,
      };
    },
  });

  // 2. Reference Provider (Shift+F12, Find All References)
  monacoInstance.languages.registerReferenceProvider(LANGUAGE_ID, {
    async provideReferences(model, position) {
      const target = getSymbolAtPosition(model, position);
      if (!target) return [];

      let occs: SymbolOccurrence[] = [];
      if (customReferencesResolver) {
        try {
          occs = await customReferencesResolver(target, model, doc);
        } catch {}
      }
      if (occs.length === 0) {
        occs = findAllOccurrencesSync(target, model, doc);
      }

      return occs.map((o) => ({
        uri: o.uri,
        range: o.range,
      }));
    },
  });

  // 3. Editor Opener for cross-model navigation
  monacoInstance.editor.registerEditorOpener({
    async openCodeEditor(sourceEditor, resource, selectionOrPosition) {
      const targetTab = doc.allTabs.find(
        (t) => t.model.uri.toString() === resource.toString(),
      );
      if (targetTab) {
        doc.switchTab(targetTab.id);
        if (selectionOrPosition) {
          if ('lineNumber' in selectionOrPosition) {
            sourceEditor.setPosition(selectionOrPosition);
            sourceEditor.revealPositionInCenter(selectionOrPosition);
          } else if ('startLineNumber' in selectionOrPosition) {
            sourceEditor.setSelection(selectionOrPosition);
            sourceEditor.revealRangeInCenter(selectionOrPosition);
          }
        }
        sourceEditor.focus();
        return true;
      }

      const path = resource.fsPath || resource.path;
      if (path) {
        const ref = platform().refFromId(path);
        if (ref) {
          await doc.openFile(ref);
        }
        if (selectionOrPosition) {
          if ('lineNumber' in selectionOrPosition) {
            sourceEditor.setPosition(selectionOrPosition);
            sourceEditor.revealPositionInCenter(selectionOrPosition);
          }
        }
        sourceEditor.focus();
        return true;
      }

      return false;
    },
  });
}


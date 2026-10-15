import type { monaco } from '../editor/monaco.ts';
let monacoRef: typeof monaco | null = null;
import type { DocumentManager, DocumentTab } from '../workspace/documents.ts';
import { platform, type FileRef } from '../../platform/index.ts';
import { showToast } from '../../ui/common/toast.ts';
import type { FileExplorer } from '../../ui/panels/explorer.ts';

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

  // 2. Variable reference or declaration: `\$[a-zA-Z0-9_\\]+`
  const varRe = /\$([a-zA-Z0-9_\\]+)/g;
  let vm: RegExpExecArray | null;
  while ((vm = varRe.exec(code)) !== null) {
    const startCol = vm.index + 1; // 1-based
    const endCol = startCol + vm[0].length;
    if (col >= startCol && col <= endCol) {
      const rawVar = vm[0]; // e.g. "$swapvar" or "$\Raiden\costume"
      const content = vm[1]; // e.g. "swapvar" or "\Raiden\costume" or "Raiden\costume"

      // Check namespace: $\Raiden\costume or $Raiden\costume
      let namespace: string | undefined;
      let cleanVar = content;
      if (content.includes('\\')) {
        const parts = content.split('\\').filter(Boolean);
        if (parts.length >= 2) {
          namespace = parts[0];
          cleanVar = parts.slice(1).join('\\');
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
  // or CommandList\Raiden\Action
  const wordAtPos = model.getWordAtPosition(position);
  if (wordAtPos && wordAtPos.word) {
    const word = wordAtPos.word;
    const startCol = wordAtPos.startColumn;
    const endCol = wordAtPos.endColumn;

    // Check if the line has section assignment or if word starts with common 3DMigoto section prefixes
    const isSectionContext =
      /(?:(?:pre\s+|post\s+)?run|vb\d+|ib|[a-z]{2}-[tu]\d+|Resource|ref)\s*=/i.test(code) ||
      /\bref\s+/i.test(code);

    const isKnownSectionPrefix =
      /^(?:commandlist|resource|textureoverride|shaderoverride|shaderregex|customshader|constants|key)/i.test(word);

    // Also check namespace pattern like CommandList\Raiden\Action on line
    const nsSecMatch = /(?:CommandList|Resource)\\[a-zA-Z0-9_\\]+/i.exec(code);
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
        name: word,
        cleanName: word,
        kind: 'section',
        rawMatch: word,
        range: {
          startLineNumber: lineNum,
          startColumn: startCol,
          endLineNumber: lineNum,
          endColumn: endCol,
        },
      };
    }

    // Check if word matches an existing section header in this model
    const secExistRe = new RegExp(`^\\s*\\[\\s*${escapeRegExp(word)}\\s*\\]`, 'im');
    if (secExistRe.test(model.getValue())) {
      return {
        name: word,
        cleanName: word,
        kind: 'section',
        rawMatch: word,
        range: {
          startLineNumber: lineNum,
          startColumn: startCol,
          endLineNumber: lineNum,
          endColumn: endCol,
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
        // Compare with cleanName
        if (
          currentSecLower === targetCleanLower ||
          (target.namespace && currentSecLower.endsWith(targetCleanLower))
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
      const varRe = /\$([a-zA-Z0-9_\\]+)/g;
      let vm: RegExpExecArray | null;

      while ((vm = varRe.exec(code)) !== null) {
        const fullMatched = vm[0]; // e.g. "$swapvar" or "$\Raiden\costume"
        const innerContent = vm[1]; // e.g. "swapvar" or "Raiden\costume"
        const innerLower = innerContent.toLowerCase();

        let isMatch = false;
        let isNamespacedUsage = false;

        if (innerLower === targetCleanLower || fullMatched.toLowerCase() === targetNameLower) {
          isMatch = true;
        } else if (innerContent.includes('\\')) {
          const parts = innerContent.split('\\').filter(Boolean);
          const leafVar = parts[parts.length - 1]?.toLowerCase();
          const ns = parts[0]?.toLowerCase();

          if (leafVar === targetCleanLower) {
            if (!target.namespace || target.namespace.toLowerCase() === ns) {
              isMatch = true;
              isNamespacedUsage = true;
            }
          }
        }

        if (isMatch) {
          const startCol = vm.index + 1;
          const endCol = startCol + fullMatched.length;

          // Determine if this is definition:
          // Line has global/persist/local $var, or is in [Constants] $var = ...
          const isConstSec = currentSection.toLowerCase() === 'constants';
          const isDeclModifier = /\b(?:global|persist|local)\s+\$/i.test(code);
          const isAssign = /^\s*(?:persist\s+|global\s+|local\s+)*\$[a-zA-Z0-9_\\]+\s*=/i.test(code);
          const isKeyCycle = /^key/i.test(currentSection) && /^\s*\$[a-zA-Z0-9_\\]+\s*=\s*[0-9,\s]+/i.test(code);

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
      const wordRe = new RegExp(`\\b${escapeRegExp(target.cleanName)}\\b`, 'gi');
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
 * Finds definition of a symbol across open tabs synchronously.
 */
export function findDefinitionSync(
  target: SymbolTarget,
  currentModel: monaco.editor.ITextModel,
  doc: DocumentManager,
): SymbolOccurrence | null {
  // 1. Current model first
  const currentOccs = scanModelOccurrences(
    currentModel,
    target,
    doc.fileName,
    doc.currentTabId,
    doc.file,
  );
  const def = currentOccs.find((o) => o.isDefinition);
  if (def) return def;

  // 2. Other open tabs
  for (const tab of doc.allTabs) {
    if (tab.model === currentModel || tab.kind !== 'text') continue;
    const occs = scanModelOccurrences(
      tab.model,
      target,
      tab.title,
      tab.id,
      tab.file,
    );
    const tabDef = occs.find((o) => o.isDefinition);
    if (tabDef) return tabDef;
  }

  return null;
}

/**
 * Finds all occurrences across open tabs synchronously.
 */
export function findAllOccurrencesSync(
  target: SymbolTarget,
  currentModel: monaco.editor.ITextModel,
  doc: DocumentManager,
): SymbolOccurrence[] {
  const all: SymbolOccurrence[] = [];

  // Current tab first
  all.push(
    ...scanModelOccurrences(
      currentModel,
      target,
      doc.fileName,
      doc.currentTabId,
      doc.file,
    ),
  );

  // Other tabs
  for (const tab of doc.allTabs) {
    if (tab.model === currentModel || tab.kind !== 'text') continue;
    all.push(
      ...scanModelOccurrences(
        tab.model,
        target,
        tab.title,
        tab.id,
        tab.file,
      ),
    );
  }

  return all;
}

/**
 * Comprehensive async scanner across open tabs AND unopened workspace INI files.
 */
export async function findAllOccurrencesAsync(
  target: SymbolTarget,
  editor: monaco.editor.IStandaloneCodeEditor,
  doc: DocumentManager,
  explorer?: FileExplorer,
): Promise<SymbolOccurrence[]> {
  const model = editor.getModel();
  if (!model) return [];

  // Start with all open tabs
  const results: SymbolOccurrence[] = findAllOccurrencesSync(target, model, doc);

  // If explorer has folder, search unopened INI files
  if (explorer && explorer.hasFolder) {
    const allPaths = explorer.getAllFilePaths();
    const openPaths = new Set<string>();
    for (const tab of doc.allTabs) {
      if (tab.file?.id) openPaths.add(tab.file.id);
      if (tab.title) openPaths.add(tab.title);
    }

    const iniPaths = allPaths.filter((p) => /\.(ini|3dm|migoto)$/i.test(p));

    for (const relPath of iniPaths) {
      if (openPaths.has(relPath)) continue;

      try {
        const ref = platform().refFromId(relPath);
        const loaded = await platform().readFile(ref);
        if (!loaded.text) continue;

        if (!monacoRef) continue;
        const tempUri = monacoRef.Uri.parse(`tempfile:///${encodeURIComponent(relPath)}`);
        const tempModel = monacoRef.editor.createModel(loaded.text, LANGUAGE_ID, tempUri);

        const fileOccs = scanModelOccurrences(
          tempModel,
          target,
          ref.name,
          undefined,
          ref,
          relPath,
        );
        results.push(...fileOccs);
        tempModel.dispose();
      } catch {
        // Skip inaccessible files
      }
    }
  }

  return results;
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

/**
 * Action: Jump to definition (F12)
 */
export async function jumpToDefinition(
  editor: monaco.editor.IStandaloneCodeEditor,
  doc: DocumentManager,
  explorer?: FileExplorer,
): Promise<boolean> {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return false;

  const target = getSymbolAtPosition(model, pos);
  if (!target) {
    showToast('커서 위치에 탐색할 섹션이나 변수가 없습니다.', 'info');
    return false;
  }

  // 1. Check open tabs
  let def = findDefinitionSync(target, model, doc);

  // 2. If not found in open tabs, search workspace files
  if (!def && explorer && explorer.hasFolder) {
    const allOccs = await findAllOccurrencesAsync(target, editor, doc, explorer);
    def = allOccs.find((o) => o.isDefinition) ?? null;
  }

  if (!def) {
    showToast(`선언된 위치를 찾을 수 없습니다: ${target.name}`, 'warn');
    return false;
  }

  // Check if cursor is already right at the definition
  if (
    def.uri.toString() === model.uri.toString() &&
    def.range.startLineNumber === pos.lineNumber
  ) {
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
    // Open the file
    await doc.openFile(occ.fileRef);
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
 * Action: Show references dialog (Shift+F12)
 */
export async function showReferencesDialog(
  editor: monaco.editor.IStandaloneCodeEditor,
  doc: DocumentManager,
  explorer?: FileExplorer,
) {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return;

  const target = getSymbolAtPosition(model, pos);
  if (!target) {
    showToast('커서 위치에 탐색할 섹션이나 변수가 없습니다.', 'info');
    return;
  }

  showToast(`'${target.name}' 참조 및 사용 위치 검색 중...`, 'info');
  const occs = await findAllOccurrencesAsync(target, editor, doc, explorer);

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

  // 1. Definition Provider (F12, Alt+F12 Peek, Ctrl+Click)
  monacoInstance.languages.registerDefinitionProvider(LANGUAGE_ID, {
    provideDefinition(model, position) {
      const target = getSymbolAtPosition(model, position);
      if (!target) return null;

      const def = findDefinitionSync(target, model, doc);
      if (!def) return null;

      return {
        uri: def.uri,
        range: def.range,
      };
    },
  });

  // 2. Reference Provider (Shift+F12, Find All References, Peek References)
  monacoInstance.languages.registerReferenceProvider(LANGUAGE_ID, {
    provideReferences(model, position) {
      const target = getSymbolAtPosition(model, position);
      if (!target) return [];

      const occs = findAllOccurrencesSync(target, model, doc);
      return occs.map((o) => ({
        uri: o.uri,
        range: o.range,
      }));
    },
  });

  // 3. Editor Opener for cross-model navigation
  monacoInstance.editor.registerEditorOpener({
    openCodeEditor(sourceEditor, resource, selectionOrPosition) {
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
      return false;
    },
  });
}


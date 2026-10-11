import { monaco } from './monaco';
import { LANGUAGE_ID } from './grammar';
import { extractSymbols, computeSuggestions, type SuggestionKind } from './symbols';

export { extractSymbols };

const KIND_MAP: Record<SuggestionKind, monaco.languages.CompletionItemKind> = {
  variable: monaco.languages.CompletionItemKind.Variable,
  resource: monaco.languages.CompletionItemKind.Reference,
  command: monaco.languages.CompletionItemKind.Function,
  section: monaco.languages.CompletionItemKind.Class,
  enum: monaco.languages.CompletionItemKind.Enum,
  keyword: monaco.languages.CompletionItemKind.Keyword,
};

/**
 * Register intelligent auto-completions for 3DMigoto/XXMI INI files.
 */
export function registerSmartCompletions() {
  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: ['$', '=', ' ', '['],
    provideCompletionItems(model, position) {
      const lineContent = model.getLineContent(position.lineNumber);
      const linePrefix = lineContent.slice(0, position.column - 1);
      const symbols = extractSymbols(model);

      const rawItems = computeSuggestions(symbols, linePrefix, position.lineNumber, position.column);
      if (rawItems.length === 0) {
        return { suggestions: [] };
      }

      const suggestions: monaco.languages.CompletionItem[] = rawItems.map((item) => {
        const range = new monaco.Range(
          position.lineNumber,
          item.startCol,
          position.lineNumber,
          item.endCol,
        );

        const res: monaco.languages.CompletionItem = {
          label: item.label,
          kind: KIND_MAP[item.kind] ?? monaco.languages.CompletionItemKind.Text,
          detail: item.detail,
          insertText: item.insertText,
          range,
        };

        if (item.isSnippet) {
          res.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
        }

        return res;
      });

      return { suggestions };
    },
  });
}

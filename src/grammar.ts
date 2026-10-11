import { monaco } from './monaco';
import { Registry, INITIAL, parseRawGrammar, type StateStack } from 'vscode-textmate';
import { loadWASM, createOnigScanner, createOnigString } from 'vscode-oniguruma';
import onigWasmUrl from 'vscode-oniguruma/release/onig.wasm?url';

// Upstream files are used verbatim; see scripts/sync-upstream.mjs.
import migotoGrammar from '../upstream/syntaxes/migoto.tmLanguage.json?raw';
import regexpGrammar from '../upstream/syntaxes/regexp.tmLanguage.json?raw';
import regexpReplaceGrammar from '../upstream/syntaxes/regexp-replace.tmLanguage.json?raw';
import languageConfigRaw from '../upstream/migoto.language-configuration.json?raw';
import upstreamVersion from '../upstream/VERSION?raw';
import { parseJsonc } from './jsonc';

export const LANGUAGE_ID = 'migoto';
export const upstreamGrammarVersion = upstreamVersion.trim();

const GRAMMARS: Record<string, string> = {
  'source.migoto': migotoGrammar,
  'source.regexp.pcre2': regexpGrammar,
  'source.regexp-replace.pcre2': regexpReplaceGrammar,
};

/** Pick the most specific scope Monaco can style; `meta.*` scopes are structural only. */
function pickScope(scopes: string[]): string {
  for (let i = scopes.length - 1; i > 0; i--) {
    if (!scopes[i].startsWith('meta.')) return scopes[i];
  }
  return '';
}

class TextMateState implements monaco.languages.IState {
  constructor(readonly stack: StateStack) {}
  clone() { return new TextMateState(this.stack); }
  equals(other: monaco.languages.IState) {
    return other instanceof TextMateState && (other === this || other.stack.equals(this.stack));
  }
}

/** VS Code language-configuration stores regexes as strings; Monaco needs RegExp objects. */
function toRegExp(v: unknown): RegExp | undefined {
  return typeof v === 'string' ? new RegExp(v) : undefined;
}

/** VS Code allows `[open, close]` pairs; Monaco's pair options require `{ open, close }` objects. */
function normalizePairs(pairs: any[] | undefined) {
  return pairs?.map((p) => (Array.isArray(p) ? { open: p[0], close: p[1] } : p));
}

function applyLanguageConfiguration() {
  const c = parseJsonc<any>(languageConfigRaw);
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: c.comments,
    brackets: c.brackets,
    autoClosingPairs: normalizePairs(c.autoClosingPairs),
    surroundingPairs: normalizePairs(c.surroundingPairs),
    folding: c.folding && {
      markers: { start: new RegExp(c.folding.markers.start), end: new RegExp(c.folding.markers.end) },
    },
    onEnterRules: (c.onEnterRules ?? []).map((r: any) => ({
      beforeText: new RegExp(r.beforeText),
      afterText: r.afterText ? new RegExp(r.afterText) : undefined,
      action: {
        indentAction: r.action.indent === 'indentOutdent'
          ? monaco.languages.IndentAction.IndentOutdent
          : monaco.languages.IndentAction.None,
        appendText: r.action.appendText,
      },
    })),
    indentationRules: c.indentationRules && {
      increaseIndentPattern: toRegExp(c.indentationRules.increaseIndentPattern)!,
      decreaseIndentPattern: toRegExp(c.indentationRules.decreaseIndentPattern)!,
    },
  });
}

export async function registerMigotoLanguage() {
  const wasm = await (await fetch(onigWasmUrl)).arrayBuffer();
  await loadWASM(wasm);

  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner, createOnigString }),
    loadGrammar: async (scopeName) => {
      const raw = GRAMMARS[scopeName];
      return raw ? parseRawGrammar(raw, `${scopeName}.json`) : null;
    },
  });
  const grammar = await registry.loadGrammar('source.migoto');
  if (!grammar) throw new Error('failed to load source.migoto grammar');

  monaco.languages.register({ id: LANGUAGE_ID, extensions: ['.ini', '.3dm', '.migoto'], aliases: ['Migoto'] });
  applyLanguageConfiguration();

  monaco.languages.setTokensProvider(LANGUAGE_ID, {
    getInitialState: () => new TextMateState(INITIAL),
    tokenize(line, state) {
      const res = grammar.tokenizeLine(line, (state as TextMateState).stack);
      return {
        endState: new TextMateState(res.ruleStack),
        tokens: res.tokens.map((t) => ({ startIndex: t.startIndex, scopes: pickScope(t.scopes) })),
      };
    },
  });
}

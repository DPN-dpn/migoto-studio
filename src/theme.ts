import { monaco } from './monaco';

/**
 * Scope -> color mapping, kept separate from upstream/ on purpose:
 * the upstream grammar defines scope names, we decide how they look.
 * Monaco matches rules by dotted prefix, so `keyword` also covers `keyword.other.instruction`.
 */
const dark: monaco.editor.ITokenThemeRule[] = [
  { token: '', foreground: 'd7dae0' },
  { token: 'comment', foreground: '6b7389', fontStyle: 'italic' },
  { token: 'comment.line.documentation', foreground: '7f8aa6', fontStyle: 'italic' },
  { token: 'entity.name.section', foreground: 'ffd479', fontStyle: 'bold' },
  { token: 'entity.name.function.section-type', foreground: 'ffd479', fontStyle: 'bold' },
  { token: 'entity.name.function', foreground: '82aaff' },
  { token: 'entity.name.namespace', foreground: 'c3a6ff' },
  { token: 'entity.name.class', foreground: '5ec8f2' },
  { token: 'entity.name.tag', foreground: '5ec8f2' },
  { token: 'entity.name.constructor', foreground: '5ec8f2' },
  { token: 'keyword', foreground: 'c792ea' },
  { token: 'keyword.control', foreground: 'ff7a90', fontStyle: 'bold' },
  { token: 'keyword.operator', foreground: '89ddff' },
  { token: 'keyword.other.instruction', foreground: '82aaff', fontStyle: 'bold' },
  { token: 'storage', foreground: 'ff7a90' },
  { token: 'variable', foreground: 'f2a679' },
  { token: 'variable.language', foreground: '5ec8f2' },
  { token: 'variable.other.enummember', foreground: 'a5e075' },
  { token: 'variable.parameter', foreground: 'e6c07b' },
  { token: 'punctuation.definition.variable', foreground: 'f2a679' },
  { token: 'punctuation', foreground: '8b93a8' },
  { token: 'constant', foreground: 'f78c6c' },
  { token: 'constant.numeric', foreground: 'f78c6c' },
  { token: 'constant.language', foreground: '5ec8f2' },
  { token: 'constant.other.path', foreground: 'a5e075', fontStyle: 'underline' },
  { token: 'constant.other.file', foreground: 'a5e075', fontStyle: 'underline' },
  { token: 'string', foreground: 'a5e075' },
  { token: 'support', foreground: '82aaff' },
  { token: 'invalid', foreground: 'ff5370', fontStyle: 'underline' },
];

const light: monaco.editor.ITokenThemeRule[] = [
  { token: '', foreground: '2b303b' },
  { token: 'comment', foreground: '8a93a6', fontStyle: 'italic' },
  { token: 'entity.name.section', foreground: 'b5651d', fontStyle: 'bold' },
  { token: 'entity.name.function.section-type', foreground: 'b5651d', fontStyle: 'bold' },
  { token: 'entity.name.function', foreground: '3b5bdb' },
  { token: 'entity.name.namespace', foreground: '7048e8' },
  { token: 'entity.name.class', foreground: '1c7ed6' },
  { token: 'entity.name.tag', foreground: '1c7ed6' },
  { token: 'keyword', foreground: '9c36b5' },
  { token: 'keyword.control', foreground: 'e03131', fontStyle: 'bold' },
  { token: 'keyword.operator', foreground: '0b7285' },
  { token: 'keyword.other.instruction', foreground: '3b5bdb', fontStyle: 'bold' },
  { token: 'storage', foreground: 'e03131' },
  { token: 'variable', foreground: 'd9480f' },
  { token: 'variable.language', foreground: '1c7ed6' },
  { token: 'variable.other.enummember', foreground: '2f9e44' },
  { token: 'punctuation', foreground: '868e96' },
  { token: 'constant', foreground: 'd9480f' },
  { token: 'constant.language', foreground: '1c7ed6' },
  { token: 'constant.other.path', foreground: '2f9e44', fontStyle: 'underline' },
  { token: 'constant.other.file', foreground: '2f9e44', fontStyle: 'underline' },
  { token: 'string', foreground: '2f9e44' },
  { token: 'invalid', foreground: 'e03131', fontStyle: 'underline' },
];

export const THEME_DARK = 'migoto-dark';
export const THEME_LIGHT = 'migoto-light';

export function defineThemes() {
  monaco.editor.defineTheme(THEME_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: dark,
    colors: {
      'editor.background': '#14161d',
      'editorLineNumber.foreground': '#454b5e',
      'editorLineNumber.activeForeground': '#9aa3bd',
      'editor.lineHighlightBackground': '#1b1e27',
      'editor.selectionBackground': '#3a3f6b88',
      'editorCursor.foreground': '#8b7cf6',
      'editorIndentGuide.background1': '#232734',
    },
  });
  monaco.editor.defineTheme(THEME_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: light,
    colors: { 'editor.background': '#fbfbfd' },
  });
}

import { monaco } from './monaco';
import { LANGUAGE_ID } from './grammar';
import { parseJsonc } from './jsonc';
import upstreamSnippetsRaw from '../upstream/snippets/migoto.snippets.json?raw';

export interface Template {
  label: string;
  description: string;
  /** Monaco snippet syntax: ${1:placeholder} marks fill-in spots (Tab moves between them), `\$` is a literal dollar. */
  body: string;
  group: string;
}

/**
 * Starter blocks for the "삽입" menu. These are examples to fill in, not complete mods.
 * (Block conditions like if/else come from the upstream extension's own snippets, below.)
 */
const OWN_TEMPLATES: Template[] = [
  {
    group: '자주 쓰는 섹션', label: '키 전환 (토글)', description: '키를 누를 때마다 값이 바뀌는 변수',
    body: '[Key${1:Toggle}]\nkey = ${2:no_modifiers} ${3:VK_F1}\ntype = cycle\n\\$${4:myvar} = ${5:0,1}\n',
  },
  {
    group: '자주 쓰는 섹션', label: '변수 선언 (Constants)', description: '전역 변수 선언 섹션',
    body: '[Constants]\nglobal persist \\$${1:myvar} = ${2:0}\n',
  },
  {
    group: '자주 쓰는 섹션', label: 'TextureOverride', description: '해시로 텍스처/버퍼를 찾아 덮어쓰기',
    body: '[TextureOverride${1:Name}]\nhash = ${2:00000000}\nmatch_priority = ${3:0}\n',
  },
  {
    group: '자주 쓰는 섹션', label: 'ShaderOverride', description: '해시로 셰이더를 찾아 동작 변경',
    body: '[ShaderOverride${1:Name}]\nhash = ${2:0000000000000000}\n',
  },
  {
    group: '자주 쓰는 섹션', label: '리소스 (Buffer)', description: '메시 버퍼 파일을 가리키는 리소스',
    body: '[Resource${1:Name}]\ntype = Buffer\nstride = ${2:12}\nfilename = ${3:Meshes/File.buf}\n',
  },
  {
    group: '자주 쓰는 섹션', label: '리소스 (텍스처)', description: '텍스처 파일을 가리키는 리소스',
    body: '[Resource${1:Name}]\nfilename = ${2:Textures/File.dds}\n',
  },
  {
    group: '자주 쓰는 섹션', label: '커맨드 리스트', description: '여러 곳에서 재사용하는 명령 모음',
    body: '[CommandList${1:Name}]\n${0}\n',
  },
];

/** Korean labels for the upstream snippets we know about; unknown ones fall back to their upstream name. */
const UPSTREAM_LABELS: Record<string, [string, string]> = {
  'If': ['조건문 (if)', 'if … endif'],
  'If Else': ['조건문 (if / else)', 'if … else … endif'],
  'If Block': ['조건문 (if / elif / else)', 'if … elif … else … endif'],
};

interface UpstreamSnippet { prefix: string | string[]; body: string | string[]; description?: string }

function upstreamTemplates(): (Template & { prefix: string })[] {
  const data = parseJsonc<Record<string, UpstreamSnippet>>(upstreamSnippetsRaw);
  return Object.entries(data).map(([name, s]) => {
    const [label, description] = UPSTREAM_LABELS[name] ?? [name, s.description ?? ''];
    return {
      group: '조건문',
      label,
      description,
      body: Array.isArray(s.body) ? s.body.join('\n') : s.body,
      prefix: Array.isArray(s.prefix) ? s.prefix[0] : s.prefix,
    };
  });
}

export const TEMPLATES: Template[] = [...OWN_TEMPLATES, ...upstreamTemplates()];

/** Insert a template at the cursor with Tab-able placeholders. */
export function insertTemplate(editor: monaco.editor.IStandaloneCodeEditor, t: Template) {
  const ctl = editor.getContribution('snippetController2') as { insert(template: string): void } | null;
  editor.focus();
  if (ctl) ctl.insert(t.body);
  else editor.trigger('menu', 'type', { text: t.body.replace(/\$\{\d+:?([^}]*)\}/g, '$1') });
}

/** Typing an upstream snippet prefix (e.g. `if`) offers the snippet in the suggestion list. */
export function registerSnippetCompletions() {
  const items = upstreamTemplates();
  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      return {
        suggestions: items.map((t) => ({
          label: t.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: t.description,
          insertText: t.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
      };
    },
  });
}

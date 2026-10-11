import { monaco } from './monaco';
import { LANGUAGE_ID } from './grammar';
import { parseJsonc } from './jsonc';
import upstreamSnippetsRaw from '../../upstream/snippets/migoto.snippets.json?raw';

export interface Template {
  id?: string;
  label: string;
  description: string;
  /** Monaco snippet syntax: ${1:placeholder} marks fill-in spots (Tab moves between them), `\$` is a literal dollar. */
  body: string;
  group: string;
  isCustom?: boolean;
}

const STORAGE_CUSTOM_TEMPLATES = 'migoto_custom_templates';

/**
 * Starter blocks for the templates panel and completions. These are examples to fill in, not complete mods.
 * (Block conditions like if/else come from the upstream extension's own snippets, below.)
 */
export const OWN_TEMPLATES: Template[] = [
  {
    id: 'builtin_key_cycle',
    group: '자주 쓰는 섹션', label: '키 전환 (토글)', description: '키를 누를 때마다 값이 바뀌는 변수',
    body: '[Key${1:Toggle}]\nkey = ${2:no_modifiers} ${3:VK_F1}\ntype = cycle\n\\$${4:myvar} = ${5:0,1}\n',
  },
  {
    id: 'builtin_constants',
    group: '자주 쓰는 섹션', label: '변수 선언 (Constants)', description: '전역 변수 선언 섹션',
    body: '[Constants]\nglobal persist \\$${1:myvar} = ${2:0}\n',
  },
  {
    id: 'builtin_texture_override',
    group: '자주 쓰는 섹션', label: 'TextureOverride', description: '해시로 텍스처/버퍼를 찾아 덮어쓰기',
    body: '[TextureOverride${1:Name}]\nhash = ${2:00000000}\nmatch_priority = ${3:0}\n',
  },
  {
    id: 'builtin_shader_override',
    group: '자주 쓰는 섹션', label: 'ShaderOverride', description: '해시로 셰이더를 찾아 동작 변경',
    body: '[ShaderOverride${1:Name}]\nhash = ${2:0000000000000000}\n',
  },
  {
    id: 'builtin_resource_buffer',
    group: '자주 쓰는 섹션', label: '리소스 (Buffer)', description: '메시 버퍼 파일을 가리키는 리소스',
    body: '[Resource${1:Name}]\ntype = Buffer\nstride = ${2:12}\nfilename = ${3:Meshes/File.buf}\n',
  },
  {
    id: 'builtin_resource_texture',
    group: '자주 쓰는 섹션', label: '리소스 (텍스처)', description: '텍스처 파일을 가리키는 리소스',
    body: '[Resource${1:Name}]\nfilename = ${2:Textures/File.dds}\n',
  },
  {
    id: 'builtin_commandlist',
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
      id: `upstream_${name.toLowerCase().replace(/\s+/g, '_')}`,
      group: '조건문',
      label,
      description,
      body: Array.isArray(s.body) ? s.body.join('\n') : s.body,
      prefix: Array.isArray(s.prefix) ? s.prefix[0] : s.prefix,
    };
  });
}

/** Retrieve user-created custom templates from localStorage */
export function getCustomTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_TEMPLATES);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map((t) => ({ ...t, isCustom: true })) : [];
  } catch {
    return [];
  }
}

/** Save a new custom template to localStorage */
export function saveCustomTemplate(t: {
  label: string;
  description: string;
  body: string;
  group?: string;
}): Template {
  const list = getCustomTemplates();
  const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const created: Template = {
    id,
    label: t.label.trim(),
    description: t.description.trim(),
    body: t.body,
    group: t.group?.trim() || '사용자 템플릿',
    isCustom: true,
  };
  list.push(created);
  try {
    localStorage.setItem(STORAGE_CUSTOM_TEMPLATES, JSON.stringify(list));
  } catch {}
  return created;
}

/** Delete a custom template by id from localStorage */
export function deleteCustomTemplate(id: string): void {
  const list = getCustomTemplates().filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_CUSTOM_TEMPLATES, JSON.stringify(list));
  } catch {}
}

/** Returns all templates: user custom templates first, then built-in, then upstream */
export function getAllTemplates(): Template[] {
  return [...getCustomTemplates(), ...OWN_TEMPLATES, ...upstreamTemplates()];
}

/** Static array of default templates for backwards compatibility */
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
  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const items = upstreamTemplates();
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

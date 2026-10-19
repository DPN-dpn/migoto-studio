import { monaco } from '../editor/monaco';
import { LANGUAGE_ID } from '../editor/grammar';
import { parseJsonc } from '../utils/jsonc';
import { platform } from '../../platform';
import upstreamSnippetsRaw from '../../../upstream/snippets/migoto.snippets.json?raw';

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
let customTemplatesCache: Template[] = [];
let isTemplatesInitialized = false;

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

/** Initialize custom templates from AppData (disk) or fallback to localStorage */
export async function initCustomTemplates(): Promise<Template[]> {
  if (isTemplatesInitialized) return getCustomTemplates();
  try {
    const p = platform();
    let raw = '';
    if (p.loadTemplatesText) {
      raw = await p.loadTemplatesText();
    }
    if (!raw) {
      raw = localStorage.getItem(STORAGE_CUSTOM_TEMPLATES) || '';
      // Migrate existing templates from localStorage to AppData on desktop
      if (raw && p.kind === 'desktop' && p.saveTemplatesText) {
        p.saveTemplatesText(raw).catch(() => {});
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        customTemplatesCache = parsed.map((t) => ({ ...t, isCustom: true }));
        try {
          localStorage.setItem(STORAGE_CUSTOM_TEMPLATES, JSON.stringify(customTemplatesCache));
        } catch {}
      }
    }
  } catch (e) {
    console.warn('Failed to initialize custom templates from AppData:', e);
  }
  isTemplatesInitialized = true;
  return getCustomTemplates();
}

const templateListeners = new Set<() => void>();
export function onTemplatesChange(listener: () => void): () => void {
  templateListeners.add(listener);
  return () => templateListeners.delete(listener);
}
function notifyTemplatesChange() {
  for (const fn of templateListeners) {
    try { fn(); } catch {}
  }
}

let pluginTemplatesCache: Template[] = [];

export function registerPluginTemplate(t: Template): () => void {
  const id = t.id || `plugin_t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const templateWithId = { ...t, id };
  pluginTemplatesCache.push(templateWithId);
  notifyTemplatesChange();
  return () => {
    pluginTemplatesCache = pluginTemplatesCache.filter((item) => item !== templateWithId && item.id !== id);
    notifyTemplatesChange();
  };
}

export function getPluginTemplates(): Template[] {
  return [...pluginTemplatesCache];
}

/** Persist custom templates to both localStorage and AppData (templates.json) */
function persistCustomTemplates(list: Template[]): void {
  customTemplatesCache = list.map((t) => ({ ...t, isCustom: true }));
  const json = JSON.stringify(customTemplatesCache);
  try {
    localStorage.setItem(STORAGE_CUSTOM_TEMPLATES, json);
  } catch {}
  const p = platform();
  if (p.saveTemplatesText) {
    p.saveTemplatesText(json).catch((err) => {
      console.warn('Failed to save templates to AppData:', err);
    });
  }
  notifyTemplatesChange();
}

/** Retrieve user-created custom templates from memory / AppData / localStorage */
export function getCustomTemplates(): Template[] {
  if (customTemplatesCache.length > 0) {
    return customTemplatesCache.map((t) => ({ ...t, isCustom: true }));
  }
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_TEMPLATES);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      customTemplatesCache = list.map((t) => ({ ...t, isCustom: true }));
      return customTemplatesCache;
    }
  } catch {}
  return [];
}

/** Save a new custom template to AppData */
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
  persistCustomTemplates(list);
  return created;
}

/** Delete a custom template by id from AppData */
export function deleteCustomTemplate(id: string): void {
  const list = getCustomTemplates().filter((t) => t.id !== id);
  persistCustomTemplates(list);
}

/** Returns all templates: user custom templates first, then plugin templates, then built-in, then upstream */
export function getAllTemplates(): Template[] {
  return [...getCustomTemplates(), ...pluginTemplatesCache, ...OWN_TEMPLATES, ...upstreamTemplates()];
}

const STORAGE_TEMPLATE_FAVORITES = 'migoto_template_favorites';
let favoriteIdsCache: Set<string> | null = null;

export function getTemplateKey(t: Template): string {
  return t.id || `${t.group}::${t.label}`;
}

export function getFavoriteTemplateIds(): Set<string> {
  if (favoriteIdsCache) return new Set(favoriteIdsCache);
  try {
    const raw = localStorage.getItem(STORAGE_TEMPLATE_FAVORITES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        favoriteIdsCache = new Set(arr);
        return new Set(favoriteIdsCache);
      }
    }
  } catch {}
  favoriteIdsCache = new Set();
  return new Set(favoriteIdsCache);
}

export function isTemplateFavorite(keyOrTemplate: string | Template): boolean {
  const key = typeof keyOrTemplate === 'string' ? keyOrTemplate : getTemplateKey(keyOrTemplate);
  return getFavoriteTemplateIds().has(key);
}

export function toggleTemplateFavorite(keyOrTemplate: string | Template): boolean {
  const key = typeof keyOrTemplate === 'string' ? keyOrTemplate : getTemplateKey(keyOrTemplate);
  const favs = getFavoriteTemplateIds();
  const willBeFav = !favs.has(key);
  if (willBeFav) {
    favs.add(key);
  } else {
    favs.delete(key);
  }
  favoriteIdsCache = favs;
  try {
    localStorage.setItem(STORAGE_TEMPLATE_FAVORITES, JSON.stringify([...favs]));
  } catch {}
  notifyTemplatesChange();
  return willBeFav;
}

/** Export ONLY custom/user-added templates belonging to a specific group as JSON string */
export function exportGroupTemplates(groupName: string): string {
  const custom = getCustomTemplates();
  const groupItems = custom.filter((t) => t.group === groupName);
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    group: groupName,
    templates: groupItems.map((t) => ({
      label: t.label,
      description: t.description,
      body: t.body,
      group: t.group,
    })),
  };
  return JSON.stringify(data, null, 2);
}

/** Export all custom templates as JSON string */
export function exportAllCustomTemplates(): string {
  const all = getCustomTemplates();
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: all.map((t) => ({
      label: t.label,
      description: t.description,
      body: t.body,
      group: t.group,
    })),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Import templates from JSON string into AppData.
 * Supports:
 * - { group: string, templates: Template[] }
 * - Template[]
 * - Single Template
 */
export function importTemplates(jsonStr: string, targetGroup?: string): { count: number; groupName?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    let items: any[] = [];
    let fileGroup: string | undefined = undefined;

    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && Array.isArray(parsed.templates)) {
      items = parsed.templates;
      if (typeof parsed.group === 'string') {
        fileGroup = parsed.group;
      }
    } else if (parsed && typeof parsed.label === 'string' && typeof parsed.body === 'string') {
      items = [parsed];
    } else {
      throw new Error('유효한 템플릿 JSON 형식이 아닙니다.');
    }

    if (items.length === 0) {
      throw new Error('가져올 템플릿 항목이 없습니다.');
    }

    const current = getCustomTemplates();
    let importedCount = 0;
    const finalGroupName = targetGroup || fileGroup;

    for (const item of items) {
      if (!item || typeof item.label !== 'string' || typeof item.body !== 'string') continue;
      const grp = targetGroup || item.group || fileGroup || '가져온 템플릿';

      // Check if duplicate label in same group exists in custom templates
      const existingIdx = current.findIndex((c) => c.label === item.label.trim() && c.group === grp.trim());
      const newT: Template = {
        id: existingIdx >= 0 ? current[existingIdx].id : `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        label: item.label.trim(),
        description: (item.description || '').trim(),
        body: item.body,
        group: grp.trim(),
        isCustom: true,
      };

      if (existingIdx >= 0) {
        current[existingIdx] = newT;
      } else {
        current.push(newT);
      }
      importedCount++;
    }

    persistCustomTemplates(current);
    return { count: importedCount, groupName: finalGroupName };
  } catch (err: any) {
    throw new Error(err.message || '템플릿을 불러오는 중 오류가 발생했습니다.');
  }
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

/**
 * Virtual Module Linker for Migoto Studio Plugins.
 *
 * Allows multi-file plugins (e.g. index.js importing ./ui.js, ./constants.js, ./style.css, ./config.json)
 * to be authored natively with standard relative ES module imports without requiring any bundler.
 *
 * In-memory Blob URLs are generated in topological dependency order and relative specifiers
 * are rewritten to point to their corresponding Blob URLs.
 */

export interface LinkedPluginModule {
  entryUrl: string;
  blobUrls: string[];
  dispose: () => void;
}

/**
 * Normalizes relative file paths:
 * - Replaces backslashes with forward slashes
 * - Strips leading './' and '/'
 * - Resolves '.' and '..' segments
 */
export function normalizePluginPath(path: string): string {
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  const parts = clean.split('/');
  const stack: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return stack.join('/');
}

/**
 * Resolves a relative import specifier from a source file path against the available file map.
 */
export function resolveRelativeSpecifier(
  fromFile: string,
  specifier: string,
  availablePaths: Set<string>,
): string | null {
  // Only handle relative imports
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return null;
  }

  const fromDir = fromFile.includes('/')
    ? fromFile.substring(0, fromFile.lastIndexOf('/') + 1)
    : '';

  const rawTarget = normalizePluginPath(fromDir + specifier);

  // Resolution candidates
  const candidates = [
    rawTarget,
    `${rawTarget}.js`,
    `${rawTarget}.mjs`,
    `${rawTarget}.json`,
    `${rawTarget}.css`,
    `${rawTarget}/index.js`,
    `${rawTarget}/index.mjs`,
  ];

  for (const candidate of candidates) {
    if (availablePaths.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Masks block and line comments with spaces of equal length
 * so character offsets remain perfectly aligned with original source code.
 */
function maskComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, (match) => ' '.repeat(match.length));
}

interface SpecifierMatch {
  start: number;
  end: number;
  specifier: string;
}

/**
 * Scans JavaScript/MJS code for all relative import and export specifiers.
 */
function extractRelativeSpecifiers(code: string): SpecifierMatch[] {
  const masked = maskComments(code);
  const matches: SpecifierMatch[] = [];

  // 1. Static imports:
  //    import './style.css'
  //    import foo from './foo.js'
  //    import { a, b } from './foo.js'
  //    import * as bar from './foo.js'
  const staticImportRegex = /(?:^|[;\s])import\s+(?:(?:(?:\* as \w+)|(?:[\w$,\s{}]+))\s+from\s+)?(['"])((\.\/|\.\.\/)[^'"]+)\1/g;
  let m: RegExpExecArray | null;

  while ((m = staticImportRegex.exec(masked)) !== null) {
    const fullMatch = m[0];
    const specifier = m[2];
    const quote = m[1];

    // Find the exact index of quote + specifier + quote within this match
    const specOffsetInMatch = fullMatch.lastIndexOf(quote + specifier + quote);
    if (specOffsetInMatch !== -1) {
      const start = m.index + specOffsetInMatch + 1; // skip leading quote
      const end = start + specifier.length;
      matches.push({ start, end, specifier });
    }
  }

  // 2. Static exports:
  //    export * from './foo.js'
  //    export { a, b } from './foo.js'
  //    export * as bar from './foo.js'
  const staticExportRegex = /(?:^|[;\s])export\s+(?:(?:\* as \w+)|(?:\*)|(?:{[\w$,\s{}]+}))\s+from\s+(['"])((\.\/|\.\.\/)[^'"]+)\1/g;

  while ((m = staticExportRegex.exec(masked)) !== null) {
    const fullMatch = m[0];
    const specifier = m[2];
    const quote = m[1];

    const specOffsetInMatch = fullMatch.lastIndexOf(quote + specifier + quote);
    if (specOffsetInMatch !== -1) {
      const start = m.index + specOffsetInMatch + 1;
      const end = start + specifier.length;
      matches.push({ start, end, specifier });
    }
  }

  // 3. Dynamic imports:
  //    import('./foo.js')
  const dynamicImportRegex = /\bimport\s*\(\s*(['"])((\.\/|\.\.\/)[^'"]+)\1\s*\)/g;

  while ((m = dynamicImportRegex.exec(masked)) !== null) {
    const fullMatch = m[0];
    const specifier = m[2];
    const quote = m[1];

    const specOffsetInMatch = fullMatch.indexOf(quote + specifier + quote);
    if (specOffsetInMatch !== -1) {
      const start = m.index + specOffsetInMatch + 1;
      const end = start + specifier.length;
      matches.push({ start, end, specifier });
    }
  }

  return matches;
}

function toBase64(str: string): string {
  const g = globalThis as any;
  if (typeof g.Buffer !== 'undefined') {
    return g.Buffer.from(str, 'utf-8').toString('base64');
  }
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createModuleUrl(code: string, mimeType = 'application/javascript'): { url: string; revoke?: () => void } {
  // If running in Node.js test environment without DOM/window, Node ESM loader supports data: URLs
  const g = globalThis as any;
  const proc = g.process;
  const isNode =
    typeof proc !== 'undefined' &&
    proc.versions &&
    proc.versions.node &&
    typeof g.window === 'undefined';

  if (isNode) {
    const encoded = toBase64(code);
    return {
      url: `data:${mimeType};base64,${encoded}`,
    };
  }

  // In browser / Tauri WebView: use Blob URL for optimal memory and lifecycle management
  const blob = new Blob([code], { type: mimeType });
  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke: () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    },
  };
}

/**
 * Links a multi-file plugin in-memory by resolving relative imports
 * and synthesizing module URLs in topological dependency order.
 */
export function linkPluginModules(
  entryScript: string,
  entryName = 'index.js',
  rawFiles?: Record<string, string | Uint8Array>,
): LinkedPluginModule {
  const fileMap = new Map<string, string>();
  const textDecoder = new TextDecoder('utf-8');

  if (rawFiles) {
    for (const [key, val] of Object.entries(rawFiles)) {
      const norm = normalizePluginPath(key);
      if (!norm) continue;
      if (typeof val === 'string') {
        fileMap.set(norm, val);
      } else if (val instanceof Uint8Array) {
        try {
          fileMap.set(norm, textDecoder.decode(val));
        } catch {}
      }
    }
  }

  const normalizedEntry = normalizePluginPath(entryName || 'index.js');
  fileMap.set(normalizedEntry, entryScript);

  const availablePaths = new Set(fileMap.keys());

  // Quick check: if the entry script has no relative imports/exports and no other files needed,
  // return direct single module URL
  const entryMatches = extractRelativeSpecifiers(entryScript);
  if (entryMatches.length === 0 && fileMap.size <= 1) {
    const res = createModuleUrl(entryScript, 'application/javascript');
    return {
      entryUrl: res.url,
      blobUrls: [res.url],
      dispose: () => {
        res.revoke?.();
      },
    };
  }

  // 1. Build dependency graph starting from entry point
  const graph = new Map<string, string[]>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const postOrder: string[] = [];

  function dfs(filePath: string) {
    if (visiting.has(filePath)) {
      // Circular dependency detected, break cycle
      console.warn(`[plugin-module-linker] Circular dependency detected at "${filePath}"`);
      return;
    }
    if (visited.has(filePath)) {
      return;
    }

    visiting.add(filePath);

    const isCode = filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath === normalizedEntry;
    const deps: string[] = [];

    if (isCode) {
      const content = fileMap.get(filePath) || '';
      const matches = extractRelativeSpecifiers(content);
      for (const match of matches) {
        const resolved = resolveRelativeSpecifier(filePath, match.specifier, availablePaths);
        if (resolved) {
          deps.push(resolved);
        }
      }
    }

    graph.set(filePath, deps);

    for (const dep of deps) {
      dfs(dep);
    }

    visiting.delete(filePath);
    visited.add(filePath);
    postOrder.push(filePath);
  }

  dfs(normalizedEntry);

  // 2. Synthesize Module URLs in post-order (dependencies first, parents last)
  const moduleUrls = new Map<string, string>();
  const createdUrls: string[] = [];
  const revokers: Array<() => void> = [];
  const injectedStyleIds: string[] = [];

  for (const filePath of postOrder) {
    const rawContent = fileMap.get(filePath) ?? '';
    let finalCode = rawContent;
    let mimeType = 'application/javascript';

    if (filePath.endsWith('.json')) {
      // Wrap JSON as ES module default export
      try {
        JSON.parse(rawContent); // Validate JSON
        finalCode = `const __data = ${JSON.stringify(JSON.parse(rawContent))};\nexport default __data;\n`;
      } catch {
        finalCode = `const __data = {};\nexport default __data;\n`;
      }
    } else if (filePath.endsWith('.css')) {
      // Wrap CSS as style injector module
      const styleId = `plugin-style-${Math.random().toString(36).substring(2, 9)}`;
      injectedStyleIds.push(styleId);
      finalCode = `
const __css = ${JSON.stringify(rawContent)};
if (typeof document !== 'undefined') {
  const __style = document.createElement('style');
  __style.setAttribute('data-plugin-style', ${JSON.stringify(styleId)});
  __style.textContent = __css;
  document.head.appendChild(__style);
}
export default __css;
`;
    } else if (
      filePath.endsWith('.svg') ||
      filePath.endsWith('.txt') ||
      filePath.endsWith('.html') ||
      filePath.endsWith('.ini')
    ) {
      // Wrap raw text/svg assets as default string export
      finalCode = `export default ${JSON.stringify(rawContent)};\n`;
    } else {
      // JavaScript / MJS: rewrite relative specifiers to Module URLs
      const matches = extractRelativeSpecifiers(rawContent);
      // Sort matches in reverse order so string replacements don't shift earlier offsets
      matches.sort((a, b) => b.start - a.start);

      for (const match of matches) {
        const resolved = resolveRelativeSpecifier(filePath, match.specifier, availablePaths);
        if (resolved && moduleUrls.has(resolved)) {
          const targetModuleUrl = moduleUrls.get(resolved)!;
          finalCode =
            finalCode.slice(0, match.start) +
            targetModuleUrl +
            finalCode.slice(match.end);
        }
      }
    }

    const res = createModuleUrl(finalCode, mimeType);
    moduleUrls.set(filePath, res.url);
    createdUrls.push(res.url);
    if (res.revoke) revokers.push(res.revoke);
  }

  const entryUrl = moduleUrls.get(normalizedEntry) || createdUrls[createdUrls.length - 1];

  return {
    entryUrl,
    blobUrls: createdUrls,
    dispose: () => {
      // Revoke any Blob URLs
      for (const revoke of revokers) {
        try {
          revoke();
        } catch {}
      }
      // Remove any injected style tags
      if (typeof document !== 'undefined') {
        for (const styleId of injectedStyleIds) {
          try {
            const els = document.querySelectorAll(`style[data-plugin-style="${styleId}"]`);
            els.forEach((el) => el.remove());
          } catch {}
        }
      }
    },
  };
}

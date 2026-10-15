export interface SearchMatch {
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  lineContent: string;
  matchedText: string;
}

export interface SearchOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
  isRegex?: boolean;
}

export const BINARY_EXTENSIONS = new Set([
  'dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'tga', 'ico', 'tiff', 'psd',
  'exe', 'dll', 'bin', 'dat', 'zip', '7z', 'rar', 'tar', 'gz',
  'buf', 'ib', 'vb', 'wasm',
]);

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSearchRegex(query: string, options: SearchOptions = {}): RegExp {
  const flags = options.matchCase ? 'g' : 'gi';
  if (options.isRegex) {
    return new RegExp(query, flags);
  }
  if (options.wholeWord) {
    return new RegExp(`\\b${escapeRegex(query)}\\b`, flags);
  }
  return new RegExp(escapeRegex(query), flags);
}

export function matchesPattern(path: string, pattern: string): boolean {
  if (!pattern) return true;
  const parts = pattern.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return true;

  const lowerPath = path.toLowerCase().replace(/\\/g, '/');
  return parts.some((p) => {
    const lowerP = p.toLowerCase().replace(/\\/g, '/');
    if (lowerP.startsWith('*.')) {
      return lowerPath.endsWith(lowerP.slice(1));
    }
    return lowerPath.includes(lowerP);
  });
}

export function searchInText(text: string, regex: RegExp): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(lineContent)) !== null) {
      const startColumn = m.index + 1;
      const endColumn = startColumn + m[0].length;
      matches.push({
        lineNumber: i + 1,
        startColumn,
        endColumn,
        lineContent: lineContent.trim(),
        matchedText: m[0],
      });

      if (m[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }

  return matches;
}

export function replaceAllInText(
  text: string,
  regex: RegExp,
  replaceText: string
): { newText: string; count: number } {
  let count = 0;
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const gRegex = new RegExp(regex.source, flags);
  const newText = text.replace(gRegex, () => {
    count++;
    return replaceText;
  });
  return { newText, count };
}

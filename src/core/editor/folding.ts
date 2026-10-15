import type { monaco } from './monaco';
export const LANGUAGE_ID = 'migoto';

export interface TextModelLike {
  getLineCount(): number;
  getLineContent(lineNumber: number): string;
}

export interface FoldingRangeItem {
  start: number;
  end: number;
  kind?: monaco.languages.FoldingRangeKind;
}

export const FoldingRangeKind = {
  Comment: { value: 'comment' } as monaco.languages.FoldingRangeKind,
  Imports: { value: 'imports' } as monaco.languages.FoldingRangeKind,
  Region: { value: 'region' } as monaco.languages.FoldingRangeKind,
};

/**
 * Computes folding ranges for 3DMigoto INI files:
 * 1. [Section] headers fold all content up to the next section or EOF.
 * 2. `if` ... `endif` blocks fold conditionally within or across lines.
 * 3. Consecutive comment lines or `;<` ... `;>` blocks fold as comment blocks.
 */
export function computeFoldingRanges(model: TextModelLike): FoldingRangeItem[] {
  const ranges: FoldingRangeItem[] = [];
  const lineCount = model.getLineCount();
  if (lineCount <= 1) return ranges;

  const sectionStarts: number[] = [];
  const ifStack: number[] = [];

  let commentBlockStart = 0;
  let customBlockStart = 0; // for ;< ... ;>

  for (let line = 1; line <= lineCount; line++) {
    const raw = model.getLineContent(line);
    const trimmed = raw.trim();

    // 1. Custom comment block marker: ;< ... ;>
    if (/^\s*;<.*$/.test(raw)) {
      customBlockStart = line;
      continue;
    }
    if (customBlockStart > 0) {
      if (/;>/.test(raw)) {
        if (line > customBlockStart) {
          ranges.push({
            start: customBlockStart,
            end: line,
            kind: FoldingRangeKind.Comment,
          });
        }
        customBlockStart = 0;
      }
      continue;
    }

    // 2. Standard multi-line comment block
    const isComment = trimmed.startsWith(';') || trimmed.startsWith('//');
    if (isComment) {
      if (commentBlockStart === 0) {
        commentBlockStart = line;
      }
    } else {
      if (commentBlockStart > 0) {
        if (line - 1 > commentBlockStart) {
          ranges.push({
            start: commentBlockStart,
            end: line - 1,
            kind: FoldingRangeKind.Comment,
          });
        }
        commentBlockStart = 0;
      }
    }

    if (!trimmed) continue;

    // 3. Section Header: `^[SectionName]`
    if (!isComment && /^\s*\[[^\]\r\n]+\]/.test(raw)) {
      if (sectionStarts.length > 0) {
        const prevStart = sectionStarts[sectionStarts.length - 1];
        // Section ends at the last non-empty line before this new section
        let endLine = line - 1;
        while (endLine > prevStart && !model.getLineContent(endLine).trim()) {
          endLine--;
        }
        if (endLine > prevStart) {
          ranges.push({
            start: prevStart,
            end: endLine,
            kind: FoldingRangeKind.Region,
          });
        }
      }
      sectionStarts.push(line);
      continue;
    }

    // 4. Conditional Blocks: if ... endif
    if (!isComment) {
      if (/^\s*if\b/i.test(trimmed)) {
        ifStack.push(line);
      } else if (/^\s*endif\b/i.test(trimmed)) {
        if (ifStack.length > 0) {
          const startIf = ifStack.pop()!;
          if (line > startIf) {
            ranges.push({
              start: startIf,
              end: line,
            });
          }
        }
      }
    }
  }

  // Trailing comment block
  if (commentBlockStart > 0 && lineCount > commentBlockStart) {
    ranges.push({
      start: commentBlockStart,
      end: lineCount,
      kind: FoldingRangeKind.Comment,
    });
  }

  // Trailing section block
  if (sectionStarts.length > 0) {
    const lastStart = sectionStarts[sectionStarts.length - 1];
    let endLine = lineCount;
    while (endLine > lastStart && !model.getLineContent(endLine).trim()) {
      endLine--;
    }
    if (endLine > lastStart) {
      ranges.push({
        start: lastStart,
        end: endLine,
        kind: FoldingRangeKind.Region,
      });
    }
  }

  return ranges;
}

/**
 * Registers custom folding range provider in Monaco for the Migoto language.
 */
export function registerFoldingProvider(monacoInstance: typeof monaco) {
  monacoInstance.languages.registerFoldingRangeProvider(LANGUAGE_ID, {
    provideFoldingRanges(model) {
      return computeFoldingRanges(model);
    },
  });
}

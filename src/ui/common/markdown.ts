/**
 * Lightweight and safe Markdown-to-HTML parser and renderer.
 * Designed for rendering release notes, documentation, and modal content
 * with full support for headings, nested lists, code blocks, links, and inline styles.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format inline markdown elements:
 * - Code: `code`
 * - Links: [label](url)
 * - Auto-links: https://... or http://...
 * - Bold + Italic: ***text*** or ___text___
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Strikethrough: ~~text~~
 */
export function formatInlineMarkdown(text: string): string {
  const safe = escapeHtml(text);

  // 1. Protect inline code blocks from inner markdown formatting
  const codeTokens: string[] = [];
  const tokenized = safe.replace(/`([^`]+)`/g, (_m, codeContent) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code class="md-code">${codeContent}</code>`);
    return `\uFFF0CODE_${idx}\uFFF1`;
  });

  // 2. Protect markdown links
  const linkTokens: string[] = [];
  const linkTokenized = tokenized.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|\/|\.\/)[^\s)]+)\)/g,
    (_m, linkText, url) => {
      const idx = linkTokens.length;
      linkTokens.push(
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="md-link">${linkText}</a>`,
      );
      return `\uFFF0LINK_${idx}\uFFF1`;
    },
  );

  // 3. Auto-link remaining raw URLs that aren't already part of a link
  const autolinked = linkTokenized.replace(
    /(https?:\/\/[^\s<>"'\)]+)/g,
    (_m, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="md-link">${url}</a>`,
  );

  // 4. Bold + Italic (3 asterisks or underscores)
  let formatted = autolinked.replace(
    /(\*\*\*|___)(.*?)\1/g,
    (_m, _delim, content) => `<strong><em>${content}</em></strong>`,
  );

  // 5. Bold (2 asterisks or underscores)
  formatted = formatted.replace(
    /(\*\*|__)(.*?)\1/g,
    (_m, _delim, content) => `<strong>${content}</strong>`,
  );

  // 6. Italic (1 asterisk or underscore, avoiding intra-word underscores)
  formatted = formatted.replace(
    /(?<!\w)(\*|_)(.*?)\1(?!\w)/g,
    (_m, _delim, content) => `<em>${content}</em>`,
  );

  // 7. Strikethrough
  formatted = formatted.replace(
    /~~(.*?)~~/g,
    (_m, content) => `<del>${content}</del>`,
  );

  // 8. Restore links
  formatted = formatted.replace(/\uFFF0LINK_(\d+)\uFFF1/g, (_m, idxStr) => {
    return linkTokens[parseInt(idxStr, 10)] || '';
  });

  // 9. Restore code tokens
  formatted = formatted.replace(/\uFFF0CODE_(\d+)\uFFF1/g, (_m, idxStr) => {
    return codeTokens[parseInt(idxStr, 10)] || '';
  });

  return formatted;
}

interface ListStackItem {
  type: 'ul' | 'ol';
  indent: number;
}

/**
 * Parses markdown text into HTML string.
 */
export function renderMarkdownToHtml(mdText: string): string {
  if (!mdText) return '';

  const lines = mdText.split(/\r?\n/);
  const out: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  let listStack: ListStackItem[] = [];
  let paraLines: string[] = [];

  const flushPara = () => {
    if (paraLines.length > 0) {
      const content = paraLines.map((l) => formatInlineMarkdown(l)).join('<br>');
      out.push(`<p class="md-p">${content}</p>`);
      paraLines = [];
    }
  };

  const closeListStack = () => {
    while (listStack.length > 0) {
      const item = listStack.pop()!;
      out.push(`</li></${item.type}>`);
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote) {
      const content = blockquoteLines.map((l) => formatInlineMarkdown(l)).join('<br>');
      out.push(`<blockquote class="md-quote"><p>${content}</p></blockquote>`);
      inBlockquote = false;
      blockquoteLines = [];
    }
  };

  const flushTable = () => {
    if (!inTable) return;
    let html = '<table class="md-table">';
    if (tableHeaders.length > 0) {
      html += '<thead><tr>';
      for (const th of tableHeaders) {
        html += `<th>${formatInlineMarkdown(th.trim())}</th>`;
      }
      html += '</tr></thead>';
    }
    if (tableRows.length > 0) {
      html += '<tbody>';
      for (const row of tableRows) {
        html += '<tr>';
        for (const cell of row) {
          html += `<td>${formatInlineMarkdown(cell.trim())}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody>';
    }
    html += '</table>';
    out.push(html);
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  const closeAllBlocks = () => {
    flushPara();
    closeListStack();
    flushBlockquote();
    flushTable();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // 1. Fenced Code Block handling
    const codeFenceMatch = rawLine.match(/^```(\w*)/);
    if (codeFenceMatch) {
      if (!inCodeBlock) {
        closeAllBlocks();
        inCodeBlock = true;
        codeBlockLang = codeFenceMatch[1] || '';
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        const escaped = codeBlockLines.map(escapeHtml).join('\n');
        const langClass = codeBlockLang ? ` language-${codeBlockLang}` : '';
        out.push(`<pre class="md-pre"><code class="md-code-block${langClass}">${escaped}</code></pre>`);
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();

    // Empty line separates blocks
    if (!trimmed) {
      closeAllBlocks();
      continue;
    }

    // 2. Horizontal rule: ---, ***, ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      closeAllBlocks();
      out.push('<hr class="md-hr">');
      continue;
    }

    // 3. Headings: # through ######
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeAllBlocks();
      const level = headingMatch[1].length;
      const title = formatInlineMarkdown(headingMatch[2].trim());
      out.push(`<h${level} class="md-h md-h${level}">${title}</h${level}>`);
      continue;
    }

    // 4. Blockquotes: > quote
    const quoteMatch = rawLine.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushPara();
      closeListStack();
      flushTable();
      inBlockquote = true;
      blockquoteLines.push(quoteMatch[1]);
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // 5. Table rows: | col1 | col2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      flushPara();
      closeListStack();
      flushBlockquote();

      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Check if this is the separator row |---|---|
      const isSep = cells.every((c) => /^:?-+:?$/.test(c));
      if (isSep) {
        // Just separator, ignore
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // 6. List items: - item, * item, + item, or 1. item
    const listMatch = rawLine.match(/^(\s*)(?:([-*+])|(\d+)\.)\s+(.*)$/);
    if (listMatch) {
      flushPara();
      flushBlockquote();
      flushTable();

      const indentSpaces = listMatch[1].replace(/\t/g, '  ').length;
      const listType: 'ul' | 'ol' = listMatch[2] ? 'ul' : 'ol';
      const itemContent = formatInlineMarkdown(listMatch[4].trim());

      if (listStack.length === 0) {
        // Start top-level list
        out.push(`<${listType} class="md-${listType}"><li>${itemContent}`);
        listStack.push({ type: listType, indent: indentSpaces });
      } else {
        const top = listStack[listStack.length - 1];

        if (indentSpaces > top.indent) {
          // Open nested list
          out.push(`<${listType} class="md-${listType}"><li>${itemContent}`);
          listStack.push({ type: listType, indent: indentSpaces });
        } else if (indentSpaces < top.indent) {
          // Close inner lists back down to matching level
          out.push('</li>');
          while (listStack.length > 0 && indentSpaces < listStack[listStack.length - 1].indent) {
            const popped = listStack.pop()!;
            out.push(`</${popped.type}></li>`);
          }

          if (listStack.length > 0 && listStack[listStack.length - 1].type === listType) {
            out.push(`<li>${itemContent}`);
          } else {
            out.push(`<${listType} class="md-${listType}"><li>${itemContent}`);
            listStack.push({ type: listType, indent: indentSpaces });
          }
        } else {
          // Same indent level
          out.push('</li>');
          if (top.type !== listType) {
            out.push(`</${top.type}><${listType} class="md-${listType}">`);
            top.type = listType;
          }
          out.push(`<li>${itemContent}`);
        }
      }
      continue;
    }

    // If we were in a list, non-list line closes lists
    if (listStack.length > 0) {
      closeListStack();
    }

    // 7. Regular paragraph text
    paraLines.push(rawLine.trim());
  }

  // Handle any remaining unclosed code block
  if (inCodeBlock) {
    const escaped = codeBlockLines.map(escapeHtml).join('\n');
    out.push(`<pre class="md-pre"><code class="md-code-block">${escaped}</code></pre>`);
  }

  closeAllBlocks();

  return out.join('\n');
}

export interface RenderMarkdownOptions {
  onLinkClick?: (url: string) => void;
}

/**
 * Renders markdown text into an HTMLElement container and wires up safe external link clicks.
 */
export function renderMarkdown(
  container: HTMLElement,
  markdownText: string,
  options?: RenderMarkdownOptions,
): void {
  container.innerHTML = renderMarkdownToHtml(markdownText);

  // Hook all links to handle in-app or browser opening
  const links = container.querySelectorAll<HTMLAnchorElement>('a');
  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href) {
        e.preventDefault();
        if (options?.onLinkClick) {
          options.onLinkClick(href);
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    });
  });
}

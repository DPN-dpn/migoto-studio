/**
 * HTML 및 마크다운 렌더링 유틸리티
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatInlineMarkdown(text: string): string {
  const safe = escapeHtml(text);
  const codeTokens: string[] = [];
  const tokenized = safe.replace(/`([^`]+)`/g, (_match, codeContent) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code class="ai-inline-code">${codeContent}</code>`);
    return `\uFFF0CODE_${idx}\uFFF1`;
  });
  let formatted = tokenized.replace(/(\*\*\*|___)(.*?)\1/g, '<strong><em>$2</em></strong>');
  formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  formatted = formatted.replace(/(?<!\w)(\*|_)(.*?)\1(?!\w)/g, '<em>$2</em>');
  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-link">$1</a>',
  );
  formatted = formatted.replace(/\uFFF0CODE_(\d+)\uFFF1/g, (_m, idxStr) => {
    const idx = parseInt(idxStr, 10);
    return codeTokens[idx] || '';
  });
  return formatted;
}

export function parseMarkdownToHtml(mdText: string): string {
  const lines = mdText.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let paraLines: string[] = [];

  const flushPara = () => {
    if (paraLines.length > 0) {
      const content = paraLines.map((l) => formatInlineMarkdown(l)).join('<br>');
      out.push(`<p class="ai-md-p">${content}</p>`);
      paraLines = [];
    }
  };

  const flushTable = () => {
    if (!inTable) return;
    let html = '<table class="ai-md-table">';
    if (tableHeaders.length > 0) {
      html += '<thead><tr>';
      for (const th of tableHeaders) {
        html += `<th>${formatInlineMarkdown(th)}</th>`;
      }
      html += '</tr></thead>';
    }
    if (tableRows.length > 0) {
      html += '<tbody>';
      for (const row of tableRows) {
        html += '<tr>';
        for (const cell of row) {
          html += `<td>${formatInlineMarkdown(cell)}</td>`;
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

  const closeBlocks = () => {
    flushPara();
    flushTable();
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
    if (inBlockquote) {
      out.push('</blockquote>');
      inBlockquote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeBlocks();
      continue;
    }

    // 테이블 감지: | 컬럼 | 컬럼 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      flushPara();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }

      const isDivider = /^\|?(\s*:?-{2,}:?\s*\|)+\s*$/.test(trimmed);
      if (isDivider) {
        continue;
      }

      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

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

    // 가로선: ---, ***, ___
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeBlocks();
      out.push('<hr class="ai-md-hr">');
      continue;
    }

    // 제목: # ~ ####
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      closeBlocks();
      const level = Math.min(headerMatch[1].length + 2, 6);
      out.push(
        `<h${level} class="ai-md-h ai-md-h${level}">${formatInlineMarkdown(headerMatch[2])}</h${level}>`,
      );
      continue;
    }

    // 인용문: > 본문
    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushPara();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inBlockquote) {
        out.push('<blockquote class="ai-md-quote">');
        inBlockquote = true;
      }
      out.push(`<p>${formatInlineMarkdown(quoteMatch[1])}</p>`);
      continue;
    } else if (inBlockquote) {
      out.push('</blockquote>');
      inBlockquote = false;
    }

    // 비순서 목록: - 항목, * 항목
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushPara();
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) {
        out.push('<ul class="ai-md-ul">');
        inUl = true;
      }
      out.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    } else if (inUl && !rawLine.startsWith('  ') && !rawLine.startsWith('\t')) {
      out.push('</ul>');
      inUl = false;
    }

    // 순서 목록: 1. 항목
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushPara();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) {
        out.push('<ol class="ai-md-ol">');
        inOl = true;
      }
      out.push(`<li>${formatInlineMarkdown(olMatch[1])}</li>`);
      continue;
    } else if (inOl && !rawLine.startsWith('  ') && !rawLine.startsWith('\t')) {
      out.push('</ol>');
      inOl = false;
    }

    paraLines.push(rawLine);
  }

  closeBlocks();
  return out.join('');
}

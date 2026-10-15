import type { monaco } from '../../core/editor/monaco';
import type { DocumentManager } from '../../core/workspace/documents';
import { openModal } from './modal';
import {
  type SymbolTarget,
  type SymbolOccurrence,
  jumpToOccurrence,
} from '../../core/ini/symbol-nav';

export function openReferencesModal(
  editor: monaco.editor.IStandaloneCodeEditor,
  doc: DocumentManager,
  target: SymbolTarget,
  occurrences: SymbolOccurrence[],
) {
  const defCount = occurrences.filter((o) => o.isDefinition).length;
  const usageCount = occurrences.length - defCount;

  const body = document.createElement('div');
  body.className = 'references-modal-body';

  // Subtitle & counts
  const metaBar = document.createElement('div');
  metaBar.className = 'ref-meta-bar';

  const badgeTarget = document.createElement('span');
  badgeTarget.className = `ref-target-badge is-${target.kind}`;
  badgeTarget.textContent = target.kind === 'variable' ? '변수' : '섹션';

  const titleText = document.createElement('span');
  titleText.className = 'ref-target-name';
  titleText.textContent = target.name;

  const countSummary = document.createElement('span');
  countSummary.className = 'ref-count-summary';
  countSummary.textContent = `(선언 ${defCount}곳, 사용 ${usageCount}곳)`;

  metaBar.append(badgeTarget, titleText, countSummary);

  // Search filter input
  const searchWrap = document.createElement('div');
  searchWrap.className = 'ref-search-wrap';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'ref-search-input';
  searchInput.placeholder = '결과 필터링 (파일명, 섹션명, 코드 검색)...';
  searchWrap.append(searchInput);

  // List container
  const listEl = document.createElement('div');
  listEl.className = 'ref-list-container';

  let filteredOccurrences = [...occurrences];
  let selectedIndex = 0;

  const renderItems = () => {
    listEl.innerHTML = '';
    if (filteredOccurrences.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ref-empty-state';
      empty.textContent = '일치하는 항목이 없습니다.';
      listEl.append(empty);
      return;
    }

    filteredOccurrences.forEach((occ, idx) => {
      const item = document.createElement('div');
      item.className = `ref-item ${idx === selectedIndex ? 'selected' : ''}`;
      item.tabIndex = 0;

      // Header row: Badge + File : Line + Section
      const itemHeader = document.createElement('div');
      itemHeader.className = 'ref-item-header';

      const typeBadge = document.createElement('span');
      typeBadge.className = `ref-badge ${occ.isDefinition ? 'badge-def' : 'badge-usage'}`;
      typeBadge.textContent = occ.isDefinition ? '선언' : '사용';

      const fileLine = document.createElement('span');
      fileLine.className = 'ref-file-line';
      fileLine.textContent = `${occ.title} : ${occ.range.startLineNumber}줄`;

      const secBadge = document.createElement('span');
      secBadge.className = 'ref-sec-badge';
      secBadge.textContent = occ.section;

      itemHeader.append(typeBadge, fileLine, secBadge);

      // Code preview
      const preview = document.createElement('div');
      preview.className = 'ref-code-preview';
      preview.innerHTML = highlightSymbol(occ.lineContent, occ.matchedText);

      item.append(itemHeader, preview);

      item.addEventListener('click', async () => {
        close();
        await jumpToOccurrence(editor, doc, occ);
      });

      listEl.append(item);
    });

    ensureVisible();
  };

  const ensureVisible = () => {
    const selectedEl = listEl.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  };

  const updateSelection = (newIdx: number) => {
    if (filteredOccurrences.length === 0) return;
    selectedIndex = Math.max(0, Math.min(newIdx, filteredOccurrences.length - 1));
    Array.from(listEl.children).forEach((child, i) => {
      if (child instanceof HTMLElement) {
        child.classList.toggle('selected', i === selectedIndex);
      }
    });
    ensureVisible();
  };

  // Filter input handler
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      filteredOccurrences = [...occurrences];
    } else {
      filteredOccurrences = occurrences.filter((o) => {
        return (
          o.title.toLowerCase().includes(query) ||
          o.section.toLowerCase().includes(query) ||
          o.lineContent.toLowerCase().includes(query) ||
          String(o.range.startLineNumber).includes(query)
        );
      });
    }
    selectedIndex = 0;
    renderItems();
  });

  // Keyboard navigation
  const onKey = async (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelection(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelection(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOccurrences[selectedIndex]) {
        const targetOcc = filteredOccurrences[selectedIndex];
        close();
        await jumpToOccurrence(editor, doc, targetOcc);
      }
    }
  };

  searchInput.addEventListener('keydown', onKey);
  listEl.addEventListener('keydown', onKey);

  body.append(metaBar, searchWrap, listEl);

  const close = openModal(`심볼 탐색: ${target.name}`, body, {
    className: 'modal-references',
  });

  renderItems();
  setTimeout(() => searchInput.focus(), 50);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightSymbol(line: string, symbol: string): string {
  const escapedLine = escapeHtml(line);
  const escapedSym = escapeHtml(symbol);
  if (!escapedSym) return escapedLine;

  const re = new RegExp(escapeRegex(escapedSym), 'gi');
  return escapedLine.replace(re, '<mark class="ref-match">$&</mark>');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

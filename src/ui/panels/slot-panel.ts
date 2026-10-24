import { slotManager } from '../../core/slots/slot-manager.ts';
import { PART_LABELS } from '../../core/slots/resolver.ts';
import type { ModPartType, ModelSlot, UnmatchedSection } from '../../core/slots/types.ts';
import type { DocumentManager } from '../../core/workspace/documents.ts';
import type { FileExplorer } from './explorer.ts';
import { platform } from '../../platform/index.ts';

import { flashLineHighlight } from '../../core/ini/symbol-nav.ts';
import { monaco } from '../../core/editor/monaco.ts';

export class SlotMatchingPanel {
  private container: HTMLElement;
  private docManager: DocumentManager;
  private editor: monaco.editor.IStandaloneCodeEditor;
  private explorer?: FileExplorer;
  private isAnalyzing = false;

  constructor(
    container: HTMLElement,
    docManager: DocumentManager,
    editor: monaco.editor.IStandaloneCodeEditor,
    explorer?: FileExplorer,
  ) {
    this.container = container;
    this.docManager = docManager;
    this.editor = editor;
    this.explorer = explorer;

    // 슬롯 변경 시 UI 자동 갱신
    slotManager.onDidChangeSlots(() => {
      this.render();
    });

    // 파일 저장 시 슬롯 자동 재분석
    this.docManager.onDidSaveFile(() => {
      this.refresh();
    });

    // 작업 영역 리셋/폴더 닫힘 시 슬롯 정리
    this.docManager.onDidResetWorkspace(() => {
      slotManager.clear();
      this.render();
    });

    // 폴더 변경 시 자동 분석
    if (this.explorer) {
      this.explorer.onDidChangeFolder((folder) => {
        if (folder) {
          this.refresh();
        } else {
          slotManager.clear();
          this.render();
        }
      });
    }

    this.render();
  }

  async refresh() {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;
    this.renderLoading();
    try {
      await slotManager.analyzeWorkspace(this.docManager, this.explorer);
    } finally {
      this.isAnalyzing = false;
      this.render();
    }
  }

  private renderLoading() {
    this.container.innerHTML = `
      <div class="slot-panel-container">
        <div class="slot-panel-header">
          <div class="slot-header-title">
            <span class="slot-header-icon">🧩</span>
            <span class="slot-header-text">슬롯 매칭</span>
          </div>
        </div>
        <div class="slot-empty-state">
          <div class="slot-spinner"></div>
          <div class="slot-empty-title">모드 슬롯 분석 중...</div>
          <div class="slot-empty-desc">INI 파일에서 모델 및 텍스처 슬롯을 스캔하고 있습니다.</div>
        </div>
      </div>
    `;
  }

  render() {
    const slots = slotManager.getSlots();
    const unmatched = slotManager.getUnmatched();

    const root = document.createElement('div');
    root.className = 'slot-panel-container';

    // 1. 헤더 (타이틀 + 상태 배지 + 새로고침 버튼)
    const header = document.createElement('div');
    header.className = 'slot-panel-header';
    header.innerHTML = `
      <div class="slot-header-title">
        <span class="slot-header-icon">🧩</span>
        <span class="slot-header-text">모델/텍스처 슬롯 매칭</span>
      </div>
      <div class="slot-header-actions">
        <button id="btn-refresh-slots" class="slot-action-btn" title="슬롯 다시 분석" aria-label="새로고침">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
    `;

    const refreshBtn = header.querySelector('#btn-refresh-slots');
    refreshBtn?.addEventListener('click', () => this.refresh());
    root.appendChild(header);

    // 2. 상태 서머리 바
    const summaryBar = document.createElement('div');
    summaryBar.className = 'slot-summary-bar';
    const matchedCount = slots.length;
    const unmatchedCount = unmatched.length;

    summaryBar.innerHTML = `
      <span class="slot-badge matched">${matchedCount}개 부위 매칭</span>
      ${unmatchedCount > 0 ? `<span class="slot-badge unmatched">${unmatchedCount}개 미분류</span>` : ''}
    `;
    root.appendChild(summaryBar);

    // 3. 내용 스크롤 컨테이너
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'slot-scroll-content';

    // 데이터가 없는 경우
    if (matchedCount === 0 && unmatchedCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'slot-empty-state';
      empty.innerHTML = `
        <div class="slot-empty-icon">📁</div>
        <div class="slot-empty-title">매칭된 슬롯 없음</div>
        <div class="slot-empty-desc">모드 폴더를 열거나 INI 파일을 열면 모델 및 텍스처 슬롯이 자동으로 분석됩니다.</div>
        <button id="btn-slot-empty-analyze" class="slot-btn primary">지금 INI 분석하기</button>
      `;
      empty.querySelector('#btn-slot-empty-analyze')?.addEventListener('click', () => this.refresh());
      scrollContainer.appendChild(empty);
      root.appendChild(scrollContainer);
      this.container.replaceChildren(root);
      return;
    }

    // A. 미분류 섹션 안내 (판단이 서지 않은 경우 상단에 노출하여 즉시 매칭 유도)
    if (unmatchedCount > 0) {
      const unSectionWrapper = document.createElement('div');
      unSectionWrapper.className = 'slot-group unmatched-group';

      const unHeader = document.createElement('div');
      unHeader.className = 'slot-group-title warning';
      unHeader.innerHTML = `
        <span>⚠️ 미분류 섹션 (${unmatchedCount})</span>
        <small>부위가 자동 판별되지 않았습니다. 부위를 선택해 매칭하세요.</small>
      `;
      unSectionWrapper.appendChild(unHeader);

      for (const item of unmatched) {
        unSectionWrapper.appendChild(this.createUnmatchedCard(item));
      }
      scrollContainer.appendChild(unSectionWrapper);
    }

    // B. 매칭된 모델 & 텍스처 슬롯 목록
    if (matchedCount > 0) {
      const matchedGroup = document.createElement('div');
      matchedGroup.className = 'slot-group';

      const matchedHeader = document.createElement('div');
      matchedHeader.className = 'slot-group-title';
      matchedHeader.innerHTML = `<span>✨ 매칭된 부위 목록 (${matchedCount})</span>`;
      matchedGroup.appendChild(matchedHeader);

      for (const slot of slots) {
        matchedGroup.appendChild(this.createModelSlotCard(slot));
      }
      scrollContainer.appendChild(matchedGroup);
    }

    root.appendChild(scrollContainer);
    this.container.replaceChildren(root);
  }

  /**
   * 매칭된 모델 부위 카드 렌더링
   */
  private createModelSlotCard(slot: ModelSlot): HTMLElement {
    const card = document.createElement('div');
    card.className = `slot-card part-${slot.part}`;

    // 카드 헤더
    const cardHeader = document.createElement('div');
    cardHeader.className = 'slot-card-header';
    cardHeader.innerHTML = `
      <div class="slot-part-tag">
        <span class="slot-part-badge ${slot.part}">${PART_LABELS[slot.part] || slot.part}</span>
        ${slot.isManual ? '<span class="slot-manual-tag" title="수동 매칭됨">수동</span>' : ''}
      </div>
      <div class="slot-section-title" title="에디터에서 열기 (클릭)">[${slot.sectionName}]</div>
    `;

    cardHeader.querySelector('.slot-section-title')?.addEventListener('click', () => {
      this.openSectionInEditor(slot.filePath, slot.startLine);
    });
    card.appendChild(cardHeader);

    // 모델 슬롯 세부 정보 (IB, Hash, Handling 등)
    const modelDetails = document.createElement('div');
    modelDetails.className = 'slot-model-details';
    const details: string[] = [];
    if (slot.ib) details.push(`<span class="slot-detail-item"><b>IB:</b> ${slot.ib}</span>`);
    if (slot.hash) details.push(`<span class="slot-detail-item"><b>Hash:</b> ${slot.hash}</span>`);
    if (slot.matchFirstIndex !== undefined) details.push(`<span class="slot-detail-item"><b>Index:</b> ${slot.matchFirstIndex}</span>`);
    if (slot.handling) details.push(`<span class="slot-detail-item"><b>Handling:</b> ${slot.handling}</span>`);

    if (details.length > 0) {
      modelDetails.innerHTML = details.join('');
      card.appendChild(modelDetails);
    }

    // 텍스처 슬롯 목록
    if (slot.textureSlots.length > 0) {
      const texList = document.createElement('div');
      texList.className = 'slot-texture-list';

      for (const tex of slot.textureSlots) {
        const item = document.createElement('div');
        item.className = 'slot-texture-item';
        item.innerHTML = `
          <span class="slot-tex-type ${tex.slotType}">${tex.slotId}</span>
          <span class="slot-tex-ref" title="${tex.resourceRef || ''}">${tex.textureFile || tex.resourceRef || '-'}</span>
        `;
        texList.appendChild(item);
      }
      card.appendChild(texList);
    } else {
      const noTex = document.createElement('div');
      noTex.className = 'slot-no-textures';
      noTex.textContent = '연결된 텍스처 슬롯 없음';
      card.appendChild(noTex);
    }

    // 부위 재지정 액션 드롭다운
    const actionRow = document.createElement('div');
    actionRow.className = 'slot-card-actions';

    const select = document.createElement('select');
    select.className = 'slot-part-select';
    select.title = '다른 부위로 재지정';

    const partOptions: ModPartType[] = ['body', 'head', 'dress', 'hair', 'face', 'weapon', 'extra', 'custom'];
    for (const p of partOptions) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = PART_LABELS[p];
      if (p === slot.part) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
      const targetPart = (e.target as HTMLSelectElement).value as ModPartType;
      slotManager.setPartMapping(slot.sectionName, targetPart);
    });

    const label = document.createElement('span');
    label.className = 'slot-action-label';
    label.textContent = '부위 변경:';

    actionRow.append(label, select);
    card.appendChild(actionRow);

    return card;
  }

  /**
   * 미분류 섹션 수동 매칭 카드 렌더링
   */
  private createUnmatchedCard(item: UnmatchedSection): HTMLElement {
    const card = document.createElement('div');
    card.className = 'slot-card unmatched';

    card.innerHTML = `
      <div class="slot-card-header">
        <span class="slot-part-badge unknown">미분류</span>
        <div class="slot-section-title" title="에디터에서 열기 (클릭)">[${item.sectionName}]</div>
      </div>
      <div class="slot-model-details">
        ${item.ib ? `<span class="slot-detail-item"><b>IB:</b> ${item.ib}</span>` : ''}
        ${item.hash ? `<span class="slot-detail-item"><b>Hash:</b> ${item.hash}</span>` : ''}
        <span class="slot-detail-item">텍스처 ${item.textureSlots.length}개 발견</span>
      </div>
      <div class="slot-match-prompt">
        <label>이 섹션의 부위를 지정하세요:</label>
      </div>
    `;

    card.querySelector('.slot-section-title')?.addEventListener('click', () => {
      this.openSectionInEditor(item.filePath, item.startLine);
    });

    const selectRow = document.createElement('div');
    selectRow.className = 'slot-card-actions';

    const select = document.createElement('select');
    select.className = 'slot-part-select match-select';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '부위 선택... (Click to Match)';
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    select.appendChild(defaultOpt);

    const partOptions: ModPartType[] = ['body', 'head', 'dress', 'hair', 'face', 'weapon', 'extra', 'custom'];
    for (const p of partOptions) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = PART_LABELS[p];
      select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
      const targetPart = (e.target as HTMLSelectElement).value as ModPartType;
      if (targetPart) {
        slotManager.setPartMapping(item.sectionName, targetPart);
      }
    });

    selectRow.appendChild(select);
    card.appendChild(selectRow);

    return card;
  }

  /**
   * 섹션 클릭 시 에디터에서 해당 파일 열고 줄로 이동
   */
  private async openSectionInEditor(filePath: string, line?: number) {
    if (!filePath) return;
    try {
      const ref = platform().refFromId(filePath);
      await this.docManager.openFile(ref);
      if (line) {
        this.editor.revealLineInCenter(line);
        this.editor.setPosition({ lineNumber: line, column: 1 });
        this.editor.focus();
        flashLineHighlight(this.editor, line);
      }
    } catch {}
  }
}

import { slotManager } from '../../core/slots/slot-manager.ts';
import { formatPartLabel, getPartColorStyle } from '../../core/slots/resolver.ts';
import type { ModelSlot, UnmatchedSection } from '../../core/slots/types.ts';
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
      matchedHeader.innerHTML = `<span>모델 슬롯 및 매칭 텍스처 (${matchedCount})</span>`;
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
   * (사용자 지침: IB, Hash, Index 정보는 나타날 필요 없이 부위와 텍스처 파일 매칭에 집중)
   */
  private createModelSlotCard(slot: ModelSlot): HTMLElement {
    const card = document.createElement('div');
    card.className = `slot-card part-${slot.part}`;

    // 카드 헤더: 부위 배지 + 섹션명 (클릭 시 에디터 이동)
    const cardHeader = document.createElement('div');
    cardHeader.className = 'slot-card-header';
    const colorStyle = getPartColorStyle(slot.part);

    cardHeader.innerHTML = `
      <div class="slot-part-tag">
        <span class="slot-part-badge" style="background:${colorStyle.bg};color:${colorStyle.color};border:${colorStyle.border}">${slot.partName}</span>
        ${slot.isManual ? '<span class="slot-manual-tag" title="수동 매칭됨">수동</span>' : ''}
      </div>
      <div class="slot-section-title" title="에디터에서 열기 (클릭)">[${slot.sectionName}]</div>
    `;

    cardHeader.querySelector('.slot-section-title')?.addEventListener('click', () => {
      this.openSectionInEditor(slot.filePath, slot.startLine);
    });
    card.appendChild(cardHeader);

    // 텍스처 슬롯 목록 (파일 드롭다운 선택 및 슬롯 추가/삭제 지원)
    const texContainer = document.createElement('div');
    texContainer.className = 'slot-texture-section';

    const texHeader = document.createElement('div');
    texHeader.className = 'slot-tex-header';
    texHeader.innerHTML = `
      <span class="slot-tex-title">매칭된 텍스처 파일</span>
      <button class="slot-btn-text-action add-tex-btn" title="이 부위에 텍스처 슬롯 추가">➕ 슬롯 추가</button>
    `;
    texHeader.querySelector('.add-tex-btn')?.addEventListener('click', () => {
      this.promptAddTextureSlot(slot.sectionName);
    });
    texContainer.appendChild(texHeader);

    if (slot.textureSlots.length > 0) {
      const texList = document.createElement('div');
      texList.className = 'slot-texture-list';

      for (const tex of slot.textureSlots) {
        const item = document.createElement('div');
        item.className = 'slot-texture-item';

        // 1. 슬롯 종류 배지
        const typeBadge = document.createElement('span');
        typeBadge.className = `slot-tex-type ${tex.slotType}`;
        typeBadge.textContent = tex.slotId;
        item.appendChild(typeBadge);

        // 2. INI 감지 파일 드롭다운 선택기
        const fileSelect = document.createElement('select');
        fileSelect.className = 'slot-tex-file-select';
        fileSelect.title = `"${tex.slotId}" 슬롯에 연결할 텍스처 파일 선택`;
        this.populateTextureFileSelect(fileSelect, tex.textureFile);

        fileSelect.addEventListener('change', (e) => {
          const val = (e.target as HTMLSelectElement).value;
          if (val === '__custom__') {
            const entered = prompt(
              `[${slot.sectionName}]의 "${tex.slotId}" 슬롯에 연결할 텍스처 파일명을 입력하세요:`,
              tex.textureFile || '',
            );
            if (entered !== null) {
              slotManager.setTextureSlot(slot.sectionName, tex.slotId, entered.trim(), tex.slotType);
            } else {
              this.render();
            }
          } else {
            slotManager.setTextureSlot(slot.sectionName, tex.slotId, val, tex.slotType);
          }
        });
        item.appendChild(fileSelect);

        // 3. 슬롯 삭제 버튼
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'slot-tex-btn delete-btn';
        deleteBtn.title = `"${tex.slotId}" 슬롯 삭제`;
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', () => {
          slotManager.removeTextureSlot(slot.sectionName, tex.slotId);
        });
        item.appendChild(deleteBtn);

        texList.appendChild(item);
      }
      texContainer.appendChild(texList);
    } else {
      const noTex = document.createElement('div');
      noTex.className = 'slot-no-textures';
      noTex.innerHTML = `<span>연결된 텍스처 슬롯 없음</span>`;
      texContainer.appendChild(noTex);
    }
    card.appendChild(texContainer);

    // 부위명 직접 문자열 수정 입력창
    const actionRow = document.createElement('div');
    actionRow.className = 'slot-card-actions';

    const label = document.createElement('span');
    label.className = 'slot-action-label';
    label.textContent = '부위명:';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'slot-part-input';
    input.value = slot.part;
    input.placeholder = '부위명 (예: BodyA, Head, Tail...)';
    input.title = '부위 이름을 입력하고 Enter를 누르거나 벗어나면 적용됩니다';

    const applyChange = () => {
      const entered = input.value.trim();
      if (entered && entered !== slot.part) {
        slotManager.setPartMapping(slot.sectionName, entered);
      } else if (!entered) {
        input.value = slot.part;
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = slot.part;
        input.blur();
      }
    });
    input.addEventListener('blur', applyChange);

    actionRow.append(label, input);
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
      <div class="slot-match-prompt">
        <label>이 섹션의 부위명을 입력하세요:</label>
      </div>
    `;

    card.querySelector('.slot-section-title')?.addEventListener('click', () => {
      this.openSectionInEditor(item.filePath, item.startLine);
    });

    const inputRow = document.createElement('div');
    inputRow.className = 'slot-card-actions unmatched-actions';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'slot-part-input match-input';
    input.placeholder = '지정할 부위명 입력 (예: BodyA, Head...)';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'slot-btn-text-action apply-btn';
    applyBtn.textContent = '부위 지정';

    const applyMatch = () => {
      const entered = input.value.trim();
      if (entered) {
        slotManager.setPartMapping(item.sectionName, entered);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyMatch();
      }
    });
    applyBtn.addEventListener('click', applyMatch);

    inputRow.append(input, applyBtn);
    card.appendChild(inputRow);

    return card;
  }

  /**
   * INI에서 감지된 텍스처 파일 선택 드롭다운 채우기
   */
  private populateTextureFileSelect(select: HTMLSelectElement, currentFile?: string) {
    select.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '(연결할 텍스처 파일 선택...)';
    if (!currentFile) {
      defaultOpt.selected = true;
    }
    select.appendChild(defaultOpt);

    const detectedFiles = slotManager.getDetectedTextureFiles();
    if (detectedFiles.length > 0) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = '📄 INI에서 감지된 텍스처 파일';
      for (const f of detectedFiles) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        if (currentFile && f.toLowerCase() === currentFile.toLowerCase()) {
          opt.selected = true;
        }
        optGroup.appendChild(opt);
      }
      select.appendChild(optGroup);
    }

    // 만약 현재 연결된 파일이 있는데 감지 목록에 없다면 추가 표시
    if (currentFile && !detectedFiles.some((f) => f.toLowerCase() === currentFile.toLowerCase())) {
      const customFileOpt = document.createElement('option');
      customFileOpt.value = currentFile;
      customFileOpt.textContent = `${currentFile} (지정됨)`;
      customFileOpt.selected = true;
      select.appendChild(customFileOpt);
    }

    // 직접 입력 옵션
    const directOpt = document.createElement('option');
    directOpt.value = '__custom__';
    directOpt.textContent = '✏️ 직접 파일명 입력...';
    select.appendChild(directOpt);
  }

  /**
   * 텍스처 슬롯만 추가 (파일은 드롭다운에서 선택하도록 파일명은 빈 값으로 생성)
   */
  private promptAddTextureSlot(sectionName: string) {
    const slotId = prompt(
      `추가할 텍스처 슬롯 ID를 입력하세요:\n(예: Diffuse, NormalMap, LightMap, MaterialMap, WEngineFX, Specular 등)`,
      'Diffuse',
    );
    if (!slotId || !slotId.trim()) return;

    // 슬롯만 추가하고 파일은 드롭다운에서 선택할 수 있도록 빈 문자열로 슬롯 생성
    slotManager.setTextureSlot(sectionName, slotId.trim(), '');
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
    } catch { }
  }
}

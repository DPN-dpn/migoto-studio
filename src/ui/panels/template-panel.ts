import { monaco } from '../../core/editor/monaco';
import type { DocumentManager } from '../../core/workspace/documents';
import { LANGUAGE_ID } from '../../core/editor/grammar';
import { appLogger } from '../../core/logger';
import {
  type Template,
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  insertTemplate,
  exportGroupTemplates,
  importTemplates,
  initCustomTemplates,
  onTemplatesChange,
  isTemplateFavorite,
  toggleTemplateFavorite,
} from '../../core/ini/templates';
import { openModal } from '../modals/modal';
import { openConfirmModal } from '../modals/confirm-ui';

const STORAGE_TEMPLATE_COLLAPSED = 'migoto_template_collapsed_groups';
const FAVORITES_GROUP_NAME = '⭐ 즐겨찾기';

function downloadJsonFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        resolve(text);
      } catch {
        resolve(null);
      }
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    document.body.append(input);
    input.click();
  });
}

export class TemplatePanel {
  private filter = '';
  private collapsedGroups: Set<string> = new Set();

  constructor(
    private root: HTMLElement,
    private editor: monaco.editor.IStandaloneCodeEditor,
    private doc?: DocumentManager,
  ) {
    this.loadCollapsedGroups();
    onTemplatesChange(() => this.renderList());
    if (this.doc) {
      this.doc.onChange(() => {
        // 활성 탭 변경 시 필요에 따라 리스트 재검사
      });
    }
    this.render();
  }

  /**
   * 현재 열린 활성 탭이 INI 텍스트 에디터 창인지 검증합니다.
   * 다른 탭(커스텀 뷰어, diff 탭, 플러그인 탭 등)을 보고 있거나 INI 에디터가 아닐 때는 삽입하지 않습니다.
   */
  private canInsertSnippet(): boolean {
    if (!this.doc) return true;
    const activeTab = this.doc.activeTab;
    if (!activeTab || activeTab.kind !== 'text') {
      return false;
    }
    const curModel = this.editor.getModel();
    if (!curModel || curModel !== activeTab.model) {
      return false;
    }
    // 언어 ID 또는 확장자 검증
    const lang = curModel.getLanguageId();
    if (lang !== LANGUAGE_ID && lang !== 'ini') {
      const fileName = activeTab.file?.name || activeTab.title || '';
      if (!/\.(ini|3dm|migoto|txt)$/i.test(fileName)) {
        return false;
      }
    }
    return true;
  }

  private loadCollapsedGroups() {
    try {
      const raw = localStorage.getItem(STORAGE_TEMPLATE_COLLAPSED);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.collapsedGroups = new Set(arr);
        }
      }
    } catch {}
  }

  private saveCollapsedGroups() {
    try {
      localStorage.setItem(STORAGE_TEMPLATE_COLLAPSED, JSON.stringify([...this.collapsedGroups]));
    } catch {}
  }

  private toggleGroup(groupName: string) {
    if (this.collapsedGroups.has(groupName)) {
      this.collapsedGroups.delete(groupName);
    } else {
      this.collapsedGroups.add(groupName);
    }
    this.saveCollapsedGroups();
    this.renderList();
  }

  private render() {
    this.root.replaceChildren();

    // ---- Header ----
    const header = document.createElement('div');
    header.className = 'template-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'template-title-row';

    const title = document.createElement('h2');
    title.textContent = '코드 템플릿';
    titleRow.append(title);

    const actions = document.createElement('div');
    actions.className = 'template-header-actions';

    const importBtn = document.createElement('button');
    importBtn.className = 'template-add-btn';
    importBtn.title = '템플릿 JSON 파일 불러오기';
    importBtn.innerHTML = `<span>불러오기</span>`;
    importBtn.addEventListener('click', async () => {
      await this.handleImport();
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'template-add-btn';
    addBtn.title = '새 템플릿 추가';
    addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span>추가</span>
    `;
    addBtn.addEventListener('click', () => this.openAddModal());

    actions.append(importBtn, addBtn);
    titleRow.append(actions);

    header.append(titleRow);

    // Search filter
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = '템플릿 검색…';
    search.value = this.filter;
    search.setAttribute('aria-label', '템플릿 검색');
    search.addEventListener('input', () => {
      this.filter = search.value.trim().toLowerCase();
      this.renderList();
    });
    header.append(search);

    this.root.append(header);

    // ---- Container for list ----
    const container = document.createElement('div');
    container.id = 'template-list-container';
    container.className = 'template-list-container';
    this.root.append(container);

    this.renderList();
  }

  private renderList() {
    const container = this.root.querySelector('#template-list-container');
    if (!container) return;
    container.replaceChildren();

    const all = getAllTemplates();
    const q = this.filter;

    const filtered = all.filter((t) => {
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.group.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = q ? '일치하는 템플릿이 없습니다.' : '등록된 템플릿이 없습니다.';
      container.append(empty);
      return;
    }

    // 1. 즐겨찾기 그룹 처리 (필터링된 결과 중 즐겨찾기된 항목 모음)
    const favoriteItems = filtered.filter((t) => isTemplateFavorite(t));
    if (favoriteItems.length > 0) {
      const favGroupEl = this.renderGroupSection(FAVORITES_GROUP_NAME, favoriteItems, true);
      container.append(favGroupEl);
    }

    // 2. 일반 그룹별 항목 모음
    const groups = new Map<string, Template[]>();
    for (const t of filtered) {
      const g = t.group || '기타';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(t);
    }

    for (const [groupName, items] of groups.entries()) {
      const groupEl = this.renderGroupSection(groupName, items, false);
      container.append(groupEl);
    }
  }

  private renderGroupSection(groupName: string, items: Template[], isFavoritesGroup: boolean): HTMLElement {
    // 검색어가 있으면 사용자가 결과를 볼 수 있도록 무조건 펼침
    const isCollapsed = !this.filter && this.collapsedGroups.has(groupName);

    const groupEl = document.createElement('div');
    groupEl.className = `template-group${isCollapsed ? ' is-collapsed' : ''}`;

    const groupTitle = document.createElement('div');
    groupTitle.className = 'template-group-title';
    groupTitle.title = isCollapsed ? `'${groupName}' 펼치기` : `'${groupName}' 접기`;

    // Left area: Chevron, Name, Count badge
    const groupLeft = document.createElement('div');
    groupLeft.className = 'template-group-left';

    const chevron = document.createElement('span');
    chevron.className = `template-group-chevron${isCollapsed ? ' collapsed' : ''}`;
    chevron.innerHTML = `
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    groupLeft.append(chevron);

    const groupNameSpan = document.createElement('span');
    groupNameSpan.className = 'template-group-name';
    groupNameSpan.textContent = groupName;
    groupLeft.append(groupNameSpan);

    const countBadge = document.createElement('span');
    countBadge.className = 'template-group-count';
    countBadge.textContent = String(items.length);
    groupLeft.append(countBadge);

    groupTitle.append(groupLeft);

    // Group action buttons (Export / Import for custom templates)
    const hasCustom = !isFavoritesGroup && items.some((t) => t.isCustom);
    if (hasCustom) {
      const groupActions = document.createElement('div');
      groupActions.className = 'template-group-actions';

      const exportGrpBtn = document.createElement('button');
      exportGrpBtn.className = 'template-group-btn';
      exportGrpBtn.title = `'${groupName}' 그룹 템플릿 내보내기 (.json)`;
      exportGrpBtn.textContent = '내보내기';
      exportGrpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleExportGroup(groupName);
      });

      const importGrpBtn = document.createElement('button');
      importGrpBtn.className = 'template-group-btn';
      importGrpBtn.title = `'${groupName}' 그룹으로 템플릿 불러오기 (.json)`;
      importGrpBtn.textContent = '불러오기';
      importGrpBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.handleImport(groupName);
      });

      groupActions.append(exportGrpBtn, importGrpBtn);
      groupTitle.append(groupActions);
    }

    // Toggle collapse on header click
    groupTitle.addEventListener('click', () => {
      this.toggleGroup(groupName);
    });

    groupEl.append(groupTitle);

    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'template-group-items';
    if (isCollapsed) {
      itemsContainer.style.display = 'none';
    }

    for (const t of items) {
      const card = this.renderCard(t);
      itemsContainer.append(card);
    }

    groupEl.append(itemsContainer);
    return groupEl;
  }

  private renderCard(t: Template): HTMLElement {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.title = '클릭하여 현재 커서 위치에 삽입';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'template-card-header';

    const label = document.createElement('span');
    label.className = 'template-card-label';
    label.textContent = t.label;
    cardHeader.append(label);

    const badgeBox = document.createElement('div');
    badgeBox.className = 'template-card-actions';

    // Favorite Star Button
    const isFav = isTemplateFavorite(t);
    const favBtn = document.createElement('button');
    favBtn.className = `template-card-fav-btn${isFav ? ' active' : ''}`;
    favBtn.title = isFav ? '즐겨찾기 해제' : '즐겨찾기에 추가';
    favBtn.setAttribute('aria-label', favBtn.title);
    favBtn.innerHTML = isFav
      ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
      : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTemplateFavorite(t);
      this.renderList();
    });
    badgeBox.append(favBtn);

    if (t.isCustom) {
      const customBadge = document.createElement('span');
      customBadge.className = 'template-card-badge custom';
      customBadge.textContent = '사용자';
      badgeBox.append(customBadge);

      const delBtn = document.createElement('button');
      delBtn.className = 'template-card-del-btn';
      delBtn.title = '템플릿 삭제';
      delBtn.setAttribute('aria-label', '템플릿 삭제');
      delBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await openConfirmModal({
          title: '템플릿 삭제',
          message: `'${t.label}' 템플릿을 삭제하시겠습니까?`,
          confirmText: '삭제',
          cancelText: '취소',
          variant: 'danger',
        });
        if (ok) {
          if (t.id) deleteCustomTemplate(t.id);
          this.renderList();
        }
      });
      badgeBox.append(delBtn);
    }

    cardHeader.append(badgeBox);
    card.append(cardHeader);

    if (t.description) {
      const desc = document.createElement('p');
      desc.className = 'template-card-desc';
      desc.textContent = t.description;
      card.append(desc);
    }

    // Preview snippet
    const preview = document.createElement('pre');
    preview.className = 'template-card-preview';
    const lines = t.body.trim().split('\n').slice(0, 3);
    preview.textContent = lines.join('\n') + (t.body.trim().split('\n').length > 3 ? '\n…' : '');
    card.append(preview);

    card.addEventListener('click', () => {
      // INI 텍스트 창에 포커스와 커서가 올라가 있을 때만 동작 (다른 탭을 보고 있을 땐 무시)
      if (!this.canInsertSnippet()) {
        return;
      }
      insertTemplate(this.editor, t);
      appLogger.info('Template', `코드 스니펫 삽입: '${t.label}' (${t.group})`);
    });

    return card;
  }

  private openAddModal() {
    const body = document.createElement('div');
    body.className = 'template-modal-body';

    const form = document.createElement('form');
    form.className = 'template-form';
    form.autocomplete = 'off';

    // 1. Name
    const nameRow = document.createElement('div');
    nameRow.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = '템플릿 이름 (필수)';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.required = true;
    nameInput.placeholder = '예: 무기 텍스처 오버라이드';
    nameRow.append(nameLabel, nameInput);

    // 2. Group
    const groupRow = document.createElement('div');
    groupRow.className = 'form-group';
    const groupLabel = document.createElement('label');
    groupLabel.textContent = '분류 / 그룹';
    const groupInput = document.createElement('input');
    groupInput.type = 'text';
    groupInput.placeholder = '기본값: 사용자 템플릿';
    groupInput.value = '사용자 템플릿';
    groupRow.append(groupLabel, groupInput);

    // 3. Description
    const descRow = document.createElement('div');
    descRow.className = 'form-group';
    const descLabel = document.createElement('label');
    descLabel.textContent = '설명 (선택)';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.placeholder = '예: 2번 무기 스킨 교체용 블록';
    descRow.append(descLabel, descInput);

    // 4. Code Body
    const bodyRow = document.createElement('div');
    bodyRow.className = 'form-group';
    const bodyLabel = document.createElement('label');
    bodyLabel.textContent = '템플릿 내용 (필수)';
    const bodyTextarea = document.createElement('textarea');
    bodyTextarea.required = true;
    bodyTextarea.rows = 8;
    bodyTextarea.placeholder = `[TextureOverrideWeapon]\nhash = \${1:00000000}\nfilename = \${2:Textures/Weapon.dds}\n`;
    const tip = document.createElement('small');
    tip.className = 'hint';
    tip.textContent = '팁: ${1:기본값}, ${2:기본값} 형식으로 입력하면 Tab 키로 이동 가능한 위치를 지정할 수 있습니다.';
    bodyRow.append(bodyLabel, bodyTextarea, tip);

    // Action buttons
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '취소';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'primary';
    submitBtn.textContent = '템플릿 저장';

    footer.append(cancelBtn, submitBtn);
    form.append(nameRow, groupRow, descRow, bodyRow, footer);
    body.append(form);

    const close = openModal('새 템플릿 추가', body);
    cancelBtn.addEventListener('click', close);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const label = nameInput.value.trim();
      const bodyText = bodyTextarea.value;
      if (!label || !bodyText) return;

      saveCustomTemplate({
        label,
        group: groupInput.value.trim() || '사용자 템플릿',
        description: descInput.value.trim(),
        body: bodyText,
      });

      close();
      this.renderList();
    });

    setTimeout(() => nameInput.focus(), 50);
  }

  private handleExportGroup(groupName: string) {
    const json = exportGroupTemplates(groupName);
    const safeName = groupName.replace(/[\\/:*?"<>|]/g, '_');
    downloadJsonFile(`templates_${safeName}.json`, json);
  }

  private async handleImport(targetGroup?: string) {
    const json = await pickJsonFile();
    if (!json) return;
    try {
      const res = importTemplates(json, targetGroup);
      const groupMsg = res.groupName ? ` ('${res.groupName}' 그룹)` : '';
      alert(`${res.count}개의 템플릿을 성공적으로 불러왔습니다.${groupMsg}`);
      this.renderList();
    } catch (err: any) {
      alert(`템플릿 불러오기 실패: ${err.message || err}`);
    }
  }
}

import { monaco } from '../core/monaco';
import {
  type Template,
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  insertTemplate,
} from '../core/templates';
import { openModal } from './modal';

export class TemplatePanel {
  private filter = '';

  constructor(
    private root: HTMLElement,
    private editor: monaco.editor.IStandaloneCodeEditor,
  ) {
    this.render();
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
    titleRow.append(addBtn);

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

    // Group items by group
    const groups = new Map<string, Template[]>();
    for (const t of filtered) {
      const g = t.group || '기타';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(t);
    }

    for (const [groupName, items] of groups.entries()) {
      const groupEl = document.createElement('div');
      groupEl.className = 'template-group';

      const groupTitle = document.createElement('div');
      groupTitle.className = 'template-group-title';
      groupTitle.textContent = groupName;
      groupEl.append(groupTitle);

      for (const t of items) {
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
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`'${t.label}' 템플릿을 삭제하시겠습니까?`)) {
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
          insertTemplate(this.editor, t);
        });

        groupEl.append(card);
      }

      container.append(groupEl);
    }
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
}

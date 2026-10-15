import { openModal } from './modal';
import { isFolderTrusted, addTrustedFolder } from '../../core/workspace/trust';

export interface FolderRef {
  id: string;
  name: string;
}

/**
 * Prompts the user with a Workspace Trust dialog before opening an untrusted folder.
 * Returns true if the user trusts the folder, false if rejected or canceled.
 */
export function promptFolderTrust(folder: FolderRef): Promise<boolean> {
  if (isFolderTrusted(folder.id)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    let closeModal: (() => void) | null = null;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      closeModal?.();
      resolve(result);
    };

    const body = document.createElement('div');
    body.className = 'trust-modal-body';

    // 1. Banner with Shield Icon
    const banner = document.createElement('div');
    banner.className = 'trust-banner';

    const shieldIcon = document.createElement('div');
    shieldIcon.className = 'trust-shield-icon';
    shieldIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
    `;

    const titleWrap = document.createElement('div');
    titleWrap.className = 'trust-title-wrap';

    const mainTitle = document.createElement('div');
    mainTitle.className = 'trust-main-title';
    mainTitle.textContent = '이 폴더의 파일 및 작성자를 신뢰하십니까?';

    const subTitle = document.createElement('div');
    subTitle.className = 'trust-sub-title';
    subTitle.textContent = '3DMigoto 모드 폴더는 INI 스크립트, 명령 목록, 텍스처 등을 포함하며 에디터에서 해당 파일들을 직접 읽고 수정합니다.';

    titleWrap.append(mainTitle, subTitle);
    banner.append(shieldIcon, titleWrap);

    // 2. Folder Info Box
    const infoBox = document.createElement('div');
    infoBox.className = 'trust-info-box';

    const folderNameRow = document.createElement('div');
    folderNameRow.className = 'trust-info-row';
    folderNameRow.innerHTML = `<span class="trust-info-label">대상 폴더:</span><strong class="trust-info-val">${folder.name}</strong>`;

    const folderPathRow = document.createElement('div');
    folderPathRow.className = 'trust-info-row';
    folderPathRow.innerHTML = `<span class="trust-info-label">전체 경로:</span><code class="trust-info-path">${folder.id}</code>`;

    infoBox.append(folderNameRow, folderPathRow);

    // 3. Optional Parent Folder Trust Checkbox
    const normalizedPath = folder.id.replace(/[\\/]+$/, '');
    const parentPath = normalizedPath.replace(/[\\/][^\\/]+$/, '');
    const hasParent = parentPath && parentPath !== normalizedPath;
    const parentName = hasParent ? parentPath.split(/[\\/]/).filter(Boolean).pop() ?? parentPath : '';

    const optWrap = document.createElement('div');
    optWrap.className = 'trust-opt-wrap';

    let chkParent: HTMLInputElement | null = null;
    if (hasParent) {
      const optLabel = document.createElement('label');
      optLabel.className = 'trust-opt-label';

      chkParent = document.createElement('input');
      chkParent.type = 'checkbox';

      const optText = document.createElement('span');
      optText.textContent = ` 상위 폴더 '${parentName}' 내의 모든 모드 폴더도 함께 신뢰`;

      optLabel.append(chkParent, optText);
      optWrap.append(optLabel);
    }

    // 4. Notice Text
    const notice = document.createElement('div');
    notice.className = 'trust-notice';
    notice.textContent = '신뢰하지 않는 출처의 폴더는 열지 않는 것을 권장합니다. 신뢰를 승인하면 파일 탐색 및 편집이 시작됩니다.';

    // 5. Actions Button Row
    const actions = document.createElement('div');
    actions.className = 'trust-actions-row';

    const trustBtn = document.createElement('button');
    trustBtn.className = 'primary trust-btn';
    trustBtn.textContent = '작성자를 신뢰하고 폴더 열기';
    trustBtn.onclick = () => {
      addTrustedFolder(folder.id);
      if (chkParent?.checked && hasParent) {
        addTrustedFolder(parentPath);
      }
      finish(true);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary trust-btn';
    cancelBtn.textContent = '열지 않음 (취소)';
    cancelBtn.onclick = () => finish(false);

    actions.append(trustBtn, cancelBtn);

    body.append(banner, infoBox, optWrap, notice, actions);

    closeModal = openModal('작업자 신뢰 확인 (Workspace Trust)', body, {
      autoHeight: true,
      className: 'modal-trust',
    });

    // Focus primary button on display
    setTimeout(() => trustBtn.focus(), 60);
  });
}

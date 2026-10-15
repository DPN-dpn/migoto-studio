import { openModal } from './modal';
import type { DocumentManager } from '../../core/workspace/documents';
import { platform } from '../../platform';
import { showToast } from '../common/toast';

/**
 * Compare Dialog (파일 및 변경 사항 비교 대화상자)
 * Allows comparing:
 * 1. Current file with saved file on disk
 * 2. Current file with clipboard text (e.g. from AI agent)
 * 3. Current file with latest automatic backup
 * 4. Two open tabs against each other
 * 5. Free-form text paste comparison
 */
export async function openCompareDialog(doc: DocumentManager): Promise<void> {
  const body = document.createElement('div');
  body.className = 'compare-dialog-body';

  let closeFn: (() => void) | null = null;

  // Section 1: Quick Actions with Current Active Document
  const currentTab = doc.activeTab;
  const currentName = currentTab ? currentTab.title : '현재 문서';

  const quickSection = document.createElement('div');
  quickSection.className = 'compare-section';

  const quickTitle = document.createElement('h3');
  quickTitle.className = 'compare-section-title';
  quickTitle.textContent = `현재 문서 ('${currentName}') 빠른 비교`;

  const quickBtnGrid = document.createElement('div');
  quickBtnGrid.className = 'compare-quick-grid';

  // 1.1 Compare with Disk
  const btnDisk = document.createElement('button');
  btnDisk.className = 'compare-quick-btn';
  btnDisk.innerHTML = `
    <span class="compare-btn-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></span>
    <span class="compare-btn-title">디스크 저장본과 비교</span>
    <span class="compare-btn-desc">디스크의 원본 파일과 현재 에디터 변경 사항을 비교합니다.</span>
  `;
  btnDisk.disabled = !currentTab?.file;
  btnDisk.onclick = async () => {
    closeFn?.();
    await doc.compareWithDisk();
  };

  // 1.2 Compare with Clipboard
  const btnClipboard = document.createElement('button');
  btnClipboard.className = 'compare-quick-btn';
  btnClipboard.innerHTML = `
    <span class="compare-btn-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg></span>
    <span class="compare-btn-title">클립보드와 비교</span>
    <span class="compare-btn-desc">AI 에이전트나 외부에서 복사한 코드와 현재 문서를 비교합니다.</span>
  `;
  btnClipboard.onclick = async () => {
    closeFn?.();
    await doc.compareWithClipboard();
  };

  // 1.3 Compare with Latest Backup
  const btnBackup = document.createElement('button');
  btnBackup.className = 'compare-quick-btn';
  btnBackup.innerHTML = `
    <span class="compare-btn-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>
    <span class="compare-btn-title">최근 백업본(.bak)과 비교</span>
    <span class="compare-btn-desc">저장 직전에 자동 보관된 백업본과 현재 문서를 비교합니다.</span>
  `;
  btnBackup.disabled = !currentTab?.file;
  btnBackup.onclick = async () => {
    if (!currentTab.file) return;
    try {
      const backups = await platform().listBackups(currentTab.file);
      if (backups.length === 0) {
        showToast('이 파일의 이전 백업본이 없습니다.', 'warn');
        return;
      }
      // Pick latest backup
      const latest = backups[0];
      const text = await platform().readBackup(latest);
      closeFn?.();
      await doc.compareWithBackup(text, latest.timestamp, currentTab.id);
    } catch (err) {
      showToast(`백업 비교 실패: ${err}`, 'error');
    }
  };

  quickBtnGrid.append(btnDisk, btnClipboard, btnBackup);
  quickSection.append(quickTitle, quickBtnGrid);

  // Section 2: Compare Two Open Tabs
  const tabsSection = document.createElement('div');
  tabsSection.className = 'compare-section';

  const tabsTitle = document.createElement('h3');
  tabsTitle.className = 'compare-section-title';
  tabsTitle.textContent = '열려 있는 탭 간 비교';

  const openTabs = doc.allTabs.filter((t) => t.kind === 'text');
  if (openTabs.length >= 2) {
    const tabsRow = document.createElement('div');
    tabsRow.className = 'compare-row';

    const selectA = document.createElement('select');
    selectA.className = 'plugin-select compare-select';

    const selectB = document.createElement('select');
    selectB.className = 'plugin-select compare-select';

    openTabs.forEach((t, i) => {
      const optA = document.createElement('option');
      optA.value = t.id;
      optA.textContent = t.title;
      selectA.append(optA);

      const optB = document.createElement('option');
      optB.value = t.id;
      optB.textContent = t.title;
      selectB.append(optB);
    });

    selectA.value = openTabs[0].id;
    selectB.value = openTabs[1].id;

    const btnCompareTabs = document.createElement('button');
    btnCompareTabs.className = 'primary compare-action-submit';
    btnCompareTabs.textContent = '두 탭 비교';
    btnCompareTabs.onclick = () => {
      const tabA = openTabs.find((t) => t.id === selectA.value);
      const tabB = openTabs.find((t) => t.id === selectB.value);
      if (!tabA || !tabB) return;
      if (tabA.id === tabB.id) {
        showToast('서로 다른 탭을 선택해주세요.', 'warn');
        return;
      }

      closeFn?.();
      doc.compareTwoFiles(
        { name: `${tabA.title} (원본)`, text: tabA.model.getValue() },
        { name: `${tabB.title} (비교본)`, text: tabB.model.getValue() },
      );
    };

    tabsRow.append(selectA, document.createTextNode(' ↔ '), selectB, btnCompareTabs);
    tabsSection.append(tabsTitle, tabsRow);
  } else {
    const tabsHint = document.createElement('p');
    tabsHint.className = 'hint';
    tabsHint.textContent = '비교할 수 있는 텍스트 탭이 2개 이상 열려 있지 않습니다.';
    tabsSection.append(tabsTitle, tabsHint);
  }

  // Section 3: Free-form Text / Paste Comparison
  const pasteSection = document.createElement('div');
  pasteSection.className = 'compare-section';

  const pasteTitle = document.createElement('h3');
  pasteTitle.className = 'compare-section-title';
  pasteTitle.textContent = '직접 텍스트 붙여넣어 비교';

  const pasteGrid = document.createElement('div');
  pasteGrid.className = 'compare-paste-grid';

  const pasteLeft = document.createElement('div');
  pasteLeft.className = 'compare-paste-col';
  const leftLabel = document.createElement('label');
  leftLabel.textContent = '원본 텍스트 (Left):';
  const leftTextarea = document.createElement('textarea');
  leftTextarea.className = 'compare-textarea';
  leftTextarea.placeholder = '비교할 원본 텍스트를 붙여넣으세요…';
  if (currentTab && currentTab.kind === 'text') {
    leftTextarea.value = currentTab.model.getValue();
  }
  pasteLeft.append(leftLabel, leftTextarea);

  const pasteRight = document.createElement('div');
  pasteRight.className = 'compare-paste-col';
  const rightLabel = document.createElement('label');
  rightLabel.textContent = '수정본 텍스트 (Right):';
  const rightTextarea = document.createElement('textarea');
  rightTextarea.className = 'compare-textarea';
  rightTextarea.placeholder = 'AI 에이전트 수정본 또는 비교할 텍스트를 붙여넣으세요…';
  pasteRight.append(rightLabel, rightTextarea);

  pasteGrid.append(pasteLeft, pasteRight);

  const pasteBtnRow = document.createElement('div');
  pasteBtnRow.className = 'compare-paste-btn-row';
  const btnComparePaste = document.createElement('button');
  btnComparePaste.className = 'primary compare-action-submit';
  btnComparePaste.textContent = '텍스트 비교 시작';
  btnComparePaste.onclick = () => {
    const textA = leftTextarea.value;
    const textB = rightTextarea.value;
    if (!textA && !textB) {
      showToast('비교할 텍스트를 입력해주세요.', 'warn');
      return;
    }

    closeFn?.();
    doc.compareTwoFiles(
      { name: '원본 텍스트', text: textA },
      { name: '수정본 텍스트', text: textB },
    );
  };
  pasteBtnRow.append(btnComparePaste);

  pasteSection.append(pasteTitle, pasteGrid, pasteBtnRow);

  body.append(quickSection, tabsSection, pasteSection);

  closeFn = openModal('파일 및 변경 사항 비교 (Diff)', body);
}

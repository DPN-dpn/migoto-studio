import type { PluginContext } from '../../src/plugins/types.ts';
import { ZZMI_TEMPLATES } from './templates.ts';
import type { ListItemInstance } from '../../src/plugins/ui-builder.ts';

function cleanSnippet(snippet: string): string {
  return snippet.replace(/\$\{\d+:([^}]+)\}/g, '$1');
}

export function buildZzmiSupportView(context: PluginContext, container: HTMLElement) {
  container.className = 'sidebar-panel dynamic-plugin-panel plugin-subview zzmi-support-panel';
  container.replaceChildren();

  // 1. 패널 상단 헤더 및 배지
  const header = context.ui.createPanelHeader('ZZMI 모딩 도구');
  const zzmiBadge = context.ui.createBadge({ text: 'ZZMI / TTL', variant: 'accent' });
  const lintBadge = context.ui.createBadge({ text: '린터 연동됨', variant: 'success' });
  header.append(zzmiBadge, lintBadge);

  // 안내 카드
  const descDiv = document.createElement('div');
  descDiv.style.cssText = 'font-size: 11px; color: var(--fg-dim); line-height: 1.5; margin-bottom: 4px;';
  descDiv.textContent =
    'Zenless Zone Zero Mod Injector(ZZMI)의 W-Engine 텍스처 슬롯픽스 및 TTL 투명도 라이브러리 구문을 원클릭으로 확인하고 에디터에 삽입할 수 있습니다.';

  const infoCard = context.ui.createCard({
    title: 'ZZMI & TTL 템플릿',
    content: [descDiv],
  });

  // 2. 템플릿 목록 (createListItem 위젯 활용)
  const listContainer = document.createElement('div');
  listContainer.className = 'zzmi-template-list';
  listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;';

  let selectedIndex = 0;
  const listItems: ListItemInstance[] = [];

  // 3. 코드 미리보기 영역 (createCodeBlock 활용)
  const previewLabel = document.createElement('div');
  previewLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--fg-dim); margin-bottom: 4px;';
  previewLabel.textContent = `코드 미리보기: ${ZZMI_TEMPLATES[0].label}`;

  let currentCodeBlock = context.ui.createCodeBlock({
    code: cleanSnippet(ZZMI_TEMPLATES[0].body),
    maxHeight: '160px',
  });

  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'zzmi-preview-wrapper';
  previewWrapper.style.cssText = 'margin-bottom: 8px;';
  previewWrapper.append(previewLabel, currentCodeBlock.container);

  // 4. 에디터 삽입 버튼
  const insertBtn = context.ui.createButton({
    text: '현재 에디터 커서에 삽입',
    variant: 'primary',
    onClick() {
      const tpl = ZZMI_TEMPLATES[selectedIndex];
      if (tpl) {
        const cleaned = cleanSnippet(tpl.body);
        context.editor.insertText(cleaned);
        context.ui.showToast(`[${tpl.label}] 구문이 삽입되었습니다.`, 'info');
      }
    },
  });

  const copyBtn = context.ui.createButton({
    text: '코드 복사',
    variant: 'secondary',
    onClick() {
      const tpl = ZZMI_TEMPLATES[selectedIndex];
      if (tpl) {
        const cleaned = cleanSnippet(tpl.body);
        navigator.clipboard.writeText(cleaned);
        context.ui.showToast('클립보드에 복사되었습니다.', 'info');
      }
    },
  });

  const actionRow = context.ui.createButtonRow([insertBtn, copyBtn]);

  function updateSelection(idx: number) {
    selectedIndex = idx;
    listItems.forEach((item, i) => {
      item.setSelected(i === idx);
    });

    const targetTpl = ZZMI_TEMPLATES[idx];
    if (targetTpl) {
      previewLabel.textContent = `코드 미리보기: ${targetTpl.label}`;
      currentCodeBlock.setCode(cleanSnippet(targetTpl.body));
    }
  }

  ZZMI_TEMPLATES.forEach((tpl, idx) => {
    const isTtl = Boolean(tpl.id?.includes('ttl'));
    const badge = context.ui.createBadge({
      text: isTtl ? 'TTL Lib' : 'SlotFix',
      variant: isTtl ? 'accent' : 'muted',
    });

    const item = context.ui.createListItem({
      title: tpl.label,
      subtitle: tpl.description,
      badge,
      selected: idx === 0,
      onClick() {
        updateSelection(idx);
      },
    });

    listContainer.append(item.element);
    listItems.push(item);
  });

  updateSelection(0);

  // 5. 전체 컨테이너에 조합
  container.append(
    header,
    infoCard,
    listContainer,
    previewWrapper,
    actionRow,
  );
}

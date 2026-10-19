import { nativeWindowManager } from './native-window';
import type { ActiveNativeWindowInfo } from './types';

let isInitialized = false;

/**
 * 하단 상태표시줄(Status Bar)에 '열린 별도 OS 창' 드롭다운 메뉴를 연동합니다.
 * 평소에는 완전히 숨겨져 있으며, 별도 OS 창이 1개 이상 열리면 드롭다운 버튼이 나타납니다.
 */
export function initStatusBarWindowsMenu(): void {
  if (isInitialized || typeof document === 'undefined') return;
  isInitialized = true;

  const statusbar = document.getElementById('statusbar');
  if (!statusbar) return;

  // 상태바 오른쪽 영역 탐색
  const statusRight = statusbar.querySelector('.status-right') || statusbar;

  // 1. 드롭다운 트리거 버튼 생성
  const btn = document.createElement('button');
  btn.id = 'status-windows-btn';
  btn.className = 'status-btn status-windows-btn';
  btn.style.display = 'none'; // 평소에는 숨김
  btn.style.color = '#58a6ff';
  btn.style.fontWeight = '500';
  btn.title = '열려 있는 별도 OS 윈도우 목록 확인 및 관리';

  // 버튼을 status-right의 가장 앞쪽에 삽입
  statusRight.insertBefore(btn, statusRight.firstChild);

  // 2. 드롭다운 팝업 메뉴 컨테이너 생성
  const dropdown = document.createElement('div');
  dropdown.id = 'status-windows-dropdown';
  dropdown.className = 'popup-menu status-windows-dropdown';
  dropdown.hidden = true;
  document.body.appendChild(dropdown);

  let currentWindows: ActiveNativeWindowInfo[] = [];

  const updateDropdownUi = () => {
    dropdown.replaceChildren();

    if (currentWindows.length === 0) {
      dropdown.hidden = true;
      btn.style.display = 'none';
      return;
    }

    // 헤더
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 6px 12px 4px 12px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted, #8b949e);
      border-bottom: 1px solid var(--border-color, #30363d);
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    `;
    header.innerHTML = `<span>열려 있는 별도 창 (${currentWindows.length})</span>`;
    dropdown.appendChild(header);

    // 창 목록 항목
    currentWindows.forEach((win) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 6px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
        font-size: 12px;
        color: var(--text-color, #e6edf3);
        transition: background 0.15s ease;
      `;
      item.onmouseenter = () => (item.style.backgroundColor = 'var(--bg-hover, #21262d)');
      item.onmouseleave = () => (item.style.backgroundColor = 'transparent');

      // 창 제목 영역 (클릭 시 포커스)
      const titleSpan = document.createElement('span');
      titleSpan.style.cssText = `
        flex: 1 1 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 6px;
      `;
      const icon = win.isSubWindowPopout ? '⧉' : '🗔';
      titleSpan.innerHTML = `<span style="opacity:0.7;">${icon}</span><span>${escapeHtml(win.title)}</span>`;
      titleSpan.title = `클릭하여 포커스: ${win.title}`;
      titleSpan.onclick = async () => {
        dropdown.hidden = true;
        await win.focus();
      };
      item.appendChild(titleSpan);

      // 액션 버튼 영역
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 4px; align-items: center;';

      // 서브윈도우에서 PiP로 분리된 창인 경우: [내장 창으로 복원] 버튼 제공
      if (win.isSubWindowPopout && typeof win.restoreToSubWindow === 'function') {
        const restoreBtn = document.createElement('button');
        restoreBtn.style.cssText = `
          background: rgba(56, 139, 253, 0.15);
          border: 1px solid rgba(56, 139, 253, 0.4);
          color: #58a6ff;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          cursor: pointer;
        `;
        restoreBtn.textContent = '내장 창으로 복원';
        restoreBtn.title = '메인 화면 내의 플로팅 서브 창으로 원상 복귀합니다.';
        restoreBtn.onclick = (e) => {
          e.stopPropagation();
          dropdown.hidden = true;
          win.restoreToSubWindow!();
        };
        actions.appendChild(restoreBtn);
      }

      // [닫기 ✕] 버튼
      const closeBtn = document.createElement('button');
      closeBtn.style.cssText = `
        background: transparent;
        border: none;
        color: var(--text-muted, #8b949e);
        font-size: 12px;
        padding: 2px 6px;
        cursor: pointer;
        border-radius: 4px;
      `;
      closeBtn.textContent = '✕';
      closeBtn.title = '이 창 닫기';
      closeBtn.onmouseenter = () => {
        closeBtn.style.color = '#f85149';
        closeBtn.style.backgroundColor = 'rgba(248, 81, 73, 0.15)';
      };
      closeBtn.onmouseleave = () => {
        closeBtn.style.color = 'var(--text-muted, #8b949e)';
        closeBtn.style.backgroundColor = 'transparent';
      };
      closeBtn.onclick = async (e) => {
        e.stopPropagation();
        await win.close();
      };
      actions.appendChild(closeBtn);

      item.appendChild(actions);
      dropdown.appendChild(item);
    });

    // 2개 이상일 때 전체 닫기 옵션
    if (currentWindows.length > 1) {
      const footer = document.createElement('div');
      footer.style.cssText = `
        border-top: 1px solid var(--border-color, #30363d);
        padding: 4px 12px;
        text-align: right;
      `;
      const closeAllBtn = document.createElement('button');
      closeAllBtn.style.cssText = `
        background: transparent;
        border: none;
        color: #f85149;
        font-size: 11px;
        cursor: pointer;
        padding: 4px 6px;
      `;
      closeAllBtn.textContent = '모든 별도 창 닫기';
      closeAllBtn.onclick = () => {
        dropdown.hidden = true;
        nativeWindowManager.closeAllWindows();
      };
      footer.appendChild(closeAllBtn);
      dropdown.appendChild(footer);
    }
  };

  // 창 변경 리스너 등록
  nativeWindowManager.onWindowsChange((windows) => {
    currentWindows = windows;
    if (windows.length > 0) {
      btn.style.display = 'inline-flex';
      btn.innerHTML = `
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px;">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <polyline points="5 8 5 6 7 6" />
          <line x1="5" y1="6" x2="8" y2="9" />
        </svg>
        <span>열린 창 (${windows.length}) ▾</span>
      `;
    } else {
      btn.style.display = 'none';
      dropdown.hidden = true;
    }
    updateDropdownUi();
  });

  // 버튼 클릭 시 드롭다운 토글 및 위치 계산
  btn.onclick = (e) => {
    e.stopPropagation();
    if (!dropdown.hidden) {
      dropdown.hidden = true;
      return;
    }

    updateDropdownUi();
    dropdown.hidden = false;

    // 위치: 상태바 버튼 바로 위에 띄우기
    const rect = btn.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex = '999999';
    dropdown.style.minWidth = '240px';
    dropdown.style.maxWidth = '360px';
    dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    dropdown.style.left = `${Math.max(10, Math.min(window.innerWidth - 260, rect.left))}px`;
  };

  // 바깥 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (!dropdown.hidden && !dropdown.contains(e.target as Node) && e.target !== btn) {
      dropdown.hidden = true;
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

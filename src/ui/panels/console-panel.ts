/**
 * Migoto Studio - Console Panel (출력 콘솔 창)
 *
 * 에디터 하단에 위치하며, 애플리케이션 및 플러그인의 로그/오류를 실시간으로 출력,
 * 레벨/소스/검색어별로 필터링하고 복사 및 비우기 기능을 제공하는 패널입니다.
 */

import { monaco } from '../../core/editor/monaco';
import { appLogger, type LogEntry, type LogLevel } from '../../core/logger';

const STORAGE_CONSOLE_HEIGHT = 'migoto_console_panel_height';
const STORAGE_CONSOLE_AUTO_SCROLL = 'migoto_console_auto_scroll';
const DEFAULT_HEIGHT = 220;
const MIN_HEIGHT = 80;

export class ConsolePanel {
  private panelEl: HTMLElement;
  private resizerEl: HTMLElement;
  private editor: monaco.editor.IStandaloneCodeEditor;

  private logsContainer!: HTMLElement;
  private totalBadge!: HTMLElement;
  private errorBadge!: HTMLElement;
  private warnBadge!: HTMLElement;
  private sourceSelect!: HTMLSelectElement;
  private searchInput!: HTMLInputElement;
  private autoScrollBtn!: HTMLButtonElement;

  private currentLevelFilter: 'all' | LogLevel = 'all';
  private currentSourceFilter = 'all';
  private searchQuery = '';
  private autoScroll = true;
  private knownSources = new Set<string>();

  private stateChangeListeners = new Set<(isOpen: boolean) => void>();
  private logUnsubscribe?: () => void;
  private clearUnsubscribe?: () => void;

  constructor(
    panelEl: HTMLElement,
    resizerEl: HTMLElement,
    editor: monaco.editor.IStandaloneCodeEditor,
  ) {
    this.panelEl = panelEl;
    this.resizerEl = resizerEl;
    this.editor = editor;

    this.loadSettings();
    this.render();
    this.bindResizer();
    this.subscribeLogger();
  }

  private loadSettings() {
    try {
      const savedScroll = localStorage.getItem(STORAGE_CONSOLE_AUTO_SCROLL);
      if (savedScroll !== null) {
        this.autoScroll = savedScroll === 'true';
      }
    } catch {}
  }

  private saveSettings() {
    try {
      localStorage.setItem(STORAGE_CONSOLE_AUTO_SCROLL, String(this.autoScroll));
    } catch {}
  }

  public isOpen(): boolean {
    return !this.panelEl.hidden;
  }

  public open() {
    if (this.isOpen()) return;
    this.panelEl.hidden = false;
    this.resizerEl.hidden = false;
    this.notifyState();

    // 에디터 레이아웃 재계산
    requestAnimationFrame(() => {
      this.editor.layout();
      if (this.autoScroll) {
        this.scrollToBottom();
      }
    });
  }

  public close() {
    if (!this.isOpen()) return;
    this.panelEl.hidden = true;
    this.resizerEl.hidden = true;
    this.notifyState();

    requestAnimationFrame(() => {
      this.editor.layout();
    });
  }

  public toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  public onStateChange(listener: (isOpen: boolean) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  private notifyState() {
    const open = this.isOpen();
    for (const listener of this.stateChangeListeners) {
      try {
        listener(open);
      } catch {}
    }
  }

  private render() {
    this.panelEl.className = 'console-panel';
    this.resizerEl.className = 'console-resizer';
    this.resizerEl.title = '드래그하여 콘솔 높이 조절 (더블 클릭 시 초기화)';

    // 패널 저장 높이 복원
    try {
      const savedHeight = localStorage.getItem(STORAGE_CONSOLE_HEIGHT);
      if (savedHeight) {
        const h = parseInt(savedHeight, 10);
        if (!isNaN(h) && h >= MIN_HEIGHT) {
          this.panelEl.style.height = `${h}px`;
        }
      } else {
        this.panelEl.style.height = `${DEFAULT_HEIGHT}px`;
      }
    } catch {
      this.panelEl.style.height = `${DEFAULT_HEIGHT}px`;
    }

    this.panelEl.replaceChildren();

    // ---- 헤더 바 ----
    const header = document.createElement('div');
    header.className = 'console-header';

    // 좌측: 타이틀 및 배지
    const headerLeft = document.createElement('div');
    headerLeft.className = 'console-header-left';

    const titleEl = document.createElement('div');
    titleEl.className = 'console-title';
    titleEl.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
      <span>콘솔 출력</span>
    `;

    this.totalBadge = document.createElement('span');
    this.totalBadge.className = 'console-count-badge';
    this.totalBadge.textContent = '0';
    this.totalBadge.title = '총 로그 개수';

    this.errorBadge = document.createElement('span');
    this.errorBadge.className = 'console-count-badge error';
    this.errorBadge.textContent = '오류 0';
    this.errorBadge.hidden = true;
    this.errorBadge.addEventListener('click', () => {
      this.setLevelFilter('error');
    });

    this.warnBadge = document.createElement('span');
    this.warnBadge.className = 'console-count-badge warn';
    this.warnBadge.textContent = '경고 0';
    this.warnBadge.hidden = true;
    this.warnBadge.addEventListener('click', () => {
      this.setLevelFilter('warn');
    });

    headerLeft.append(titleEl, this.totalBadge, this.errorBadge, this.warnBadge);

    // 중앙: 필터 버튼 및 소스 선택, 검색
    const headerCenter = document.createElement('div');
    headerCenter.className = 'console-header-center';

    const levelGroup = document.createElement('div');
    levelGroup.className = 'console-level-filters';

    const levels: Array<{ id: 'all' | LogLevel; label: string }> = [
      { id: 'all', label: '전체' },
      { id: 'info', label: '정보' },
      { id: 'warn', label: '경고' },
      { id: 'error', label: '오류' },
    ];

    levels.forEach(({ id, label }) => {
      const btn = document.createElement('button');
      btn.className = `console-filter-btn ${this.currentLevelFilter === id ? 'active' : ''}`;
      btn.dataset.level = id;
      btn.textContent = label;
      btn.addEventListener('click', () => this.setLevelFilter(id));
      levelGroup.appendChild(btn);
    });

    this.sourceSelect = document.createElement('select');
    this.sourceSelect.className = 'console-source-select';
    this.sourceSelect.title = '출력 소스 필터';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = '전체 소스';
    this.sourceSelect.appendChild(allOpt);
    this.sourceSelect.addEventListener('change', () => {
      this.currentSourceFilter = this.sourceSelect.value;
      this.refreshLogDisplay();
    });

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'console-search-input';
    this.searchInput.placeholder = '로그 필터링…';
    this.searchInput.setAttribute('aria-label', '콘솔 로그 검색');
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.trim().toLowerCase();
      this.refreshLogDisplay();
    });

    headerCenter.append(levelGroup, this.sourceSelect, this.searchInput);

    // 우측: 액션 버튼들
    const headerRight = document.createElement('div');
    headerRight.className = 'console-header-right';

    this.autoScrollBtn = document.createElement('button');
    this.autoScrollBtn.className = `console-action-btn ${this.autoScroll ? 'active' : ''}`;
    this.autoScrollBtn.title = '자동 스크롤 켜기/끄기';
    this.autoScrollBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
      </svg>
      <span>자동 스크롤</span>
    `;
    this.autoScrollBtn.addEventListener('click', () => {
      this.autoScroll = !this.autoScroll;
      this.autoScrollBtn.classList.toggle('active', this.autoScroll);
      this.saveSettings();
      if (this.autoScroll) {
        this.scrollToBottom();
      }
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'console-action-btn';
    copyBtn.title = '현재 표시된 로그 전체 복사';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>복사</span>
    `;
    copyBtn.addEventListener('click', () => this.copyFilteredLogs());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'console-action-btn';
    clearBtn.title = '콘솔 로그 지우기';
    clearBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span>지우기</span>
    `;
    clearBtn.addEventListener('click', () => appLogger.clear());

    const closeBtn = document.createElement('button');
    closeBtn.className = 'console-action-btn close';
    closeBtn.title = '콘솔창 닫기 (Ctrl+`)';
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', () => this.close());

    headerRight.append(this.autoScrollBtn, copyBtn, clearBtn, closeBtn);

    header.append(headerLeft, headerCenter, headerRight);
    this.panelEl.appendChild(header);

    // ---- 로그 목록 컨테이너 ----
    this.logsContainer = document.createElement('div');
    this.logsContainer.className = 'console-logs-container';
    this.panelEl.appendChild(this.logsContainer);

    // 초기 로그 목록 렌더링
    this.refreshLogDisplay();
  }

  private setLevelFilter(level: 'all' | LogLevel) {
    this.currentLevelFilter = level;
    const btns = this.panelEl.querySelectorAll('.console-filter-btn');
    btns.forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.level === level);
    });
    this.refreshLogDisplay();
  }

  private subscribeLogger() {
    this.logUnsubscribe = appLogger.subscribe((entry) => {
      this.handleNewLog(entry);
    });

    this.clearUnsubscribe = appLogger.onClear(() => {
      this.logsContainer.replaceChildren();
      this.updateBadges();
    });
  }

  private handleNewLog(entry: LogEntry) {
    // 새 소스 발견 시 드롭다운 갱신
    if (!this.knownSources.has(entry.source)) {
      this.knownSources.add(entry.source);
      const opt = document.createElement('option');
      opt.value = entry.source;
      opt.textContent = entry.source;
      this.sourceSelect.appendChild(opt);
    }

    this.updateBadges();

    // 현재 필터 조건에 맞으면 DOM에 직접 행 추가
    if (this.matchesFilter(entry)) {
      const row = this.createLogRow(entry);
      this.logsContainer.appendChild(row);

      if (this.autoScroll) {
        this.scrollToBottom();
      }
    }
  }

  private updateBadges() {
    const entries = appLogger.getEntries();
    this.totalBadge.textContent = String(entries.length);

    const errCount = entries.filter((e) => e.level === 'error').length;
    const warnCount = entries.filter((e) => e.level === 'warn').length;

    if (errCount > 0) {
      this.errorBadge.textContent = `오류 ${errCount}`;
      this.errorBadge.hidden = false;
    } else {
      this.errorBadge.hidden = true;
    }

    if (warnCount > 0) {
      this.warnBadge.textContent = `경고 ${warnCount}`;
      this.warnBadge.hidden = false;
    } else {
      this.warnBadge.hidden = true;
    }
  }

  private matchesFilter(entry: LogEntry): boolean {
    if (this.currentLevelFilter !== 'all' && entry.level !== this.currentLevelFilter) {
      return false;
    }
    if (this.currentSourceFilter !== 'all' && entry.source !== this.currentSourceFilter) {
      return false;
    }
    if (this.searchQuery) {
      const text = `${entry.source} ${entry.message} ${JSON.stringify(entry.details || '')}`.toLowerCase();
      if (!text.includes(this.searchQuery)) {
        return false;
      }
    }
    return true;
  }

  private refreshLogDisplay() {
    this.logsContainer.replaceChildren();
    const entries = appLogger.getEntries();

    this.updateBadges();

    const filtered = entries.filter((e) => this.matchesFilter(e));
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'console-empty';
      empty.textContent = entries.length === 0 ? '출력된 로그가 없습니다.' : '조건에 맞는 로그가 없습니다.';
      this.logsContainer.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((entry) => {
      fragment.appendChild(this.createLogRow(entry));
    });
    this.logsContainer.appendChild(fragment);

    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  private formatTime(d: Date): string {
    const pad = (n: number, s = 2) => String(n).padStart(s, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  private createLogRow(entry: LogEntry): HTMLElement {
    const row = document.createElement('div');
    row.className = `console-row ${entry.level}`;

    // 타임스탬프
    const time = document.createElement('span');
    time.className = 'console-row-time';
    time.textContent = this.formatTime(entry.timestamp);

    // 레벨 배지
    const levelBadge = document.createElement('span');
    levelBadge.className = `console-row-level ${entry.level}`;
    levelBadge.textContent = entry.level.toUpperCase();

    // 소스 태그
    const source = document.createElement('span');
    source.className = 'console-row-source';
    source.textContent = `[${entry.source}]`;

    // 메시지 본문
    const msg = document.createElement('span');
    msg.className = 'console-row-msg';
    msg.textContent = entry.message;

    row.append(time, levelBadge, source, msg);

    // 상세 객체가 있는 경우 펼치기 지원
    if (entry.details && entry.details.length > 0) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'console-expand-btn';
      expandBtn.title = '상세 정보 펼치기/접기';
      expandBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;

      const detailsContainer = document.createElement('pre');
      detailsContainer.className = 'console-row-details';
      detailsContainer.hidden = true;
      detailsContainer.textContent = entry.details
        .map((d) => {
          if (d instanceof Error) {
            return d.stack || d.message;
          }
          if (typeof d === 'object') {
            try {
              return JSON.stringify(d, null, 2);
            } catch {
              return String(d);
            }
          }
          return String(d);
        })
        .join('\n');

      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willShow = Boolean(detailsContainer.hidden);
        detailsContainer.hidden = !willShow;
        expandBtn.classList.toggle('expanded', willShow);
      });

      row.appendChild(expandBtn);

      const wrapper = document.createElement('div');
      wrapper.className = 'console-row-wrapper';
      wrapper.append(row, detailsContainer);
      return wrapper;
    }

    return row;
  }

  private scrollToBottom() {
    requestAnimationFrame(() => {
      this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    });
  }

  private async copyFilteredLogs() {
    const entries = appLogger.getEntries().filter((e) => this.matchesFilter(e));
    if (entries.length === 0) return;

    const lines = entries.map((e) => {
      const time = this.formatTime(e.timestamp);
      const details = e.details && e.details.length > 0 ? `\n${JSON.stringify(e.details, null, 2)}` : '';
      return `[${time}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}${details}`;
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {}
  }

  private bindResizer() {
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e: MouseEvent) => {
      const dy = startY - e.clientY;
      const maxHeight = window.innerHeight * 0.8;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + dy));
      this.panelEl.style.height = `${newHeight}px`;
      this.editor.layout();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      try {
        const h = parseInt(this.panelEl.style.height, 10);
        if (!isNaN(h)) {
          localStorage.setItem(STORAGE_CONSOLE_HEIGHT, String(h));
        }
      } catch {}
    };

    this.resizerEl.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startHeight = this.panelEl.getBoundingClientRect().height;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    this.resizerEl.addEventListener('dblclick', () => {
      this.panelEl.style.height = `${DEFAULT_HEIGHT}px`;
      try {
        localStorage.setItem(STORAGE_CONSOLE_HEIGHT, String(DEFAULT_HEIGHT));
      } catch {}
      this.editor.layout();
    });
  }

  public dispose() {
    this.logUnsubscribe?.();
    this.clearUnsubscribe?.();
  }
}

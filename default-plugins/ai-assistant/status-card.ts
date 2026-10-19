/**
 * status-card.ts
 * AI 요청 진행 상황 표시 카드 (단계별 상태, 타이머, 요청 중단)
 */

export type StepState = 'pending' | 'active' | 'completed' | 'error' | 'retry';

export interface StatusCardController {
  element: HTMLElement;
  updateStep: (
    index: number,
    state: StepState,
    title?: string,
    detail?: string,
  ) => void;
  setStatusTitle: (title: string, color?: string) => void;
  setProviderInfo: (info: string) => void;
  stopTimer: () => string; // returns elapsed seconds
  hideSpinnerAndAbort: () => void;
  remove: () => void;
}

export function createStatusCard(options: {
  onAbort: () => void;
}): StatusCardController {
  const statusCard = document.createElement('div');
  statusCard.className = 'ai-status-card';

  const statusHeader = document.createElement('div');
  statusHeader.className = 'ai-status-header';

  const statusHeaderLeft = document.createElement('div');
  statusHeaderLeft.className = 'ai-status-header-left';

  const spinner = document.createElement('span');
  spinner.className = 'ai-status-spinner';

  const statusTitle = document.createElement('span');
  statusTitle.className = 'ai-status-title';
  statusTitle.textContent = '요청 처리 준비 중...';

  statusHeaderLeft.append(spinner, statusTitle);

  const timerEl = document.createElement('span');
  timerEl.className = 'ai-status-timer';
  timerEl.textContent = '0.0s';

  statusHeader.append(statusHeaderLeft, timerEl);

  const stepsContainer = document.createElement('div');
  stepsContainer.className = 'ai-status-steps';

  const statusActions = document.createElement('div');
  statusActions.className = 'ai-status-actions';

  const statusInfo = document.createElement('span');
  statusInfo.className = 'ai-status-info';

  const abortBtn = document.createElement('button');
  abortBtn.className = 'small-btn ai-status-abort-btn';
  abortBtn.textContent = '요청 중단';
  abortBtn.onclick = () => {
    options.onAbort();
  };

  statusActions.append(statusInfo, abortBtn);
  statusCard.append(statusHeader, stepsContainer, statusActions);

  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    timerEl.textContent = `${elapsed}s`;
  }, 100);

  const steps = [
    { id: 'ctx', title: '에디터 컨텍스트 및 질의 분석' },
    { id: 'conn', title: 'AI 모델 엔드포인트 연결' },
    { id: 'gen', title: '답변 생성 및 코드 스트리밍' },
    { id: 'render', title: '마크다운 및 Diff 렌더링' },
  ];

  const stepElements = steps.map((step) => {
    const el = document.createElement('div');
    el.className = 'ai-step-item pending';
    el.innerHTML = `
      <span class="ai-step-icon"></span>
      <div class="ai-step-text-wrap">
        <span class="ai-step-title">${step.title}</span>
        <span class="ai-step-detail"></span>
      </div>
    `;
    stepsContainer.append(el);
    return el;
  });

  const updateStep = (
    index: number,
    state: StepState,
    title?: string,
    detail?: string,
  ) => {
    const el = stepElements[index];
    if (!el) return;
    el.className = `ai-step-item ${state}`;
    if (title) {
      const tEl = el.querySelector('.ai-step-title');
      if (tEl) tEl.textContent = title;
    }
    if (detail !== undefined) {
      const dEl = el.querySelector('.ai-step-detail');
      if (dEl) dEl.textContent = detail;
    }
  };

  const stopTimer = () => {
    clearInterval(timerInterval);
    return ((Date.now() - startTime) / 1000).toFixed(1);
  };

  const hideSpinnerAndAbort = () => {
    spinner.style.display = 'none';
    abortBtn.style.display = 'none';
  };

  const setStatusTitle = (title: string, color?: string) => {
    statusTitle.textContent = title;
    if (color) {
      statusTitle.style.color = color;
    }
  };

  const setProviderInfo = (info: string) => {
    statusInfo.textContent = info;
  };

  return {
    element: statusCard,
    updateStep,
    setStatusTitle,
    setProviderInfo,
    stopTimer,
    hideSpinnerAndAbort,
    remove: () => statusCard.remove(),
  };
}

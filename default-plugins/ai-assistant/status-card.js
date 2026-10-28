//#region default-plugins/ai-assistant/status-card.ts
function createStatusCard(options) {
	const statusCard = document.createElement("div");
	statusCard.className = "ai-status-card";
	const statusHeader = document.createElement("div");
	statusHeader.className = "ai-status-header";
	const statusHeaderLeft = document.createElement("div");
	statusHeaderLeft.className = "ai-status-header-left";
	const spinner = document.createElement("span");
	spinner.className = "ai-status-spinner";
	const statusTitle = document.createElement("span");
	statusTitle.className = "ai-status-title";
	statusTitle.textContent = "요청 처리 준비 중...";
	statusHeaderLeft.append(spinner, statusTitle);
	const timerEl = document.createElement("span");
	timerEl.className = "ai-status-timer";
	timerEl.textContent = "0.0s";
	statusHeader.append(statusHeaderLeft, timerEl);
	const stepsContainer = document.createElement("div");
	stepsContainer.className = "ai-status-steps";
	const statusActions = document.createElement("div");
	statusActions.className = "ai-status-actions";
	const statusInfo = document.createElement("span");
	statusInfo.className = "ai-status-info";
	const abortBtn = document.createElement("button");
	abortBtn.className = "small-btn ai-status-abort-btn";
	abortBtn.textContent = "요청 중단";
	abortBtn.onclick = () => {
		options.onAbort();
	};
	statusActions.append(statusInfo, abortBtn);
	statusCard.append(statusHeader, stepsContainer, statusActions);
	const startTime = Date.now();
	const timerInterval = setInterval(() => {
		const elapsed = ((Date.now() - startTime) / 1e3).toFixed(1);
		timerEl.textContent = `${elapsed}s`;
	}, 100);
	const stepElements = [
		{
			id: "ctx",
			title: "에디터 컨텍스트 및 질의 분석"
		},
		{
			id: "conn",
			title: "AI 모델 엔드포인트 연결"
		},
		{
			id: "gen",
			title: "답변 생성 및 코드 스트리밍"
		},
		{
			id: "render",
			title: "마크다운 및 Diff 렌더링"
		}
	].map((step) => {
		const el = document.createElement("div");
		el.className = "ai-step-item pending";
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
	const updateStep = (index, state, title, detail) => {
		const el = stepElements[index];
		if (!el) return;
		el.className = `ai-step-item ${state}`;
		if (title) {
			const tEl = el.querySelector(".ai-step-title");
			if (tEl) tEl.textContent = title;
		}
		if (detail !== void 0) {
			const dEl = el.querySelector(".ai-step-detail");
			if (dEl) dEl.textContent = detail;
		}
	};
	const stopTimer = () => {
		clearInterval(timerInterval);
		return ((Date.now() - startTime) / 1e3).toFixed(1);
	};
	const hideSpinnerAndAbort = () => {
		spinner.style.display = "none";
		abortBtn.style.display = "none";
	};
	const setStatusTitle = (title, color) => {
		statusTitle.textContent = title;
		if (color) statusTitle.style.color = color;
	};
	const setProviderInfo = (info) => {
		statusInfo.textContent = info;
	};
	return {
		element: statusCard,
		updateStep,
		setStatusTitle,
		setProviderInfo,
		stopTimer,
		hideSpinnerAndAbort,
		remove: () => statusCard.remove()
	};
}
//#endregion
export { createStatusCard };

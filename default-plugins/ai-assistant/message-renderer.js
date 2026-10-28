import { parseMarkdownToHtml } from "./markdown.js";
//#region default-plugins/ai-assistant/message-renderer.ts
function executeSmartApply(context, codeContent, isAuto = false) {
	const currentText = context.editor.getText();
	const mergeResult = context.ini.merge(currentText, codeContent);
	context.editor.setText(mergeResult.newText);
	const prefix = isAuto ? "[자동 반영] " : "";
	const replacedCount = mergeResult.replacedSections.length;
	const addedCount = mergeResult.addedSections.length;
	if (replacedCount > 0 && addedCount > 0) context.ui.showToast(`${prefix}${replacedCount}개 섹션 교체 및 ${addedCount}개 섹션이 추가되었습니다. (되돌리기: Ctrl+Z)`, "info");
	else if (replacedCount > 0) context.ui.showToast(`${prefix}${replacedCount}개 섹션이 스마트 교체되었습니다. (되돌리기: Ctrl+Z)`, "info");
	else if (addedCount > 0) context.ui.showToast(`${prefix}${addedCount}개 섹션이 파일에 추가되었습니다. (되돌리기: Ctrl+Z)`, "info");
	else context.ui.showToast(`${prefix}파일 내용이 갱신되었습니다. (되돌리기: Ctrl+Z)`, "info");
	return true;
}
function renderAssistantContent(context, targetEl, text, onSmartApply = (c, a) => executeSmartApply(context, c, a)) {
	targetEl.replaceChildren();
	const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?([\s\S]*?)```/g;
	let lastIdx = 0;
	let match;
	while ((match = codeBlockRegex.exec(text)) !== null) {
		const textBefore = text.slice(lastIdx, match.index);
		if (textBefore.trim()) {
			const mdDiv = document.createElement("div");
			mdDiv.className = "ai-md-content";
			mdDiv.innerHTML = parseMarkdownToHtml(textBefore.trim());
			targetEl.append(mdDiv);
		}
		const codeContent = match[1].trim();
		const codeBox = document.createElement("div");
		codeBox.className = "ai-code-block";
		const pre = document.createElement("pre");
		pre.textContent = codeContent;
		codeBox.append(pre);
		const btnBar = document.createElement("div");
		btnBar.className = "ai-code-bar";
		const applyBtn = document.createElement("button");
		applyBtn.className = "small-btn ai-apply-btn";
		applyBtn.textContent = "스마트 적용";
		applyBtn.title = "현재 열린 파일의 해당 섹션을 찾아 스마트하게 교체/반영합니다";
		applyBtn.onclick = () => {
			onSmartApply(codeContent, false);
		};
		const insertBtn = document.createElement("button");
		insertBtn.className = "small-btn";
		insertBtn.textContent = "커서 삽입";
		insertBtn.title = "현재 에디터 커서 위치에 코드를 삽입합니다";
		insertBtn.onclick = () => {
			context.editor.insertText(codeContent + "\n");
			context.ui.showToast("에디터 커서에 코드가 삽입되었습니다.", "info");
		};
		const copyBtn = document.createElement("button");
		copyBtn.className = "small-btn";
		copyBtn.textContent = "복사";
		copyBtn.onclick = () => {
			navigator.clipboard.writeText(codeContent);
			context.ui.showToast("클립보드에 복사되었습니다.", "info");
		};
		btnBar.append(applyBtn, insertBtn, copyBtn);
		codeBox.append(btnBar);
		targetEl.append(codeBox);
		lastIdx = match.index + match[0].length;
	}
	const remaining = text.slice(lastIdx);
	if (remaining.trim()) {
		const mdDiv = document.createElement("div");
		mdDiv.className = "ai-md-content";
		mdDiv.innerHTML = parseMarkdownToHtml(remaining.trim());
		targetEl.append(mdDiv);
	}
}
function renderErrorActions(options) {
	const { targetContainer, prompt, currentModel, reason, onSwitchModel, onRetry } = options;
	const box = document.createElement("div");
	box.className = "ai-error-actions-box";
	const desc = document.createElement("div");
	desc.className = "ai-error-actions-desc";
	if (reason === "503") desc.textContent = "Google Gemini 무료 티어 트래픽 집중으로 인해 요청이 일시 지연되었습니다. 잠시 후 다시 시도하시거나 다른 모델로 변경해 보세요.";
	else if (reason === "TIMEOUT") desc.textContent = "서버 응답이 45초 동안 지연되었습니다. 네트워크 상태를 확인하시거나 다시 시도해 보세요.";
	else if (reason === "404") desc.textContent = "지정된 모델 또는 엔드포인트를 찾을 수 없습니다 (404). 공식 별칭인 gemini-flash-latest 또는 gemini-pro-latest를 사용하세요.";
	else desc.textContent = "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 보세요.";
	const btnRow = document.createElement("div");
	btnRow.className = "ai-error-actions-btn-row";
	const altModel = currentModel === "gemini-flash-latest" ? "gemini-pro-latest" : "gemini-flash-latest";
	const switchBtn = document.createElement("button");
	switchBtn.className = "small-btn";
	switchBtn.textContent = `${altModel} 모델로 전환 후 재시도`;
	switchBtn.onclick = () => {
		onSwitchModel(altModel);
	};
	const retryBtn = document.createElement("button");
	retryBtn.className = "small-btn";
	retryBtn.textContent = "동일 모델로 다시 시도";
	retryBtn.onclick = () => {
		onRetry();
	};
	btnRow.append(switchBtn, retryBtn);
	box.append(desc, btnRow);
	targetContainer.append(box);
}
//#endregion
export { executeSmartApply, renderAssistantContent, renderErrorActions };

import { AVAILABLE_MODELS } from "./api.js";
//#region default-plugins/ai-assistant/settings-view.ts
function createSettingsPane(context) {
	const settingsPane = document.createElement("div");
	settingsPane.className = "ai-pane ai-settings-view";
	settingsPane.hidden = true;
	const urlInput = context.ui.createInput({
		label: "API URL:",
		placeholder: "https://generativelanguage.googleapis.com/v1beta/openai 또는 https://api.openai.com/v1",
		value: context.storage.get("api_url", "https://generativelanguage.googleapis.com/v1beta/openai"),
		onInput: (v) => context.storage.set("api_url", v.trim())
	});
	const keyRow = document.createElement("div");
	keyRow.className = "form-row";
	const keyLabel = document.createElement("label");
	keyLabel.textContent = "API Key:";
	const keyWrap = document.createElement("div");
	keyWrap.className = "ai-key-input-wrap";
	const keyInput = document.createElement("input");
	keyInput.type = "password";
	keyInput.className = "plugin-input ai-key-input";
	keyInput.placeholder = "Gemini 또는 OpenAI API 키 (Ollama는 비워둠)";
	keyInput.value = context.storage.get("api_key", "");
	keyInput.oninput = () => context.storage.set("api_key", keyInput.value.trim());
	const eyeBtn = document.createElement("button");
	eyeBtn.type = "button";
	eyeBtn.className = "ai-eye-btn";
	eyeBtn.title = "API 키 보기/숨기기";
	eyeBtn.setAttribute("aria-label", "API 키 보기/숨기기");
	const eyeSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
	const eyeOffSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
	eyeBtn.innerHTML = eyeSvg;
	let isKeyVisible = false;
	eyeBtn.onclick = () => {
		isKeyVisible = !isKeyVisible;
		keyInput.type = isKeyVisible ? "text" : "password";
		eyeBtn.innerHTML = isKeyVisible ? eyeOffSvg : eyeSvg;
	};
	keyWrap.append(keyInput, eyeBtn);
	keyRow.append(keyLabel, keyWrap);
	let initialModel = context.storage.get("model", "gemini-flash-latest").trim();
	if (!initialModel || initialModel.startsWith("gemini-2.") || initialModel.startsWith("gemini-1.") || initialModel === "gemini-pro") {
		initialModel = "gemini-flash-latest";
		context.storage.set("model", initialModel);
	}
	const modelInput = context.ui.createInput({
		label: "모델명:",
		placeholder: "gemini-flash-latest, gpt-4o-mini 등",
		value: initialModel,
		onInput: (v) => {
			context.storage.set("model", v.trim());
			renderChips();
		}
	});
	const modelChipsWrap = document.createElement("div");
	modelChipsWrap.className = "ai-model-chips";
	const renderChips = () => {
		modelChipsWrap.replaceChildren();
		const current = context.storage.get("model", "gemini-flash-latest").trim();
		for (const m of AVAILABLE_MODELS) {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = `ai-model-chip${current === m.name ? " active" : ""}`;
			chip.textContent = m.label;
			chip.onclick = () => {
				modelInput.setValue(m.name);
				context.storage.set("model", m.name);
				renderChips();
			};
			modelChipsWrap.append(chip);
		}
	};
	renderChips();
	const presetRow = document.createElement("div");
	presetRow.className = "ai-quick-actions";
	const btnPresetGemini = context.ui.createButton({
		text: "Google Gemini",
		variant: "small",
		onClick: () => {
			const u = "https://generativelanguage.googleapis.com/v1beta/openai";
			const m = "gemini-flash-latest";
			urlInput.setValue(u);
			modelInput.setValue(m);
			context.storage.set("api_url", u);
			context.storage.set("model", m);
			renderChips();
			context.ui.showToast("Gemini 설정이 적용되었습니다. API Key를 입력하세요.", "info");
		}
	});
	const btnPresetOpenAI = context.ui.createButton({
		text: "OpenAI (ChatGPT)",
		variant: "small",
		onClick: () => {
			const u = "https://api.openai.com/v1";
			const m = "gpt-4o-mini";
			urlInput.setValue(u);
			modelInput.setValue(m);
			context.storage.set("api_url", u);
			context.storage.set("model", m);
			renderChips();
			context.ui.showToast("OpenAI 설정이 적용되었습니다.", "info");
		}
	});
	const btnPresetOllama = context.ui.createButton({
		text: "로컬 Ollama",
		variant: "small",
		onClick: () => {
			const u = "http://localhost:11434/v1";
			const m = "qwen2.5-coder";
			urlInput.setValue(u);
			modelInput.setValue(m);
			context.storage.set("api_url", u);
			context.storage.set("model", m);
			renderChips();
			context.ui.showToast("Ollama 설정이 적용되었습니다. (Key는 비워둠)", "info");
		}
	});
	presetRow.append(btnPresetGemini, btnPresetOpenAI, btnPresetOllama);
	const presetCard = context.ui.createCard({
		title: "빠른 프로바이더 설정",
		content: [presetRow]
	});
	const configCard = context.ui.createCard({
		title: "연결 정보 입력",
		content: [
			urlInput.row,
			keyRow,
			modelInput.row,
			modelChipsWrap
		]
	});
	const guideDiv = document.createElement("div");
	guideDiv.style.cssText = "font-size: 11px; color: var(--fg-dim); line-height: 1.5;";
	guideDiv.innerHTML = `
    <div>- Google Gemini: Google AI Studio 키(AQ...) 입력 시 gemini-flash-latest 모델이 기본 제공됩니다.</div>
    <div>- OpenAI: platform.openai.com API 키 및 gpt-4o-mini 모델을 권장합니다.</div>
    <div>- Ollama: 로컬 PC에서 실행 중인 경우 키 없이 바로 연결할 수 있습니다.</div>
  `;
	const guideCard = context.ui.createCard({
		title: "환경 및 모델 안내",
		content: [guideDiv]
	});
	settingsPane.append(presetCard, configCard, guideCard);
	return {
		pane: settingsPane,
		renderChips,
		setModel: (modelName) => {
			modelInput.setValue(modelName);
			context.storage.set("model", modelName);
			renderChips();
		}
	};
}
//#endregion
export { createSettingsPane };

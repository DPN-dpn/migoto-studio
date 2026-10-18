//#region default-plugins/zzmi-support/rules.ts
function registerZzmiRules(context) {
	const cleanups = [];
	if (context.linter?.registerAllowedResource) {
		cleanups.push(context.linter.registerAllowedResource(/^commandlist\\zzmi\\/i));
		cleanups.push(context.linter.registerAllowedResource(/^resource\\zzmi\\/i));
		cleanups.push(context.linter.registerAllowedResource("CommandList\\ZZMI\\SetTextures"));
		cleanups.push(context.linter.registerAllowedResource("CommandListSkinTexture"));
		cleanups.push(context.linter.registerAllowedResource(/^commandlist\\ttl\\/i));
		cleanups.push(context.linter.registerAllowedResource(/^resource\\ttl\\/i));
		cleanups.push(context.linter.registerAllowedResource("CommandList\\TTL\\Draw"));
		cleanups.push(context.linter.registerAllowedResource("Resource\\TTL\\TransparencyTex"));
	}
	if (context.linter?.registerAllowedVariable) {
		cleanups.push(context.linter.registerAllowedVariable((name) => {
			return name.toLowerCase().replace(/^[\\$]+/, "").startsWith("ttl\\");
		}));
		cleanups.push(context.linter.registerAllowedVariable(/^\\?ttl\\/i));
	}
	if (context.linter?.registerAllowedUsedVariable) cleanups.push(context.linter.registerAllowedUsedVariable((name) => {
		return name.toLowerCase().replace(/^[\\$]+/, "").startsWith("ttl\\");
	}));
	if (context.linter?.registerAllowedUsedResource) {
		cleanups.push(context.linter.registerAllowedUsedResource(/^resource\\ttl\\/i));
		cleanups.push(context.linter.registerAllowedUsedResource(/^commandlist\\ttl\\/i));
	}
	if (context.linter?.registerDiagnosticFilter) cleanups.push(context.linter.registerDiagnosticFilter((diag, ctx) => {
		const msg = diag.message || "";
		if (msg.includes("'TTL'") || msg.includes("'ttl'")) return false;
		if (/\bttl[\\_]/i.test(msg) || /\$?\\?ttl\\/i.test(msg)) return false;
		if (ctx?.model && diag.startLineNumber) {
			const lineContent = ctx.model.getLineContent(diag.startLineNumber) || "";
			if (/\\?TTL\\/i.test(lineContent) && /ttl/i.test(msg)) return false;
		}
		return true;
	}));
	return cleanups;
}
//#endregion
//#region default-plugins/zzmi-support/templates.ts
var ZZMI_TEMPLATES = [
	{
		id: "zzmi_slot_fix",
		group: "ZZMI (젠레스 존 제로)",
		label: "ZZMI 텍스처 슬롯픽스 (SlotFix)",
		description: "ZZMI 텍스처 슬롯 매핑 및 WEngineFX 이펙트 슬롯 구문",
		body: [
			"; ZZMI SlotFix (Texture Slot Mapping)",
			"Resource\\ZZMI\\Diffuse = ref Resource${1:Diffuse}",
			"Resource\\ZZMI\\NormalMap = ref Resource${2:NormalMap}",
			"Resource\\ZZMI\\LightMap = ref Resource${3:LightMap}",
			"Resource\\ZZMI\\MaterialMap = ref Resource${4:MaterialMap}",
			"Resource\\ZZMI\\WEngineFX = ref Resource${5:WEngineFX}",
			"run = CommandList\\ZZMI\\SetTextures"
		].join("\n") + "\n"
	},
	{
		id: "zzmi_ttl_draw",
		group: "ZZMI (젠레스 존 제로)",
		label: "ZZMI TTL 투명도 드로우 (단일 투명도)",
		description: "Transparency Texture Lib (TTL) 단일 알파 투명도 렌더링 구문 (No Texture)",
		body: [
			"; ZZMI TTL (Transparency Texture Lib - Uniform Alpha)",
			"$\\TTL\\alpha = ${1:0.5}",
			"$\\TTL\\_1 = ${2:IndexCount}",
			"$\\TTL\\_2 = ${3:FirstIndex}",
			"run = CommandList\\TTL\\Draw"
		].join("\n") + "\n"
	},
	{
		id: "zzmi_ttl_texture",
		group: "ZZMI (젠레스 존 제로)",
		label: "ZZMI TTL 텍스처 마스크 투명도 (Texture Mask)",
		description: "Transparency Texture Lib (TTL) 텍스처 마스크 및 채널 기반 투명도 렌더링 구문",
		body: [
			"; ZZMI TTL (Transparency Texture Lib - Texture Mask)",
			"Resource\\TTL\\TransparencyTex = ref Resource${1:Transparency}",
			"$\\TTL\\_1 = ${2:IndexCount}",
			"$\\TTL\\_2 = ${3:FirstIndex}",
			"$\\TTL\\mask_channel = ${4:3}",
			"$\\TTL\\mask_invert = ${5:0}",
			"run = CommandList\\TTL\\Draw"
		].join("\n") + "\n"
	}
];
//#endregion
//#region default-plugins/zzmi-support/ui.ts
function cleanSnippet(snippet) {
	return snippet.replace(/\$\{\d+:([^}]+)\}/g, "$1");
}
function buildZzmiSupportView(context, container) {
	container.className = "sidebar-panel dynamic-plugin-panel plugin-subview zzmi-support-panel";
	container.replaceChildren();
	const header = context.ui.createPanelHeader("ZZMI 모딩 도구");
	const zzmiBadge = context.ui.createBadge({
		text: "ZZMI / TTL",
		variant: "accent"
	});
	const lintBadge = context.ui.createBadge({
		text: "린터 연동됨",
		variant: "success"
	});
	header.append(zzmiBadge, lintBadge);
	const descDiv = document.createElement("div");
	descDiv.style.cssText = "font-size: 11px; color: var(--fg-dim); line-height: 1.5; margin-bottom: 4px;";
	descDiv.textContent = "Zenless Zone Zero Mod Injector(ZZMI)의 W-Engine 텍스처 슬롯픽스 및 TTL 투명도 라이브러리 구문을 원클릭으로 확인하고 에디터에 삽입할 수 있습니다.";
	const infoCard = context.ui.createCard({
		title: "ZZMI & TTL 템플릿",
		content: [descDiv]
	});
	const listContainer = document.createElement("div");
	listContainer.className = "zzmi-template-list";
	listContainer.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;";
	let selectedIndex = 0;
	const listItems = [];
	const previewLabel = document.createElement("div");
	previewLabel.style.cssText = "font-size: 11px; font-weight: 600; color: var(--fg-dim); margin-bottom: 4px;";
	previewLabel.textContent = `코드 미리보기: ${ZZMI_TEMPLATES[0].label}`;
	let currentCodeBlock = context.ui.createCodeBlock({
		code: cleanSnippet(ZZMI_TEMPLATES[0].body),
		maxHeight: "160px"
	});
	const previewWrapper = document.createElement("div");
	previewWrapper.className = "zzmi-preview-wrapper";
	previewWrapper.style.cssText = "margin-bottom: 8px;";
	previewWrapper.append(previewLabel, currentCodeBlock.container);
	const insertBtn = context.ui.createButton({
		text: "현재 에디터 커서에 삽입",
		variant: "primary",
		onClick() {
			const tpl = ZZMI_TEMPLATES[selectedIndex];
			if (tpl) {
				const cleaned = cleanSnippet(tpl.body);
				context.editor.insertText(cleaned);
				context.ui.showToast(`[${tpl.label}] 구문이 삽입되었습니다.`, "info");
			}
		}
	});
	const copyBtn = context.ui.createButton({
		text: "코드 복사",
		variant: "secondary",
		onClick() {
			const tpl = ZZMI_TEMPLATES[selectedIndex];
			if (tpl) {
				const cleaned = cleanSnippet(tpl.body);
				navigator.clipboard.writeText(cleaned);
				context.ui.showToast("클립보드에 복사되었습니다.", "info");
			}
		}
	});
	const actionRow = context.ui.createButtonRow([insertBtn, copyBtn]);
	function updateSelection(idx) {
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
		const isTtl = Boolean(tpl.id?.includes("ttl"));
		const badge = context.ui.createBadge({
			text: isTtl ? "TTL Lib" : "SlotFix",
			variant: isTtl ? "accent" : "muted"
		});
		const item = context.ui.createListItem({
			title: tpl.label,
			subtitle: tpl.description,
			badge,
			selected: idx === 0,
			onClick() {
				updateSelection(idx);
			}
		});
		listContainer.append(item.element);
		listItems.push(item);
	});
	updateSelection(0);
	container.append(header, infoCard, listContainer, previewWrapper, actionRow);
}
//#endregion
//#region default-plugins/zzmi-support/icon.ts
var iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>`;
//#endregion
//#region default-plugins/zzmi-support/index.ts
var cleanups = [];
var plugin = {
	activate(context) {
		cleanups = registerZzmiRules(context);
		if (context.templates?.registerTemplate) for (const tpl of ZZMI_TEMPLATES) context.templates.registerTemplate(tpl);
		if (context.ui?.registerSidebarView) context.ui.registerSidebarView({
			id: "zzmi-support",
			title: "ZZMI 지원",
			icon: iconSvg,
			render(container) {
				buildZzmiSupportView(context, container);
			}
		});
	},
	deactivate() {
		for (const cleanup of cleanups) try {
			cleanup();
		} catch {}
		cleanups = [];
	}
};
//#endregion
export { ZZMI_TEMPLATES, plugin as default, registerZzmiRules };

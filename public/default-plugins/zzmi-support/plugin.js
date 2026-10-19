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
//#region default-plugins/zzmi-support/index.ts
var cleanups = [];
var plugin = {
	activate(context) {
		cleanups = registerZzmiRules(context);
		context.logger?.info(`ZZMI 모딩 지원 활성화 (슬롯픽스 템플릿 ${ZZMI_TEMPLATES.length}개 등록)`);
		if (context.templates?.registerTemplate) for (const tpl of ZZMI_TEMPLATES) context.templates.registerTemplate(tpl);
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

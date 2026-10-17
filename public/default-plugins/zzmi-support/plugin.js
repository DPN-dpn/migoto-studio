//#region default-plugins/zzmi-support/rules.ts
function registerZzmiRules(context) {
	const cleanups = [];
	if (context.linter?.registerAllowedResource) {
		cleanups.push(context.linter.registerAllowedResource(/^commandlist\\zzmi\\/i));
		cleanups.push(context.linter.registerAllowedResource(/^resource\\zzmi\\/i));
		cleanups.push(context.linter.registerAllowedResource("CommandList\\ZZMI\\SetTextures"));
		cleanups.push(context.linter.registerAllowedResource("CommandListSkinTexture"));
	}
	return cleanups;
}
//#endregion
//#region default-plugins/zzmi-support/templates.ts
var ZZMI_TEMPLATES = [{
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
}];
//#endregion
//#region default-plugins/zzmi-support/index.ts
var cleanups = [];
var plugin = {
	activate(context) {
		cleanups = registerZzmiRules(context);
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

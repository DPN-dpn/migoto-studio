//#region src/plugins/api.ts
function e(e) {
	return e;
}
//#endregion
//#region default-plugins/zzmi-support/index.ts
var t = e({ activate(e) {
	e.linter.registerAllowedResource(/^commandlist\\zzmi\\/i), e.linter.registerAllowedResource(/^resource\\zzmi\\/i), e.linter.registerAllowedResource("CommandList\\ZZMI\\SetTextures"), e.linter.registerAllowedResource("CommandListSkinTexture"), e.templates.registerTemplate({
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
	});
} });
//#endregion
export { t as default };

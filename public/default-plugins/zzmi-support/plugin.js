//#region default-plugins/zzmi-support/index.ts
var plugin = {
	activate(context) {
		context.linter.registerAllowedResource(/^commandlist\\zzmi\\/i);
		context.linter.registerAllowedResource(/^resource\\zzmi\\/i);
		context.linter.registerAllowedResource("CommandList\\ZZMI\\SetTextures");
		context.linter.registerAllowedResource("CommandListSkinTexture");
		context.templates.registerTemplate({
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
		context.ui?.registerMenuItem?.({
			label: "ZZMI 슬롯픽스(SlotFix) 생성기…",
			shortcut: "Ctrl+Shift+Z",
			action: () => openSlotFixWizard(context)
		});
	},
	deactivate() {}
};
function openSlotFixWizard(context) {
	context.ui.openFormTab({
		id: "zzmi-slot-fix-wizard",
		title: "ZZMI 슬롯픽스 생성기",
		icon: "⚡",
		form: {
			title: "ZZMI 텍스처 슬롯픽스 (SlotFix) 마법사",
			description: "젠레스 존 제로 모드의 텍스처 슬롯 매핑 및 WEngineFX 이펙트 구문을 현재 열린 INI 파일에 생성합니다.",
			fields: [
				{
					id: "diffuse",
					type: "text",
					label: "Diffuse 텍스처 리소스",
					default: "ResourceDiffuse",
					placeholder: "Resource...",
					required: true
				},
				{
					id: "normal",
					type: "text",
					label: "NormalMap 텍스처 리소스",
					default: "ResourceNormalMap",
					placeholder: "Resource...",
					required: true
				},
				{
					id: "light",
					type: "text",
					label: "LightMap 텍스처 리소스",
					default: "ResourceLightMap",
					placeholder: "Resource..."
				},
				{
					id: "material",
					type: "text",
					label: "MaterialMap 텍스처 리소스",
					default: "ResourceMaterialMap",
					placeholder: "Resource..."
				},
				{
					id: "wengine",
					type: "text",
					label: "WEngineFX 이펙트 리소스",
					default: "ResourceWEngineFX",
					placeholder: "Resource..."
				},
				{
					id: "location",
					type: "select",
					label: "삽입 위치",
					options: [{
						value: "cursor",
						label: "현재 에디터 커서 위치에 삽입"
					}, {
						value: "end",
						label: "INI 문서 맨 끝에 추가"
					}],
					default: "cursor"
				}
			],
			submitLabel: "INI 문서에 삽입",
			onSubmit: (values) => {
				const lines = [
					"; ZZMI SlotFix (Texture Slot Mapping)",
					`Resource\\ZZMI\\Diffuse = ref ${values.diffuse}`,
					`Resource\\ZZMI\\NormalMap = ref ${values.normal}`
				];
				if (values.light) lines.push(`Resource\\ZZMI\\LightMap = ref ${values.light}`);
				if (values.material) lines.push(`Resource\\ZZMI\\MaterialMap = ref ${values.material}`);
				if (values.wengine) lines.push(`Resource\\ZZMI\\WEngineFX = ref ${values.wengine}`);
				lines.push("run = CommandList\\ZZMI\\SetTextures\n");
				const textToInsert = lines.join("\n");
				if (values.location === "cursor") context.editor.insertText(textToInsert);
				else {
					const current = context.editor.getText();
					context.editor.setText(current + (current.endsWith("\n") ? "" : "\n") + textToInsert);
				}
				context.ui.showToast("ZZMI 슬롯픽스 구문이 성공적으로 삽입되었습니다.", "info");
			}
		}
	});
}
//#endregion
export { plugin as default };

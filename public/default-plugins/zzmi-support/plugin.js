//#region src/plugins/api.ts
function e(e) {
	return e;
}
//#endregion
//#region default-plugins/zzmi-support/index.ts
var t = e({
	activate(e) {
		e.linter.registerAllowedResource(/^commandlist\\zzmi\\/i);
		e.linter.registerAllowedResource(/^resource\\zzmi\\/i);
		e.linter.registerAllowedResource("CommandList\\ZZMI\\SetTextures");
		e.linter.registerAllowedResource("CommandListSkinTexture");
		e.templates.registerTemplate({
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
		e.ui.registerMenuItem({
			label: "ZZMI 슬롯픽스(SlotFix) 생성기…",
			shortcut: "Ctrl+Shift+Z",
			action: () => {
				e.ui.openFormTab({
					id: "zzmi-slot-fix-wizard",
					title: "ZZMI 슬롯픽스 생성기",
					icon: "⚡",
					form: {
						title: "ZZMI 텍스처 슬롯픽스 (SlotFix) 마법사",
						description: "젠레스 존 제로 모드의 텍스처 슬롯 매핑 및 WEngineFX 이펙트 구문을 현재 열린 INI 파일에 생성합니다.",
						fields: [
							{ id: "diffuse", type: "text", label: "Diffuse 텍스처 리소스", default: "ResourceDiffuse", placeholder: "Resource...", required: true },
							{ id: "normal", type: "text", label: "NormalMap 텍스처 리소스", default: "ResourceNormalMap", placeholder: "Resource...", required: true },
							{ id: "light", type: "text", label: "LightMap 텍스처 리소스", default: "ResourceLightMap", placeholder: "Resource..." },
							{ id: "material", type: "text", label: "MaterialMap 텍스처 리소스", default: "ResourceMaterialMap", placeholder: "Resource..." },
							{ id: "wengine", type: "text", label: "WEngineFX 이펙트 리소스", default: "ResourceWEngineFX", placeholder: "Resource..." },
							{ id: "location", type: "select", label: "삽입 위치", options: [{ value: "cursor", label: "현재 에디터 커서 위치에 삽입" }, { value: "end", label: "INI 문서 맨 끝에 추가" }], default: "cursor" }
						],
						submitLabel: "INI 문서에 삽입",
						onSubmit: (t) => {
							let n = [
								"; ZZMI SlotFix (Texture Slot Mapping)",
								`Resource\\ZZMI\\Diffuse = ref ${t.diffuse}`,
								`Resource\\ZZMI\\NormalMap = ref ${t.normal}`
							];
							t.light && n.push(`Resource\\ZZMI\\LightMap = ref ${t.light}`);
							t.material && n.push(`Resource\\ZZMI\\MaterialMap = ref ${t.material}`);
							t.wengine && n.push(`Resource\\ZZMI\\WEngineFX = ref ${t.wengine}`);
							n.push("run = CommandList\\ZZMI\\SetTextures\n");
							let r = n.join("\n");
							if (t.location === "cursor") {
								e.editor.insertText(r);
							} else {
								let t = e.editor.getText();
								e.editor.setText(t + (t.endsWith("\n") ? "" : "\n") + r);
							}
							e.ui.showToast("ZZMI 슬롯픽스 구문이 성공적으로 삽입되었습니다.", "info");
						}
					}
				});
			}
		});
	},
	deactivate() {}
});
//#endregion
export { t as default };

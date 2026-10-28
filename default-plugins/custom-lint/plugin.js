//#region default-plugins/custom-lint/zzmi/rules.ts
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
	if (context.slots?.registerTextureSlotResolver) cleanups.push(context.slots.registerTextureSlotResolver(createZzmiSlotResolver()));
	return cleanups;
}
/**
* ZZMI 슬롯픽스(SlotFix) 및 TTL 구문을 해석하는 텍스처 슬롯 리졸버 생성
*/
function createZzmiSlotResolver() {
	return {
		id: "zzmi-slotfix",
		name: "ZZMI 슬롯픽스 리졸버 (SlotFix & TTL)",
		priority: 10,
		resolveSlots: (section, doc, allDocs) => {
			const slots = [];
			const props = section.properties;
			const resolveFilename = (resName) => {
				const clean = resName.replace(/^[\\$]+/, "").replace(/^ref\s+/i, "").trim();
				const candidates = [
					clean,
					`Resource${clean}`,
					`Resource\\${clean}`
				];
				for (const name of candidates) {
					const sec = doc.getSection(name);
					if (sec && sec.properties["filename"]) {
						const fn = sec.properties["filename"].replace(/['"]/g, "").trim();
						if (/\.(dds|png|tga|jpg|jpeg|webp|bmp)$/i.test(fn)) return fn;
					}
				}
				if (allDocs) for (const otherDoc of allDocs.values()) for (const name of candidates) {
					const sec = otherDoc.getSection(name);
					if (sec && sec.properties["filename"]) {
						const fn = sec.properties["filename"].replace(/['"]/g, "").trim();
						if (/\.(dds|png|tga|jpg|jpeg|webp|bmp)$/i.test(fn)) return fn;
					}
				}
			};
			const checkProperties = (pRecord, srcSec) => {
				for (const [key, rawVal] of Object.entries(pRecord)) {
					const cleanKey = key.trim();
					const cleanVal = rawVal.replace(/^ref\s+/i, "").trim();
					const zzmiMatch = cleanKey.match(/^Resource\\ZZMI\\(.+)$/i);
					if (zzmiMatch) {
						const slotName = zzmiMatch[1].trim();
						const lowerSlot = slotName.toLowerCase();
						let slotType = "custom";
						let displaySlotName = slotName;
						if (lowerSlot.includes("diffuse")) {
							slotType = "diffuse";
							displaySlotName = "Diffuse";
						} else if (lowerSlot.includes("normal")) {
							slotType = "normal";
							displaySlotName = "NormalMap";
						} else if (lowerSlot.includes("light")) {
							slotType = "light";
							displaySlotName = "LightMap";
						} else if (lowerSlot.includes("material")) {
							slotType = "material";
							displaySlotName = "MaterialMap";
						} else if (lowerSlot.includes("fx") || lowerSlot.includes("wengine")) {
							slotType = "fx";
							displaySlotName = "WEngineFX";
						}
						slots.push({
							slotId: `ZZMI\\${displaySlotName}`,
							slotType,
							resourceRef: cleanVal,
							textureFile: resolveFilename(cleanVal),
							sourceSection: srcSec,
							rawLine: `${key} = ${rawVal}`
						});
						continue;
					}
					const ttlMatch = cleanKey.match(/^Resource\\TTL\\(.+)$/i);
					if (ttlMatch) {
						const slotName = ttlMatch[1].trim();
						const lowerTtl = slotName.toLowerCase();
						let displayTtl = slotName;
						if (lowerTtl.includes("transparency")) displayTtl = "TransparencyTex";
						slots.push({
							slotId: `TTL\\${displayTtl}`,
							slotType: "custom",
							resourceRef: cleanVal,
							textureFile: resolveFilename(cleanVal),
							sourceSection: srcSec,
							rawLine: `${key} = ${rawVal}`
						});
						continue;
					}
				}
			};
			checkProperties(props, section.name);
			if (props["run"]) {
				const cmdName = props["run"].trim();
				const cmdSec = doc.getSection(cmdName) || (allDocs ? (() => {
					for (const otherDoc of allDocs.values()) {
						const s = otherDoc.getSection(cmdName);
						if (s) return s;
					}
				})() : void 0);
				if (cmdSec) checkProperties(cmdSec.properties, cmdSec.name);
			}
			return slots.length > 0 ? slots : null;
		}
	};
}
//#endregion
//#region default-plugins/custom-lint/zzmi/templates.ts
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
//#region default-plugins/custom-lint/zzmi/index.ts
/**
* ZZMI (젠레스 존 제로) 및 TTL (Transparency Texture Lib) 지원 기능을 등록합니다.
* (슬롯픽스 리졸버, 리소스/변수 허용, 진단 필터, 템플릿 등)
*/
function registerZzmiSupport(context) {
	const cleanups = [];
	cleanups.push(...registerZzmiRules(context));
	context.logger?.info(`ZZMI 모딩 지원 활성화 (슬롯픽스 템플릿 ${ZZMI_TEMPLATES.length}개 등록)`);
	if (context.templates?.registerTemplate) for (const tpl of ZZMI_TEMPLATES) context.templates.registerTemplate(tpl);
	return cleanups;
}
//#endregion
//#region default-plugins/custom-lint/srmi/rules.ts
/**
* SRMI (붕괴: 스타레일 - Star Rail Model Importer) 변수 정규식
* 예: $\SRMI\vertex_count, \SRMI\vertex_count, $SRMI\vertex_count 등
*/
var SRMI_VAR_REGEX = /^\\?srmi\\/i;
/**
* SRMI 리소스 및 커맨드리스트 정규식
* 예: Resource\SRMI\PositionBuffer, Resource\SRMI\BlendBuffer, CommandList\SRMI\...
*/
var SRMI_RESOURCE_REGEX = /^(?:resource|commandlist)\\srmi\\/i;
/**
* 주어진 변수명이 SRMI 전용 변수 구문인지 검사합니다.
* (대소문자 무관, 접두어 $, \ 무시)
*/
function isSrmiVariable(name) {
	if (!name) return false;
	return name.trim().toLowerCase().replace(/^[\\$]+/, "").startsWith("srmi\\");
}
/**
* 주어진 리소스/커맨드리스트 이름이 SRMI 전용 구문인지 검사합니다.
*/
function isSrmiResource(name) {
	if (!name) return false;
	const clean = name.trim().toLowerCase().replace(/^[\\\/]+/, "");
	return clean.startsWith("resource\\srmi\\") || clean.startsWith("commandlist\\srmi\\") || clean.startsWith("srmi\\");
}
/**
* SRMI (Star Rail Model Importer) 전용 린트 규칙 및 허용 리소스/변수를 등록합니다.
*/
function registerSrmiRules(context) {
	const cleanups = [];
	if (context.linter?.registerAllowedResource) {
		cleanups.push(context.linter.registerAllowedResource(SRMI_RESOURCE_REGEX));
		cleanups.push(context.linter.registerAllowedResource((name) => isSrmiResource(name)));
		cleanups.push(context.linter.registerAllowedResource("Resource\\SRMI\\PositionBuffer"));
		cleanups.push(context.linter.registerAllowedResource("Resource\\SRMI\\BlendBuffer"));
	}
	if (context.linter?.registerAllowedVariable) {
		cleanups.push(context.linter.registerAllowedVariable(SRMI_VAR_REGEX));
		cleanups.push(context.linter.registerAllowedVariable((name) => isSrmiVariable(name)));
	}
	if (context.linter?.registerAllowedUsedVariable) cleanups.push(context.linter.registerAllowedUsedVariable((name) => isSrmiVariable(name)));
	if (context.linter?.registerAllowedUsedResource) {
		cleanups.push(context.linter.registerAllowedUsedResource(SRMI_RESOURCE_REGEX));
		cleanups.push(context.linter.registerAllowedUsedResource((name) => isSrmiResource(name)));
	}
	if (context.linter?.registerDiagnosticFilter) cleanups.push(context.linter.registerDiagnosticFilter((diag, ctx) => {
		const msg = diag.message || "";
		if (msg.includes("'SRMI'") || msg.includes("'srmi'")) return false;
		if (/\bsrmi[\\_]/i.test(msg) || /\$?\\?srmi\\/i.test(msg)) return false;
		if (ctx?.model && diag.startLineNumber) {
			const lineContent = ctx.model.getLineContent(diag.startLineNumber) || "";
			if (/\\?srmi\\/i.test(lineContent) && /srmi/i.test(msg)) return false;
		}
		return true;
	}));
	return cleanups;
}
//#endregion
//#region default-plugins/custom-lint/srmi/index.ts
/**
* SRMI (붕괴: 스타레일 - Star Rail Model Importer) 모딩 지원 기능을 등록합니다.
* ($\\SRMI\\vertex_count 등 전용 변수 및 Resource\\SRMI\\... 전용 리소스 허용 규칙)
*/
function registerSrmiSupport(context) {
	const cleanups = [];
	cleanups.push(...registerSrmiRules(context));
	context.logger?.info("SRMI (붕괴: 스타레일) 모딩 지원 활성화 (vertex_count 등 전용 문법 등록)");
	return cleanups;
}
//#endregion
//#region default-plugins/custom-lint/index.ts
var unregisterZzmiList = [];
var unregisterSrmiList = [];
var plugin = {
	activate(context) {
		context.logger?.info("커스텀 린터 (ZZMI & SRMI 모딩 지원) 활성화됨");
		unregisterZzmiList = registerZzmiSupport(context);
		unregisterSrmiList = registerSrmiSupport(context);
	},
	deactivate() {
		if (unregisterZzmiList.length > 0) {
			for (const cleanup of unregisterZzmiList) try {
				cleanup();
			} catch {}
			unregisterZzmiList = [];
		}
		if (unregisterSrmiList.length > 0) {
			for (const cleanup of unregisterSrmiList) try {
				cleanup();
			} catch {}
			unregisterSrmiList = [];
		}
	}
};
//#endregion
export { ZZMI_TEMPLATES, createZzmiSlotResolver, plugin as default, isSrmiResource, isSrmiVariable, registerSrmiRules, registerZzmiRules };

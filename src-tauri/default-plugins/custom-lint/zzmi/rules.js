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
export { createZzmiSlotResolver, registerZzmiRules };

import { createZzmiSlotResolver, registerZzmiRules } from "./rules.js";
import { ZZMI_TEMPLATES } from "./templates.js";
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
export { ZZMI_TEMPLATES, createZzmiSlotResolver, registerZzmiRules, registerZzmiSupport };

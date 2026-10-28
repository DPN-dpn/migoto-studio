import { isSrmiResource, isSrmiVariable, registerSrmiRules } from "./rules.js";
import { SRMI_TEMPLATES } from "./templates.js";
//#region default-plugins/custom-lint/srmi/index.ts
/**
* SRMI (붕괴: 스타레일 - Star Rail Model Importer) 모딩 지원 기능을 등록합니다.
* ($\\SRMI\\vertex_count 등 전용 변수, Resource\\SRMI\\... 전용 리소스 및 템플릿)
*/
function registerSrmiSupport(context) {
	const cleanups = [];
	cleanups.push(...registerSrmiRules(context));
	context.logger?.info(`SRMI (붕괴: 스타레일) 모딩 지원 활성화 (템플릿 ${SRMI_TEMPLATES.length}개 등록)`);
	if (context.templates?.registerTemplate) for (const tpl of SRMI_TEMPLATES) context.templates.registerTemplate(tpl);
	return cleanups;
}
//#endregion
export { SRMI_TEMPLATES, isSrmiResource, isSrmiVariable, registerSrmiRules, registerSrmiSupport };

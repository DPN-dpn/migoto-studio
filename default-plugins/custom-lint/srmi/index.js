import { isSrmiResource, isSrmiVariable, registerSrmiRules } from "./rules.js";
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
export { isSrmiResource, isSrmiVariable, registerSrmiRules, registerSrmiSupport };

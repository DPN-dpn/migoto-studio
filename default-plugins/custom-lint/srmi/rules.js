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
export { SRMI_RESOURCE_REGEX, SRMI_VAR_REGEX, isSrmiResource, isSrmiVariable, registerSrmiRules };

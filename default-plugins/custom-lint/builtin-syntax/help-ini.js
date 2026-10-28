//#region default-plugins/custom-lint/builtin-syntax/help-ini.ts
/**
* help-ini.ts
* XXMI 레거시 빌트인 구문(ShaderFixes\help.ini 네임스페이스)을 전담 지원합니다.
*
* 예시:
* - pre run = CustomShader\ShaderFixes\help.ini\FormatText
* - pre Resource\ShaderFixes\help.ini\Notification = ResourceCreditInfo
* - pre $\ShaderFixes\help.ini\notification_timeout = time + 5.0
*/
var HELP_INI_RESOURCE_REGEX = /^(?:customshader|resource|commandlist)\\shaderfixes\\help\.ini\\/i;
var HELP_INI_VARIABLE_REGEX = /^\\?shaderfixes\\help\.ini\\/i;
function isHelpIniResource(name) {
	if (!name) return false;
	const clean = name.toLowerCase().replace(/^[\\\/]+/, "");
	return HELP_INI_RESOURCE_REGEX.test(clean) || clean.startsWith("shaderfixes\\help.ini\\");
}
function isHelpIniVariable(name) {
	if (!name) return false;
	const clean = name.toLowerCase().replace(/^[\\\$]+/, "");
	return HELP_INI_VARIABLE_REGEX.test(clean);
}
/**
* ShaderFixes\help.ini 빌트인 리소스, 커맨드, 셰이더 및 변수를 에디터 린터에 허용 등록합니다.
*/
function registerHelpIniSyntax(context) {
	const unregisterCallbacks = [];
	if (context.linter?.registerAllowedResource) {
		unregisterCallbacks.push(context.linter.registerAllowedResource(HELP_INI_RESOURCE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedResource((name) => isHelpIniResource(name)));
	}
	if (context.linter?.registerAllowedVariable) {
		unregisterCallbacks.push(context.linter.registerAllowedVariable(HELP_INI_VARIABLE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedVariable((name) => isHelpIniVariable(name)));
	}
	if (context.linter?.registerAllowedUsedResource) {
		unregisterCallbacks.push(context.linter.registerAllowedUsedResource(HELP_INI_RESOURCE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedUsedResource((name) => isHelpIniResource(name)));
	}
	if (context.linter?.registerAllowedUsedVariable) {
		unregisterCallbacks.push(context.linter.registerAllowedUsedVariable(HELP_INI_VARIABLE_REGEX));
		unregisterCallbacks.push(context.linter.registerAllowedUsedVariable((name) => isHelpIniVariable(name)));
	}
	return unregisterCallbacks;
}
//#endregion
export { HELP_INI_RESOURCE_REGEX, HELP_INI_VARIABLE_REGEX, isHelpIniResource, isHelpIniVariable, registerHelpIniSyntax };

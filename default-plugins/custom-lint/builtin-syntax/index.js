import { isBuiltinResource } from "./matcher.js";
import { isHelpIniResource, isHelpIniVariable, registerHelpIniSyntax } from "./help-ini.js";
//#region default-plugins/custom-lint/builtin-syntax/index.ts
/**
* XXMI 표준 내장 커맨드리스트, 함수 및 레거시 빌트인 구문(ShaderFixes\help.ini 등)을 에디터 린터에 허용 등록합니다.
*/
function registerBuiltinSyntax(context) {
	const unregisterCallbacks = [];
	const patterns = [
		(name) => isBuiltinResource(name),
		/^builtincommandlist/i,
		"CommandListSkinTexture",
		/^(?:builtin\\)?commandlistskintexture$/i,
		/^commandlist\\(?:builtin\\)?skintexture$/i,
		/^builtin\\skintexture$/i,
		/^(?:commandlist\\)?builtin\\/i,
		/^builtin\\/i
	];
	if (context.linter?.registerAllowedResource) for (const pat of patterns) unregisterCallbacks.push(context.linter.registerAllowedResource(pat));
	if (context.linter?.registerAllowedUsedResource) for (const pat of patterns) unregisterCallbacks.push(context.linter.registerAllowedUsedResource(pat));
	unregisterCallbacks.push(...registerHelpIniSyntax(context));
	return unregisterCallbacks;
}
//#endregion
export { isBuiltinResource, isHelpIniResource, isHelpIniVariable, registerBuiltinSyntax };

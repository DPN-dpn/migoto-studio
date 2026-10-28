import { isBuiltinResource } from "./matcher.js";
//#region default-plugins/custom-lint/builtin-syntax/index.ts
/**
* XXMI 표준 내장 커맨드리스트 및 함수 문법을 에디터 린터에 허용 등록합니다.
* (BuiltinCommandList~, CommandListSkinTexture 등)
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
	return unregisterCallbacks;
}
//#endregion
export { isBuiltinResource, registerBuiltinSyntax };

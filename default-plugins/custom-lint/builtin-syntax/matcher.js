//#region default-plugins/custom-lint/builtin-syntax/matcher.ts
/**
* matcher.ts
* GIMI / ZZMI / XXMI 내장 리소스 및 내장 커맨드리스트 여부를 판별합니다.
*/
function isBuiltinResource(name) {
	if (!name) return false;
	const norm = name.toLowerCase().replace(/^[\\\/]+/, "");
	return norm.startsWith("builtincommandlist") || norm.startsWith("builtin_commandlist") || norm.startsWith("builtin\\") || norm.startsWith("commandlist\\builtin") || norm.startsWith("commandlist\\skintexture") || norm === "commandlistskintexture" || norm === "builtin";
}
//#endregion
export { isBuiltinResource };

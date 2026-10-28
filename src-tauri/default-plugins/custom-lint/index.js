import { isBuiltinResource } from "./builtin-syntax/matcher.js";
import { registerBuiltinSyntax } from "./builtin-syntax/index.js";
import { registerFileCheckRule } from "./file-check/index.js";
import { parseIniExports } from "./namespace-check/parser.js";
import { buildWorkspaceIndex, collectIniFiles, readIniText } from "./namespace-check/indexer.js";
import { cleanupNamespaceState, createNamespaceRegistrationState, registerNamespaceCheck } from "./namespace-check/index.js";
//#region default-plugins/custom-lint/index.ts
var isPluginActive = false;
var unregisterBuiltinList = [];
var unregisterFileCheck = void 0;
var namespaceState = createNamespaceRegistrationState();
var plugin = {
	activate(context) {
		isPluginActive = true;
		context.logger?.info("커스텀 린터 (내장문법 / 파일실재성 / 네임스페이스) 활성화됨");
		unregisterBuiltinList = registerBuiltinSyntax(context);
		unregisterFileCheck = registerFileCheckRule(context);
		registerNamespaceCheck(context, () => isPluginActive, namespaceState);
	},
	deactivate() {
		isPluginActive = false;
		if (unregisterBuiltinList.length > 0) {
			for (const cleanup of unregisterBuiltinList) try {
				cleanup();
			} catch {}
			unregisterBuiltinList = [];
		}
		if (typeof unregisterFileCheck === "function") {
			try {
				unregisterFileCheck();
			} catch {}
			unregisterFileCheck = void 0;
		}
		cleanupNamespaceState(namespaceState);
	}
};
//#endregion
export { buildWorkspaceIndex, collectIniFiles, plugin as default, isBuiltinResource, parseIniExports, readIniText };

import { isBuiltinResource } from "./builtin-syntax/matcher.js";
import { isHelpIniResource, isHelpIniVariable } from "./builtin-syntax/help-ini.js";
import { registerBuiltinSyntax } from "./builtin-syntax/index.js";
import { registerFileCheckRule } from "./file-check/index.js";
import { parseIniExports } from "./namespace-check/parser.js";
import { buildWorkspaceIndex, collectIniFiles, readIniText } from "./namespace-check/indexer.js";
import { isSrmiResource, isSrmiVariable, registerSrmiRules } from "./srmi/rules.js";
import { cleanupNamespaceState, createNamespaceRegistrationState, registerNamespaceCheck } from "./namespace-check/index.js";
import { createZzmiSlotResolver, registerZzmiRules } from "./zzmi/rules.js";
import { ZZMI_TEMPLATES } from "./zzmi/templates.js";
import { registerZzmiSupport } from "./zzmi/index.js";
import { SRMI_TEMPLATES } from "./srmi/templates.js";
import { registerSrmiSupport } from "./srmi/index.js";
//#region default-plugins/custom-lint/index.ts
var isPluginActive = false;
var unregisterBuiltinList = [];
var unregisterFileCheck = void 0;
var unregisterZzmiList = [];
var unregisterSrmiList = [];
var namespaceState = createNamespaceRegistrationState();
var plugin = {
	activate(context) {
		isPluginActive = true;
		context.logger?.info("커스텀 린터 (내장문법 / 파일실재성 / 네임스페이스 / ZZMI / SRMI지원) 활성화됨");
		unregisterBuiltinList = registerBuiltinSyntax(context);
		unregisterFileCheck = registerFileCheckRule(context);
		registerNamespaceCheck(context, () => isPluginActive, namespaceState);
		unregisterZzmiList = registerZzmiSupport(context);
		unregisterSrmiList = registerSrmiSupport(context);
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
		if (unregisterZzmiList.length > 0) {
			for (const cleanup of unregisterZzmiList) try {
				cleanup();
			} catch {}
			unregisterZzmiList = [];
		}
		if (unregisterSrmiList.length > 0) {
			for (const cleanup of unregisterSrmiList) try {
				cleanup();
			} catch {}
			unregisterSrmiList = [];
		}
	}
};
//#endregion
export { SRMI_TEMPLATES, ZZMI_TEMPLATES, buildWorkspaceIndex, collectIniFiles, createZzmiSlotResolver, plugin as default, isBuiltinResource, isHelpIniResource, isHelpIniVariable, isSrmiResource, isSrmiVariable, parseIniExports, readIniText, registerSrmiRules, registerZzmiRules };

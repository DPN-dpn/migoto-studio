import { createZzmiSlotResolver, registerZzmiRules } from "./zzmi/rules.js";
import { ZZMI_TEMPLATES } from "./zzmi/templates.js";
import { registerZzmiSupport } from "./zzmi/index.js";
import { isSrmiResource, isSrmiVariable, registerSrmiRules } from "./srmi/rules.js";
import { registerSrmiSupport } from "./srmi/index.js";
//#region default-plugins/custom-lint/index.ts
var unregisterZzmiList = [];
var unregisterSrmiList = [];
var plugin = {
	activate(context) {
		context.logger?.info("커스텀 린터 (ZZMI & SRMI 모딩 지원) 활성화됨");
		unregisterZzmiList = registerZzmiSupport(context);
		unregisterSrmiList = registerSrmiSupport(context);
	},
	deactivate() {
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
export { ZZMI_TEMPLATES, createZzmiSlotResolver, plugin as default, isSrmiResource, isSrmiVariable, registerSrmiRules, registerZzmiRules };

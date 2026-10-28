import { registerZzmiRules } from "./rules.js";
import { ZZMI_TEMPLATES } from "./templates.js";
//#region default-plugins/zzmi-support/index.ts
var cleanups = [];
var plugin = {
	activate(context) {
		cleanups = registerZzmiRules(context);
		context.logger?.info(`ZZMI 모딩 지원 활성화 (슬롯픽스 템플릿 ${ZZMI_TEMPLATES.length}개 등록)`);
		if (context.templates?.registerTemplate) for (const tpl of ZZMI_TEMPLATES) context.templates.registerTemplate(tpl);
	},
	deactivate() {
		for (const cleanup of cleanups) try {
			cleanup();
		} catch {}
		cleanups = [];
	}
};
//#endregion
export { ZZMI_TEMPLATES, plugin as default, registerZzmiRules };

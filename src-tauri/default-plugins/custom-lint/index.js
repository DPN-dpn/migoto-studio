import { isBuiltinResource, parseIniExports } from "./parser.js";
import { buildWorkspaceIndex, collectIniFiles, readIniText } from "./indexer.js";
import { createDefinitionProvider, createReferenceProvider } from "./providers.js";
import { registerLintRules } from "./rules.js";
//#region default-plugins/custom-lint/index.ts
var isPluginActive = false;
var unregisterBuiltinResources = [];
var dynamicState = {
	unregisterAllowedVars: null,
	unregisterAllowedGroupResources: null,
	unregisterAllowedUsedVars: null,
	unregisterAllowedUsedResources: null
};
var unregisterDefProvider = null;
var unregisterRefProvider = null;
var plugin = {
	activate(context) {
		isPluginActive = true;
		context.logger?.info("커스텀 린터 및 크로스 파일 심볼 추적기 활성화됨");
		if (context.linter?.registerAllowedResource) {
			const u1 = context.linter.registerAllowedResource((name) => isBuiltinResource(name));
			const u2 = context.linter.registerAllowedResource(/^builtincommandlist/i);
			const u3 = context.linter.registerAllowedResource("CommandListSkinTexture");
			const u4 = context.linter.registerAllowedResource(/^(?:builtin\\)?commandlistskintexture$/i);
			const u5 = context.linter.registerAllowedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
			const u6 = context.linter.registerAllowedResource(/^builtin\\skintexture$/i);
			const u7 = context.linter.registerAllowedResource(/^(?:commandlist\\)?builtin\\/i);
			const u8 = context.linter.registerAllowedResource(/^builtin\\/i);
			unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
		}
		if (context.linter?.registerAllowedUsedResource) {
			const u1 = context.linter.registerAllowedUsedResource((name) => isBuiltinResource(name));
			const u2 = context.linter.registerAllowedUsedResource(/^builtincommandlist/i);
			const u3 = context.linter.registerAllowedUsedResource("CommandListSkinTexture");
			const u4 = context.linter.registerAllowedUsedResource(/^(?:builtin\\)?commandlistskintexture$/i);
			const u5 = context.linter.registerAllowedUsedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
			const u6 = context.linter.registerAllowedUsedResource(/^builtin\\skintexture$/i);
			const u7 = context.linter.registerAllowedUsedResource(/^(?:commandlist\\)?builtin\\/i);
			const u8 = context.linter.registerAllowedUsedResource(/^builtin\\/i);
			unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
		}
		registerLintRules(context, () => isPluginActive, dynamicState);
		const definitionProvider = createDefinitionProvider(context, () => isPluginActive);
		if (context.editor?.registerDefinitionProvider) unregisterDefProvider = context.editor.registerDefinitionProvider(definitionProvider);
		else if (context.linter?.registerDefinitionProvider) unregisterDefProvider = context.linter.registerDefinitionProvider(definitionProvider);
		const referenceProvider = createReferenceProvider(context, () => isPluginActive);
		if (context.editor?.registerReferenceProvider) unregisterRefProvider = context.editor.registerReferenceProvider(referenceProvider);
		else if (context.linter?.registerReferenceProvider) unregisterRefProvider = context.linter.registerReferenceProvider(referenceProvider);
	},
	deactivate() {
		isPluginActive = false;
		if (unregisterBuiltinResources.length > 0) {
			for (const cleanup of unregisterBuiltinResources) try {
				cleanup();
			} catch {}
			unregisterBuiltinResources = [];
		}
		if (dynamicState.unregisterAllowedVars) {
			dynamicState.unregisterAllowedVars();
			dynamicState.unregisterAllowedVars = null;
		}
		if (dynamicState.unregisterAllowedGroupResources) {
			dynamicState.unregisterAllowedGroupResources();
			dynamicState.unregisterAllowedGroupResources = null;
		}
		if (dynamicState.unregisterAllowedUsedVars) {
			dynamicState.unregisterAllowedUsedVars();
			dynamicState.unregisterAllowedUsedVars = null;
		}
		if (dynamicState.unregisterAllowedUsedResources) {
			dynamicState.unregisterAllowedUsedResources();
			dynamicState.unregisterAllowedUsedResources = null;
		}
		if (unregisterDefProvider) {
			unregisterDefProvider();
			unregisterDefProvider = null;
		}
		if (unregisterRefProvider) {
			unregisterRefProvider();
			unregisterRefProvider = null;
		}
	}
};
//#endregion
export { buildWorkspaceIndex, collectIniFiles, plugin as default, isBuiltinResource, parseIniExports, readIniText };

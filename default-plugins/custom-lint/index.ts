import type { MigotoPlugin, PluginContext } from '../../src/plugins/types.ts';
import { isBuiltinResource } from './parser.ts';
import { createDefinitionProvider, createReferenceProvider } from './providers.ts';
import { registerLintRules, type DynamicRegistrationState } from './rules.ts';

export { isBuiltinResource } from './parser.ts';
export type { SymbolLocationRecord, NamespaceExport, NamespaceGroup } from './types.ts';
export { parseIniExports } from './parser.ts';
export { collectIniFiles, readIniText, buildWorkspaceIndex } from './indexer.ts';

let isPluginActive = false;
let unregisterBuiltinResources: (() => void)[] = [];
const dynamicState: DynamicRegistrationState = {
  unregisterAllowedVars: null,
  unregisterAllowedGroupResources: null,
  unregisterAllowedUsedVars: null,
  unregisterAllowedUsedResources: null,
};
let unregisterDefProvider: (() => void) | null = null;
let unregisterRefProvider: (() => void) | null = null;

const plugin: MigotoPlugin = {
  activate(context: PluginContext) {
    isPluginActive = true;
    context.logger?.info('커스텀 린터 및 크로스 파일 심볼 추적기 활성화됨');

    // 0. XXMI 표준 내장 커맨드리스트 허용 등록 (GIMI / ZZMI / XXMI 내장 함수: BuiltinCommandList~, CommandListSkinTexture 등)
    if (context.linter?.registerAllowedResource) {
      const u1 = context.linter.registerAllowedResource((name: string) => isBuiltinResource(name));
      const u2 = context.linter.registerAllowedResource(/^builtincommandlist/i);
      const u3 = context.linter.registerAllowedResource('CommandListSkinTexture');
      const u4 = context.linter.registerAllowedResource(/^(?:builtin\\)?commandlistskintexture$/i);
      const u5 = context.linter.registerAllowedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
      const u6 = context.linter.registerAllowedResource(/^builtin\\skintexture$/i);
      const u7 = context.linter.registerAllowedResource(/^(?:commandlist\\)?builtin\\/i);
      const u8 = context.linter.registerAllowedResource(/^builtin\\/i);
      unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
    }
    if (context.linter?.registerAllowedUsedResource) {
      const u1 = context.linter.registerAllowedUsedResource((name: string) => isBuiltinResource(name));
      const u2 = context.linter.registerAllowedUsedResource(/^builtincommandlist/i);
      const u3 = context.linter.registerAllowedUsedResource('CommandListSkinTexture');
      const u4 = context.linter.registerAllowedUsedResource(/^(?:builtin\\)?commandlistskintexture$/i);
      const u5 = context.linter.registerAllowedUsedResource(/^commandlist\\(?:builtin\\)?skintexture$/i);
      const u6 = context.linter.registerAllowedUsedResource(/^builtin\\skintexture$/i);
      const u7 = context.linter.registerAllowedUsedResource(/^(?:commandlist\\)?builtin\\/i);
      const u8 = context.linter.registerAllowedUsedResource(/^builtin\\/i);
      unregisterBuiltinResources.push(u1, u2, u3, u4, u5, u6, u7, u8);
    }

    // 1 & 2. 린트 규칙 등록 (모드 리소스 파일 실재성 검사 & XXMI 네임스페이스 및 변수 검사)
    registerLintRules(context, () => isPluginActive, dynamicState);

    // 3. 에디터 / 린터: 동일 네임스페이스 및 크로스 파일 심볼 정의(선언) 추적
    const definitionProvider = createDefinitionProvider(context, () => isPluginActive);
    if (context.editor?.registerDefinitionProvider) {
      unregisterDefProvider = context.editor.registerDefinitionProvider(definitionProvider);
    } else if (context.linter?.registerDefinitionProvider) {
      unregisterDefProvider = context.linter.registerDefinitionProvider(definitionProvider);
    }

    // 4. 에디터 / 린터: 동일 네임스페이스 및 크로스 파일 심볼 참조(사용) 추적
    const referenceProvider = createReferenceProvider(context, () => isPluginActive);
    if (context.editor?.registerReferenceProvider) {
      unregisterRefProvider = context.editor.registerReferenceProvider(referenceProvider);
    } else if (context.linter?.registerReferenceProvider) {
      unregisterRefProvider = context.linter.registerReferenceProvider(referenceProvider);
    }
  },

  deactivate() {
    isPluginActive = false;
    if (unregisterBuiltinResources.length > 0) {
      for (const cleanup of unregisterBuiltinResources) {
        try { cleanup(); } catch {}
      }
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
  },
};

export default plugin;

import type { PluginContext } from '../../src/plugins/types.ts';

export function registerZzmiRules(context: PluginContext): (() => void)[] {
  const cleanups: (() => void)[] = [];

  // ZZMI 전용 린트 규칙: run = CommandList\ZZMI\SetTextures 및 관련 네임스페이스를 정상 구문으로 인식
  if (context.linter?.registerAllowedResource) {
    cleanups.push(context.linter.registerAllowedResource(/^commandlist\\zzmi\\/i));
    cleanups.push(context.linter.registerAllowedResource(/^resource\\zzmi\\/i));
    cleanups.push(context.linter.registerAllowedResource('CommandList\\ZZMI\\SetTextures'));
    cleanups.push(context.linter.registerAllowedResource('CommandListSkinTexture'));
  }

  return cleanups;
}

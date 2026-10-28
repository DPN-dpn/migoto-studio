import type { PluginContext } from '../../../src/plugins/types.ts';
import { isBuiltinResource } from './matcher.ts';
import { registerHelpIniSyntax, isHelpIniResource, isHelpIniVariable } from './help-ini.ts';

export { isBuiltinResource } from './matcher.ts';
export { registerHelpIniSyntax, isHelpIniResource, isHelpIniVariable } from './help-ini.ts';

/**
 * XXMI 표준 내장 커맨드리스트, 함수 및 레거시 빌트인 구문(ShaderFixes\help.ini 등)을 에디터 린터에 허용 등록합니다.
 */
export function registerBuiltinSyntax(context: PluginContext): (() => void)[] {
  const unregisterCallbacks: (() => void)[] = [];

  // 1. 공통 내장 커맨드리스트/리소스 패턴
  const patterns: (string | RegExp | ((name: string) => boolean))[] = [
    (name: string) => isBuiltinResource(name),
    /^builtincommandlist/i,
    'CommandListSkinTexture',
    /^(?:builtin\\)?commandlistskintexture$/i,
    /^commandlist\\(?:builtin\\)?skintexture$/i,
    /^builtin\\skintexture$/i,
    /^(?:commandlist\\)?builtin\\/i,
    /^builtin\\/i,
  ];

  if (context.linter?.registerAllowedResource) {
    for (const pat of patterns) {
      unregisterCallbacks.push(context.linter.registerAllowedResource(pat));
    }
  }

  if (context.linter?.registerAllowedUsedResource) {
    for (const pat of patterns) {
      unregisterCallbacks.push(context.linter.registerAllowedUsedResource(pat));
    }
  }

  // 2. ShaderFixes\help.ini 레거시 빌트인 구문 허용 등록
  unregisterCallbacks.push(...registerHelpIniSyntax(context));

  return unregisterCallbacks;
}

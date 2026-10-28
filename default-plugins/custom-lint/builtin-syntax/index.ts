import type { PluginContext } from '../../../src/plugins/types.ts';
import { isBuiltinResource } from './matcher.ts';

export { isBuiltinResource } from './matcher.ts';

/**
 * XXMI 표준 내장 커맨드리스트 및 함수 문법을 에디터 린터에 허용 등록합니다.
 * (BuiltinCommandList~, CommandListSkinTexture 등)
 */
export function registerBuiltinSyntax(context: PluginContext): (() => void)[] {
  const unregisterCallbacks: (() => void)[] = [];

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

  return unregisterCallbacks;
}

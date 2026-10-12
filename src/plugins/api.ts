export * from './types.ts';
export * from './ui-builder.ts';

import type { MigotoPlugin } from './types.ts';

/**
 * 플러그인 정의 헬퍼 함수
 * TypeScript 환경에서 완전한 타입 추론과 자동 완성을 제공합니다.
 *
 * @example
 * ```ts
 * import { definePlugin } from '../../api.ts';
 *
 * export default definePlugin({
 *   activate(context) {
 *     const header = context.ui.createPanelHeader('내 플러그인');
 *     ...
 *   }
 * });
 * ```
 */
export function definePlugin(plugin: MigotoPlugin): MigotoPlugin {
  return plugin;
}

import type { PluginContext } from '../../../src/plugins/types.ts';
import { registerSrmiRules, isSrmiVariable, isSrmiResource } from './rules.ts';

export { registerSrmiRules, isSrmiVariable, isSrmiResource } from './rules.ts';

/**
 * SRMI (붕괴: 스타레일 - Star Rail Model Importer) 모딩 지원 기능을 등록합니다.
 * ($\\SRMI\\vertex_count 등 전용 변수 및 Resource\\SRMI\\... 전용 리소스 허용 규칙)
 */
export function registerSrmiSupport(context: PluginContext): (() => void)[] {
  const cleanups: (() => void)[] = [];

  // SRMI 전용 린트 규칙, 허용 리소스/변수, 진단 필터 등록
  cleanups.push(...registerSrmiRules(context));
  context.logger?.info('SRMI (붕괴: 스타레일) 모딩 지원 활성화 (vertex_count 등 전용 문법 등록)');

  return cleanups;
}

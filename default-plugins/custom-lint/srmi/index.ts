import type { PluginContext } from '../../../src/plugins/types.ts';
import { registerSrmiRules, isSrmiVariable, isSrmiResource } from './rules.ts';
import { SRMI_TEMPLATES } from './templates.ts';

export { registerSrmiRules, isSrmiVariable, isSrmiResource } from './rules.ts';
export { SRMI_TEMPLATES } from './templates.ts';

/**
 * SRMI (붕괴: 스타레일 - Star Rail Model Importer) 모딩 지원 기능을 등록합니다.
 * ($\\SRMI\\vertex_count 등 전용 변수, Resource\\SRMI\\... 전용 리소스 및 템플릿)
 */
export function registerSrmiSupport(context: PluginContext): (() => void)[] {
  const cleanups: (() => void)[] = [];

  // 1. SRMI 전용 린트 규칙, 허용 리소스, 진단 필터 등록
  cleanups.push(...registerSrmiRules(context));
  context.logger?.info(`SRMI (붕괴: 스타레일) 모딩 지원 활성화 (템플릿 ${SRMI_TEMPLATES.length}개 등록)`);

  // 2. 코드 템플릿: SRMI vertex_count 및 버퍼 오버라이드 구문 등록
  if (context.templates?.registerTemplate) {
    for (const tpl of SRMI_TEMPLATES) {
      context.templates.registerTemplate(tpl);
    }
  }

  return cleanups;
}

import type { PluginContext } from '../../../src/plugins/types.ts';
import { registerZzmiRules } from './rules.ts';
import { ZZMI_TEMPLATES } from './templates.ts';

export { registerZzmiRules, createZzmiSlotResolver } from './rules.ts';
export { ZZMI_TEMPLATES } from './templates.ts';

/**
 * ZZMI (젠레스 존 제로) 및 TTL (Transparency Texture Lib) 지원 기능을 등록합니다.
 * (슬롯픽스 리졸버, 리소스/변수 허용, 진단 필터, 템플릿 등)
 */
export function registerZzmiSupport(context: PluginContext): (() => void)[] {
  const cleanups: (() => void)[] = [];

  // 1. ZZMI 전용 린트 규칙, 허용 리소스, TTL 진단 필터 및 슬롯 리졸버 등록
  cleanups.push(...registerZzmiRules(context));
  context.logger?.info(`ZZMI 모딩 지원 활성화 (슬롯픽스 템플릿 ${ZZMI_TEMPLATES.length}개 등록)`);

  // 2. 코드 템플릿: ZZMI 슬롯픽스 구문 (WEngineFX 포함) 등록
  if (context.templates?.registerTemplate) {
    for (const tpl of ZZMI_TEMPLATES) {
      context.templates.registerTemplate(tpl);
    }
  }

  return cleanups;
}

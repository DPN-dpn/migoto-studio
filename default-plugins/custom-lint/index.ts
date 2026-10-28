import type { MigotoPlugin, PluginContext } from '../../src/plugins/types.ts';
import { registerZzmiSupport, registerZzmiRules, createZzmiSlotResolver, ZZMI_TEMPLATES } from './zzmi/index.ts';
import { registerSrmiSupport, registerSrmiRules, isSrmiVariable, isSrmiResource } from './srmi/index.ts';

export { registerZzmiRules, createZzmiSlotResolver, ZZMI_TEMPLATES } from './zzmi/index.ts';
export { registerSrmiRules, isSrmiVariable, isSrmiResource } from './srmi/index.ts';

let isPluginActive = false;
let unregisterZzmiList: (() => void)[] = [];
let unregisterSrmiList: (() => void)[] = [];

const plugin: MigotoPlugin = {
  activate(context: PluginContext) {
    isPluginActive = true;
    context.logger?.info('커스텀 린터 (ZZMI & SRMI 모딩 지원) 활성화됨');

    // 1. ZZMI 모딩 지원: 슬롯픽스 템플릿, 슬롯픽스 리졸버, TTL 변수/리소스, 진단 필터 등록
    unregisterZzmiList = registerZzmiSupport(context);

    // 2. SRMI 모딩 지원: $\SRMI\vertex_count 등 전용 변수, Resource\SRMI\... 전용 리소스 등록
    unregisterSrmiList = registerSrmiSupport(context);
  },

  deactivate() {
    isPluginActive = false;

    // 1. ZZMI 모딩 지원 등록 해제
    if (unregisterZzmiList.length > 0) {
      for (const cleanup of unregisterZzmiList) {
        try { cleanup(); } catch {}
      }
      unregisterZzmiList = [];
    }

    // 2. SRMI 모딩 지원 등록 해제
    if (unregisterSrmiList.length > 0) {
      for (const cleanup of unregisterSrmiList) {
        try { cleanup(); } catch {}
      }
      unregisterSrmiList = [];
    }
  },
};

export default plugin;

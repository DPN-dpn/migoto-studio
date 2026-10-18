import type { PluginContext, MigotoPlugin } from '../../src/plugins/types.ts';
import { registerZzmiRules } from './rules.ts';
import { ZZMI_TEMPLATES } from './templates.ts';
import { buildZzmiSupportView } from './ui.ts';
import { iconSvg } from './icon.ts';

export { registerZzmiRules } from './rules.ts';
export { ZZMI_TEMPLATES } from './templates.ts';

let cleanups: (() => void)[] = [];

const plugin: MigotoPlugin = {
  activate(context: PluginContext) {
    // 1. ZZMI 전용 린트 규칙 등록
    cleanups = registerZzmiRules(context);

    // 2. 코드 템플릿: ZZMI 슬롯픽스 구문 (WEngineFX 포함) 등록
    if (context.templates?.registerTemplate) {
      for (const tpl of ZZMI_TEMPLATES) {
        context.templates.registerTemplate(tpl);
      }
    }

    // 3. 사이드바 UI 뷰 등록 (ZZMI & TTL 템플릿 탐색기)
    if (context.ui?.registerSidebarView) {
      context.ui.registerSidebarView({
        id: 'zzmi-support',
        title: 'ZZMI 지원',
        icon: iconSvg,
        render(container) {
          buildZzmiSupportView(context, container);
        },
      });
    }
  },
  deactivate() {
    for (const cleanup of cleanups) {
      try { cleanup(); } catch {}
    }
    cleanups = [];
  },
};

export default plugin;

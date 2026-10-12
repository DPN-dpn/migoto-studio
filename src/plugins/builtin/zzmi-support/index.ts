import { definePlugin } from '../../api.ts';

export default definePlugin({
  activate(context) {
    // 1. ZZMI 전용 린트 규칙: run = CommandList\ZZMI\SetTextures 및 관련 네임스페이스를 정상 구문으로 인식
    context.linter.registerAllowedResource(/^commandlist\\zzmi\\/i);
    context.linter.registerAllowedResource(/^resource\\zzmi\\/i);
    context.linter.registerAllowedResource('CommandList\\ZZMI\\SetTextures');

    // 2. 코드 템플릿: ZZMI 슬롯픽스 구문 (WEngineFX 포함)
    context.templates.registerTemplate({
      id: 'zzmi_slot_fix',
      group: 'ZZMI (젠레스 존 제로)',
      label: 'ZZMI 텍스처 슬롯픽스 (SlotFix)',
      description: 'ZZMI 텍스처 슬롯 매핑 및 WEngineFX 이펙트 슬롯 구문',
      body: [
        '; ZZMI SlotFix (Texture Slot Mapping)',
        'Resource\\ZZMI\\Diffuse = ref Resource${1:Diffuse}',
        'Resource\\ZZMI\\NormalMap = ref Resource${2:NormalMap}',
        'Resource\\ZZMI\\LightMap = ref Resource${3:LightMap}',
        'Resource\\ZZMI\\MaterialMap = ref Resource${4:MaterialMap}',
        'Resource\\ZZMI\\WEngineFX = ref Resource${5:WEngineFX}',
        'run = CommandList\\ZZMI\\SetTextures',
      ].join('\n') + '\n',
    });
  },
});

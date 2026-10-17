import type { PluginTemplate } from '../../src/plugins/types.ts';

export const ZZMI_TEMPLATES: PluginTemplate[] = [
  {
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
  },
  {
    id: 'zzmi_ttl_draw',
    group: 'ZZMI (젠레스 존 제로)',
    label: 'ZZMI TTL 투명도 드로우 (단일 투명도)',
    description: 'Transparency Texture Lib (TTL) 단일 알파 투명도 렌더링 구문 (No Texture)',
    body: [
      '; ZZMI TTL (Transparency Texture Lib - Uniform Alpha)',
      '$\\TTL\\alpha = ${1:0.5}',
      '$\\TTL\\_1 = ${2:IndexCount}',
      '$\\TTL\\_2 = ${3:FirstIndex}',
      'run = CommandList\\TTL\\Draw',
    ].join('\n') + '\n',
  },
  {
    id: 'zzmi_ttl_texture',
    group: 'ZZMI (젠레스 존 제로)',
    label: 'ZZMI TTL 텍스처 마스크 투명도 (Texture Mask)',
    description: 'Transparency Texture Lib (TTL) 텍스처 마스크 및 채널 기반 투명도 렌더링 구문',
    body: [
      '; ZZMI TTL (Transparency Texture Lib - Texture Mask)',
      'Resource\\TTL\\TransparencyTex = ref Resource${1:Transparency}',
      '$\\TTL\\_1 = ${2:IndexCount}',
      '$\\TTL\\_2 = ${3:FirstIndex}',
      '$\\TTL\\mask_channel = ${4:3}',
      '$\\TTL\\mask_invert = ${5:0}',
      'run = CommandList\\TTL\\Draw',
    ].join('\n') + '\n',
  },
];

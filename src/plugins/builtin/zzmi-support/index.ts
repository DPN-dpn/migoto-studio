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

    // 3. 사이드바 도구 탭 등록
    context.ui.registerSidebarView({
      id: 'zzmi-tools-view',
      title: 'ZZMI 도구',
      icon: 'ZZMI',
      render: (container) => {
        container.replaceChildren();

        const panel = document.createElement('div');
        panel.className = 'zzmi-tools-panel';
        panel.style.padding = '10px';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.gap = '10px';
        panel.style.fontSize = '12px';

        const title = document.createElement('strong');
        title.textContent = 'ZZMI (Zenless Zone Zero) 도구';
        title.style.color = 'var(--fg)';
        panel.append(title);

        const desc = document.createElement('div');
        desc.style.color = 'var(--fg-dim)';
        desc.style.lineHeight = '1.4';
        desc.style.fontSize = '11px';
        desc.textContent = '젠레스 존 제로 모딩에 필요한 ZZMI SlotFix 문법 및 커맨드리스트를 지원합니다.';
        panel.append(desc);

        // 템플릿 삽입 버튼
        const insertBtn = document.createElement('button');
        insertBtn.className = 'small-btn primary';
        insertBtn.textContent = '슬롯픽스 템플릿 에디터에 삽입';
        insertBtn.onclick = () => {
          context.editor.insertText([
            '; ZZMI SlotFix',
            'Resource\\ZZMI\\Diffuse = ref ResourceDiffuse',
            'Resource\\ZZMI\\NormalMap = ref ResourceNormalMap',
            'Resource\\ZZMI\\LightMap = ref ResourceLightMap',
            'Resource\\ZZMI\\MaterialMap = ref ResourceMaterialMap',
            'Resource\\ZZMI\\WEngineFX = ref ResourceWEngineFX',
            'run = CommandList\\ZZMI\\SetTextures\n',
          ].join('\n'));
          context.ui.showToast('ZZMI 슬롯픽스 구문이 삽입되었습니다.', 'info');
        };
        panel.append(insertBtn);

        // 슬롯 레퍼런스 안내
        const refBox = document.createElement('div');
        refBox.style.padding = '8px';
        refBox.style.background = 'var(--bg-elev)';
        refBox.style.borderRadius = '5px';
        refBox.style.border = '1px solid var(--border)';
        refBox.style.lineHeight = '1.5';
        refBox.style.fontSize = '11px';

        refBox.innerHTML = `
          <div style="font-weight: 600; color: var(--accent); margin-bottom: 4px;">ZZMI 슬롯 가이드</div>
          <div><strong>Diffuse:</strong> 기본 텍스처 (색상/알베도)</div>
          <div><strong>NormalMap:</strong> 노멀맵 (표면 굴곡)</div>
          <div><strong>LightMap:</strong> 조명 및 음영 맵</div>
          <div><strong>MaterialMap:</strong> 재질/반사/금속성 맵</div>
          <div><strong>WEngineFX:</strong> W-Engine 발광 이펙트 맵</div>
          <div style="margin-top: 4px; color: var(--fg-dim);">
            모든 텍스처 슬롯을 지정한 후 <code>run = CommandList\\ZZMI\\SetTextures</code>로 슬롯에 일괄 바인딩합니다.
          </div>
        `;
        panel.append(refBox);

        container.append(panel);
      },
    });
  },
});

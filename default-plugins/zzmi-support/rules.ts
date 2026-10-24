import type { PluginContext, TextureSlotResolver, TextureSlot, IniSection, IniDocument } from '../../src/plugins/types.ts';

export function registerZzmiRules(context: PluginContext): (() => void)[] {
  const cleanups: (() => void)[] = [];

  // 1. ZZMI 기본 린트 규칙: run = CommandList\ZZMI\SetTextures 및 관련 네임스페이스를 정상 구문으로 인식
  if (context.linter?.registerAllowedResource) {
    cleanups.push(context.linter.registerAllowedResource(/^commandlist\\zzmi\\/i));
    cleanups.push(context.linter.registerAllowedResource(/^resource\\zzmi\\/i));
    cleanups.push(context.linter.registerAllowedResource('CommandList\\ZZMI\\SetTextures'));
    cleanups.push(context.linter.registerAllowedResource('CommandListSkinTexture'));

    // TTL (Transparency Texture Lib) 관련 리소스 및 커맨드리스트 허용
    cleanups.push(context.linter.registerAllowedResource(/^commandlist\\ttl\\/i));
    cleanups.push(context.linter.registerAllowedResource(/^resource\\ttl\\/i));
    cleanups.push(context.linter.registerAllowedResource('CommandList\\TTL\\Draw'));
    cleanups.push(context.linter.registerAllowedResource('Resource\\TTL\\TransparencyTex'));
  }

  // 2. TTL (Transparency Texture Lib) 전용 변수 허용 등록 ($\TTL\alpha, $\TTL\_1, $\TTL\_2, $\TTL\mask_channel 등)
  if (context.linter?.registerAllowedVariable) {
    cleanups.push(
      context.linter.registerAllowedVariable((name: string) => {
        const norm = name.toLowerCase().replace(/^[\\$]+/, '');
        return norm.startsWith('ttl\\');
      }),
    );
    cleanups.push(context.linter.registerAllowedVariable(/^\\?ttl\\/i));
  }

  // 3. TTL 변수 및 리소스 사용 허용 등록 (Unused 경고 방지)
  if (context.linter?.registerAllowedUsedVariable) {
    cleanups.push(
      context.linter.registerAllowedUsedVariable((name: string) => {
        const norm = name.toLowerCase().replace(/^[\\$]+/, '');
        return norm.startsWith('ttl\\');
      }),
    );
  }

  if (context.linter?.registerAllowedUsedResource) {
    cleanups.push(context.linter.registerAllowedUsedResource(/^resource\\ttl\\/i));
    cleanups.push(context.linter.registerAllowedUsedResource(/^commandlist\\ttl\\/i));
  }

  // 4. ZZMI 진단 필터 등록: 커스텀 린트(custom-lint) 및 코어 린터가 먼저 발생시킨 경고 중
  // ZZMI 표준(TTL 등)에 해당하는 경고를 바로잡아 억제(문제없는 정상 코드로 보정)
  if (context.linter?.registerDiagnosticFilter) {
    cleanups.push(
      context.linter.registerDiagnosticFilter((diag, ctx) => {
        const msg = diag.message || '';

        // A. TTL 네임스페이스 부재 경고 필터링 (ZZMI 환경에서는 TTL이 엔진 내장 라이브러리이므로 정상)
        if (msg.includes("'TTL'") || msg.includes("'ttl'")) {
          return false;
        }

        // B. TTL 변수 또는 드로우콜 관련 경고 메시지 필터링
        if (/\bttl[\\_]/i.test(msg) || /\$?\\?ttl\\/i.test(msg)) {
          return false;
        }

        // C. 해당 라인에 TTL 구문이 있고, 메시지에서 TTL 관련 심볼을 지칭하는 경우
        if (ctx?.model && diag.startLineNumber) {
          const lineContent = ctx.model.getLineContent(diag.startLineNumber) || '';
          if (/\\?TTL\\/i.test(lineContent) && /ttl/i.test(msg)) {
            return false;
          }
        }

        return true;
      }),
    );
  }

  // 5. ZZMI 전용 텍스처 슬롯픽스(SlotFix) 리졸버 등록
  if (context.slots?.registerTextureSlotResolver) {
    cleanups.push(context.slots.registerTextureSlotResolver(createZzmiSlotResolver()));
  }

  return cleanups;
}

/**
 * ZZMI 슬롯픽스(SlotFix) 및 TTL 구문을 해석하는 텍스처 슬롯 리졸버 생성
 */
export function createZzmiSlotResolver(): TextureSlotResolver {
  return {
    id: 'zzmi-slotfix',
    name: 'ZZMI 슬롯픽스 리졸버 (SlotFix & TTL)',
    priority: 10,
    resolveSlots: (section: IniSection, doc: IniDocument, allDocs?: Map<string, IniDocument>): TextureSlot[] | null => {
      const slots: TextureSlot[] = [];
      const props = section.properties;

      const resolveFilename = (resName: string): string | undefined => {
        const clean = resName.replace(/^[\\$]+/, '').replace(/^ref\s+/i, '').trim();
        const candidates = [clean, `Resource${clean}`, `Resource\\${clean}`];
        for (const name of candidates) {
          const sec = doc.getSection(name);
          if (sec && sec.properties['filename']) {
            return sec.properties['filename'].replace(/['"]/g, '').trim();
          }
        }
        if (allDocs) {
          for (const otherDoc of allDocs.values()) {
            for (const name of candidates) {
              const sec = otherDoc.getSection(name);
              if (sec && sec.properties['filename']) {
                return sec.properties['filename'].replace(/['"]/g, '').trim();
              }
            }
          }
        }
        return undefined;
      };

      const checkProperties = (pRecord: Record<string, string>, srcSec: string) => {
        for (const [key, rawVal] of Object.entries(pRecord)) {
          const cleanKey = key.trim();
          const cleanVal = rawVal.replace(/^ref\s+/i, '').trim();

          // Resource\ZZMI\... 패턴
          const zzmiMatch = cleanKey.match(/^Resource\\ZZMI\\(.+)$/i);
          if (zzmiMatch) {
            const slotName = zzmiMatch[1].trim();
            const lowerSlot = slotName.toLowerCase();
            let slotType: TextureSlot['slotType'] = 'custom';
            let displaySlotName = slotName;
            if (lowerSlot.includes('diffuse')) { slotType = 'diffuse'; displaySlotName = 'Diffuse'; }
            else if (lowerSlot.includes('normal')) { slotType = 'normal'; displaySlotName = 'NormalMap'; }
            else if (lowerSlot.includes('light')) { slotType = 'light'; displaySlotName = 'LightMap'; }
            else if (lowerSlot.includes('material')) { slotType = 'material'; displaySlotName = 'MaterialMap'; }
            else if (lowerSlot.includes('fx') || lowerSlot.includes('wengine')) { slotType = 'fx'; displaySlotName = 'WEngineFX'; }

            slots.push({
              slotId: `ZZMI\\${displaySlotName}`,
              slotType,
              resourceRef: cleanVal,
              textureFile: resolveFilename(cleanVal),
              sourceSection: srcSec,
              rawLine: `${key} = ${rawVal}`,
            });
            continue;
          }

          // Resource\TTL\... 패턴
          const ttlMatch = cleanKey.match(/^Resource\\TTL\\(.+)$/i);
          if (ttlMatch) {
            const slotName = ttlMatch[1].trim();
            const lowerTtl = slotName.toLowerCase();
            let displayTtl = slotName;
            if (lowerTtl.includes('transparency')) displayTtl = 'TransparencyTex';

            slots.push({
              slotId: `TTL\\${displayTtl}`,
              slotType: 'custom',
              resourceRef: cleanVal,
              textureFile: resolveFilename(cleanVal),
              sourceSection: srcSec,
              rawLine: `${key} = ${rawVal}`,
            });
            continue;
          }
        }
      };

      // 1. 현재 섹션의 프로퍼티 직접 확인
      checkProperties(props, section.name);

      // 2. 만약 run = CommandList\ZZMI\... 또는 커맨드리스트 참조가 있는 경우 해당 커맨드리스트 내부도 확인
      if (props['run']) {
        const cmdName = props['run'].trim();
        const cmdSec = doc.getSection(cmdName) || (allDocs ? (() => {
          for (const otherDoc of allDocs.values()) {
            const s = otherDoc.getSection(cmdName);
            if (s) return s;
          }
          return undefined;
        })() : undefined);

        if (cmdSec) {
          checkProperties(cmdSec.properties, cmdSec.name);
        }
      }

      return slots.length > 0 ? slots : null;
    },
  };
}


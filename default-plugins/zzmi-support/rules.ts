import type { PluginContext } from '../../src/plugins/types.ts';

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

  return cleanups;
}

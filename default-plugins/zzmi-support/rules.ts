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

  return cleanups;
}


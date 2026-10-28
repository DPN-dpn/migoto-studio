import type { PluginContext } from '../../../src/plugins/types.ts';

/**
 * help-ini.ts
 * XXMI 레거시 빌트인 구문(ShaderFixes\help.ini 네임스페이스)을 전담 지원합니다.
 *
 * 예시:
 * - pre run = CustomShader\ShaderFixes\help.ini\FormatText
 * - pre Resource\ShaderFixes\help.ini\Notification = ResourceCreditInfo
 * - pre $\ShaderFixes\help.ini\notification_timeout = time + 5.0
 */

// 1. 리소스 / 커맨드리스트 / 커스텀셰이더 매칭 정규식
export const HELP_INI_RESOURCE_REGEX = /^(?:customshader|resource|commandlist)\\shaderfixes\\help\.ini\\/i;

// 2. 변수 매칭 정규식 ($\ShaderFixes\help.ini\...)
export const HELP_INI_VARIABLE_REGEX = /^\\?shaderfixes\\help\.ini\\/i;

export function isHelpIniResource(name: string): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/^[\\\/]+/, '');
  return HELP_INI_RESOURCE_REGEX.test(clean) || clean.startsWith('shaderfixes\\help.ini\\');
}

export function isHelpIniVariable(name: string): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/^[\\\$]+/, '');
  return HELP_INI_VARIABLE_REGEX.test(clean);
}

/**
 * ShaderFixes\help.ini 빌트인 리소스, 커맨드, 셰이더 및 변수를 에디터 린터에 허용 등록합니다.
 */
export function registerHelpIniSyntax(context: PluginContext): (() => void)[] {
  const unregisterCallbacks: (() => void)[] = [];

  // A. 리소스 / 커맨드리스트 / 커스텀셰이더 허용 등록
  if (context.linter?.registerAllowedResource) {
    unregisterCallbacks.push(context.linter.registerAllowedResource(HELP_INI_RESOURCE_REGEX));
    unregisterCallbacks.push(context.linter.registerAllowedResource((name: string) => isHelpIniResource(name)));
  }

  // B. 변수 허용 등록
  if (context.linter?.registerAllowedVariable) {
    unregisterCallbacks.push(context.linter.registerAllowedVariable(HELP_INI_VARIABLE_REGEX));
    unregisterCallbacks.push(context.linter.registerAllowedVariable((name: string) => isHelpIniVariable(name)));
  }

  // C. 사용 허용 등록 (Unused 경고 방지)
  if (context.linter?.registerAllowedUsedResource) {
    unregisterCallbacks.push(context.linter.registerAllowedUsedResource(HELP_INI_RESOURCE_REGEX));
    unregisterCallbacks.push(context.linter.registerAllowedUsedResource((name: string) => isHelpIniResource(name)));
  }

  if (context.linter?.registerAllowedUsedVariable) {
    unregisterCallbacks.push(context.linter.registerAllowedUsedVariable(HELP_INI_VARIABLE_REGEX));
    unregisterCallbacks.push(context.linter.registerAllowedUsedVariable((name: string) => isHelpIniVariable(name)));
  }

  return unregisterCallbacks;
}

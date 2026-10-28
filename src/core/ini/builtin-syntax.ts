/**
 * builtin-syntax.ts
 * XXMI 및 3DMigoto 표준 내장 리소스, 커맨드리스트 및 ShaderFixes\help.ini 레거시 빌트인 구문 정의
 */

// 1. ShaderFixes\help.ini 리소스 / 커맨드리스트 / 커스텀셰이더 매칭 정규식
export const HELP_INI_RESOURCE_REGEX = /^(?:customshader|resource|commandlist)\\shaderfixes\\help\.ini\\/i;

// 2. ShaderFixes\help.ini 변수 매칭 정규식 ($\ShaderFixes\help.ini\...)
export const HELP_INI_VARIABLE_REGEX = /^\\?shaderfixes\\help\.ini\\/i;

/**
 * GIMI / ZZMI / XXMI 내장 리소스 및 내장 커맨드리스트 여부를 판별합니다.
 */
export function isBuiltinResource(name: string): boolean {
  if (!name) return false;
  const norm = name.toLowerCase().replace(/^[\\\/]+/, '').replace(/[\/]/g, '\\');
  return (
    norm.startsWith('builtincommandlist') ||
    norm.startsWith('builtin_commandlist') ||
    norm.startsWith('builtin\\') ||
    norm.startsWith('commandlist\\builtin') ||
    norm.startsWith('commandlist\\skintexture') ||
    norm === 'commandlistskintexture' ||
    norm === 'builtin'
  );
}

/**
 * ShaderFixes\help.ini 내장 리소스/커맨드리스트/커스텀셰이더 여부를 판별합니다.
 */
export function isHelpIniResource(name: string): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/^[\\\/$]+/, '').replace(/[\/]/g, '\\');
  return HELP_INI_RESOURCE_REGEX.test(clean) || clean.startsWith('shaderfixes\\help.ini\\');
}

/**
 * ShaderFixes\help.ini 내장 변수 여부를 판별합니다.
 */
export function isHelpIniVariable(name: string): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/^[\\\/$]+/, '').replace(/[\/]/g, '\\');
  return HELP_INI_VARIABLE_REGEX.test(clean) || clean.startsWith('shaderfixes\\help.ini\\');
}

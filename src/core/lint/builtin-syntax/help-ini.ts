/**
 * help-ini.ts
 * ShaderFixes\help.ini 레거시 내장 리소스 및 변수 매칭
 */

export const HELP_INI_RESOURCE_REGEX = /^(?:customshader|resource|commandlist)\\shaderfixes\\help\.ini\\/i;
export const HELP_INI_VARIABLE_REGEX = /^\\?shaderfixes\\help\.ini\\/i;

export function isHelpIniResource(name: string): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/^[\\\/$]+/, '').replace(/[\/]/g, '\\');
  return HELP_INI_RESOURCE_REGEX.test(clean) || clean.startsWith('shaderfixes\\help.ini\\');
}

export function isHelpIniVariable(name: string): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/^[\\\/$]+/, '').replace(/[\/]/g, '\\');
  return HELP_INI_VARIABLE_REGEX.test(clean) || clean.startsWith('shaderfixes\\help.ini\\');
}

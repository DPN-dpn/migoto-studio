/**
 * matcher.ts
 * GIMI / ZZMI / XXMI 내장 리소스 및 내장 커맨드리스트 검사
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

export function isBuiltinCommandList(name: string): boolean {
  return isBuiltinResource(name);
}

import type { PluginContext } from '../../../src/plugins/types.ts';

/**
 * SRMI (붕괴: 스타레일 - Star Rail Model Importer) 변수 정규식
 * 예: $\SRMI\vertex_count, \SRMI\vertex_count, $SRMI\vertex_count 등
 */
export const SRMI_VAR_REGEX = /^\\?srmi\\/i;

/**
 * SRMI 리소스 및 커맨드리스트 정규식
 * 예: Resource\SRMI\PositionBuffer, Resource\SRMI\BlendBuffer, CommandList\SRMI\...
 */
export const SRMI_RESOURCE_REGEX = /^(?:resource|commandlist)\\srmi\\/i;

/**
 * 주어진 변수명이 SRMI 전용 변수 구문인지 검사합니다.
 * (대소문자 무관, 접두어 $, \ 무시)
 */
export function isSrmiVariable(name: string): boolean {
  if (!name) return false;
  const clean = name.trim().toLowerCase().replace(/^[\\$]+/, '');
  return clean.startsWith('srmi\\');
}

/**
 * 주어진 리소스/커맨드리스트 이름이 SRMI 전용 구문인지 검사합니다.
 */
export function isSrmiResource(name: string): boolean {
  if (!name) return false;
  const clean = name.trim().toLowerCase().replace(/^[\\\/]+/, '');
  return (
    clean.startsWith('resource\\srmi\\') ||
    clean.startsWith('commandlist\\srmi\\') ||
    clean.startsWith('srmi\\')
  );
}

/**
 * SRMI (Star Rail Model Importer) 전용 린트 규칙 및 허용 리소스/변수를 등록합니다.
 */
export function registerSrmiRules(context: PluginContext): (() => void)[] {
  const cleanups: (() => void)[] = [];

  // 1. SRMI 전용 리소스 및 커맨드리스트 허용 등록
  if (context.linter?.registerAllowedResource) {
    cleanups.push(context.linter.registerAllowedResource(SRMI_RESOURCE_REGEX));
    cleanups.push(context.linter.registerAllowedResource((name: string) => isSrmiResource(name)));
    cleanups.push(context.linter.registerAllowedResource('Resource\\SRMI\\PositionBuffer'));
    cleanups.push(context.linter.registerAllowedResource('Resource\\SRMI\\BlendBuffer'));
  }

  // 2. SRMI 전용 변수 등록 ($\SRMI\vertex_count 등)
  if (context.linter?.registerAllowedVariable) {
    cleanups.push(context.linter.registerAllowedVariable(SRMI_VAR_REGEX));
    cleanups.push(context.linter.registerAllowedVariable((name: string) => isSrmiVariable(name)));
  }

  // 3. Unused 경고 방지를 위한 사용 허용 변수 및 리소스 등록
  if (context.linter?.registerAllowedUsedVariable) {
    cleanups.push(context.linter.registerAllowedUsedVariable((name: string) => isSrmiVariable(name)));
  }

  if (context.linter?.registerAllowedUsedResource) {
    cleanups.push(context.linter.registerAllowedUsedResource(SRMI_RESOURCE_REGEX));
    cleanups.push(context.linter.registerAllowedUsedResource((name: string) => isSrmiResource(name)));
  }

  // 4. SRMI 전용 진단 필터 등록:
  // SRMI는 엔진/로더가 직접 해석하는 내장 네임스페이스이므로 '네임스페이스를 찾을 수 없습니다' 경고 억제
  if (context.linter?.registerDiagnosticFilter) {
    cleanups.push(
      context.linter.registerDiagnosticFilter((diag, ctx) => {
        const msg = diag.message || '';

        // A. SRMI 네임스페이스 부재 경고 필터링
        if (msg.includes("'SRMI'") || msg.includes("'srmi'")) {
          return false;
        }

        // B. SRMI 변수 관련 경고 메시지 필터링
        if (/\bsrmi[\\_]/i.test(msg) || /\$?\\?srmi\\/i.test(msg)) {
          return false;
        }

        // C. 해당 라인에 SRMI 구문이 있고 메시지에 srmi가 포함된 경우
        if (ctx?.model && diag.startLineNumber) {
          const lineContent = ctx.model.getLineContent(diag.startLineNumber) || '';
          if (/\\?srmi\\/i.test(lineContent) && /srmi/i.test(msg)) {
            return false;
          }
        }

        return true;
      }),
    );
  }

  return cleanups;
}

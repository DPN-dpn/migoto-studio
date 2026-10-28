import type { MigotoPlugin, PluginContext } from '../../src/plugins/types.ts';
import { registerBuiltinSyntax, isBuiltinResource, isHelpIniResource, isHelpIniVariable } from './builtin-syntax/index.ts';
import { registerFileCheckRule } from './file-check/index.ts';
import {
  registerNamespaceCheck,
  createNamespaceRegistrationState,
  cleanupNamespaceState,
  type NamespaceRegistrationState,
} from './namespace-check/index.ts';
import { registerZzmiSupport, registerZzmiRules, ZZMI_TEMPLATES } from './zzmi/index.ts';

// 외부 및 테스트 호환성을 위한 심볼 re-export
export { isBuiltinResource, isHelpIniResource, isHelpIniVariable } from './builtin-syntax/index.ts';
export { parseIniExports } from './namespace-check/parser.ts';
export { collectIniFiles, readIniText, buildWorkspaceIndex } from './namespace-check/indexer.ts';
export type { SymbolLocationRecord, NamespaceExport, NamespaceGroup } from './namespace-check/types.ts';
export { registerZzmiRules, createZzmiSlotResolver, ZZMI_TEMPLATES } from './zzmi/index.ts';

let isPluginActive = false;
let unregisterBuiltinList: (() => void)[] = [];
let unregisterFileCheck: (() => void) | void = undefined;
let unregisterZzmiList: (() => void)[] = [];
const namespaceState: NamespaceRegistrationState = createNamespaceRegistrationState();

const plugin: MigotoPlugin = {
  activate(context: PluginContext) {
    isPluginActive = true;
    context.logger?.info('커스텀 린터 (내장문법 / 파일실재성 / 네임스페이스 / ZZMI지원) 활성화됨');

    // 1. 내장함수 문법 추가: XXMI 표준 내장 커맨드리스트 및 ShaderFixes\help.ini 허용 등록
    unregisterBuiltinList = registerBuiltinSyntax(context);

    // 2. 파일 실재성 검사: 모드 리소스 파일 실재성 검사 규칙 등록
    unregisterFileCheck = registerFileCheckRule(context);

    // 3. 네임스페이스 및 변수 검사: 크로스 파일 심볼 인덱싱, 네임스페이스 린트 및 정의/참조 Provider 등록
    registerNamespaceCheck(context, () => isPluginActive, namespaceState);

    // 4. ZZMI 모딩 지원: 슬롯픽스 템플릿, 슬롯픽스 리졸버, TTL 변수/리소스, 진단 필터 등록
    unregisterZzmiList = registerZzmiSupport(context);
  },

  deactivate() {
    isPluginActive = false;

    // 1. 내장함수 문법 허용 해제
    if (unregisterBuiltinList.length > 0) {
      for (const cleanup of unregisterBuiltinList) {
        try { cleanup(); } catch {}
      }
      unregisterBuiltinList = [];
    }

    // 2. 파일 실재성 검사 규칙 해제
    if (typeof unregisterFileCheck === 'function') {
      try { unregisterFileCheck(); } catch {}
      unregisterFileCheck = undefined;
    }

    // 3. 네임스페이스 및 변수 검사 정리
    cleanupNamespaceState(namespaceState);

    // 4. ZZMI 지원 정리
    if (unregisterZzmiList.length > 0) {
      for (const cleanup of unregisterZzmiList) {
        try { cleanup(); } catch {}
      }
      unregisterZzmiList = [];
    }
  },
};

export default plugin;

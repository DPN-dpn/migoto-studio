// Slim Monaco bundle: core API + only the editor features we use.
// (monaco-editor's own `editor.main` also pulls in ~80 programming-language definitions and
// TS/JSON/CSS/HTML language services, which this app does not need.)
import 'monaco-editor/nls/lang/ko.js';
import * as monaco from 'monaco-editor/editor/editor.api.js';

import 'monaco-editor/editor/browser/coreCommands.js';
import 'monaco-editor/editor/browser/widget/codeEditor/codeEditorWidget.js';
import 'monaco-editor/editor/browser/widget/diffEditor/diffEditor.contribution.js';
import 'monaco-editor/editor/browser/widget/diffEditor/diffEditorWidget.js';
import '../../../node_modules/monaco-editor/esm/vs/editor/browser/widget/diffEditor/style.css';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/editor/contrib/cursorUndo/browser/cursorUndo.js';
import 'monaco-editor/editor/contrib/dnd/browser/dnd.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import 'monaco-editor/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/editor/contrib/fontZoom/browser/fontZoom.js';
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/editor/contrib/indentation/browser/indentation.js';
import 'monaco-editor/editor/contrib/lineSelection/browser/lineSelection.js';
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/editor/contrib/smartSelect/browser/smartSelect.js';
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/editor/contrib/gotoError/browser/gotoError.js';
import 'monaco-editor/editor/contrib/tokenization/browser/tokenization.js';
import 'monaco-editor/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
import 'monaco-editor/editor/common/standaloneStrings.js';
import 'monaco-editor/features/find/register.js';
// @ts-ignore
import { MenuRegistry, MenuId } from 'monaco-editor/platform/actions/common/actions.js';

/**
 * INI 파일 편집 환경에 불필요하거나 중복되는 Monaco 기본 컨텍스트 메뉴 항목을 정리합니다.
 * (정의/선언 중복, 구현으로 이동, 형식 정의로 이동 등 제거)
 */
export function pruneRedundantContextActions() {
  const UNWANTED_ACTION_IDS = new Set([
    'editor.action.peekDefinition',         // Monaco 기본 "정의 피킹" (중복 제거)
    'editor.action.peekDeclaration',        // Monaco 기본 "선언 피킹" (중복 제거)
    'editor.action.referenceSearch.trigger',// Monaco 기본 "참조 피킹" (중복 제거)
    'editor.action.revealDefinition',       // Monaco 기본 "정의로 이동" (코어 액션과 중복)
    'editor.action.revealDeclaration',      // Monaco 기본 "선언된 곳으로 이동" (Ctrl+F12 중복)
    'editor.action.goToImplementation',     // Monaco 기본 "구현으로 이동" (INI에 미지원)
    'editor.action.peekImplementation',     // Monaco 기본 "구현 피킹" (INI에 미지원)
    'editor.action.goToTypeDefinition',     // Monaco 기본 "형식 정의로 이동" (INI에 미지원)
    'editor.action.peekTypeDefinition',     // Monaco 기본 "형식 정의 피킹" (INI에 미지원)
    'editor.action.revealDefinitionAside',  // Monaco 기본 "측면에 정의 열기"
    'editor.action.goToReferences',         // Monaco 기본 "모든 참조 찾기" (코어 전용 모달과 중복)
  ]);

  const pruneList = (menuId: any) => {
    try {
      const list = MenuRegistry._menuItems?.get(menuId);
      if (!list || !list._first) return;
      let node = list._first;
      const undef = list._first.constructor?.Undefined;
      while (node && node !== undef) {
        const next = node.next;
        const cmdId = node.element?.command?.id;
        if (cmdId && UNWANTED_ACTION_IDS.has(cmdId)) {
          list._remove(node);
        }
        node = next;
      }
    } catch (err) {
      console.warn('[Monaco] Failed to prune redundant menu action:', err);
    }
  };

  pruneList(MenuId.EditorContext);
  pruneList(MenuId.EditorContextPeek);
}

export { monaco };


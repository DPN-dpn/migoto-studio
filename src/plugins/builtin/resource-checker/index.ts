import { definePlugin } from '../../api.ts';
import { stripComments } from '../../../core/lint.ts';

export default definePlugin({
  activate(context) {
    // 1. 에디터 린트 규칙 등록: filename 구문에 적힌 파일이 모드 폴더에 존재하는지 검사
    context.linter.registerRule({
      id: 'missing-resource-files',
      name: '모드 리소스 파일 실재성 검사',
      check: async (ctx) => {
        // 모드 폴더가 열려 있지 않은 단일 파일 모드에서는 폴더 기준 경로를 검증할 수 없으므로 건너뜁니다.
        if (!ctx.folder) {
          return [];
        }

        const diagnostics = [];
        const count = ctx.model.getLineCount();

        for (let line = 1; line <= count; line++) {
          const raw = ctx.model.getLineContent(line);
          const { code } = stripComments(raw);
          const trimmed = code.trim();
          if (!trimmed) continue;

          const match = /^\s*filename\s*=\s*(.+)$/i.exec(code);
          if (!match) continue;

          let target = match[1].trim();
          // 양쪽 따옴표("..." 또는 '...') 제거
          if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith("'") && target.endsWith("'"))) {
            target = target.slice(1, -1).trim();
          }

          if (!target) continue;

          const exists = await ctx.fileExists(target);
          if (!exists) {
            const rawIdx = raw.indexOf(match[1]);
            const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
            const endCol = startCol + match[1].length;

            diagnostics.push({
              severity: 'warning' as const,
              message: `참조된 파일 "${target}"을(를) 모드 폴더에서 찾을 수 없습니다. (파일명 및 확장자 확인 필요)`,
              startLineNumber: line,
              startColumn: startCol,
              endLineNumber: line,
              endColumn: endCol,
            });
          }
        }

        return diagnostics;
      },
    });
  },
});

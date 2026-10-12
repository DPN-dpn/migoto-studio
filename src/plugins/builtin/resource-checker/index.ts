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

    // 2. 좌측 사이드바 전용 패널 등록
    context.ui.registerSidebarView({
      id: 'resource-checker-view',
      title: '리소스 검사기',
      icon: 'file-check',
      render: (container) => {
        const renderPanel = async () => {
          container.replaceChildren();

          const panel = document.createElement('div');
          panel.className = 'resource-checker-panel';
          panel.style.padding = '10px';
          panel.style.display = 'flex';
          panel.style.flexDirection = 'column';
          panel.style.gap = '10px';
          panel.style.fontSize = '12px';

          const currentFolder = context.workspace.getCurrentFolder();
          const currentFile = context.workspace.getCurrentFile();

          const titleRow = document.createElement('div');
          titleRow.style.display = 'flex';
          titleRow.style.justifyContent = 'space-between';
          titleRow.style.alignItems = 'center';

          const title = document.createElement('strong');
          title.textContent = '모드 리소스 파일 검사';
          title.style.color = 'var(--fg)';

          const refreshBtn = document.createElement('button');
          refreshBtn.className = 'small-btn';
          refreshBtn.textContent = '새로고침';
          refreshBtn.onclick = () => renderPanel();

          titleRow.append(title, refreshBtn);
          panel.append(titleRow);

          const statusBox = document.createElement('div');
          statusBox.style.padding = '8px';
          statusBox.style.background = 'var(--bg-elev)';
          statusBox.style.borderRadius = '5px';
          statusBox.style.border = '1px solid var(--border)';
          statusBox.style.lineHeight = '1.4';

          if (!currentFolder) {
            statusBox.innerHTML = `
              <div style="color: var(--accent); font-weight: 600;">단일 파일 모드</div>
              <div style="color: var(--fg-dim); font-size: 11px; margin-top: 2px;">
                모드 폴더를 열면 ini의 filename 구문에 적힌 리소스 파일의 존재 여부가 실시간으로 검사됩니다.
              </div>
            `;
            panel.append(statusBox);
            container.append(panel);
            return;
          }

          const folderName = currentFolder.split(/[\\/]/).filter(Boolean).pop() || currentFolder;
          statusBox.innerHTML = `
            <div style="font-weight: 600; color: var(--fg);">모드 폴더: <span style="color: var(--accent);">${folderName}</span></div>
            <div style="color: var(--fg-dim); font-size: 11px;">현재 파일: ${currentFile?.name || '없음'}</div>
          `;
          panel.append(statusBox);

          // 현재 에디터 내용에서 filename 목록 검사
          const text = context.editor.getText();
          const lines = text.split(/\r?\n/);
          const items: { line: number; path: string; exists: boolean }[] = [];

          for (let i = 0; i < lines.length; i++) {
            const { code } = stripComments(lines[i]);
            const m = /^\s*filename\s*=\s*(.+)$/i.exec(code);
            if (!m) continue;
            let target = m[1].trim();
            if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith("'") && target.endsWith("'"))) {
              target = target.slice(1, -1).trim();
            }
            if (!target) continue;

            const exists = await context.workspace.readDirectory().then((entries) => {
              const checkTree = (list: any[]): boolean => {
                const clean = target.replace(/\\/g, '/').toLowerCase();
                const bName = clean.split('/').pop() || clean;
                for (const e of list) {
                  const rel = (e.path || e.name).replace(/\\/g, '/').toLowerCase();
                  if (rel.endsWith(clean) || (!e.isDir && e.name.toLowerCase() === bName && !clean.includes('/'))) return true;
                  if (e.children && checkTree(e.children)) return true;
                }
                return false;
              };
              return checkTree(entries);
            }).catch(() => false);

            items.push({ line: i + 1, path: target, exists });
          }

          const missingCount = items.filter((x) => !x.exists).length;
          const okCount = items.length - missingCount;

          const summary = document.createElement('div');
          summary.style.display = 'flex';
          summary.style.gap = '8px';
          summary.style.fontSize = '11px';

          const okBadge = document.createElement('span');
          okBadge.style.color = '#10b981';
          okBadge.textContent = `정상: ${okCount}개`;

          const missBadge = document.createElement('span');
          missBadge.style.color = missingCount > 0 ? '#ef4444' : 'var(--fg-dim)';
          missBadge.style.fontWeight = missingCount > 0 ? '700' : 'normal';
          missBadge.textContent = `누락: ${missingCount}개`;

          summary.append(okBadge, missBadge);
          panel.append(summary);

          const list = document.createElement('div');
          list.style.display = 'flex';
          list.style.flexDirection = 'column';
          list.style.gap = '4px';
          list.style.maxHeight = 'calc(100vh - 250px)';
          list.style.overflowY = 'auto';

          if (items.length === 0) {
            const empty = document.createElement('div');
            empty.style.color = 'var(--fg-dim)';
            empty.style.padding = '12px 0';
            empty.style.textAlign = 'center';
            empty.textContent = '현재 ini 파일에 filename 구문이 없습니다.';
            list.append(empty);
          } else {
            items.forEach((item) => {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.alignItems = 'center';
              row.style.justifyContent = 'space-between';
              row.style.padding = '5px 8px';
              row.style.background = 'var(--bg-elev)';
              row.style.border = '1px solid var(--border)';
              row.style.borderRadius = '4px';
              row.style.cursor = 'pointer';
              row.title = `줄 ${item.line}로 이동`;
              row.onclick = () => {
                context.editor.setCursor(item.line, 1);
              };

              const left = document.createElement('div');
              left.style.overflow = 'hidden';
              left.style.textOverflow = 'ellipsis';
              left.style.whiteSpace = 'nowrap';
              left.innerHTML = `<span style="color: var(--accent); font-weight: 600; margin-right: 6px;">[L${item.line}]</span><span>${item.path}</span>`;

              const status = document.createElement('span');
              status.style.fontSize = '10px';
              status.style.padding = '1px 5px';
              status.style.borderRadius = '3px';
              status.style.flexShrink = '0';
              if (item.exists) {
                status.style.background = 'rgba(16, 185, 129, 0.15)';
                status.style.color = '#10b981';
                status.textContent = '존재함';
              } else {
                status.style.background = 'rgba(239, 68, 68, 0.15)';
                status.style.color = '#ef4444';
                status.textContent = '누락';
              }

              row.append(left, status);
              list.append(row);
            });
          }

          panel.append(list);
          container.append(panel);
        };

        renderPanel();
      },
    });
  },
});

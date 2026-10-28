import type { monaco } from '../editor/monaco.ts';
import { MarkerSeverity } from '../ini/lint.ts';

/**
 * 주석을 제거하고 유효 코드 문자열을 반환합니다.
 */
function stripComments(line: string): string {
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ';' || (ch === '/' && line[i + 1] === '/')) {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

export interface TextModelLike {
  getLineCount(): number;
  getLineContent(lineNumber: number): string;
}

/**
 * 모드 리소스 파일 실재성 검사:
 * filename = ... 구문에서 지정된 파일이 모드 폴더 내에 실제로 존재하는지 검사합니다.
 */
export async function checkResourceFileExistence(
  model: TextModelLike,
  fileExists: (relativePath: string) => Promise<boolean>,
): Promise<monaco.editor.IMarkerData[]> {
  const markers: monaco.editor.IMarkerData[] = [];
  const count = model.getLineCount();

  for (let line = 1; line <= count; line++) {
    const raw = model.getLineContent(line);
    const code = stripComments(raw);
    const trimmed = code.trim();
    if (!trimmed) continue;

    const match = /^\s*filename\s*=\s*(.+)$/i.exec(code);
    if (!match) continue;

    let target = match[1].trim();
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1).trim();
    }

    if (!target) continue;

    try {
      const exists = await fileExists(target);
      if (!exists) {
        const rawIdx = raw.indexOf(match[1]);
        const startCol = rawIdx !== -1 ? rawIdx + 1 : 1;
        const endCol = startCol + match[1].length;

        markers.push({
          severity: MarkerSeverity.Warning,
          message: `참조된 파일 "${target}"을(를) 모드 폴더에서 찾을 수 없습니다. (파일명 및 확장자 확인 필요)`,
          startLineNumber: line,
          startColumn: startCol,
          endLineNumber: line,
          endColumn: endCol,
        });
      }
    } catch {}
  }

  return markers;
}

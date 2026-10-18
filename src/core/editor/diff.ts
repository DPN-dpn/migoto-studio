/**
 * Line-by-line Diff Algorithm using LCS (Longest Common Subsequence)
 * Fast, reliable, and generates standard hunk modifications, insertions, and deletions.
 */

export interface DiffHunk {
  originalStart: number; // 1-indexed line
  originalLines: string[];
  modifiedStart: number; // 1-indexed line
  modifiedLines: string[];
}

export function computeLineDiff(originalText: string, modifiedText: string): DiffHunk[] {
  // Quick optimization: identical strings
  if (originalText === modifiedText) return [];

  const orig = originalText.split(/\r?\n/);
  const mod = modifiedText.split(/\r?\n/);

  const n = orig.length;
  const m = mod.length;

  // Trim common prefix
  let prefixCount = 0;
  while (prefixCount < n && prefixCount < m && orig[prefixCount] === mod[prefixCount]) {
    prefixCount++;
  }

  // Trim common suffix
  let suffixCount = 0;
  while (
    suffixCount < (n - prefixCount) &&
    suffixCount < (m - prefixCount) &&
    orig[n - 1 - suffixCount] === mod[m - 1 - suffixCount]
  ) {
    suffixCount++;
  }

  const trimmedOrig = orig.slice(prefixCount, n - suffixCount);
  const trimmedMod = mod.slice(prefixCount, m - suffixCount);

  type EditOp = {
    type: 'keep' | 'delete' | 'insert';
    origLine?: string;
    modLine?: string;
    origIdx: number;
    modIdx: number;
  };

  const ops: EditOp[] = [];

  // Prefix keeps
  for (let k = 0; k < prefixCount; k++) {
    ops.push({ type: 'keep', origLine: orig[k], origIdx: k, modIdx: k });
  }

  // LCS on trimmed middle
  const tN = trimmedOrig.length;
  const tM = trimmedMod.length;

  if (tN > 0 || tM > 0) {
    const dp = Array.from({ length: tN + 1 }, () => new Int32Array(tM + 1));
    for (let i = 0; i < tN; i++) {
      for (let j = 0; j < tM; j++) {
        if (trimmedOrig[i] === trimmedMod[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = tN;
    let j = tM;
    const middleOps: EditOp[] = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && trimmedOrig[i - 1] === trimmedMod[j - 1]) {
        middleOps.unshift({
          type: 'keep',
          origLine: trimmedOrig[i - 1],
          origIdx: prefixCount + i - 1,
          modIdx: prefixCount + j - 1,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        middleOps.unshift({
          type: 'insert',
          modLine: trimmedMod[j - 1],
          origIdx: prefixCount + i,
          modIdx: prefixCount + j - 1,
        });
        j--;
      } else {
        middleOps.unshift({
          type: 'delete',
          origLine: trimmedOrig[i - 1],
          origIdx: prefixCount + i - 1,
          modIdx: prefixCount + j,
        });
        i--;
      }
    }
    ops.push(...middleOps);
  }

  // Suffix keeps
  for (let k = 0; k < suffixCount; k++) {
    const origIdx = n - suffixCount + k;
    const modIdx = m - suffixCount + k;
    ops.push({ type: 'keep', origLine: orig[origIdx], origIdx, modIdx });
  }

  // Group contiguous delete & insert ops into hunks
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;

  for (const op of ops) {
    if (op.type === 'keep') {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    } else {
      if (!currentHunk) {
        currentHunk = {
          originalStart: op.origIdx + 1,
          originalLines: [],
          modifiedStart: op.modIdx + 1,
          modifiedLines: [],
        };
      }
      if (op.type === 'delete') {
        currentHunk.originalLines.push(op.origLine ?? '');
      } else if (op.type === 'insert') {
        currentHunk.modifiedLines.push(op.modLine ?? '');
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

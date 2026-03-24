/**
 * Simple line-level diff: returns line numbers (1-indexed) in `newText`
 * that are different from `oldText`.
 */
export function getChangedLines(oldText: string, newText: string): number[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const changed: number[] = [];

  // Use LCS-based approach for better diff quality
  const lcs = computeLCS(oldLines, newLines);
  const oldInLCS = new Set<number>();
  const newInLCS = new Set<number>();

  for (const [oi, ni] of lcs) {
    oldInLCS.add(oi);
    newInLCS.add(ni);
  }

  // Any line in newLines not part of the LCS is "changed" (added or modified)
  for (let i = 0; i < newLines.length; i++) {
    if (!newInLCS.has(i)) {
      changed.push(i + 1); // 1-indexed
    }
  }

  return changed;
}

/**
 * Compute Longest Common Subsequence of two string arrays.
 * Returns pairs of [oldIndex, newIndex] that match.
 */
function computeLCS(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;

  // For very large files, fall back to simple line-by-line comparison
  if (m * n > 1_000_000) {
    return simpleLCS(a, b);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result: [number, number][] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result.reverse();
}

/**
 * Fallback for large files: simple greedy matching.
 */
function simpleLCS(a: string[], b: string[]): [number, number][] {
  const result: [number, number][] = [];
  let j = 0;
  for (let i = 0; i < a.length && j < b.length; i++) {
    while (j < b.length) {
      if (a[i] === b[j]) {
        result.push([i, j]);
        j++;
        break;
      }
      j++;
    }
  }
  return result;
}

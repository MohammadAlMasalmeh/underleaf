export interface MathBlock {
  math: string;
  displayMode: boolean;
  line: number;
  context: string; // surrounding text for label
}

/**
 * Extract all math environments from LaTeX source.
 * Handles: inline $...$, display $$...$$, \begin{equation}...\end{equation},
 * \begin{align}...\end{align}, \begin{gather}...\end{gather}, etc.
 */
export function extractMath(source: string): MathBlock[] {
  const blocks: MathBlock[] = [];
  const lines = source.split("\n");

  // Track which character offsets we've already matched (to avoid inline $ matching inside $$)
  const matched = new Set<number>();

  // 1. Display math: $$...$$
  const displayDollar = /\$\$([\s\S]*?)\$\$/g;
  let m: RegExpExecArray | null;
  while ((m = displayDollar.exec(source)) !== null) {
    const line = lineNumberAt(source, m.index);
    for (let i = m.index; i < m.index + m[0].length; i++) matched.add(i);
    blocks.push({
      math: m[1].trim(),
      displayMode: true,
      line,
      context: getContext(lines, line),
    });
  }

  // 2. Environment blocks: \begin{equation}...\end{equation}, align, gather, etc.
  const envPattern =
    /\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}([\s\S]*?)\\end\{\1\*?\}/g;
  while ((m = envPattern.exec(source)) !== null) {
    const line = lineNumberAt(source, m.index);
    for (let i = m.index; i < m.index + m[0].length; i++) matched.add(i);
    blocks.push({
      math: m[2].trim(),
      displayMode: true,
      line,
      context: getContext(lines, line),
    });
  }

  // 3. Inline math: $...$  (skip already-matched regions)
  const inlineDollar = /\$((?!\$)(?:[^$\\]|\\.)+)\$/g;
  while ((m = inlineDollar.exec(source)) !== null) {
    if (matched.has(m.index)) continue;
    const line = lineNumberAt(source, m.index);
    blocks.push({
      math: m[1].trim(),
      displayMode: false,
      line,
      context: getContext(lines, line),
    });
  }

  // Sort by position in document
  blocks.sort((a, b) => a.line - b.line);
  return blocks;
}

function lineNumberAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

function getContext(lines: string[], line: number): string {
  // Return the line itself (1-indexed)
  const idx = line - 1;
  if (idx >= 0 && idx < lines.length) {
    return lines[idx].trim();
  }
  return "";
}

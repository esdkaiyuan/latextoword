export type SourceKind = 'text' | 'markdown' | 'latex' | 'html' | 'structured' | 'project';
export type ImportedFormula = { latex: string; displayMode: 'inline' | 'block'; sourceLine: number; sourceColumn: number };
export type ImportWarning = { message: string; line: number; column: number };
export type ImportResult = { items: ImportedFormula[]; warnings: ImportWarning[] };

type Delimiter = { open: string; close: string; displayMode: 'inline' | 'block' };
const DELIMITERS: Delimiter[] = [
  { open: '$$', close: '$$', displayMode: 'block' }, { open: '\\[', close: '\\]', displayMode: 'block' },
  { open: '\\(', close: '\\)', displayMode: 'inline' }, { open: '$', close: '$', displayMode: 'inline' }
];
const ENVIRONMENTS = ['equation', 'equation*', 'displaymath', 'align', 'align*', 'aligned', 'gather', 'gather*', 'gathered', 'multline', 'multline*', 'split', 'cases', 'array', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix'];
const MATH_FENCE_LANGUAGES = new Set(['math', 'latex', 'tex', 'katex']);

export function sourceKindForFileName(fileName: string): SourceKind {
  const lower = fileName.toLowerCase();
  if (/\.(ltw|json)$/.test(lower)) return 'project';
  if (/\.(csv|tsv)$/.test(lower)) return 'structured';
  if (/\.(md|markdown|mdown|mkdn|mdx|qmd|rmd)$/.test(lower)) return 'markdown';
  if (/\.(rst|org|py|r|m|jl|sage)$/.test(lower)) return 'structured';
  if (/\.(tex|latex|ltx)$/.test(lower)) return 'latex';
  if (/\.(html?|xhtml)$/.test(lower)) return 'html';
  return 'text';
}

/** 把 HTML 降级成纯文本再交给数学扫描：去脚本样式与标签，块级标签换行。 */
export function stripHtml(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/(?:p|div|section|article|h[1-6]|li|tr|table|pre|blockquote)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function lineColumn(source: string, index: number): { line: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
}

function isEscaped(source: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function maskRange(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
}

function maskInlineCode(chars: string[]): void {
  const source = chars.join('');
  for (const match of source.matchAll(/`+[^`\n]+`+/g)) maskRange(chars, match.index ?? 0, (match.index ?? 0) + match[0].length);
}

function maskHtmlComments(chars: string[]): void {
  const source = chars.join('');
  for (const match of source.matchAll(/<!--[\s\S]*?-->/g)) maskRange(chars, match.index ?? 0, (match.index ?? 0) + match[0].length);
}

function maskLatexComments(chars: string[]): void {
  const source = chars.join('');
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] !== '%' || isEscaped(source, index)) continue;
    const end = chars.indexOf('\n', index);
    maskRange(chars, index, end < 0 ? chars.length : end);
    index = end < 0 ? chars.length : end;
  }
}

function removeLatexComments(source: string): string {
  const chars = source.split('');
  maskLatexComments(chars);
  return chars.join('');
}

function maskMarkdownSyntax(source: string, result: ImportResult): { masked: string; fenced: ImportedFormula[] } {
  const chars = source.split('');
  maskHtmlComments(chars);
  const fenced: ImportedFormula[] = [];
  const lines = source.split(/\n/);
  let offset = 0;
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)?.*$/);
    if (fence) {
      const marker = fence[1][0];
      const length = fence[1].length;
      let closeLine = lineIndex + 1;
      while (closeLine < lines.length && !new RegExp(`^\\s*${marker}{${length},}\\s*$`).test(lines[closeLine])) closeLine += 1;
      const endLine = closeLine < lines.length ? closeLine : lines.length - 1;
      const language = (fence[2] ?? '').toLowerCase();
      if (MATH_FENCE_LANGUAGES.has(language) && closeLine < lines.length) {
        const content = lines.slice(lineIndex + 1, closeLine).join('\n').trim();
        if (content) {
          const contentStart = offset + line.length + 1;
          const position = lineColumn(source, contentStart);
          fenced.push({ latex: content, displayMode: 'block', sourceLine: position.line, sourceColumn: position.column });
        }
      } else if (closeLine >= lines.length) {
        result.warnings.push({ message: '未闭合的 Markdown 代码围栏', ...lineColumn(source, offset) });
      }
      let endOffset = offset + line.length;
      for (let cursor = lineIndex + 1; cursor <= endLine; cursor += 1) endOffset += 1 + lines[cursor].length;
      maskRange(chars, offset, endOffset);
      offset = endOffset + (endLine < lines.length - 1 ? 1 : 0);
      lineIndex = endLine + 1;
      continue;
    }
    if (/^(?: {4}|\t)\S/.test(line)) maskRange(chars, offset, offset + line.length);
    offset += line.length + 1;
    lineIndex += 1;
  }
  maskInlineCode(chars);
  return { masked: chars.join(''), fenced };
}

function findClosing(source: string, start: number, delimiter: Delimiter): number {
  for (let index = start; index < source.length; index += 1) {
    if (!source.startsWith(delimiter.close, index) || isEscaped(source, index)) continue;
    if (delimiter.close !== '$') return index;
    const next = source[index + 1] ?? '';
    if (/[A-Za-z0-9]/.test(next)) continue;
    return index;
  }
  return -1;
}

function scanDelimited(source: string, result: ImportResult): void {
  let index = 0;
  while (index < source.length) {
    if (source[index] === '\\' && source[index + 1] === '$') {
      const literalEnd = source.indexOf('$', index + 2);
      index = literalEnd < 0 ? index + 2 : literalEnd + 1;
      continue;
    }
    const delimiter = DELIMITERS.find((candidate) => source.startsWith(candidate.open, index) && !isEscaped(source, index));
    if (!delimiter) { index += 1; continue; }
    if (delimiter.open === '$' && /\d/.test(source[index + 1] ?? '')) { index += 1; continue; }
    const start = index;
    const bodyStart = index + delimiter.open.length;
    const end = findClosing(source, bodyStart, delimiter);
    if (end < 0) {
      if (delimiter.open !== '$' || !/\d/.test(source[bodyStart] ?? '')) result.warnings.push({ message: `未闭合的数学分隔符 ${delimiter.open}`, ...lineColumn(source, start) });
      index = bodyStart;
      continue;
    }
    const latex = source.slice(bodyStart, end).trim();
    if (latex) {
      const position = lineColumn(source, start);
      result.items.push({ latex, displayMode: delimiter.displayMode, sourceLine: position.line, sourceColumn: position.column });
    }
    index = end + delimiter.close.length;
  }
}

function findEnvironmentMatches(source: string): Array<{ start: number; end: number; latex: string }> {
  const matches: Array<{ start: number; end: number; latex: string }> = [];
  for (const environment of ENVIRONMENTS) {
    const escaped = environment.replace('*', '\\*');
    const pattern = new RegExp(String.raw`\\begin\{${escaped}\}([\s\S]*?)\\end\{${escaped}\}`, 'g');
    for (const match of source.matchAll(pattern)) matches.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, latex: match[1].trim() });
  }
  return matches.sort((a, b) => a.start - b.start || b.end - a.end);
}

function scanEnvironments(source: string, result: ImportResult): Array<{ start: number; end: number }> {
  const accepted: Array<{ start: number; end: number }> = [];
  for (const match of findEnvironmentMatches(source)) {
    if (!match.latex || accepted.some((span) => match.start >= span.start && match.end <= span.end)) continue;
    accepted.push({ start: match.start, end: match.end });
    const position = lineColumn(source, match.start);
    result.items.push({ latex: match.latex, displayMode: 'block', sourceLine: position.line, sourceColumn: position.column });
  }
  return accepted;
}

function maskRanges(source: string, ranges: Array<{ start: number; end: number }>): string {
  const chars = source.split('');
  for (const range of ranges) maskRange(chars, range.start, range.end);
  return chars.join('');
}

export function scanMathSource(source: string, kind: SourceKind): ImportResult {
  const result: ImportResult = { items: [], warnings: [] };
  if (kind === 'project') return result;
  const normalizedSource = kind === 'latex' ? removeLatexComments(source) : kind === 'html' ? stripHtml(source) : source;
  const markdown = kind === 'markdown' || kind === 'html'
    ? maskMarkdownSyntax(normalizedSource, result)
    : { masked: normalizedSource, fenced: [] as ImportedFormula[] };
  result.items.push(...markdown.fenced);
  const environments = scanEnvironments(markdown.masked, result);
  scanDelimited(maskRanges(markdown.masked, environments), result);
  result.items.sort((a, b) => a.sourceLine - b.sourceLine || a.sourceColumn - b.sourceColumn);
  const unique = new Set<string>();
  result.items = result.items.filter((item) => {
    const key = `${item.displayMode}:${item.latex}`;
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  });
  if (kind === 'text' && result.items.length === 0) source.split(/\r?\n/).forEach((line, index) => {
    const latex = line.trim();
    if (latex) result.items.push({ latex, displayMode: 'block', sourceLine: index + 1, sourceColumn: line.indexOf(latex) + 1 });
  });
  return result;
}

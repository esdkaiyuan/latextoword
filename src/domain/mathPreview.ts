import katex from 'katex';

export type PreviewResult =
  | { ok: true; html: string; mathml: string }
  | { ok: false; message: string; position: number | null; html: string; mathml: string };

/** KaTeX 的 ParseError 带有出错字符偏移，供编辑器做行内标记。 */
function errorPosition(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const position = (error as { position?: unknown }).position;
  return typeof position === 'number' && Number.isFinite(position) ? position : null;
}

export function getFormulaScale(latex: string, targetLength = 42): number {
  const length = latex.replace(/\s/g, '').length;
  const commandWeight = (latex.match(/\\[A-Za-z]+/g) ?? []).length * 3;
  const environmentWeight = /\\begin\{|\\end\{/.test(latex) ? 24 : 0;
  const complexity = length + commandWeight + environmentWeight;
  return Math.max(0.55, Math.min(1, targetLength / Math.max(targetLength, complexity)));
}

export function renderLatex(latex: string, displayMode: 'inline' | 'block', macros: Record<string, string> = {}): PreviewResult {
  try {
    const options = { displayMode: displayMode === 'block', throwOnError: true, output: 'htmlAndMathml' as const, macros };
    const html = katex.renderToString(latex, options);
    const mathml = katex.renderToString(latex, { ...options, output: 'mathml' });
    return { ok: true, html, mathml };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '无法解析公式', position: errorPosition(error), html: '', mathml: '' };
  }
}

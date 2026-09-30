import { describe, expect, it } from 'vitest';
import { scanMathSource, sourceKindForFileName } from '../src/domain/batchImport';

describe('batch math import', () => {
  it('extracts display, inline, and environment formulas with source positions', () => {
    const source = ['x=$a+b$', '$$\\frac{1}{2}$$', '\\begin{equation}E=mc^2\\end{equation}'].join('\n');
    const result = scanMathSource(source, 'markdown');

    expect(result.items.map((item) => item.latex)).toEqual(['a+b', '\\frac{1}{2}', 'E=mc^2']);
    expect(result.items[0].displayMode).toBe('inline');
    expect(result.items[1].displayMode).toBe('block');
    expect(result.items[2].sourceLine).toBe(3);
  });

  it('ignores escaped dollar signs and fenced code in markdown', () => {
    const source = ['text \\$not-math$', '```js', '$ignored$', '```', '$kept$'].join('\n');
    const result = scanMathSource(source, 'markdown');

    expect(result.items.map((item) => item.latex)).toEqual(['kept']);
  });

  it('reports unmatched delimiters without discarding valid formulas', () => {
    const result = scanMathSource('$ok$ and $broken', 'text');

    expect(result.items).toHaveLength(1);
    expect(result.warnings[0].message).toMatch(/未闭合/);
  });

  it('imports fenced math blocks but ignores ordinary code fences', () => {
    const source = ['```math', '\\int_0^1 x^2 dx', '```', '```js', 'const price = "$5";', '```'].join('\n');
    const result = scanMathSource(source, 'markdown');

    expect(result.items.map((item) => item.latex)).toEqual(['\\int_0^1 x^2 dx']);
    expect(result.items[0].sourceLine).toBe(2);
  });

  it('supports tilde fences, escaped delimiters, and avoids currency false positives', () => {
    const source = ['~~~latex', '\\sum_{i=1}^{n} i', '~~~', 'Price is $5 and tax is $2.', 'Escaped \\$not-math$ but $x+y$ is math.'].join('\n');
    const result = scanMathSource(source, 'markdown');

    expect(result.items.map((item) => item.latex)).toEqual(['\\sum_{i=1}^{n} i', 'x+y']);
  });

  it('extracts aligned environments once and preserves their source line', () => {
    const source = ['text', '\\begin{align*}', 'a &= b + c \\\\', 'd &= e + f', '\\end{align*}'].join('\n');
    const result = scanMathSource(source, 'latex');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].latex).toContain('a &= b + c');
    expect(result.items[0].displayMode).toBe('block');
    expect(result.items[0].sourceLine).toBe(2);
  });

  it('maps Markdown and LaTeX filename extensions to the correct parser', () => {
    expect(sourceKindForFileName('notes.markdown')).toBe('markdown');
    expect(sourceKindForFileName('chapter.mdown')).toBe('markdown');
    expect(sourceKindForFileName('paper.latex')).toBe('latex');
    expect(sourceKindForFileName('formulas.txt')).toBe('text');
  });

  it('ignores Markdown HTML comments and LaTeX percent comments', () => {
    const markdown = scanMathSource('<!-- $hidden$ -->\n$visible$', 'markdown');
    const latex = scanMathSource('% $hidden$\n$visible$', 'latex');

    expect(markdown.items.map((item) => item.latex)).toEqual(['visible']);
    expect(latex.items.map((item) => item.latex)).toEqual(['visible']);
  });

  it('strips html markup and scripts before scanning math', () => {
    const source = [
      '<html><head><style>$not-math$</style><script>var a = "$no$";</script></head>',
      '<body><p>Euler: $e^{i\\pi}+1=0$</p>',
      '<div>\\begin{equation}a^2+b^2=c^2\\end{equation}</div>',
      '</body></html>'
    ].join('\n');

    const result = scanMathSource(source, 'html');

    expect(result.items.map((item) => item.latex)).toEqual(['e^{i\\pi}+1=0', 'a^2+b^2=c^2']);
    expect(result.items.every((item) => item.displayMode === 'block' || item.displayMode === 'inline')).toBe(true);
  });

  it('maps the extended file formats to the right parsers', () => {
    expect(sourceKindForFileName('notes.md')).toBe('markdown');
    expect(sourceKindForFileName('paper.tex')).toBe('latex');
    expect(sourceKindForFileName('page.html')).toBe('html');
    expect(sourceKindForFileName('page.htm')).toBe('html');
    expect(sourceKindForFileName('backup.ltw')).toBe('project');
    expect(sourceKindForFileName('data.json')).toBe('project');
    expect(sourceKindForFileName('formulas.txt')).toBe('text');
  });

  it('returns nothing for project files', () => {
    expect(scanMathSource('{"title":"x"}', 'project')).toEqual({ items: [], warnings: [] });
  });
});

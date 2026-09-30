import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFormulaSvg, inlineKatexFonts, sanitizeFileName, svgToDataUrl } from '../src/domain/imageExport';

const KATEX_CSS = readFileSync('node_modules/katex/dist/katex.min.css', 'utf8');

describe('image export', () => {
  it('inlines woff2 sources and drops unreachable woff/ttf fallbacks', () => {
    const result = inlineKatexFonts(KATEX_CSS, { 'KaTeX_Main-Regular.woff2': 'data:font/woff2;base64,AAA' });

    expect(result).toContain('url(data:font/woff2;base64,AAA)');
    expect(result).not.toMatch(/KaTeX_Main-Regular\.(woff|ttf)\)/);
    expect(result).toMatch(/src:url\(data:font\/woff2;base64,AAA\) format\("woff2"\)/);
  });

  it('leaves unknown fonts untouched', () => {
    const result = inlineKatexFonts('@font-face{src:url(fonts/Other.woff2) format("woff2")}', {});

    expect(result).toContain('url(fonts/Other.woff2)');
  });

  it('builds a self-contained svg sized to the formula plus padding', () => {
    const svg = buildFormulaSvg('<span class="katex">x</span>', '.katex{color:red}', { width: 100.4, height: 40.2, padding: 10 });

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="121" height="61"')).toBe(true);
    expect(svg).toContain('<foreignObject');
    expect(svg).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(svg).toContain('.katex{color:red}');
    expect(svg).toContain('<span class="katex">x</span>');
  });

  it('encodes svg as a data url', () => {
    expect(svgToDataUrl('<svg/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E');
  });

  it('strips characters that are illegal in file names', () => {
    expect(sanitizeFileName('a/b:c*d?')).toBe('abcd');
    expect(sanitizeFileName('   ')).toBe('formula');
  });
});

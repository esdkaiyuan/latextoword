import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getFormulaScale, renderLatex } from '../src/domain/mathPreview';

describe('math preview', () => {
  it('renders valid latex to MathML and visual markup', () => {
    const result = renderLatex('\\frac{a}{b}', 'block');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mathml).toContain('<math');
      expect(result.html).toContain('katex');
    }
  });

  it('applies selected fonts to ordinary glyphs without overriding KaTeX structure fonts', () => {
    const stylesheet = readFileSync('src/renderer/styles.css', 'utf8');

    expect(stylesheet).not.toContain('.formula-preview .katex, .formula-preview .katex *');
    expect(stylesheet).toMatch(/\.formula-preview \.katex\s*\{\s*font-family:\s*inherit !important/);
    expect(stylesheet).toMatch(/\.formula-preview \.katex \.mathnormal[^{]*\{\s*font-family:\s*inherit !important/);
    expect(stylesheet).toMatch(/\.formula-preview \.katex \.accent-body \.mord\s*\{\s*font-family:\s*KaTeX_Main !important/);
  });

  it('returns a positioned error for invalid latex', () => {
    const result = renderLatex('\\frac{a', 'inline');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it('reduces the display scale for long formulas', () => {
    expect(getFormulaScale('E=mc^2')).toBe(1);
    expect(getFormulaScale('\\begin{cases} f(x)=x^2 & x>0 \\\\ -x^2 & x<0 \\end{cases}')).toBeLessThan(1);
    expect(getFormulaScale('x'.repeat(200))).toBeGreaterThanOrEqual(0.55);
  });
});

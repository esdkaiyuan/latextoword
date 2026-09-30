import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { extractMathml, mathmlToLatex } from '../src/domain/mathmlToLatex';

function toMathml(latex: string): string {
  return katex.renderToString(latex, { displayMode: true, throwOnError: true, output: 'mathml' });
}

describe('mathml to latex (katex output)', () => {
  it('converts fractions and scripts', () => {
    expect(mathmlToLatex(toMathml('\\frac{a}{b}'))).toBe('\\frac{a}{b}');
    expect(mathmlToLatex(toMathml('x^2'))).toBe('{x}^{2}');
    expect(mathmlToLatex(toMathml('y_1'))).toBe('{y}_{1}');
    expect(mathmlToLatex(toMathml('a_b^c'))).toBe('{a}_{b}^{c}');
  });

  it('converts roots and n-ary operators', () => {
    expect(mathmlToLatex(toMathml('\\sqrt{x+1}'))).toBe('\\sqrt{x+1}');
    expect(mathmlToLatex(toMathml('\\sqrt[3]{x}'))).toBe('\\sqrt[3]{x}');
    expect(mathmlToLatex(toMathml('\\sum_{i=1}^{n}'))).toBe('\\sum_{i=1}^{n}');
    expect(mathmlToLatex(toMathml('\\int_0^1'))).toBe('\\int_{0}^{1}');
  });

  it('converts accents and overbars', () => {
    expect(mathmlToLatex(toMathml('\\bar{x}'))).toBe('\\bar{x}');
    expect(mathmlToLatex(toMathml('\\hat{x}'))).toBe('\\hat{x}');
    expect(mathmlToLatex(toMathml('\\vec{x}'))).toBe('\\vec{x}');
  });

  it('converts matrices with delimiters', () => {
    const latex = mathmlToLatex(toMathml('\\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix}'));

    expect(latex).toContain('\\left[');
    expect(latex).toContain('\\right]');
    expect(latex).toContain('\\begin{matrix}a & b \\\\ c & d\\end{matrix}');
  });

  it('maps operators and greek letters', () => {
    expect(mathmlToLatex(toMathml('a \\cdot b'))).toBe('a\\cdot b');
    expect(mathmlToLatex(toMathml('\\alpha'))).toBe('\\alpha');
  });
});

describe('mathml to latex (word clipboard output)', () => {
  const wordMatrix = [
    '<mml:math xmlns:mml="http://www.w3.org/1998/Math/MathML">',
    '<mml:mstyle displaystyle="true">',
    '<mml:mfenced open="{" close="}">',
    '<mml:mtable><mml:mtr><mml:mtd><mml:msup><mml:mi>x</mml:mi><mml:mn>2</mml:mn></mml:msup></mml:mtd>',
    '<mml:mtd><mml:mi>y</mml:mi></mml:mtd></mml:mtr></mml:mtable>',
    '</mml:mfenced></mml:mstyle></mml:math>'
  ].join('');

  it('understands prefixed word mathml with mfenced', () => {
    const latex = mathmlToLatex(wordMatrix);

    expect(latex).toContain('\\left\\{');
    expect(latex).toContain('\\right\\}');
    expect(latex).toContain('{x}^{2}');
    expect(latex).toContain(' & ');
  });

  it('converts limit constructs', () => {
    const mathml = '<mml:math><mml:munder><mml:mi>lim</mml:mi><mml:mrow><mml:mi>x</mml:mi><mml:mo>→</mml:mo><mml:mn>0</mml:mn></mml:mrow></mml:munder></mml:math>';

    expect(mathmlToLatex(mathml)).toBe('\\lim_{x\\to 0}');
  });

  it('extracts mathml from a word html clipboard fragment', () => {
    const html = `<html><body><!--StartFragment-->${wordMatrix}<!--EndFragment--></body></html>`;

    expect(extractMathml(html)).toBe(wordMatrix);
  });

  it('returns null when no mathml is present', () => {
    expect(extractMathml('<html><body>plain text</body></html>')).toBeNull();
  });
});

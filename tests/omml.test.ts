import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { mathmlToOmml } from '../src/domain/omml';
import { buildDocxParts } from '../src/domain/docx';

function toMathml(latex: string): string {
  return katex.renderToString(latex, { displayMode: true, throwOnError: true, output: 'mathml' });
}

describe('mathml to omml', () => {
  it('converts fractions', () => {
    const omml = mathmlToOmml(toMathml('\\frac{a}{b}'));

    expect(omml).toContain('<m:f>');
    expect(omml).toContain('<m:num>');
    expect(omml).toContain('<m:den>');
    expect(omml).toContain('>a<');
  });

  it('converts scripts', () => {
    const omml = mathmlToOmml(toMathml('x^2+y_1'));

    expect(omml).toContain('<m:sSup>');
    expect(omml).toContain('<m:sSub>');
  });

  it('converts n-ary operators with limits', () => {
    const omml = mathmlToOmml(toMathml('\\sum_{i=1}^{n}'));

    expect(omml).toContain('<m:nary>');
    expect(omml).toContain('∑');
    expect(omml).toContain('<m:sub>');
    expect(omml).toContain('<m:sup>');
  });

  it('converts roots', () => {
    expect(mathmlToOmml(toMathml('\\sqrt{x}'))).toContain('m:degHide m:val="1"');
    expect(mathmlToOmml(toMathml('\\sqrt[3]{x}'))).toContain('<m:deg>');
  });

  it('converts matrices and their fences into omml delimiters', () => {
    const omml = mathmlToOmml(toMathml('\\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix}'));

    expect(omml).toContain('<m:m>');
    expect(omml).toContain('<m:mr>');
    expect(omml).toContain('<m:d>');
    expect(omml).toContain('m:begChr m:val="["');
  });

  it('converts accents and overbars', () => {
    expect(mathmlToOmml(toMathml('\\hat{x}'))).toContain('<m:acc>');
    expect(mathmlToOmml(toMathml('\\bar{x}'))).toContain('m:pos m:val="top"');
  });

  it('escapes xml special characters', () => {
    const omml = mathmlToOmml(toMathml('a < b'));

    expect(omml).toContain('&lt;');
    expect(omml).not.toContain('>a < b<');
  });

  it('uses the requested math font', () => {
    expect(mathmlToOmml(toMathml('x'), 'STIX Two Math')).toContain('w:ascii="STIX Two Math"');
  });

  it('degrades gracefully instead of throwing', () => {
    expect(() => mathmlToOmml('<math xmlns="x"><mystery><mi>y</mi></mystery></math>')).not.toThrow();
    expect(mathmlToOmml('<math xmlns="x"><mystery><mi>y</mi></mystery></math>')).toContain('>y<');
    expect(mathmlToOmml('')).toBe('<m:oMath></m:oMath>');
  });
});

describe('docx package', () => {
  it('builds a minimal but complete ooxml package', () => {
    const parts = buildDocxParts('我的公式集', [
      { name: '质能方程', mathml: toMathml('E=mc^2'), displayMode: 'block', fontFamily: 'Cambria Math', fontSizePt: 14 }
    ]);

    expect(parts.map((part) => part.path)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
      'word/document.xml'
    ]);

    const document = parts.find((part) => part.path === 'word/document.xml')?.content ?? '';
    expect(document).toContain('xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"');
    expect(document).toContain('<m:oMathPara>');
    expect(document).toContain('质能方程');
    expect(document).toContain('我的公式集');
  });

  it('omits names when not requested', () => {
    const parts = buildDocxParts('标题', [
      { name: '动能', mathml: toMathml('E_k'), displayMode: 'inline', fontFamily: 'Cambria Math', fontSizePt: 12 }
    ], false);
    const document = parts.find((part) => part.path === 'word/document.xml')?.content ?? '';

    expect(document).not.toContain('动能');
    expect(document).not.toContain('<m:oMathPara>');
  });
});

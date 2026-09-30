import { describe, expect, it } from 'vitest';
import { MATH_SYMBOLS, MATH_TEMPLATES, SYMBOL_CATEGORIES } from '../src/domain/mathSymbols';

describe('math symbol palette', () => {
  it('contains categorized symbols with distinct visual style variants', () => {
    expect(SYMBOL_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(MATH_SYMBOLS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(MATH_SYMBOLS.map((symbol) => symbol.style)).size).toBeGreaterThanOrEqual(5);
    expect(MATH_SYMBOLS.every((symbol) => symbol.latex.length > 0 && symbol.label.length > 0)).toBe(true);
  });

  it('keeps palette ids unique and exposes insertion snippets', () => {
    const ids = MATH_SYMBOLS.map((symbol) => symbol.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MATH_SYMBOLS.find((symbol) => symbol.id === 'greek-alpha')?.insert).toBe('\\alpha ');
    expect(MATH_SYMBOLS.find((symbol) => symbol.id === 'operator-sum')?.category).toBe('运算符');
  });

  it('includes common composite math templates with editable placeholders', () => {
    expect(MATH_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(MATH_TEMPLATES.map((template) => template.id)).toEqual(expect.arrayContaining([
      'template-fraction', 'template-integral-limits', 'template-limit', 'template-sum-limits', 'template-matrix'
    ]));
    expect(MATH_TEMPLATES.every((template) => typeof template.caretOffset === 'number' && template.preview.length > 0)).toBe(true);
  });
});

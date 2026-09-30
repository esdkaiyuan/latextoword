import { describe, expect, it } from 'vitest';
import { createProject, mergeImportedFormulas, parseProject, reorderFormulas, updateFormula, type FormulaItem } from '../src/domain/project';

describe('project model', () => {
  it('creates a formula collection with a stable schema', () => {
    const project = createProject('科研公式');

    expect(project.schemaVersion).toBe(1);
    expect(project.title).toBe('科研公式');
    expect(project.defaults.fontSizePt).toBe(14);
  });

  it('starts with a full page of starter formulas across every category', () => {
    const project = createProject('科研公式');

    expect(project.formulas.length).toBeGreaterThanOrEqual(30);
    expect(new Set(project.formulas.map((formula) => formula.name)).size).toBe(project.formulas.length);
    expect(project.formulas.every((formula) => formula.latex.length > 0)).toBe(true);
    expect(project.formulas[0].name).toBe('二次方程');
  });

  it('rejects malformed project data at the file boundary', () => {
    expect(() => parseProject({ title: 'missing required fields' })).toThrow();
  });

  it('updates only the requested formula and its timestamp', () => {
    const project = createProject('科研公式');
    const updated = updateFormula(project, project.formulas[0].id, {
      name: '动能',
      latex: '\\frac{1}{2}mv^2'
    });

    expect(updated.formulas[0].name).toBe('动能');
    expect(updated.formulas[0].latex).toContain('mv^2');
    expect(updated.formulas[0].updatedAt).not.toBe(project.formulas[0].updatedAt);
  });

  it('merges imported formulas and skips duplicates or empty latex', () => {
    const base = createProject('科研公式');
    const addition = (latex: string): FormulaItem => ({
      id: `addition-${latex}`,
      name: latex,
      latex,
      displayMode: 'block',
      style: {},
      tags: [],
      createdAt: '',
      updatedAt: ''
    });

    const { project, added, skipped } = mergeImportedFormulas(base, [
      addition(base.formulas[0].latex),
      addition('x_1 + x_2 = 99'),
      addition('   ')
    ]);

    expect(added).toBe(1);
    expect(skipped).toBe(2);
    expect(project.formulas.at(-1)?.latex).toBe('x_1 + x_2 = 99');
  });

  it('reorders formulas by id and keeps the collection size', () => {
    const base = createProject('科研公式');
    const first = base.formulas[0].id;
    const last = base.formulas[base.formulas.length - 1].id;

    const moved = reorderFormulas(base, last, first);

    expect(moved.formulas).toHaveLength(base.formulas.length);
    expect(moved.formulas[0].id).toBe(last);
    expect(moved.formulas[1].id).toBe(first);
  });

  it('ignores unknown or identical reorder targets', () => {
    const base = createProject('科研公式');
    const first = base.formulas[0].id;

    expect(reorderFormulas(base, 'nope', first)).toBe(base);
    expect(reorderFormulas(base, first, first)).toBe(base);
  });
});

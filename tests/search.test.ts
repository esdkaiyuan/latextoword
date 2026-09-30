import { describe, expect, it } from 'vitest';
import { searchEverything, type SearchSources } from '../src/domain/search';

const sources: SearchSources = {
  project: [
    { id: 'p1', name: '动能', latex: '\\frac{1}{2}mv^2' },
    { id: 'p2', name: '质能方程', latex: 'E=mc^2' }
  ],
  library: [{ id: 'l1', name: '正态分布', latex: 'f(x)=\\frac{1}{\\sqrt{2\\pi}}', category: '概率统计' }],
  symbols: [
    { id: 's1', label: 'α', insert: '\\alpha ', category: '希腊字母' },
    { id: 's2', label: '∑', insert: '\\sum_{i=1}^{n} ', category: '运算符' }
  ],
  templates: [{ id: 't1', label: '分式', description: '分子 / 分母', insert: '\\frac{}{}', caretOffset: 6 }]
};

describe('global search', () => {
  it('finds formulas by name and by latex', () => {
    expect(searchEverything('动能', sources)[0].id).toBe('p1');
    expect(searchEverything('mc^2', sources)[0].id).toBe('p2');
  });

  it('ranks project formulas above library entries on the same match', () => {
    const hits = searchEverything('分式', sources);

    expect(hits[0].kind).toBe('template');
    expect(hits.map((hit) => hit.id)).toContain('t1');
  });

  it('ranks prefix matches above mid-string matches', () => {
    const hits = searchEverything('\\alpha', sources);

    expect(hits[0].id).toBe('s1');
    expect(hits[0].caretOffset).toBe('\\alpha '.length);
  });

  it('returns an empty list when nothing matches', () => {
    expect(searchEverything('zzzz', sources)).toEqual([]);
  });

  it('lists everything for an empty query, capped by the limit', () => {
    const hits = searchEverything('', sources, 3);

    expect(hits).toHaveLength(3);
    expect(hits[0].kind).toBe('project');
  });
});

export type SearchKind = 'project' | 'library' | 'symbol' | 'template';

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  latex: string;
  insert: string;
  caretOffset: number | null;
  score: number;
};

export type SearchSources = {
  project: Array<{ id: string; name: string; latex: string }>;
  library: Array<{ id: string; name: string; latex: string; category: string }>;
  symbols: Array<{ id: string; label: string; insert: string; category: string }>;
  templates: Array<{ id: string; label: string; description: string; insert: string; caretOffset: number }>;
};

const KIND_WEIGHT: Record<SearchKind, number> = { project: 9, library: 6, template: 4, symbol: 2 };

/** 位置越靠前得分越高；未命中返回 -1。 */
function matchScore(haystack: string, needle: string): number {
  if (!needle) return 50;
  const index = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return -1;
  return index === 0 ? 100 : Math.max(10, 70 - index);
}

/** 一段文本里取最高分，用于「名称或 LaTeX 任一命中即可」。 */
function bestScore(fields: string[], needle: string): number {
  let best = -1;
  for (const field of fields) best = Math.max(best, matchScore(field, needle));
  return best;
}

export function searchEverything(query: string, sources: SearchSources, limit = 24): SearchHit[] {
  const needle = query.trim();
  const hits: SearchHit[] = [];

  for (const formula of sources.project) {
    const score = bestScore([formula.name, formula.latex], needle);
    if (score < 0) continue;
    hits.push({ id: formula.id, kind: 'project', title: formula.name, subtitle: '当前项目', latex: formula.latex, insert: formula.latex, caretOffset: null, score: score + KIND_WEIGHT.project });
  }

  for (const item of sources.library) {
    const score = bestScore([item.name, item.latex, item.category], needle);
    if (score < 0) continue;
    hits.push({ id: item.id, kind: 'library', title: item.name, subtitle: item.category, latex: item.latex, insert: item.latex, caretOffset: null, score: score + KIND_WEIGHT.library });
  }

  for (const symbol of sources.symbols) {
    const score = bestScore([symbol.label, symbol.insert, symbol.category], needle);
    if (score < 0) continue;
    hits.push({ id: symbol.id, kind: 'symbol', title: symbol.label, subtitle: `${symbol.category} · ${symbol.insert.trim()}`, latex: symbol.insert, insert: symbol.insert, caretOffset: symbol.insert.length, score: score + KIND_WEIGHT.symbol });
  }

  for (const template of sources.templates) {
    const score = bestScore([template.label, template.description, template.insert], needle);
    if (score < 0) continue;
    hits.push({ id: template.id, kind: 'template', title: template.label, subtitle: template.description, latex: template.insert, insert: template.insert, caretOffset: template.caretOffset, score: score + KIND_WEIGHT.template });
  }

  return hits.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind)).slice(0, limit);
}

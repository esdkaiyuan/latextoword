import { z } from 'zod';
import { BUILT_IN_TEMPLATES, TEMPLATE_CATEGORIES } from './templates';

const FormulaStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontSizePt: z.number().min(6).max(96)
});

const FormulaItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  latex: z.string(),
  displayMode: z.enum(['inline', 'block']),
  style: FormulaStyleSchema.partial(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  defaults: FormulaStyleSchema,
  macros: z.record(z.string(), z.string()),
  formulas: z.array(FormulaItemSchema).min(1),
  updatedAt: z.string()
});

export type FormulaStyle = z.infer<typeof FormulaStyleSchema>;
export type FormulaItem = z.infer<typeof FormulaItemSchema>;
export type ProjectFile = z.infer<typeof ProjectSchema>;

const DEFAULT_STYLE: FormulaStyle = {
  fontFamily: 'Cambria Math',
  fontSizePt: 14
};

function createId(): string {
  return crypto.randomUUID();
}

const STARTER_PER_CATEGORY = 4;

/** 新建项目时铺一整页示例公式，每个分类取前几条，方便直接浏览与复用。 */
function starterFormulas(timestamp: string): FormulaItem[] {
  return TEMPLATE_CATEGORIES.flatMap((category) =>
    BUILT_IN_TEMPLATES.filter((template) => template.category === category).slice(0, STARTER_PER_CATEGORY)
  ).map((template) => ({
    id: createId(),
    name: template.name,
    latex: template.latex,
    displayMode: 'block' as const,
    style: {},
    tags: [...template.tags],
    createdAt: timestamp,
    updatedAt: timestamp
  }));
}

export function createProject(title = '未命名公式'): ProjectFile {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: createId(),
    title,
    defaults: { ...DEFAULT_STYLE },
    macros: {},
    formulas: starterFormulas(now),
    updatedAt: now
  };
}

export function parseProject(value: unknown): ProjectFile {
  return ProjectSchema.parse(value);
}

export function updateFormula(
  project: ProjectFile,
  formulaId: string,
  patch: Partial<Pick<FormulaItem, 'name' | 'latex' | 'displayMode' | 'style' | 'tags'>>
): ProjectFile {
  const nextTimestamp = Math.max(Date.now(), Date.parse(project.updatedAt) + 1);
  const now = new Date(nextTimestamp).toISOString();
  const formulas = project.formulas.map((formula) => formula.id === formulaId
    ? { ...formula, ...patch, updatedAt: now }
    : formula);
  if (formulas.every((formula) => formula.id !== formulaId)) {
    throw new Error(`公式不存在: ${formulaId}`);
  }
  return { ...project, formulas, updatedAt: now };
}

export function effectiveStyle(project: ProjectFile, formula: FormulaItem): FormulaStyle {
  return { ...project.defaults, ...formula.style };
}

/** 把公式拖到目标位置：源或目标不存在、或位置相同则原样返回。 */
export function reorderFormulas(project: ProjectFile, fromId: string, toId: string): ProjectFile {
  const formulas = [...project.formulas];
  const from = formulas.findIndex((formula) => formula.id === fromId);
  const to = formulas.findIndex((formula) => formula.id === toId);
  if (from < 0 || to < 0 || from === to) return project;
  const [moved] = formulas.splice(from, 1);
  formulas.splice(to, 0, moved);
  return { ...project, formulas, updatedAt: new Date().toISOString() };
}

/** 合并导入的公式：按 LaTeX 去重，空内容跳过，绝不产生重复项。 */
export function mergeImportedFormulas(project: ProjectFile, additions: FormulaItem[]): { project: ProjectFile; added: number; skipped: number } {
  const seen = new Set(project.formulas.map((formula) => formula.latex.trim()));
  const fresh: FormulaItem[] = [];
  let skipped = 0;
  for (const item of additions) {
    const key = item.latex.trim();
    if (!key || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    fresh.push(item);
  }
  if (!fresh.length) return { project, added: 0, skipped };
  return {
    project: { ...project, formulas: [...project.formulas, ...fresh], updatedAt: new Date().toISOString() },
    added: fresh.length,
    skipped
  };
}

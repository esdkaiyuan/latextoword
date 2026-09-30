import { ProjectSchema, type ProjectFile } from './project';

export const DRAFT_STORAGE_KEY = 'formula-workbench.draft';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DraftRecord = { savedAt: string; project: ProjectFile };

export function serializeDraft(project: ProjectFile, savedAt: string): string {
  return JSON.stringify({ savedAt, project });
}

/** 解析本地草稿；任何损坏、过期或不符合 schema 的数据一律返回 null，绝不抛错。 */
export function parseDraft(raw: string | null, now = Date.now()): DraftRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const { savedAt, project } = value as { savedAt?: unknown; project?: unknown };
    if (typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt))) return null;
    if (now - Date.parse(savedAt) > DRAFT_TTL_MS) return null;
    const parsed = ProjectSchema.safeParse(project);
    return parsed.success ? { savedAt, project: parsed.data } : null;
  } catch {
    return null;
  }
}

export function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

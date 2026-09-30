import { describe, expect, it } from 'vitest';
import { DRAFT_STORAGE_KEY, DRAFT_TTL_MS, formatSavedAt, parseDraft, serializeDraft } from '../src/domain/persistence';
import { createProject } from '../src/domain/project';

describe('draft persistence', () => {
  it('round-trips a project through the draft envelope', () => {
    const project = createProject('科研公式');
    const savedAt = new Date().toISOString();

    const record = parseDraft(serializeDraft(project, savedAt));

    expect(record?.project.title).toBe('科研公式');
    expect(record?.savedAt).toBe(savedAt);
    expect(DRAFT_STORAGE_KEY).toBe('formula-workbench.draft');
  });

  it('rejects malformed or stale drafts instead of throwing', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('not json')).toBeNull();
    expect(parseDraft('[]')).toBeNull();
    expect(parseDraft(JSON.stringify({ savedAt: 'nope', project: {} }))).toBeNull();
    expect(parseDraft(serializeDraft(createProject('x'), '2020-01-01T00:00:00.000Z'))).toBeNull();
  });

  it('keeps drafts that are still inside the retention window', () => {
    const project = createProject('窗口内');
    const savedAt = new Date(Date.now() - DRAFT_TTL_MS + 60_000).toISOString();

    expect(parseDraft(serializeDraft(project, savedAt), Date.now())?.project.title).toBe('窗口内');
  });

  it('formats a saved timestamp as HH:MM', () => {
    expect(formatSavedAt('2026-09-18T09:05:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    expect(formatSavedAt('invalid')).toBe('');
  });
});

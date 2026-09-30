import { describe, expect, it, vi } from 'vitest';
import { shouldCloseDocumentWorkspace } from '../src/domain/documentCloseGuard';

describe('unsaved document close guard', () => {
  it('allows a clean document to close without prompting', () => {
    const confirm = vi.fn(() => false);

    expect(shouldCloseDocumentWorkspace(false, confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before discarding edits', () => {
    expect(shouldCloseDocumentWorkspace(true, () => false)).toBe(false);
    expect(shouldCloseDocumentWorkspace(true, () => true)).toBe(true);
  });
});

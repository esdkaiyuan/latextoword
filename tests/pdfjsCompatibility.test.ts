import { describe, expect, it, vi } from 'vitest';
import { installMapGetOrInsertComputed, type MapWithGetOrInsertComputed } from '../src/renderer/pdfjsCompatibility';

describe('PDF.js Map compatibility', () => {
  it('computes and stores a value for a missing map key', () => {
    class OlderMap extends Map<unknown, unknown> {}
    installMapGetOrInsertComputed(OlderMap.prototype as MapWithGetOrInsertComputed);
    const map = new OlderMap() as MapWithGetOrInsertComputed;
    const compute = vi.fn((key: unknown) => `${String(key)}:ready`);

    expect(map.getOrInsertComputed?.('page', compute)).toBe('page:ready');
    expect(map.get('page')).toBe('page:ready');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('does not recompute an existing key even when its value is undefined', () => {
    class OlderMap extends Map<unknown, unknown> {}
    installMapGetOrInsertComputed(OlderMap.prototype as MapWithGetOrInsertComputed);
    const map = new OlderMap() as MapWithGetOrInsertComputed;
    const compute = vi.fn(() => 'unexpected');
    map.set('cached', undefined);

    expect(map.getOrInsertComputed?.('cached', compute)).toBeUndefined();
    expect(compute).not.toHaveBeenCalled();
  });
});

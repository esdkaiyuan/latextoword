export type MapWithGetOrInsertComputed = Map<unknown, unknown> & {
  getOrInsertComputed?: (key: unknown, callback: (key: unknown) => unknown) => unknown;
};

export function installMapGetOrInsertComputed(prototype: MapWithGetOrInsertComputed = Map.prototype as MapWithGetOrInsertComputed): void {
  if (typeof prototype.getOrInsertComputed === 'function') return;
  Object.defineProperty(prototype, 'getOrInsertComputed', {
    configurable: true,
    writable: true,
    value: function (this: Map<unknown, unknown>, key: unknown, callback: (key: unknown) => unknown) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    }
  });
}

installMapGetOrInsertComputed();

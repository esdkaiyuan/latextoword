import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createTrustedNavigationGuard } = require('../src/main/trustedNavigation.cjs') as {
  createTrustedNavigationGuard: (options: { isDev: boolean; appEntryPath: string; devOrigin?: string }) => (target: string) => boolean;
};

describe('trusted Electron renderer navigation', () => {
  it('allows the dev server origin but rejects navigation to other origins', () => {
    const isTrusted = createTrustedNavigationGuard({ isDev: true, appEntryPath: '', devOrigin: 'http://localhost:5173' });

    expect(isTrusted('http://localhost:5173/')).toBe(true);
    expect(isTrusted('https://example.com/')).toBe(false);
    expect(isTrusted('http://localhost:5174/')).toBe(false);
  });

  it('allows only the packaged renderer entry file', () => {
    const entryPath = path.resolve('D:/formula-app/dist-renderer/index.html');
    const isTrusted = createTrustedNavigationGuard({ isDev: false, appEntryPath: entryPath });

    expect(isTrusted(pathToFileURL(entryPath).href)).toBe(true);
    expect(isTrusted(pathToFileURL(path.resolve('D:/formula-app/other.html')).href)).toBe(false);
    expect(isTrusted('https://example.com/')).toBe(false);
  });
});

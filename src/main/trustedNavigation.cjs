const path = require('node:path');
const { fileURLToPath } = require('node:url');

function createTrustedNavigationGuard({ isDev, appEntryPath, devOrigin = 'http://localhost:5173' }) {
  const packagedEntry = path.resolve(appEntryPath || '.');
  return (target) => {
    try {
      const url = new URL(target);
      if (isDev) return url.origin === devOrigin && url.protocol === 'http:';
      return url.protocol === 'file:' && path.resolve(fileURLToPath(url)) === packagedEntry;
    } catch {
      return false;
    }
  };
}

module.exports = { createTrustedNavigationGuard };

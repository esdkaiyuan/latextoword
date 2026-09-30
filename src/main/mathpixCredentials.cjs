const path = require('node:path');
const fs = require('node:fs/promises');

function createCredentialStore(app, safeStorage) {
  const filePath = path.join(app.getPath('userData'), 'mathpix-credentials.bin');

  async function load() {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统加密存储不可用，无法安全读取 Mathpix 凭据');
    try {
      const encrypted = await fs.readFile(filePath);
      return JSON.parse(safeStorage.decryptString(encrypted));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new Error('Mathpix 凭据无法解密，请重新配置');
    }
  }

  async function save(input) {
    const appId = typeof input?.appId === 'string' ? input.appId.trim() : '';
    const appKey = typeof input?.appKey === 'string' ? input.appKey.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(appId) || appKey.length < 8 || appKey.length > 500) {
      throw new Error('app_id 或 app_key 格式无效');
    }
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统加密存储不可用，不能保存联网识别密钥');
    const encrypted = safeStorage.encryptString(JSON.stringify({ appId, appKey }));
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, encrypted);
    await fs.rename(temporaryPath, filePath);
  }

  async function remove() {
    await fs.rm(filePath, { force: true });
  }

  return { load, save, remove };
}

module.exports = { createCredentialStore };

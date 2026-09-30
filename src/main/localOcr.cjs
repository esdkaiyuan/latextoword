const path = require('node:path');
const fs = require('node:fs/promises');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const { ensureRuntime, environment, runtimePaths } = require('./downloadManager.cjs');

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_PDF_BYTES = 100 * 1024 * 1024;

function createLocalOcr(app, workerPath) {
  let worker;
  let startup;
  let setup;
  const pending = new Map();

  function emitProgress(onProgress, update) {
    for (const callback of onProgress) callback(update);
  }

  async function startWorker(onProgress) {
    if (worker && !worker.killed) return startup ?? worker;
    if (!setup) setup = ensureRuntime(app, path.join(path.dirname(workerPath), 'requirements.txt'), (update) => onProgress(update)).finally(() => { setup = null; });
    const paths = await setup;
    const child = spawn(paths.python, ['-u', workerPath], {
      cwd: path.dirname(workerPath), env: await environment(paths.root), windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    worker = child;
    startup = new Promise((resolve, reject) => {
      const output = readline.createInterface({ input: child.stdout });
      output.on('line', (line) => {
        let message;
        try { message = JSON.parse(line); } catch { return; }
        if (message.type === 'ready') resolve(child);
        if (message.type === 'progress') emitProgress(activeProgress, message);
        if (message.type === 'result' || message.type === 'error') {
          const task = pending.get(message.id);
          if (!task) return;
          pending.delete(message.id);
          if (message.type === 'error') task.reject(new Error(message.message || '离线 OCR 失败'));
          else task.resolve(message.text ?? '');
        }
      });
      child.stderr.on('data', () => emitProgress(activeProgress, { stage: '下载或载入本地 OCR 模型', percent: 0 }));
      child.once('error', reject);
      child.once('close', (code) => {
        if (worker === child) { worker = null; startup = null; }
        const reason = new Error(`本地 OCR worker 已退出（${code ?? '未知错误'}）`);
        reject(reason);
        for (const task of pending.values()) task.reject(reason);
        pending.clear();
      });
      setTimeout(() => reject(new Error('本地 OCR worker 启动超时')), 30_000).unref();
    });
    return startup;
  }

  const activeProgress = new Set();

  async function recognize(name, kind, inputBytes, onProgress = () => undefined) {
    const bytes = Buffer.from(inputBytes);
    const maxBytes = kind === 'pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (bytes.length === 0 || bytes.length > maxBytes) throw new Error(`本地 OCR 文件须小于 ${maxBytes / 1024 / 1024} MB`);
    if (kind !== 'pdf' && kind !== 'image') throw new Error('本地 OCR 输入类型不支持');
    activeProgress.add(onProgress);
    try {
      await startWorker(onProgress);
      const root = path.join(app.getPath('userData'), 'ocr-temp');
      const directory = path.join(root, crypto.randomUUID());
      await fs.mkdir(directory, { recursive: true });
      const ext = path.extname(name).toLowerCase().match(/^\.[a-z0-9]{1,8}$/)?.[0] ?? (kind === 'pdf' ? '.pdf' : '.png');
      const inputPath = path.join(directory, `input${ext}`);
      const id = crypto.randomUUID();
      try {
        await fs.writeFile(inputPath, bytes, { flag: 'wx' });
        return await new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          worker.stdin.write(`${JSON.stringify({ id, kind, path: inputPath })}\n`, (error) => {
            if (error) {
              pending.delete(id);
              reject(error);
            }
          });
        });
      } finally {
        await fs.rm(directory, { recursive: true, force: true });
      }
    } finally {
      activeProgress.delete(onProgress);
    }
  }

  async function status() {
    const paths = runtimePaths(app);
    try {
      await fs.access(paths.python);
      await new Promise((resolve, reject) => {
        const check = spawn(paths.python, ['-c', 'import pix2text'], { windowsHide: true, stdio: 'ignore' });
        check.once('error', reject);
        check.once('close', (code) => code === 0 ? resolve() : reject(new Error('Pix2Text 未安装')));
      });
      return { ready: true, downloading: false };
    } catch {
      return { ready: false, downloading: false };
    }
  }

  return { recognize, status };
}

module.exports = { createLocalOcr };

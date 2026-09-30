const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { unzipSync } = require('fflate');

function platformAsset() {
  const cpu = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  if (process.platform === 'win32') return `uv-${cpu}-pc-windows-msvc.zip`;
  if (process.platform === 'darwin') return `uv-${cpu}-apple-darwin.tar.gz`;
  if (process.platform === 'linux') return `uv-${cpu}-unknown-linux-gnu.tar.gz`;
  throw new Error('此系统暂不支持自动准备本地 OCR 运行时');
}

function findUv() {
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(command, ['uv'], { encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.split(/\r?\n/).find(Boolean) : null;
}

async function downloadVerified(asset, destination, onProgress) {
  if (!/^sha256:[a-f0-9]{64}$/i.test(asset.digest ?? '')) throw new Error('无法校验 uv 下载文件的官方 SHA-256，已中止安装');
  const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`下载 OCR 运行工具失败（HTTP ${response.status}）`);
  const bytes = Buffer.from(await response.arrayBuffer());
  onProgress({ stage: '下载 OCR 运行工具', percent: 65 });
  const digest = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  if (digest.toLowerCase() !== asset.digest.toLowerCase()) throw new Error('uv 下载文件校验失败');
  await fs.writeFile(destination, bytes);
  return bytes;
}

async function downloadUv(root, onProgress) {
  const assetName = platformAsset();
  onProgress({ stage: '查找本地 OCR 运行工具', percent: 2 });
  const response = await fetch('https://api.github.com/repos/astral-sh/uv/releases/latest', {
    headers: { 'user-agent': 'latex-to-word-workbench' }, signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`无法获取 OCR 运行工具版本（HTTP ${response.status}）`);
  const release = await response.json();
  const asset = release.assets?.find((item) => item.name === assetName);
  if (!asset) throw new Error(`未找到 ${process.platform}/${process.arch} 对应的 OCR 运行工具`);
  await fs.mkdir(root, { recursive: true });
  const archivePath = path.join(root, assetName);
  const bytes = await downloadVerified(asset, archivePath, onProgress);
  if (assetName.endsWith('.zip')) {
    const files = unzipSync(new Uint8Array(bytes));
    const executable = Object.entries(files).find(([name]) => /(^|\/)uv\.exe$/i.test(name))?.[1];
    if (!executable) throw new Error('uv 压缩包中未找到可执行文件');
    const output = path.join(root, 'uv.exe');
    await fs.writeFile(output, executable);
    return output;
  }
  const list = spawnSync('tar', ['-tzf', archivePath], { encoding: 'utf8', windowsHide: true });
  if (list.status !== 0 || list.stdout.split(/\r?\n/).some((name) => name.startsWith('/') || name.split('/').includes('..'))) {
    throw new Error('uv 压缩包包含无效路径，已中止安装');
  }
  const extractDir = path.join(root, 'extract');
  await fs.mkdir(extractDir, { recursive: true });
  const extracted = spawnSync('tar', ['-xzf', archivePath, '-C', extractDir, '--strip-components=1'], { encoding: 'utf8', windowsHide: true });
  if (extracted.status !== 0) throw new Error('无法展开 OCR 运行工具');
  const executable = path.join(extractDir, 'uv');
  await fs.chmod(executable, 0o755);
  return executable;
}

function run(executable, args, options, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd, env: options.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-8000);
      onProgress?.({ stage: '安装离线 OCR 运行环境', percent: null });
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(output) : reject(new Error(`离线 OCR 环境安装失败（${code}）：${output.slice(-900)}`)));
  });
}

function runtimePaths(app) {
  const root = path.join(app.getPath('userData'), 'ocr-runtime');
  const env = path.join(root, 'venv');
  const python = process.platform === 'win32' ? path.join(env, 'Scripts', 'python.exe') : path.join(env, 'bin', 'python');
  return { root, env, python, uvRoot: path.join(root, 'tools') };
}

async function environment(root) {
  const modelHome = path.join(root, 'models');
  await fs.mkdir(modelHome, { recursive: true });
  const modelReadyFile = path.join(modelHome, 'models-ready.json');
  const modelReady = await fs.access(modelReadyFile).then(() => true).catch(() => false);
  return {
    ...process.env,
    UV_PYTHON_INSTALL_DIR: path.join(root, 'python'),
    UV_CACHE_DIR: path.join(root, 'cache'),
    UV_PYTHON_PREFERENCE: 'only-managed',
    HF_HOME: path.join(modelHome, 'huggingface'),
    HF_HUB_OFFLINE: modelReady ? '1' : '0',
    FORMULA_WORKBENCH_MODEL_READY: modelReadyFile,
    HOME: modelHome,
    USERPROFILE: modelHome,
    PYTHONUTF8: '1',
    PYTHONNOUSERSITE: '1',
    TOKENIZERS_PARALLELISM: 'false',
    CUDA_VISIBLE_DEVICES: ''
  };
}

async function ensureRuntime(app, requirementsPath, onProgress = () => undefined) {
  const paths = runtimePaths(app);
  try {
    await fs.access(paths.python);
    await run(paths.python, ['-c', 'import pix2text'], { cwd: paths.root, env: await environment(paths.root) });
    return paths;
  } catch { /* Setup resumes from cached uv/Python/packages below. */ }

  const uv = findUv() ?? await downloadUv(paths.uvRoot, onProgress);
  const env = await environment(paths.root);
  await fs.mkdir(paths.root, { recursive: true });
  onProgress({ stage: '自动下载 Python 3.12', percent: 10 });
  await run(uv, ['python', 'install', '3.12', '--install-dir', path.join(paths.root, 'python')], { cwd: paths.root, env }, onProgress);
  onProgress({ stage: '准备本地隔离环境', percent: 30 });
  await run(uv, ['venv', '--managed-python', '--python', '3.12', paths.env], { cwd: paths.root, env }, onProgress);
  onProgress({ stage: '下载 CPU 版 OCR 依赖', percent: 40 });
  await run(uv, ['pip', 'install', '--python', paths.python, '--index-url', 'https://download.pytorch.org/whl/cpu', '--extra-index-url', 'https://pypi.org/simple', 'torch', 'torchvision'], { cwd: paths.root, env }, onProgress);
  onProgress({ stage: '安装 Pix2Text', percent: 65 });
  await run(uv, ['pip', 'install', '--python', paths.python, '--index-url', 'https://pypi.org/simple', '-r', requirementsPath], { cwd: paths.root, env }, onProgress);
  await run(paths.python, ['-c', 'import pix2text'], { cwd: paths.root, env });
  onProgress({ stage: '离线 OCR 运行环境已准备好', percent: 100 });
  return paths;
}

module.exports = { ensureRuntime, runtimePaths, environment };

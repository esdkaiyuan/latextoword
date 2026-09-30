const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { spawnSync, spawn } = require('node:child_process');

const CONVERSIONS = { '.doc': '.docx', '.odt': '.docx', '.ppt': '.pptx', '.pps': '.pptx', '.xls': '.xlsx', '.xlsb': '.xlsx' };

function findSoffice() {
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  const found = spawnSync(command, ['soffice'], { encoding: 'utf8', windowsHide: true });
  if (found.status === 0) return found.stdout.split(/\r?\n/).find(Boolean);
  const candidates = process.platform === 'win32'
    ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'LibreOffice', 'program', 'soffice.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'LibreOffice', 'program', 'soffice.exe')]
    : process.platform === 'darwin' ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice'] : [];
  return candidates.find((candidate) => {
    try { return require('node:fs').statSync(candidate).isFile(); } catch { return false; }
  });
}

function runConversion(executable, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (part) => { output = `${output}${part}`.slice(-4000); });
    child.stderr.on('data', (part) => { output = `${output}${part}`.slice(-4000); });
    const timer = setTimeout(() => child.kill(), 120_000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`LibreOffice 转换失败（${code ?? '超时'}）${output ? `：${output.trim()}` : ''}`));
    });
  });
}

async function convertLegacyOffice(name, inputBytes) {
  const extension = path.extname(String(name)).toLowerCase();
  const outputExtension = CONVERSIONS[extension];
  if (!outputExtension) throw new Error('不支持转换此旧版 Office 格式');
  const executable = findSoffice();
  if (!executable) throw new Error('未检测到 LibreOffice；请安装后重试，或使用联网识别（仅 DOC 可直接上传）');
  const bytes = Buffer.from(inputBytes);
  if (!bytes.length || bytes.length > 100 * 1024 * 1024) throw new Error('旧版 Office 文件须小于 100 MB');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'formula-office-'));
  const inputPath = path.join(directory, `source${extension}`);
  const outputPath = path.join(directory, `source${outputExtension}`);
  try {
    await fs.writeFile(inputPath, bytes, { flag: 'wx' });
    await runConversion(executable, ['--headless', '--norestore', '--convert-to', outputExtension.slice(1), '--outdir', directory, inputPath], directory);
    const result = await fs.readFile(outputPath);
    if (!result.length || result.length > 100 * 1024 * 1024) throw new Error('LibreOffice 输出文件为空或超过 100 MB');
    return { name: `${path.basename(name, extension)}${outputExtension}`, bytes: new Uint8Array(result) };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

module.exports = { convertLegacyOffice };

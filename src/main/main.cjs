const { app, BrowserWindow, clipboard, ClipboardItem, dialog, ipcMain, Menu, nativeImage, safeStorage, shell } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { createZip } = require('./zip.cjs');
const { createMathpixClient } = require('./mathpix.cjs');
const { createCredentialStore } = require('./mathpixCredentials.cjs');
const { createLocalOcr } = require('./localOcr.cjs');
const { convertLegacyOffice } = require('./legacyOffice.cjs');
const { createTrustedNavigationGuard } = require('./trustedNavigation.cjs');

const isDev = !app.isPackaged;
const rendererEntryPath = path.join(__dirname, '../../dist-renderer/index.html');
const isTrustedNavigation = createTrustedNavigationGuard({ isDev, appEntryPath: rendererEntryPath });
let mainWindow;
let allowWindowClose = false;
let windowClosePending = false;
const mathpixCredentials = createCredentialStore(app, safeStorage);
const mathpix = createMathpixClient(mathpixCredentials.load);
const ocrWorkerPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ocr-worker', 'worker.py')
  : path.join(__dirname, '../../ocr-worker/worker.py');
const localOcr = createLocalOcr(app, ocrWorkerPath);
const CHROME_THEMES = {
  white: { color: '#ffffff', symbolColor: '#1f2937' },
  cream: { color: '#f6efe1', symbolColor: '#443b31' },
  black: { color: '#141618', symbolColor: '#f4f6f8' },
  aqua: { color: '#e5f5f7', symbolColor: '#183d45' },
  grass: { color: '#eaf5e9', symbolColor: '#24432a' },
  gray: { color: '#e7eaed', symbolColor: '#323941' }
};

function createWindow() {
  const canOverlayTitlebar = process.platform === 'win32' || process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#f4f6f8',
    titleBarStyle: canOverlayTitlebar ? 'hidden' : 'default',
    ...(canOverlayTitlebar ? { titleBarOverlay: { ...CHROME_THEMES.white, height: 38 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url)) event.preventDefault();
  });
  mainWindow.on('close', (event) => {
    if (allowWindowClose) return;
    event.preventDefault();
    if (windowClosePending) return;
    windowClosePending = true;
    mainWindow?.webContents.send('window:before-close');
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
    allowWindowClose = false;
    windowClosePending = false;
  });
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(rendererEntryPath);
  return mainWindow;
}

function createMenu() {
  Menu.setApplicationMenu(null);
}

function assertTrustedSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !isTrustedNavigation(event.senderFrame.url)) {
    throw new Error('拒绝来自未授权页面的 IPC 请求');
  }
}

function handleIpc(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event);
    return listener(event, ...args);
  });
}

function onIpc(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    assertTrustedSender(event);
    listener(event, ...args);
  });
}

onIpc('window:close-response', (_, shouldClose) => {
  if (!windowClosePending) return;
  windowClosePending = false;
  if (shouldClose !== true) return;
  allowWindowClose = true;
  mainWindow?.close();
});

onIpc('window:set-theme', (_, themeId) => {
  const colors = CHROME_THEMES[themeId] || CHROME_THEMES.white;
  if (mainWindow?.setTitleBarOverlay) mainWindow.setTitleBarOverlay(colors);
});
onIpc('window:quit', () => app.quit());
handleIpc('window:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

handleIpc('clipboard:copy-office-math', async (_, payload) => {
  const mathml = String(payload?.mathml ?? '');
  const latex = String(payload?.latex ?? '');
  const html = `<span>${mathml}</span>`;
  await clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([mathml], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
      'web application/x-latex': new Blob([latex], { type: 'text/plain' }),
      'electron application/osclipboard;format="MathML"': new Blob([Buffer.from(mathml, 'utf16le')], { type: 'application/octet-stream' }),
      'electron application/osclipboard;format="MathML Presentation"': new Blob([Buffer.from(mathml, 'utf16le')], { type: 'application/octet-stream' })
    })
  ]);
});

/** 统一写入剪贴板：图片 > HTML > 纯文本，调用方只需给一种载荷。 */
handleIpc('clipboard:write', async (_, payload) => {
  const text = typeof payload?.text === 'string' ? payload.text : undefined;
  const html = typeof payload?.html === 'string' ? payload.html : undefined;
  const image = typeof payload?.image === 'string' && payload.image.startsWith('data:image/') ? payload.image : undefined;

  if (image) {
    clipboard.writeImage(nativeImage.createFromDataURL(image));
    return;
  }
  if (html) {
    clipboard.write({ text: text ?? '', html });
    return;
  }
  if (text !== undefined) clipboard.writeText(text);
});

function safeFileBase(name) {
  return String(name ?? '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'formula';
}

handleIpc('export:save-image', async (_, payload) => {
  const kind = payload?.kind === 'svg' ? 'svg' : 'png';
  const result = await dialog.showSaveDialog({
    defaultPath: `${safeFileBase(payload?.defaultName)}.${kind}`,
    filters: [{ name: kind === 'svg' ? 'SVG 图片' : 'PNG 图片', extensions: [kind] }]
  });
  if (result.canceled || !result.filePath) return null;

  if (kind === 'svg') {
    await fs.writeFile(result.filePath, String(payload?.svg ?? ''), 'utf8');
    return result.filePath;
  }
  const dataUrl = String(payload?.dataUrl ?? '');
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!dataUrl.startsWith('data:image/') || !base64) throw new Error('图片数据无效');
  await fs.writeFile(result.filePath, Buffer.from(base64, 'base64'));
  return result.filePath;
});

const RECENT_LIMIT = 8;
const recentFile = () => path.join(app.getPath('userData'), 'recent-projects.json');

async function loadRecentProjects() {
  try {
    const list = JSON.parse(await fs.readFile(recentFile(), 'utf8'));
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

async function pushRecentProject(filePath) {
  const previous = await loadRecentProjects();
  const list = [filePath, ...previous.filter((item) => item !== filePath)].slice(0, RECENT_LIMIT);
  await fs.writeFile(recentFile(), JSON.stringify(list, null, 2), 'utf8').catch(() => undefined);
  return list;
}

handleIpc('project:recent', () => loadRecentProjects());

// ---- 文件查看器 ----
const VIEWER_IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|tif|tiff)$/i;
const VIEWER_PDF_EXTS = /\.pdf$/i;
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
const MAX_TEXT_CHARS = 2 * 1024 * 1024;
const IMPORT_CONTAINER_EXTS = /\.(ipynb|docx|docm|pptx|pptm|ppsx|xlsx|xlsm|odt|odp|ods|epub|doc|ppt|pps|xls|xlsb|rtf)$/i;
const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  '.avif': 'image/avif', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.pdf': 'application/pdf'
};

handleIpc('clipboard:read', () => ({ text: clipboard.readText(), html: clipboard.readHTML() }));

handleIpc('ocr:mathpix-status', async () => ({ configured: Boolean(await mathpixCredentials.load().catch(() => null)) }));
handleIpc('ocr:mathpix-save', async (_, credentials) => {
  await mathpixCredentials.save(credentials);
  return { configured: true };
});
handleIpc('ocr:mathpix-remove', async () => {
  await mathpixCredentials.remove();
  return { configured: false };
});
handleIpc('ocr:mathpix-recognize', async (_, payload) => {
  if (typeof payload?.name !== 'string' || !payload.name.trim()) throw new Error('缺少文件名');
  const bytes = payload.bytes instanceof Uint8Array ? payload.bytes : null;
  if (!bytes?.length) throw new Error('文件内容为空或格式无效');
  const progress = (value) => {
    if (mainWindow && typeof payload.jobId === 'string') mainWindow.webContents.send('ocr:progress', { jobId: payload.jobId, name: payload.name, ...value });
  };
  if (payload.kind === 'image') return { text: await mathpix.recognizeImage(payload.name, bytes), warnings: [] };
  return { text: await mathpix.recognizeDocument(payload.name, bytes, progress), warnings: [] };
});
handleIpc('ocr:local-status', () => localOcr.status());
handleIpc('ocr:local-recognize', async (_, payload) => {
  if (typeof payload?.name !== 'string' || !payload.name.trim()) throw new Error('缺少文件名');
  const bytes = payload.bytes instanceof Uint8Array ? payload.bytes : null;
  if (!bytes?.length) throw new Error('文件内容为空或格式无效');
  const progress = (value) => {
    if (mainWindow && typeof payload.jobId === 'string') mainWindow.webContents.send('ocr:progress', { jobId: payload.jobId, name: payload.name, ...value });
  };
  const kind = payload.kind === 'pdf' ? 'pdf' : payload.kind === 'image' ? 'image' : null;
  if (!kind) throw new Error('本地 OCR 仅支持 PDF 和图片');
  return { text: await localOcr.recognize(payload.name, kind, bytes, progress), warnings: [] };
});
handleIpc('file:convert-legacy-office', async (_, payload) => {
  if (typeof payload?.name !== 'string' || !(payload.bytes instanceof Uint8Array)) throw new Error('旧版 Office 转换参数无效');
  return convertLegacyOffice(payload.name, payload.bytes);
});

const authorizedViewerFiles = new Set();
const authorizedDocumentFiles = new Set();
const DOCUMENT_EXTENSIONS = ['txt', 'csv', 'tsv', 'md', 'markdown', 'mdown', 'mkdn', 'mdx', 'qmd', 'rmd', 'rst', 'org', 'py', 'r', 'm', 'jl', 'sage', 'tex', 'latex', 'ltx', 'html', 'htm', 'xhtml', 'rtf', 'doc', 'docx', 'docm', 'odt', 'pdf', 'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'xls', 'xlsx', 'xlsm', 'xlsb', 'odp', 'ods', 'epub', 'ipynb', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'webp', 'gif', 'svg', 'avif'];
const SOURCE_SAVE_EXTENSIONS = ['txt', 'csv', 'tsv', 'md', 'markdown', 'mdown', 'mkdn', 'mdx', 'qmd', 'rmd', 'rst', 'org', 'py', 'r', 'm', 'jl', 'sage', 'tex', 'latex', 'ltx', 'html', 'htm', 'xhtml', 'rtf'];

function documentBytes(value) {
  if (!(value instanceof Uint8Array) || value.byteLength > MAX_DOCUMENT_BYTES) throw new Error('文档内容无效或超过 100 MB 安全上限');
  return Buffer.from(value);
}

function saveExtensions(mode) {
  if (mode === 'source') return SOURCE_SAVE_EXTENSIONS;
  if (mode === 'rich-text') return ['docx'];
  if (mode === 'pdf-annotation') return ['pdf'];
  throw new Error('此文件格式不支持在应用内保存');
}

function appendDefaultExtension(filePath, extensions) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return extensions.includes(extension) ? filePath : `${filePath}.${extensions[0]}`;
}

async function writeDocumentFile(filePath, value) {
  const bytes = documentBytes(value);
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, bytes, { flag: 'wx' });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

handleIpc('document:open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '可打开的文档', extensions: DOCUMENT_EXTENSIONS }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = await canonicalFilePath(result.filePaths[0]);
  const info = await fs.stat(filePath);
  if (!info.isFile() || info.size > MAX_DOCUMENT_BYTES) throw new Error('只能打开小于 100 MB 的普通文件');
  const bytes = await fs.readFile(filePath);
  authorizedDocumentFiles.add(filePath);
  return { path: filePath, name: path.basename(filePath), size: info.size, bytes: new Uint8Array(bytes) };
});

handleIpc('document:save', async (_, payload) => {
  if (typeof payload?.path !== 'string') throw new Error('文档路径无效');
  const filePath = await canonicalFilePath(payload.path);
  if (!authorizedDocumentFiles.has(filePath)) throw new Error('只能保存本次在文档工作区打开的文件');
  await writeDocumentFile(filePath, payload.bytes);
  return { path: filePath, name: path.basename(filePath) };
});

handleIpc('document:save-as', async (_, payload) => {
  const extensions = saveExtensions(payload?.mode);
  const defaultName = safeFileBase(payload?.defaultName || '未命名文档');
  const result = await dialog.showSaveDialog({
    defaultPath: appendDefaultExtension(defaultName, extensions),
    filters: [{ name: payload?.mode === 'pdf-annotation' ? 'PDF 文档' : payload?.mode === 'rich-text' ? 'Word 文档' : '文本/源码文档', extensions }]
  });
  if (result.canceled || !result.filePath) return null;
  const filePath = appendDefaultExtension(result.filePath, extensions);
  await writeDocumentFile(filePath, payload.bytes);
  const canonical = await canonicalFilePath(filePath);
  authorizedDocumentFiles.add(canonical);
  return { path: canonical, name: path.basename(canonical) };
});

handleIpc('document:convert-to-docx', async (_, payload) => {
  if (typeof payload?.name !== 'string' || !(payload.bytes instanceof Uint8Array)) throw new Error('文档转换参数无效');
  return convertLegacyOffice(payload.name, documentBytes(payload.bytes));
});

handleIpc('document:export-docx', async (_, payload) => {
  if (typeof payload?.html !== 'string' || Buffer.byteLength(payload.html, 'utf8') > 32 * 1024 * 1024) throw new Error('文档内容无效或超过 32 MB');
  const converterModule = require('html-to-docx');
  const convertHtmlToDocx = converterModule.default || converterModule;
  const bytes = await convertHtmlToDocx(payload.html, null, { title: safeFileBase(payload?.title || '文档'), lang: 'zh-CN' });
  return new Uint8Array(bytes);
});

async function canonicalFilePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('文件路径无效');
  return fs.realpath(filePath);
}

async function requireAuthorizedViewerFile(filePath) {
  const canonical = await canonicalFilePath(filePath);
  if (!authorizedViewerFiles.has(canonical)) throw new Error('只能访问通过文件选择器打开的文件');
  return canonical;
}

handleIpc('file:pick', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '可导入文件', extensions: ['txt', 'csv', 'tsv', 'md', 'markdown', 'mdown', 'mkdn', 'mdx', 'qmd', 'rmd', 'rst', 'org', 'py', 'r', 'm', 'jl', 'sage', 'tex', 'latex', 'ltx', 'html', 'htm', 'xhtml', 'rtf', 'ltw', 'json', 'ipynb', 'doc', 'docx', 'docm', 'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'xls', 'xlsx', 'xlsm', 'xlsb', 'odt', 'odp', 'ods', 'epub', 'pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'webp', 'gif', 'svg', 'avif'] }]
  });
  if (result.canceled) return [];
  const authorized = await Promise.all(result.filePaths.map((filePath) => fs.realpath(filePath).catch(() => null)));
  for (const filePath of authorized) if (filePath) authorizedViewerFiles.add(filePath);
  return result.filePaths;
});

handleIpc('file:read', async (_, filePath) => {
  const authorizedPath = await requireAuthorizedViewerFile(filePath);
  const info = await fs.stat(authorizedPath);
  if (!info.isFile()) throw new Error('只能预览普通文件');
  const name = path.basename(authorizedPath);
  const size = info.size;

  if (VIEWER_IMAGE_EXTS.test(name) || VIEWER_PDF_EXTS.test(name) || IMPORT_CONTAINER_EXTS.test(name)) {
    if (size > MAX_PREVIEW_BYTES) return { path: authorizedPath, name, size, encoding: 'too-large' };
    const buffer = await fs.readFile(authorizedPath);
    const mime = MIME_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';
    return { path: authorizedPath, name, size, encoding: 'base64', mime, data: buffer.toString('base64') };
  }

  const handle = await fs.open(authorizedPath, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(size, MAX_TEXT_CHARS + 4096));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    // 前 8KB 出现空字节即视为二进制，避免把 exe 之类读成乱码
    if (buffer.subarray(0, Math.min(bytesRead, 8192)).includes(0)) {
      return { path: authorizedPath, name, size, encoding: 'binary' };
    }
    const truncated = bytesRead > MAX_TEXT_CHARS;
    return { path: authorizedPath, name, size, encoding: 'text', truncated, text: buffer.subarray(0, MAX_TEXT_CHARS).toString('utf8') };
  } finally {
    await handle.close();
  }
});

handleIpc('file:open-external', async (_, filePath) => shell.openPath(await requireAuthorizedViewerFile(filePath)));
handleIpc('file:show-in-folder', async (_, filePath) => {
  shell.showItemInFolder(await requireAuthorizedViewerFile(filePath));
});

handleIpc('project:open-path', async (_, filePath) => {
  if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.ltw')) throw new Error('仅支持打开 .ltw 项目文件');
  const canonical = await canonicalFilePath(filePath);
  const recentPaths = await loadRecentProjects();
  const authorizedPaths = await Promise.all(recentPaths.map((item) => fs.realpath(item).catch(() => null)));
  if (!authorizedPaths.includes(canonical)) throw new Error('项目不在最近打开列表中，请通过“打开项目”选择');
  const text = await fs.readFile(canonical, 'utf8');
  const recent = await pushRecentProject(canonical);
  return { project: JSON.parse(text), recent };
});

handleIpc('project:save', async (_, payload) => {
  const result = await dialog.showSaveDialog({ defaultPath: `${safeFileBase(payload?.title || '未命名公式集')}.ltw`, filters: [{ name: '公式工作台项目', extensions: ['ltw'] }] });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, JSON.stringify(payload.project, null, 2), 'utf8');
  const recent = await pushRecentProject(result.filePath);
  return { path: result.filePath, recent };
});

handleIpc('project:open', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '公式工作台项目', extensions: ['ltw'] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  const selectedPath = await canonicalFilePath(result.filePaths[0]);
  const text = await fs.readFile(selectedPath, 'utf8');
  const recent = await pushRecentProject(selectedPath);
  return { project: JSON.parse(text), recent };
});

handleIpc('export:create-docx', async (_, payload) => {
  const parts = Array.isArray(payload?.parts) ? payload.parts : [];
  if (!parts.length) throw new Error('没有可导出的公式');

  const result = await dialog.showSaveDialog({ defaultPath: `${safeFileBase(payload?.defaultName)}.docx`, filters: [{ name: 'Word 文档', extensions: ['docx'] }] });
  if (result.canceled || !result.filePath) return null;

  const archive = createZip(parts.map((part) => ({ name: String(part.path ?? ''), data: Buffer.from(String(part.content ?? ''), 'utf8') })));
  await fs.writeFile(result.filePath, archive);
  return result.filePath;
});

app.whenReady().then(() => {
  createMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

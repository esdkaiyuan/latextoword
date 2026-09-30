export type ImportMode = 'auto' | 'offline' | 'online';
export type ImportFormat =
  | 'text' | 'markdown' | 'structured-text' | 'latex' | 'html' | 'rtf' | 'project' | 'notebook'
  | 'doc' | 'docx' | 'docm' | 'ppt' | 'pptx' | 'pptm' | 'pps' | 'ppsx' | 'xls' | 'xlsx' | 'xlsm' | 'xlsb'
  | 'odt' | 'odp' | 'ods' | 'epub' | 'pdf' | 'image' | 'unsupported';

export type FormatCategory = 'text' | 'project' | 'office' | 'pdf' | 'image' | 'unsupported';
export type FileFormatInfo = {
  id: ImportFormat;
  label: string;
  extensions: readonly string[];
  category: FormatCategory;
  offline: boolean;
  online: boolean;
};

export const FILE_FORMATS: readonly FileFormatInfo[] = [
  { id: 'text', label: '纯文本/CSV/TSV', extensions: ['.txt', '.csv', '.tsv'], category: 'text', offline: true, online: true },
  { id: 'markdown', label: 'Markdown/Quarto/R Markdown', extensions: ['.md', '.markdown', '.mdown', '.mkdn', '.mdx', '.qmd', '.rmd'], category: 'text', offline: true, online: true },
  { id: 'structured-text', label: '科研标记/脚本', extensions: ['.rst', '.org', '.py', '.r', '.m', '.jl', '.sage'], category: 'text', offline: true, online: false },
  { id: 'latex', label: 'LaTeX', extensions: ['.tex', '.latex', '.ltx'], category: 'text', offline: true, online: true },
  { id: 'html', label: 'HTML', extensions: ['.html', '.htm', '.xhtml'], category: 'text', offline: true, online: true },
  { id: 'rtf', label: 'RTF', extensions: ['.rtf'], category: 'text', offline: true, online: true },
  { id: 'project', label: '公式工作台项目', extensions: ['.ltw', '.json'], category: 'project', offline: true, online: false },
  { id: 'notebook', label: 'Jupyter Notebook', extensions: ['.ipynb'], category: 'office', offline: true, online: false },
  { id: 'doc', label: 'Word 97–2003', extensions: ['.doc'], category: 'office', offline: true, online: true },
  { id: 'docx', label: 'Word', extensions: ['.docx'], category: 'office', offline: true, online: true },
  { id: 'docm', label: 'Word 启用宏', extensions: ['.docm'], category: 'office', offline: true, online: false },
  { id: 'ppt', label: 'PowerPoint 97–2003', extensions: ['.ppt'], category: 'office', offline: true, online: false },
  { id: 'pptx', label: 'PowerPoint', extensions: ['.pptx'], category: 'office', offline: true, online: true },
  { id: 'pptm', label: 'PowerPoint 启用宏', extensions: ['.pptm'], category: 'office', offline: true, online: false },
  { id: 'pps', label: 'PowerPoint 放映 97–2003', extensions: ['.pps'], category: 'office', offline: true, online: false },
  { id: 'ppsx', label: 'PowerPoint 放映', extensions: ['.ppsx'], category: 'office', offline: true, online: false },
  { id: 'xls', label: 'Excel 97–2003', extensions: ['.xls'], category: 'office', offline: true, online: false },
  { id: 'xlsx', label: 'Excel', extensions: ['.xlsx'], category: 'office', offline: true, online: false },
  { id: 'xlsm', label: 'Excel 启用宏', extensions: ['.xlsm'], category: 'office', offline: true, online: false },
  { id: 'xlsb', label: 'Excel 二进制簿', extensions: ['.xlsb'], category: 'office', offline: true, online: false },
  { id: 'odt', label: 'OpenDocument 文本', extensions: ['.odt'], category: 'office', offline: true, online: true },
  { id: 'odp', label: 'OpenDocument 演示', extensions: ['.odp'], category: 'office', offline: true, online: false },
  { id: 'ods', label: 'OpenDocument 表格', extensions: ['.ods'], category: 'office', offline: true, online: false },
  { id: 'epub', label: 'EPUB 电子书', extensions: ['.epub'], category: 'office', offline: true, online: true },
  { id: 'pdf', label: 'PDF', extensions: ['.pdf'], category: 'pdf', offline: true, online: true },
  { id: 'image', label: '图片', extensions: ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp', '.gif', '.svg', '.avif'], category: 'image', offline: true, online: true }
];

export type FileFormatDetection = {
  format: ImportFormat;
  label: string;
  category: FormatCategory;
  extension: string;
  extensionMismatch: boolean;
  warning?: string;
};

function extensionFor(name: string): string {
  const leaf = name.split(/[\\/]/).at(-1) ?? name;
  const dot = leaf.lastIndexOf('.');
  return dot > 0 ? leaf.slice(dot).toLowerCase() : '';
}

function signatureFormat(bytes: Uint8Array): ImportFormat | 'zip-container' | undefined {
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-') return 'pdf';
  if (bytes.length >= 8 && bytes[0] === 0x89 && String.fromCharCode(...bytes.subarray(1, 4)) === 'PNG') return 'image';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image';
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 0x2a)) return 'image';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.subarray(0, 6)))) return 'image';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 12)).includes('ftyp') && String.fromCharCode(...bytes.subarray(8, 12)).includes('avif')) return 'image';
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip-container';
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === '{\\rtf') return 'rtf';
  return undefined;
}

function formatForExtension(extension: string): FileFormatInfo | undefined {
  return FILE_FORMATS.find((format) => format.extensions.includes(extension));
}

export function formatInfoForName(name: string): FileFormatInfo | undefined {
  return formatForExtension(extensionFor(name));
}

export function detectFileFormat(name: string, mime: string, bytes: Uint8Array): FileFormatDetection {
  const extension = extensionFor(name);
  const byExtension = formatForExtension(extension);
  const signature = signatureFormat(bytes);
  const zipOffice = byExtension?.category === 'office' && ['.docx', '.docm', '.pptx', '.pptm', '.ppsx', '.xlsx', '.xlsm', '.odt', '.odp', '.ods', '.epub'].includes(extension);
  const signatureMismatch = (zipOffice && signature !== 'zip-container') ||
    (extension === '.pdf' && signature !== 'pdf') ||
    (/\.(png|jpe?g|tiff?|bmp|webp|gif)$/i.test(extension) && signature !== 'image') ||
    (signature === 'pdf' && byExtension?.category !== 'pdf') ||
    (signature === 'image' && byExtension?.category !== 'image') ||
    (signature === 'rtf' && byExtension?.category !== 'text') ||
    (signature === 'zip-container' && !zipOffice);
  const info = byExtension ?? FILE_FORMATS.find((format) => format.id === signature);
  if (!info) {
    return { format: 'unsupported', label: '不支持的文件', category: 'unsupported', extension, extensionMismatch: false, warning: `无法识别 ${mime || '未知类型'} 文件` };
  }
  if (signatureMismatch) {
    return { format: 'unsupported', label: '文件类型不匹配', category: 'unsupported', extension, extensionMismatch: true, warning: `扩展名 ${extension || '(无)'} 与文件内容不一致` };
  }
  return { format: info.id, label: info.label, category: info.category, extension, extensionMismatch: false };
}

export function supportedImportAccept(): string {
  return FILE_FORMATS.flatMap((format) => format.extensions).join(',');
}

export function isOnlineOcrSupported(name: string): boolean {
  const extension = extensionFor(name);
  if (/\.(png|jpe?g|tiff?|bmp|webp)$/i.test(extension)) return true;
  return /\.(pdf|doc|docx|pptx|odt|epub)$/i.test(extension);
}

export function supportedImportExtensions(): string[] {
  return FILE_FORMATS.flatMap((format) => format.extensions);
}

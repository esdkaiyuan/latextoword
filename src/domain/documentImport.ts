import { decodeBase64File, decodeTextFile } from './fileDecoding';
import { readArchiveImages, readArchiveXml } from './archiveImport';
import { extractOfficeText, type OfficeXmlFormat } from './officeXml';
import { extractPdfText } from './pdfImport';
import { mathmlToLatex } from './mathmlToLatex';

export type DocumentImportResult = { text: string; ocrPages: number[]; warnings: string[]; embeddedImages: Array<{ name: string; bytes: Uint8Array }> };

export function rtfToText(source: string): string {
  const escapedCharacters: Record<string, string> = { '{': '\u0001', '}': '\u0002', '\\': '\u0003' };
  return source
    .replace(/\\([{}\\])/g, (_, escaped: string) => escapedCharacters[escaped] ?? escaped)
    .replace(/\\'[0-9a-f]{2}/gi, (value) => String.fromCharCode(parseInt(value.slice(2), 16)))
    .replace(/\\u(-?\d+)\??/g, (_, code) => String.fromCharCode(Number(code) < 0 ? Number(code) + 65536 : Number(code)))
    .replace(/\\(?:par|line)\b ?/gi, '\n')
    .replace(/\\tab\b ?/gi, '\t')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\u0001/g, '{').replace(/\u0002/g, '}').replace(/\u0003/g, '\\');
}

function notebookSource(value: unknown): string {
  return Array.isArray(value) ? value.join('') : typeof value === 'string' ? value : '';
}

function notebookMath(value: unknown): string {
  const source = notebookSource(value).trim();
  if (!source) return '';
  const mathml = source.match(/<math\b[\s\S]*?<\/math>/i)?.[0];
  const latex = mathml ? mathmlToLatex(mathml) : source;
  if (/\$\$|\\\[|\\\(|\$[A-Za-z0-9\\{]/.test(latex) || /\\begin\{/.test(latex)) return `${latex}\n`;
  return `\\(${latex}\\)\n`;
}

function notebookImageBytes(mime: string, value: unknown): Uint8Array {
  const source = notebookSource(value).trim();
  if (mime === 'image/svg+xml' && source.startsWith('<svg')) return new TextEncoder().encode(source);
  const dataUri = source.match(/^data:image\/[^;,]+;base64,([\s\S]*)$/i)?.[1];
  if (dataUri) return decodeBase64File(dataUri.replace(/\s/g, ''));
  if (mime === 'image/svg+xml' && source.startsWith('data:image/svg+xml,')) {
    return new TextEncoder().encode(decodeURIComponent(source.slice('data:image/svg+xml,'.length)));
  }
  return decodeBase64File(source.replace(/\s/g, ''));
}

function notebookMarkdown(bytes: Uint8Array): { text: string; embeddedImages: DocumentImportResult['embeddedImages']; warnings: string[] } {
  const notebook = JSON.parse(decodeTextFile(bytes).text) as { cells?: Array<Record<string, unknown>> };
  if (!Array.isArray(notebook.cells)) throw new Error('Jupyter Notebook 缺少 cells 列表');
  const sections: string[] = [];
  const embeddedImages: DocumentImportResult['embeddedImages'] = [];
  const warnings: string[] = [];
  notebook.cells.forEach((cell, index) => {
    const cellType = cell.cell_type;
    const source = notebookSource(cell.source);
    if (cellType === 'markdown' || cellType === 'raw') sections.push(source);
    if (cellType === 'code' && /^\s*%%(?:latex|tex)\b/i.test(source)) sections.push(`\n${source.replace(/^\s*%%(?:latex|tex)\b[^\n]*\n/i, '')}\n`);
    else if (cellType === 'code' && source.trim()) sections.push(`\n\`\`\`python\n${source}\n\`\`\`\n`);
    const outputs = Array.isArray(cell.outputs) ? cell.outputs as Array<Record<string, unknown>> : [];
    for (const output of outputs) {
      const data = output.data as Record<string, unknown> | undefined;
      if (!data) continue;
      const math = data['text/latex'] ?? data['application/mathml+xml'];
      if (data['application/mathml+xml']) sections.push(notebookMath(mathmlToLatex(notebookSource(math))));
      else if (math) sections.push(notebookMath(math));
      const markdown = data['text/markdown'];
      if (markdown) sections.push(notebookSource(markdown));
      for (const [mime, ext] of [['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['image/svg+xml', '.svg']] as const) {
        const imageData = data[mime];
        if (!imageData) continue;
        try {
          embeddedImages.push({ name: `ipynb-cell-${index + 1}${ext}`, bytes: notebookImageBytes(mime, imageData) });
        }
        catch { warnings.push(`第 ${index + 1} 个单元格的 ${mime} 图片无法解码`); }
      }
    }
  });
  return { text: sections.join('\n\n'), embeddedImages, warnings };
}

export async function extractDocumentText(format: string, bytes: Uint8Array): Promise<DocumentImportResult> {
  if (format === 'pdf') {
    const result = await extractPdfText(bytes);
    return { text: result.text, ocrPages: result.ocrPages, warnings: [], embeddedImages: [] };
  }
  if (format === 'rtf') return { text: rtfToText(decodeTextFile(bytes).text), ocrPages: [], warnings: [], embeddedImages: [] };
  if (format === 'notebook') {
    const notebook = notebookMarkdown(bytes);
    return { ...notebook, ocrPages: [] };
  }
  if (['docx', 'docm', 'pptx', 'pptm', 'ppsx', 'xlsx', 'xlsm', 'odt', 'odp', 'ods', 'epub'].includes(format)) {
    const [parts, images] = await Promise.all([readArchiveXml(bytes), readArchiveImages(bytes)]);
    const text = extractOfficeText(format as OfficeXmlFormat, parts);
    const embeddedImages = Array.from(images, ([name, imageBytes]) => ({ name: `${format}:${name.split('/').at(-1)}`, bytes: imageBytes }));
    return { text, ocrPages: [], warnings: [], embeddedImages };
  }
  if (['doc', 'ppt', 'pps', 'xls', 'xlsb'].includes(format)) {
    throw new Error('旧版 Office 文件需要 LibreOffice 转换，或切换到联网识别（DOC 支持直接识别）');
  }
  throw new Error(`暂不支持从 ${format.toUpperCase()} 提取文档内容`);
}

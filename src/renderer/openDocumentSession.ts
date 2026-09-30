import { documentCapabilities } from '../domain/document';
import type { DocumentSession } from '../domain/documentSession';
import { extractDocumentText } from '../domain/documentImport';
import { importRichDocument } from '../domain/richDocument';
import { openSourceDocument } from '../domain/sourceDocument';

export type OpenedDocumentFile = { path: string | null; name: string; size: number; bytes: Uint8Array };
type SessionBase = ReturnType<typeof createSessionBase>;

function createSessionBase(file: OpenedDocumentFile) {
  return { id: crypto.randomUUID(), name: file.name, path: file.path, savePath: null, dirty: false, originalBytes: file.bytes, warnings: [] as string[] };
}

function imageMime(name: string): string {
  const extension = name.split('.').at(-1)?.toLowerCase();
  const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff' };
  return extension ? imageTypes[extension] ?? 'application/octet-stream' : 'application/octet-stream';
}

async function createRichSession(file: OpenedDocumentFile, format: string, base: SessionBase): Promise<DocumentSession> {
  let bytes = file.bytes;
  const warnings: string[] = [];
  if (['doc', 'odt'].includes(format)) {
    const converted = await window.desktop!.documents.convertToDocx({ name: file.name, bytes });
    bytes = converted.bytes;
    warnings.push('已转换为 DOCX 编辑副本；首次保存将另存为，不会覆盖原文件');
  }
  if (format === 'docm') warnings.push('宏、修订记录、复杂版式和嵌入对象不会写入新 DOCX');
  const imported = await importRichDocument(bytes);
  return { ...base, mode: 'rich-text', format, html: imported.html, originalBytes: bytes, warnings: [...warnings, ...imported.warnings] };
}

async function createReadonlySession(file: OpenedDocumentFile, format: string, base: SessionBase): Promise<DocumentSession> {
  if (format === 'image') return { ...base, mode: 'readonly', format, previewText: '', mime: imageMime(file.name) };
  try {
    const parsed = await extractDocumentText(format, file.bytes);
    return { ...base, mode: 'readonly', format, previewText: parsed.text, mime: 'text/plain', warnings: parsed.warnings };
  } catch (error) {
    const warning = error instanceof Error ? error.message : '暂不支持此格式的正文预览';
    return { ...base, mode: 'readonly', format, previewText: '', mime: 'text/plain', warnings: [warning] };
  }
}

export async function openDocumentSession(file: OpenedDocumentFile): Promise<DocumentSession> {
  const capability = documentCapabilities(file.name);
  const base = createSessionBase(file);
  if (capability.mode === 'source') {
    const source = openSourceDocument(file.name, file.bytes);
    return { ...base, mode: 'source', format: capability.format, source, text: source.text, savePath: file.path, warnings: source.warnings };
  }
  if (capability.mode === 'pdf-annotation') return { ...base, mode: 'pdf-annotation', format: 'pdf', annotations: [] };
  if (capability.mode === 'rich-text') return createRichSession(file, capability.format, base);
  return createReadonlySession(file, capability.format, base);
}

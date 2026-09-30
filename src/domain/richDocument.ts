import DOMPurify from 'dompurify';

export type RichDocumentImport = { html: string; warnings: string[] };

const FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'link'];

export function sanitizeRichDocumentHtml(source: string): string {
  const clean = DOMPurify.sanitize(source, { FORBID_TAGS: FORBIDDEN_TAGS, FORBID_ATTR: ['style'] });
  const parsed = new DOMParser().parseFromString(clean, 'text/html');
  parsed.querySelectorAll('img').forEach((image) => {
    if (!image.src.startsWith('data:image/')) image.remove();
  });
  parsed.querySelectorAll('a').forEach((link) => link.setAttribute('rel', 'noreferrer noopener'));
  return parsed.body.innerHTML;
}

function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function importRichDocument(bytes: Uint8Array): Promise<RichDocumentImport> {
  const mammoth = await import('mammoth');
  const input = { arrayBuffer: toExactArrayBuffer(bytes), buffer: bytes };
  const result = await mammoth.convertToHtml(input as Parameters<typeof mammoth.convertToHtml>[0]);
  return {
    html: sanitizeRichDocumentHtml(result.value),
    warnings: result.messages.map((message) => message.message)
  };
}

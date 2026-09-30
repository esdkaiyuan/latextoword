import { documentCapabilities } from './document';
import { decodeTextFile } from './fileDecoding';

export type SourceDocument = {
  name: string;
  format: string;
  text: string;
  encoding: string;
  originalBytes: Uint8Array;
  warnings: string[];
};

export function openSourceDocument(name: string, bytes: Uint8Array): SourceDocument {
  const capability = documentCapabilities(name);
  if (capability.mode !== 'source') throw new Error('此文件不是可编辑的源码文档');
  const decoded = decodeTextFile(bytes);
  const warnings = decoded.warning ? [decoded.warning] : [];
  if (decoded.encoding === 'GB18030' || decoded.encoding.includes('替代字符')) warnings.push('修改后将保存为 UTF-8，请检查少数字符的解码结果');
  return {
    name,
    format: capability.format,
    text: decoded.text,
    encoding: decoded.encoding,
    originalBytes: new Uint8Array(bytes),
    warnings
  };
}

export function serializeSourceDocument(document: SourceDocument, text: string): Uint8Array {
  if (text === document.text) return new Uint8Array(document.originalBytes);
  if (document.encoding === 'UTF-16 LE' || document.encoding === 'UTF-16 BE') {
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes[0] = document.encoding === 'UTF-16 LE' ? 0xff : 0xfe;
    bytes[1] = document.encoding === 'UTF-16 LE' ? 0xfe : 0xff;
    for (let index = 0; index < text.length; index += 1) {
      const unit = text.charCodeAt(index);
      bytes[2 + index * 2] = document.encoding === 'UTF-16 LE' ? unit & 0xff : unit >> 8;
      bytes[3 + index * 2] = document.encoding === 'UTF-16 LE' ? unit >> 8 : unit & 0xff;
    }
    return bytes;
  }
  const encoded = new TextEncoder().encode(text);
  if (document.encoding === 'UTF-8 BOM') {
    return new Uint8Array([0xef, 0xbb, 0xbf, ...encoded]);
  }
  return encoded;
}

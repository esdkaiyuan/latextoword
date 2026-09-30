import { describe, expect, it } from 'vitest';
import { openSourceDocument, serializeSourceDocument } from '../src/domain/sourceDocument';

describe('source document codecs', () => {
  it('preserves unchanged UTF-8 source bytes including BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('# 标题\n$x$')]);
    const document = openSourceDocument('paper.md', bytes);

    expect(document.text).toBe('# 标题\n$x$');
    expect(serializeSourceDocument(document, document.text)).toEqual(bytes);
  });

  it('keeps a UTF-16LE source encoding when edited', () => {
    const body = Array.from('第一行', (character) => character.charCodeAt(0));
    const bytes = new Uint8Array([0xff, 0xfe, ...body.flatMap((unit) => [unit & 0xff, unit >> 8])]);
    const document = openSourceDocument('notes.txt', bytes);

    expect(document.encoding).toBe('UTF-16 LE');
    expect(new TextDecoder('utf-16le').decode(serializeSourceDocument(document, '第二行').subarray(2))).toBe('第二行');
  });

  it('rejects binary office documents as source text', () => {
    expect(() => openSourceDocument('paper.docx', new Uint8Array([1, 2, 3]))).toThrow(/源码/);
  });

  it('warns when an edited legacy-encoded file will be saved as UTF-8', () => {
    const document = openSourceDocument('notes.md', new Uint8Array([0xd6, 0xd0]));

    expect(document.encoding).toBe('GB18030');
    expect(document.warnings.join(' ')).toContain('修改后将保存为 UTF-8');
    expect(new TextDecoder().decode(serializeSourceDocument(document, '中国'))).toBe('中国');
  });
});

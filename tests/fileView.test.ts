import { describe, expect, it } from 'vitest';
import { canImportFormulas, fileKindForName, formatFileSize } from '../src/domain/fileView';

describe('file kind detection', () => {
  it('maps common extensions to preview kinds', () => {
    expect(fileKindForName('notes.md')).toBe('markdown');
    expect(fileKindForName('paper.tex')).toBe('text');
    expect(fileKindForName('page.html')).toBe('html');
    expect(fileKindForName('chart.PNG')).toBe('image');
    expect(fileKindForName('doc.pdf')).toBe('pdf');
    expect(fileKindForName('Makefile')).toBe('text');
    expect(fileKindForName('setup.exe')).toBe('binary');
  });

  it('allows formula extraction from text, documents, and OCR sources', () => {
    expect(canImportFormulas('text')).toBe(true);
    expect(canImportFormulas('markdown')).toBe(true);
    expect(canImportFormulas('html')).toBe(true);
    expect(canImportFormulas('image')).toBe(true);
    expect(canImportFormulas('pdf')).toBe(true);
    expect(canImportFormulas('document')).toBe(true);
    expect(canImportFormulas('binary')).toBe(false);
  });
});

describe('file size formatting', () => {
  it('formats bytes up to terabytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1536 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(5 * 1024 ** 3)).toBe('5.0 GB');
  });

  it('handles invalid input gracefully', () => {
    expect(formatFileSize(-1)).toBe('未知大小');
    expect(formatFileSize(Number.NaN)).toBe('未知大小');
  });
});

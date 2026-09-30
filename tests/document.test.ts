import { describe, expect, it } from 'vitest';
import { documentCapabilities, isDocumentSaveTarget } from '../src/domain/document';

describe('document capabilities', () => {
  it('marks source formats editable and previewable', () => {
    expect(documentCapabilities('analysis.md')).toMatchObject({ mode: 'source', preview: true, saveAs: true });
  });

  it('marks Word formats as conversion-backed rich text', () => {
    expect(documentCapabilities('draft.docx')).toMatchObject({ mode: 'rich-text', preview: true, saveAs: true });
  });

  it('keeps PDF page editing annotation-based', () => {
    expect(documentCapabilities('paper.pdf')).toMatchObject({ mode: 'pdf-annotation', preview: true, saveAs: true });
  });

  it('does not advertise unsupported Office formats as editable', () => {
    expect(documentCapabilities('slides.pptx')).toMatchObject({ mode: 'readonly', preview: true, saveAs: false });
  });

  it('routes common images to a read-only image preview', () => {
    expect(documentCapabilities('scan.PNG')).toMatchObject({ mode: 'readonly', format: 'image', preview: true, extractFormulas: true });
  });

  it('accepts only save extensions compatible with the current editor', () => {
    expect(isDocumentSaveTarget('notes.md', 'source')).toBe(true);
    expect(isDocumentSaveTarget('notes.docx', 'source')).toBe(false);
    expect(isDocumentSaveTarget('report.docx', 'rich-text')).toBe(true);
  });
});

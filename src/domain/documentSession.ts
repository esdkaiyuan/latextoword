import type { PdfAnnotation } from './pdfAnnotations';
import type { SourceDocument } from './sourceDocument';

type SessionBase = {
  id: string;
  name: string;
  path: string | null;
  savePath: string | null;
  dirty: boolean;
  warnings: string[];
  originalBytes: Uint8Array;
};

export type SourceSession = SessionBase & {
  mode: 'source';
  format: string;
  source: SourceDocument;
  text: string;
};

export type RichTextSession = SessionBase & {
  mode: 'rich-text';
  format: string;
  html: string;
};

export type PdfSession = SessionBase & {
  mode: 'pdf-annotation';
  format: 'pdf';
  annotations: PdfAnnotation[];
};

export type ReadonlySession = SessionBase & {
  mode: 'readonly';
  format: string;
  previewText: string;
  mime: string;
};

export type DocumentSession = SourceSession | RichTextSession | PdfSession | ReadonlySession;

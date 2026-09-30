import type { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';

export type NormalizedRect = { x: number; y: number; width: number; height: number };
export type PdfAnnotation = {
  id: string;
  page: number;
  kind: 'highlight' | 'note';
  rect: NormalizedRect;
  pdfRect?: PdfRect;
  text?: string;
};
export type PdfRect = { x: number; y: number; width: number; height: number };
export type PdfViewportTransform = { width: number; height: number; convertToPdfPoint: (x: number, y: number) => number[] };
type PdfLiteral = Record<string, PDFName | PDFHexString | number | number[]>;
type PdfLibrary = typeof import('pdf-lib');

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function points(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function normalizedRectToPdf(rect: NormalizedRect, pageWidth: number, pageHeight: number): PdfRect {
  const left = clamp(rect.x);
  const top = clamp(rect.y);
  const right = clamp(rect.x + rect.width);
  const bottom = clamp(rect.y + rect.height);
  return {
    x: points(left * pageWidth),
    y: points((1 - bottom) * pageHeight),
    width: points(Math.max(0, right - left) * pageWidth),
    height: points(Math.max(0, bottom - top) * pageHeight)
  };
}

export function moveNormalizedRect(rect: NormalizedRect, deltaX: number, deltaY: number): NormalizedRect {
  const width = clamp(rect.width);
  const height = clamp(rect.height);
  return {
    x: Math.max(0, Math.min(1 - width, rect.x + deltaX)),
    y: Math.max(0, Math.min(1 - height, rect.y + deltaY)),
    width,
    height
  };
}

export function normalizedRectToPdfViewport(rect: NormalizedRect, viewport: PdfViewportTransform): PdfRect {
  const left = clamp(rect.x) * viewport.width;
  const top = clamp(rect.y) * viewport.height;
  const right = clamp(rect.x + rect.width) * viewport.width;
  const bottom = clamp(rect.y + rect.height) * viewport.height;
  const corners = [[left, top], [right, top], [left, bottom], [right, bottom]].map(([x, y]) => viewport.convertToPdfPoint(x, y));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: points(minX), y: points(minY), width: points(maxX - minX), height: points(maxY - minY) };
}

function pushAnnotation(pdf: PDFDocument, library: PdfLibrary, pageIndex: number, annotation: PdfLiteral): void {
  const page = pdf.getPage(pageIndex);
  const reference = pdf.context.register(pdf.context.obj(annotation));
  const key = library.PDFName.of('Annots');
  const list = page.node.lookupMaybe(key, library.PDFArray);
  if (list) list.push(reference);
  else page.node.set(key, pdf.context.obj([reference]));
}

function appendHighlight(pdf: PDFDocument, library: PdfLibrary, mark: PdfAnnotation): void {
  const page = pdf.getPage(mark.page);
  const rect = mark.pdfRect ?? normalizedRectToPdf(mark.rect, page.getWidth(), page.getHeight());
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  pushAnnotation(pdf, library, mark.page, {
    Type: library.PDFName.of('Annot'), Subtype: library.PDFName.of('Highlight'),
    Rect: [rect.x, rect.y, x2, y2], QuadPoints: [rect.x, y2, x2, y2, rect.x, rect.y, x2, rect.y],
    C: [1, 0.88, 0.25], CA: 0.38, F: 4, Contents: library.PDFHexString.fromText(mark.text ?? '')
  });
}

function appendNote(pdf: PDFDocument, library: PdfLibrary, mark: PdfAnnotation): void {
  const page = pdf.getPage(mark.page);
  const rect = mark.pdfRect ?? normalizedRectToPdf(mark.rect, page.getWidth(), page.getHeight());
  pushAnnotation(pdf, library, mark.page, {
    Type: library.PDFName.of('Annot'), Subtype: library.PDFName.of('Text'),
    Rect: [rect.x, rect.y, rect.x + 20, rect.y + 20],
    Name: library.PDFName.of('Comment'), C: [1, 0.78, 0.25], F: 4,
    Contents: library.PDFHexString.fromText(mark.text ?? '')
  });
}

export async function applyPdfAnnotations(bytes: Uint8Array, marks: PdfAnnotation[]): Promise<Uint8Array> {
  const library = await import('pdf-lib');
  const pdf = await library.PDFDocument.load(bytes, { updateMetadata: false });
  for (const mark of marks) {
    if (mark.page < 0 || mark.page >= pdf.getPageCount()) continue;
    if (mark.kind === 'highlight') appendHighlight(pdf, library, mark);
    else appendNote(pdf, library, mark);
  }
  return pdf.save();
}

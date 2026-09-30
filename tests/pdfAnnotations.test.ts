import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFName } from 'pdf-lib';
import { applyPdfAnnotations, moveNormalizedRect, normalizedRectToPdf, normalizedRectToPdfViewport } from '../src/domain/pdfAnnotations';

describe('PDF annotation geometry', () => {
  it('converts top-left normalized coordinates to PDF points', () => {
    expect(normalizedRectToPdf({ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }, 500, 700)).toEqual({
      x: 50, y: 490, width: 150, height: 70
    });
  });

  it('moves an annotation while keeping the whole mark inside the page', () => {
    expect(moveNormalizedRect({ x: 0.2, y: 0.3, width: 0.1, height: 0.1 }, 0.8, -0.5)).toEqual({ x: 0.9, y: 0, width: 0.1, height: 0.1 });
  });

  it('maps displayed rectangles back through rotated PDF page viewports', () => {
    const rect = normalizedRectToPdfViewport({ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }, {
      width: 700,
      height: 500,
      convertToPdfPoint: (x, y) => [y, 700 - x]
    });

    expect(rect).toEqual({ x: 100, y: 420, width: 50, height: 210 });
  });

  it('clamps drags that start or end outside the page', () => {
    expect(normalizedRectToPdf({ x: -0.2, y: 0.9, width: 1.5, height: 0.5 }, 200, 300)).toEqual({
      x: 0, y: 0, width: 200, height: 30
    });
  });

  it('writes annotations into a new PDF copy and preserves the original bytes', async () => {
    const source = await PDFDocument.create();
    source.addPage([500, 700]);
    const originalBytes = await source.save();
    const savedBytes = await applyPdfAnnotations(originalBytes, [{ id: 'a', page: 0, kind: 'highlight', rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 } }]);
    const saved = await PDFDocument.load(savedBytes);
    const annotations = saved.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray);

    expect(annotations.size()).toBe(1);
    expect(saved.getPageCount()).toBe(1);
    expect(originalBytes).not.toEqual(savedBytes);
  });

  it('returns an unchanged copy when no PDF annotations are present', async () => {
    const source = await PDFDocument.create();
    source.addPage([320, 480]);
    const originalBytes = await source.save();

    expect(await applyPdfAnnotations(originalBytes, [])).toEqual(originalBytes);
  });
});

import { describe, expect, it } from 'vitest';
import { adjustPdfZoom, fitPdfPageScale, getPdfZoomShortcut } from '../src/domain/pdfView';

describe('PDF fit-to-page zoom', () => {
  it('fits a portrait page within both available viewport dimensions', () => {
    const scale = fitPdfPageScale(595, 842, 1400, 719);

    expect(595 * scale).toBeLessThanOrEqual(1400 - 32);
    expect(842 * scale).toBeLessThanOrEqual(719 - 32);
  });

  it('keeps very small desktop viewports usable without exceeding the page bounds', () => {
    const scale = fitPdfPageScale(595, 842, 900, 430);

    expect(scale).toBeGreaterThanOrEqual(0.25);
    expect(842 * scale).toBeLessThanOrEqual(430 - 32);
  });

  it('adjusts zoom in small bounded steps for wheel and keyboard shortcuts', () => {
    expect(adjustPdfZoom(1, 0.1)).toBe(1.1);
    expect(adjustPdfZoom(1, -0.1)).toBe(0.9);
    expect(adjustPdfZoom(2.4, 0.1)).toBe(2.4);
    expect(adjustPdfZoom(0.25, -0.1)).toBe(0.25);
  });

  it('maps standard zoom keys while leaving unrelated keys untouched', () => {
    expect(getPdfZoomShortcut('=')).toBe('in');
    expect(getPdfZoomShortcut('+')).toBe('in');
    expect(getPdfZoomShortcut('-')).toBe('out');
    expect(getPdfZoomShortcut('0')).toBe('fit');
    expect(getPdfZoomShortcut('ArrowDown')).toBeNull();
  });
});

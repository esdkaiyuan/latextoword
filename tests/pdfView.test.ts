import { describe, expect, it } from 'vitest';
import { fitPdfPageScale } from '../src/domain/pdfView';

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
});

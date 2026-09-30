export type PdfZoomShortcut = 'in' | 'out' | 'fit';

export function adjustPdfZoom(current: number, delta: number): number {
  return Math.max(0.25, Math.min(2.4, Math.round((current + delta) * 10) / 10));
}

export function getPdfZoomShortcut(key: string): PdfZoomShortcut | null {
  if (key === '=' || key === '+') return 'in';
  if (key === '-') return 'out';
  if (key === '0') return 'fit';
  return null;
}

export function fitPdfPageScale(pageWidth: number, pageHeight: number, viewportWidth: number, viewportHeight: number, padding = 32): number {
  if (pageWidth <= 0 || pageHeight <= 0 || viewportWidth <= padding || viewportHeight <= padding) return 0.25;
  const widthScale = (viewportWidth - padding) / pageWidth;
  const heightScale = (viewportHeight - padding) / pageHeight;
  return Math.max(0.25, Math.min(2.4, widthScale, heightScale));
}

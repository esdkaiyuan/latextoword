export function fitPdfPageScale(pageWidth: number, pageHeight: number, viewportWidth: number, viewportHeight: number, padding = 32): number {
  if (pageWidth <= 0 || pageHeight <= 0 || viewportWidth <= padding || viewportHeight <= padding) return 0.25;
  const widthScale = (viewportWidth - padding) / pageWidth;
  const heightScale = (viewportHeight - padding) / pageHeight;
  return Math.max(0.25, Math.min(2.4, widthScale, heightScale));
}

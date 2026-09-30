export type PdfTextPage = { page: number; text: string };

export async function extractPdfText(bytes: Uint8Array): Promise<{ pages: PdfTextPage[]; text: string; ocrPages: number[] }> {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const loading = getDocument({ data: bytes, useSystemFonts: true });
  const document = await loading.promise;
  try {
    if (document.numPages > 500) throw new Error('PDF 超过 500 页，请按章节拆分后导入');
    const pages: PdfTextPage[] = [];
    const ocrPages: number[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
        .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`)
        .join('').trim();
      pages.push({ page: pageNumber, text });
      if (!text) ocrPages.push(pageNumber);
      page.cleanup();
    }
    return { pages, text: pages.map(({ page, text }) => `\n[第 ${page} 页]\n${text}`).join('\n'), ocrPages };
  } finally {
    await loading.destroy();
  }
}

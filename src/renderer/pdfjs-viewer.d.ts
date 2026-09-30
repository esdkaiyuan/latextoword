declare module 'pdfjs-dist/web/pdf_viewer.mjs' {
  import type { PDFPageProxy, PageViewport } from 'pdfjs-dist';

  export class TextLayerBuilder {
    constructor(options: { pdfPage: PDFPageProxy });
    div: HTMLDivElement;
    render(options: { viewport: PageViewport; images?: null }): Promise<void>;
    cancel(): void;
  }
}

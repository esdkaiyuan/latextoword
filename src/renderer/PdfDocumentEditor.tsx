import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPdfText } from '../domain/pdfImport';
import type { NormalizedRect, PdfAnnotation, PdfRect } from '../domain/pdfAnnotations';
import type { PdfSession } from '../domain/documentSession';
import { observePdfLoad } from '../domain/pdfLoadTask';
import { fitPdfPageScale } from '../domain/pdfView';
import PdfPageCanvas from './PdfPageCanvas';

type Props = { session: PdfSession; busy: boolean; onAnnotationsChange: (items: PdfAnnotation[]) => void; onOcrCopy: () => void };

export default function PdfDocumentEditor({ session, busy, onAnnotationsChange, onOcrCopy }: Props) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageTexts, setPageTexts] = useState<Array<{ page: number; text: string }>>([]);
  const [search, setSearch] = useState('');
  const [tool, setTool] = useState<'select' | 'highlight' | 'note' | null>('select');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [fitToPage, setFitToPage] = useState(true);
  const [fitReady, setFitReady] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const pageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setError('');
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const loading = getDocument({ data: new Uint8Array(session.originalBytes), useSystemFonts: true });
    setDocument(null);
    return observePdfLoad(
      loading.promise,
      () => loading.destroy(),
      setDocument,
      (reason) => setError(reason instanceof Error ? reason.message : 'PDF 无法读取')
    );
  }, [session.id, session.originalBytes]);

  useEffect(() => {
    let cancelled = false;
    void extractPdfText(session.originalBytes).then((result) => { if (!cancelled) setPageTexts(result.pages); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [session.id, session.originalBytes]);

  useEffect(() => {
    const container = pageScrollRef.current;
    if (!document || !fitToPage || !container) return;
    const pdfDocument = document;
    const scrollContainer = container;
    let cancelled = false;
    let measuring = false;
    async function measurePage() {
      if (cancelled || measuring) return;
      measuring = true;
      let page;
      try {
        page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        if (!cancelled) {
          setZoom(fitPdfPageScale(viewport.width, viewport.height, scrollContainer.clientWidth, scrollContainer.clientHeight));
          setFitReady(true);
        }
      } catch { /* PDF loading reports errors through the main renderer effect. */ }
      finally { page?.cleanup(); measuring = false; }
    }
    const observer = new ResizeObserver(() => { void measurePage(); });
    observer.observe(scrollContainer);
    void measurePage();
    return () => { cancelled = true; observer.disconnect(); };
  }, [document, pageNumber, fitToPage, fitRequest]);

  const matches = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle ? pageTexts.filter((item) => item.text.toLocaleLowerCase().includes(needle)) : [];
  }, [pageTexts, search]);

  function addAnnotation(annotation: PdfAnnotation) {
    onAnnotationsChange([...session.annotations, annotation]);
    setSelectedAnnotationId(annotation.id);
    setTool('select');
  }

  function moveAnnotation(id: string, rect: NormalizedRect, pdfRect?: PdfRect) {
    onAnnotationsChange(session.annotations.map((item) => item.id === id ? { ...item, rect, pdfRect } : item));
  }

  function removeSelectedAnnotation() {
    if (!selectedAnnotationId) return;
    onAnnotationsChange(session.annotations.filter((item) => item.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  }

  function movePage(offset: number) {
    if (fitToPage) setFitReady(false);
    setPageNumber((current) => Math.max(1, Math.min(document?.numPages ?? 1, current + offset)));
  }

  function navigateToSearchResult(index: number) {
    const match = matches[index];
    if (match) setPageNumber(match.page);
  }

  function changeZoom(delta: number) {
    setFitToPage(false);
    setFitReady(true);
    setZoom((current) => Math.max(0.6, Math.min(2.4, Math.round((current + delta) * 10) / 10)));
  }

  return (
    <section className="pdf-document-editor" aria-label="PDF 文档工作区">
      <div className="pdf-toolbar">
        <div className="pdf-tools"><button disabled={busy} className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>选择/移动</button><button disabled={busy} className={tool === 'highlight' ? 'active' : ''} onClick={() => setTool('highlight')}>拖拽高亮</button><button disabled={busy} className={tool === 'note' ? 'active' : ''} onClick={() => setTool('note')}>添加批注</button><button disabled={busy || !selectedAnnotationId} onClick={removeSelectedAnnotation}>删除选中批注</button><button disabled={busy} onClick={onOcrCopy}>OCR 转可编辑副本</button></div>
        <div className="pdf-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 PDF 文本" aria-label="搜索 PDF 文本" /><span>{matches.length} 页匹配</span></div>
        <div className="pdf-page-nav"><button onClick={() => { setFitReady(false); setFitToPage(true); setFitRequest((current) => current + 1); }}>适合页面</button><button onClick={() => changeZoom(-0.2)} aria-label="缩小 PDF">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => changeZoom(0.2)} aria-label="放大 PDF">+</button><button disabled={!document || pageNumber <= 1} onClick={() => movePage(-1)}>上一页</button><span>{pageNumber} / {document?.numPages ?? '—'}</span><button disabled={!document || pageNumber >= (document?.numPages ?? 0)} onClick={() => movePage(1)}>下一页</button></div>
      </div>
      {matches.length > 0 && <div className="pdf-search-results">{matches.slice(0, 12).map((match, index) => <button key={match.page} onClick={() => navigateToSearchResult(index)}>第 {match.page} 页：{match.text.slice(0, 90)}</button>)}</div>}
      {error ? <div className="document-error">{error}</div> : null}
      <div className="pdf-page-scroll" ref={pageScrollRef}>
        {document && fitReady ? <PdfPageCanvas document={document} pageNumber={pageNumber} scale={zoom} annotations={session.annotations} selectedId={selectedAnnotationId} tool={busy ? null : tool} onAdd={addAnnotation} onMove={moveAnnotation} onSelect={setSelectedAnnotationId} onRenderError={setError} /> : <div className="document-empty">{document ? '正在适配页面大小…' : '正在解析 PDF 页面…'}</div>}
      </div>
    </section>
  );
}

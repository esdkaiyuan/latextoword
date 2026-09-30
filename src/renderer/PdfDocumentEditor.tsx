import { useEffect, useMemo, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPdfText } from '../domain/pdfImport';
import type { NormalizedRect, PdfAnnotation } from '../domain/pdfAnnotations';
import type { PdfSession } from '../domain/documentSession';
import PdfPageCanvas from './PdfPageCanvas';

type Props = { session: PdfSession; onAnnotationsChange: (items: PdfAnnotation[]) => void; onOcrCopy: () => void };

export default function PdfDocumentEditor({ session, onAnnotationsChange, onOcrCopy }: Props) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageTexts, setPageTexts] = useState<Array<{ page: number; text: string }>>([]);
  const [search, setSearch] = useState('');
  const [tool, setTool] = useState<'select' | 'highlight' | 'note' | null>('select');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1.5);

  useEffect(() => {
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const loading = getDocument({ data: new Uint8Array(session.originalBytes), useSystemFonts: true });
    loading.promise.then(setDocument).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'PDF 无法读取'));
    return () => { setDocument(null); void loading.destroy(); };
  }, [session.id, session.originalBytes]);

  useEffect(() => {
    let cancelled = false;
    void extractPdfText(session.originalBytes).then((result) => { if (!cancelled) setPageTexts(result.pages); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [session.id, session.originalBytes]);

  const matches = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle ? pageTexts.filter((item) => item.text.toLocaleLowerCase().includes(needle)) : [];
  }, [pageTexts, search]);

  function addAnnotation(annotation: PdfAnnotation) {
    onAnnotationsChange([...session.annotations, annotation]);
    setSelectedAnnotationId(annotation.id);
    setTool('select');
  }

  function moveAnnotation(id: string, rect: NormalizedRect) {
    onAnnotationsChange(session.annotations.map((item) => item.id === id ? { ...item, rect } : item));
  }

  function removeSelectedAnnotation() {
    if (!selectedAnnotationId) return;
    onAnnotationsChange(session.annotations.filter((item) => item.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  }

  function movePage(offset: number) {
    setPageNumber((current) => Math.max(1, Math.min(document?.numPages ?? 1, current + offset)));
  }

  function navigateToSearchResult(index: number) {
    const match = matches[index];
    if (match) setPageNumber(match.page);
  }

  function changeZoom(delta: number) {
    setZoom((current) => Math.max(0.6, Math.min(2.4, Math.round((current + delta) * 10) / 10)));
  }

  return (
    <section className="pdf-document-editor" aria-label="PDF 文档工作区">
      <div className="pdf-toolbar">
        <div className="pdf-tools"><button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>选择/移动</button><button className={tool === 'highlight' ? 'active' : ''} onClick={() => setTool('highlight')}>拖拽高亮</button><button className={tool === 'note' ? 'active' : ''} onClick={() => setTool('note')}>添加批注</button><button disabled={!selectedAnnotationId} onClick={removeSelectedAnnotation}>删除选中批注</button><button onClick={onOcrCopy}>OCR 转可编辑副本</button></div>
        <div className="pdf-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 PDF 文本" aria-label="搜索 PDF 文本" /><span>{matches.length} 页匹配</span></div>
        <div className="pdf-page-nav"><button onClick={() => changeZoom(-0.2)} aria-label="缩小 PDF">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => changeZoom(0.2)} aria-label="放大 PDF">+</button><button disabled={!document || pageNumber <= 1} onClick={() => movePage(-1)}>上一页</button><span>{pageNumber} / {document?.numPages ?? '—'}</span><button disabled={!document || pageNumber >= (document?.numPages ?? 0)} onClick={() => movePage(1)}>下一页</button></div>
      </div>
      {matches.length > 0 && <div className="pdf-search-results">{matches.slice(0, 12).map((match, index) => <button key={match.page} onClick={() => navigateToSearchResult(index)}>第 {match.page} 页：{match.text.slice(0, 90)}</button>)}</div>}
      {error ? <div className="document-error">{error}</div> : null}
      <div className="pdf-page-scroll">
        {document ? <PdfPageCanvas document={document} pageNumber={pageNumber} scale={zoom} annotations={session.annotations} selectedId={selectedAnnotationId} tool={tool} onAdd={addAnnotation} onMove={moveAnnotation} onSelect={setSelectedAnnotationId} /> : <div className="document-empty">正在解析 PDF 页面…</div>}
      </div>
    </section>
  );
}

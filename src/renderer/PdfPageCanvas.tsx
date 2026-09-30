import { useEffect, useRef, useState } from 'react';
import type { PageViewport, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs';
import { moveNormalizedRect, normalizedRectToPdfViewport, type NormalizedRect, type PdfAnnotation, type PdfRect } from '../domain/pdfAnnotations';
import 'pdfjs-dist/web/pdf_viewer.css';

type Props = { document: PDFDocumentProxy; pageNumber: number; scale: number; annotations: PdfAnnotation[]; selectedId: string | null; tool: 'select' | 'highlight' | 'note' | null; onAdd: (annotation: PdfAnnotation) => void; onMove: (id: string, rect: NormalizedRect, pdfRect?: PdfRect) => void; onSelect: (id: string) => void };
type Point = { x: number; y: number };
type Drag = { start: Point; end: Point; annotationId?: string; originalRect?: NormalizedRect };

function pagePoint(event: React.PointerEvent<HTMLDivElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
}

function dragRect(drag: Drag): NormalizedRect {
  if (drag.annotationId && drag.originalRect) return moveNormalizedRect(drag.originalRect, drag.end.x - drag.start.x, drag.end.y - drag.start.y);
  const x = Math.min(drag.start.x, drag.end.x);
  const y = Math.min(drag.start.y, drag.end.y);
  return { x, y, width: Math.max(0.012, Math.abs(drag.end.x - drag.start.x)), height: Math.max(0.012, Math.abs(drag.end.y - drag.start.y)) };
}

export default function PdfPageCanvas({ document, pageNumber, scale, annotations, selectedId, tool, onAdd, onMove, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<PageViewport | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1.42);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;
    let textLayer: TextLayerBuilder | null = null;
    async function renderPage() {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      viewportRef.current = viewport;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setAspectRatio(viewport.width / viewport.height);
      task = page.render({ canvas, canvasContext: context, viewport });
      textLayer = new TextLayerBuilder({ pdfPage: page });
      textLayerRef.current?.replaceChildren(textLayer.div);
      await textLayer.render({ viewport, images: null });
      await task.promise;
      page.cleanup();
    }
    void renderPage().catch(() => undefined);
    return () => { cancelled = true; task?.cancel(); textLayer?.cancel(); };
  }, [document, pageNumber, scale]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!tool) return;
    const start = pagePoint(event);
    if (tool === 'select') {
      const markElement = (event.target as HTMLElement).closest<HTMLElement>('[data-pdf-mark-id]');
      const annotationId = markElement?.dataset.pdfMarkId;
      const existing = annotations.find((item) => item.id === annotationId);
      if (!existing) return;
      onSelect(existing.id);
      const next = { start, end: start, annotationId: existing.id, originalRect: existing.rect };
      dragRef.current = next;
      setDrag(next);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = { start, end: start };
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const next = { ...dragRef.current, end: pagePoint(event) };
    dragRef.current = next;
    setDrag(next);
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !tool) return;
    const finished = { ...dragRef.current, end: pagePoint(event) };
    const rect = dragRect(finished);
    const pdfRect = viewportRef.current ? normalizedRectToPdfViewport(rect, viewportRef.current) : undefined;
    if (finished.annotationId) {
      onMove(finished.annotationId, rect, pdfRect);
      dragRef.current = null;
      setDrag(null);
      return;
    }
    if (tool === 'highlight') onAdd({ id: crypto.randomUUID(), page: pageNumber - 1, kind: 'highlight', rect, pdfRect });
    if (tool === 'note') {
      const text = window.prompt('批注内容')?.trim();
      if (text) onAdd({ id: crypto.randomUUID(), page: pageNumber - 1, kind: 'note', rect, pdfRect, text });
    }
    dragRef.current = null;
    setDrag(null);
  }

  const dragPreview = drag ? dragRect(drag) : null;

  return (
    <div className="pdf-page-frame" style={{ aspectRatio }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}>
      <canvas ref={canvasRef} className="pdf-page-canvas" aria-label={`PDF 第 ${pageNumber} 页`} />
      <div ref={textLayerRef} className="pdf-text-layer" />
      <div className={`pdf-annotation-layer ${tool === 'select' ? 'is-selecting' : tool ? 'is-drawing' : ''}`}>
        {annotations.filter((item) => item.page === pageNumber - 1).map((item) => <div key={item.id} data-pdf-mark-id={item.id} className={`pdf-mark pdf-mark-${item.kind} ${selectedId === item.id ? 'selected' : ''}`} title={item.text || '高亮'} style={{ left: `${item.rect.x * 100}%`, top: `${item.rect.y * 100}%`, width: `${item.rect.width * 100}%`, height: `${Math.max(item.rect.height, 0.025) * 100}%` }}>{item.kind === 'note' ? '✎' : null}</div>)}
        {dragPreview && <div className="pdf-mark pdf-mark-preview" style={{ left: `${dragPreview.x * 100}%`, top: `${dragPreview.y * 100}%`, width: `${dragPreview.width * 100}%`, height: `${Math.max(dragPreview.height, 0.025) * 100}%` }} />}
      </div>
    </div>
  );
}

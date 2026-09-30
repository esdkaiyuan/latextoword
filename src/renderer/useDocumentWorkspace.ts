import { useEffect, useEffectEvent, useState } from 'react';
import type { DocumentSession } from '../domain/documentSession';
import { applyPdfAnnotations, type PdfAnnotation } from '../domain/pdfAnnotations';
import { openSourceDocument, serializeSourceDocument } from '../domain/sourceDocument';
import { openDocumentSession, type OpenedDocumentFile } from './openDocumentSession';

type Props = { active: boolean; onDirtyChange: (dirty: boolean) => void; onExtractFormulas: (name: string, bytes: Uint8Array) => Promise<void> };

function editedSession(session: DocumentSession, update: Partial<DocumentSession>): DocumentSession {
  return { ...session, ...update, dirty: true } as DocumentSession;
}

function docxTitle(name: string): string {
  return name.replace(/\.[^.]+$/, '') || '文档';
}

export function useDocumentWorkspace({ active, onDirtyChange, onExtractFormulas }: Props) {
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('打开 Markdown、Word、PDF 等文档开始编辑');

  useEffect(() => onDirtyChange(Boolean(session?.dirty)), [session?.dirty, onDirtyChange]);

  async function openDocument() {
    if (!window.desktop) return setMessage('完整文档工作区需要桌面版文件读写能力');
    if (session?.dirty && !window.confirm('当前文档有未保存更改，继续打开将丢弃这些更改。是否继续？')) return;
    setBusy(true);
    try {
      const file = await window.desktop.documents.open();
      if (!file) return;
      const opened = await openDocumentSession(file);
      setSession(opened);
      setMessage(`已打开 ${file.name}${opened.warnings.length ? ` · ${opened.warnings.length} 条格式提示` : ''}`);
    } catch (error) {
      setMessage(error instanceof Error ? `打开失败：${error.message}` : '打开失败');
    } finally {
      setBusy(false);
    }
  }

  function changeSource(text: string) {
    setSession((current) => current?.mode === 'source' ? { ...current, text, dirty: text !== current.source.text } : current);
  }

  function changeRichHtml(html: string) {
    setSession((current) => current?.mode === 'rich-text' ? editedSession(current, { html }) : current);
  }

  function changePdfAnnotations(annotations: PdfAnnotation[]) {
    setSession((current) => current?.mode === 'pdf-annotation' ? editedSession(current, { annotations }) : current);
  }

  async function currentBytes(current: DocumentSession): Promise<Uint8Array> {
    if (current.mode === 'source') return serializeSourceDocument(current.source, current.text);
    if (current.mode === 'rich-text') return window.desktop!.documents.exportDocx({ title: docxTitle(current.name), html: current.html });
    if (current.mode === 'pdf-annotation') return applyPdfAnnotations(current.originalBytes, current.annotations);
    return current.originalBytes;
  }

  async function saveAs(current = session) {
    if (!current || current.mode === 'readonly' || !window.desktop) return setMessage('该文档只读，无法在应用内保存');
    setBusy(true);
    try {
      const bytes = await currentBytes(current);
      const defaultName = current.mode === 'rich-text' ? docxTitle(current.name) : current.name;
      const result = await window.desktop.documents.saveAs({ defaultName, mode: current.mode, bytes });
      if (!result) return;
      setSession(savedSession(current, result.path, result.name, bytes));
      setMessage(`已另存为 ${result.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? `另存失败：${error.message}` : '另存失败');
    } finally {
      setBusy(false);
    }
  }

  async function saveDocument() {
    if (!session || session.mode === 'readonly') return setMessage('该格式当前只读');
    if (!session.savePath) return saveAs(session);
    if (!window.desktop) return setMessage('保存文档需要桌面版文件读写能力');
    setBusy(true);
    try {
      const bytes = await currentBytes(session);
      const result = await window.desktop.documents.save({ path: session.savePath, bytes });
      setSession(savedSession(session, result.path, result.name, bytes));
      setMessage(`已保存 ${result.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  function savedSession(current: DocumentSession, path: string, name: string, bytes: Uint8Array): DocumentSession {
    if (current.mode === 'source') {
      const source = openSourceDocument(name, bytes);
      return { ...current, name, path, savePath: path, originalBytes: bytes, source, text: source.text, dirty: false, warnings: source.warnings };
    }
    if (current.mode === 'rich-text') return { ...current, name, path, savePath: path, originalBytes: bytes, dirty: false };
    if (current.mode === 'pdf-annotation') return { ...current, name, path, savePath: path, originalBytes: bytes, annotations: [], dirty: false };
    return current;
  }

  async function extractFormulas() {
    if (!session) return setMessage('请先打开文档');
    setBusy(true);
    try {
      await onExtractFormulas(session.name, await currentBytes(session));
      setMessage('已将文档公式发送到公式工作台复核');
    } catch (error) {
      setMessage(error instanceof Error ? `公式提取失败：${error.message}` : '公式提取失败');
    } finally {
      setBusy(false);
    }
  }

  async function createOcrCopy() {
    if (session?.mode !== 'pdf-annotation' || !window.desktop) return;
    setBusy(true);
    setMessage('正在本机 OCR 识别 PDF…');
    try {
      const result = await window.desktop.ocr.recognizeLocal({ name: session.name, kind: 'pdf', bytes: session.originalBytes });
      const name = `${docxTitle(session.name)}-OCR.md`;
      const bytes = new TextEncoder().encode(result.text);
      setSession(await openDocumentSession({ path: null, name, size: bytes.length, bytes }));
      setMessage('OCR 已生成独立 Markdown 副本；原 PDF 未修改');
    } catch (error) {
      setMessage(error instanceof Error ? `OCR 失败：${error.message}` : 'OCR 失败');
    } finally {
      setBusy(false);
    }
  }

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); void saveDocument(); }
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); void openDocument(); }
  });

  useEffect(() => {
    if (!active) return;
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [active]);

  return { session, busy, message, openDocument, saveDocument, saveAs, extractFormulas, createOcrCopy, changeSource, changeRichHtml, changePdfAnnotations };
}

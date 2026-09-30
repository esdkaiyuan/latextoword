import { lazy, Suspense } from 'react';
import { useDocumentWorkspace } from './useDocumentWorkspace';
import SourceDocumentEditor from './SourceDocumentEditor';
import DocumentPreview from './DocumentPreview';
import RichDocumentPreview from './RichDocumentPreview';
import ReadonlyDocumentPreview from './ReadonlyDocumentPreview';

const RichDocumentEditor = lazy(() => import('./RichDocumentEditor'));
const PdfDocumentEditor = lazy(() => import('./PdfDocumentEditor'));

type Props = { active: boolean; onDirtyChange: (dirty: boolean) => void; onExtractFormulas: (name: string, bytes: Uint8Array) => Promise<void> };

function WorkspaceActions({ onOpen, onSave, onSaveAs, onExtract, onReturn, canReturn, busy, canSave }: { onOpen: () => void; onSave: () => void; onSaveAs: () => void; onExtract: () => void; onReturn: () => void; canReturn: boolean; busy: boolean; canSave: boolean }) {
  return (
    <div className="document-toolbar-actions">
      <button onClick={onOpen} disabled={busy}>打开文档</button>
      <button onClick={onSave} disabled={busy || !canSave}>保存</button>
      <button onClick={onSaveAs} disabled={busy || !canSave}>另存为</button>
      <span className="document-toolbar-separator" />
      <button className="document-extract-button" onClick={onExtract} disabled={busy}>提取公式到工作台</button>
      {canReturn && <button onClick={onReturn} disabled={busy}>返回原 PDF</button>}
    </div>
  );
}

function DocumentBody({ session, actions }: { session: ReturnType<typeof useDocumentWorkspace>['session']; actions: ReturnType<typeof useDocumentWorkspace> }) {
  if (!session) return <div className="document-empty"><div className="document-empty-icon">文</div><h2>在工作台中编辑整份文档</h2><p>支持 Markdown、文本、LaTeX、Word、ODT、PDF 和更多可查看格式。</p><button onClick={actions.openDocument}>打开文档</button></div>;
  if (session.mode === 'source') return <div className="document-split-view"><SourceDocumentEditor value={session.text} format={session.format} readOnly={actions.busy} onChange={actions.changeSource} /><DocumentPreview format={session.format} source={session.text} /></div>;
  if (session.mode === 'rich-text') return <div className="document-split-view"><Suspense fallback={<div className="document-empty">正在加载 Word 编辑器…</div>}><RichDocumentEditor key={session.id} id={session.id} html={session.html} readOnly={actions.busy} onChange={actions.changeRichHtml} /></Suspense><RichDocumentPreview html={session.html} /></div>;
  if (session.mode === 'pdf-annotation') return <Suspense fallback={<div className="document-empty">正在加载 PDF 查看器…</div>}><PdfDocumentEditor key={session.id} session={session} busy={actions.busy} onAnnotationsChange={actions.changePdfAnnotations} onOcrCopy={() => { void actions.createOcrCopy(); }} /></Suspense>;
  return <ReadonlyDocumentPreview session={session} />;
}

export default function DocumentWorkspace({ active, onDirtyChange, onExtractFormulas }: Props) {
  const actions = useDocumentWorkspace({ active, onDirtyChange, onExtractFormulas });
  const session = actions.session;
  const canSave = Boolean(session && session.mode !== 'readonly');
  return (
    <div className="document-workspace">
      <header className="document-workspace-header">
        <div className="document-workspace-title"><div><strong>{session?.name ?? '文档工作区'}</strong>{session?.dirty && <span className="document-unsaved-dot" title="未保存更改" />}</div><small>{session ? `${session.format.toUpperCase()} · ${session.path ?? '新建副本'}${session.dirty ? ' · 未保存' : ''}` : '整份文档编辑、预览与格式适配'}</small></div>
        <WorkspaceActions onOpen={() => { void actions.openDocument(); }} onSave={() => { void actions.saveDocument(); }} onSaveAs={() => { void actions.saveAs(); }} onExtract={() => { void actions.extractFormulas(); }} onReturn={actions.restorePreviousDocument} canReturn={actions.previousSession?.mode === 'pdf-annotation'} busy={actions.busy} canSave={canSave} />
      </header>
      {session?.warnings.length ? <div className="document-warnings"><strong>格式提示</strong><span>{session.warnings.slice(0, 3).join('；')}</span></div> : null}
      <div className="document-workspace-body"><DocumentBody session={session} actions={actions} /></div>
      <footer className="document-workspace-footer"><span className={actions.busy ? 'document-status-busy' : 'document-status-dot'} />{actions.message}<span className="document-footer-spacer" />{session ? '文档内容仅在本机处理' : '本机文档工作区'}</footer>
    </div>
  );
}

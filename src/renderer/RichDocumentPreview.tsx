import { sanitizeRichDocumentHtml } from '../domain/richDocument';

type Props = { html: string };

export default function RichDocumentPreview({ html }: Props) {
  return (
    <section className="document-preview-column" aria-label="Word 文档预览">
      <div className="document-pane-heading"><strong>文档预览</strong><span>转换预览</span></div>
      <article className="document-preview-content" dangerouslySetInnerHTML={{ __html: sanitizeRichDocumentHtml(html) }} />
    </section>
  );
}

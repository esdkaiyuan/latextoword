import { renderSourcePreview } from '../domain/markdownPreview';

type Props = { format: string; source: string };

const PREVIEW_HINTS: Record<string, string> = {
  latex: '实时预览支持常见章节标题与数学环境；完整 LaTeX 宏包排版请使用 TeX 编译器。',
  rtf: 'RTF 以纯文本形式预览，保存仍保留 RTF 源文件结构。',
  'structured-text': '科研标记和脚本文件以安全文本方式预览。'
};

export default function DocumentPreview({ format, source }: Props) {
  const html = renderSourcePreview(format, source);
  return (
    <section className="document-preview-column" aria-label="文档实时预览">
      <div className="document-pane-heading"><strong>实时预览</strong><span>{format.toUpperCase()}</span></div>
      {PREVIEW_HINTS[format] && <div className="document-preview-hint">{PREVIEW_HINTS[format]}</div>}
      <article className="document-preview-content" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

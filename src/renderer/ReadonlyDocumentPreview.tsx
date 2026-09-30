import { useEffect, useState } from 'react';
import type { ReadonlySession } from '../domain/documentSession';

type Props = { session: ReadonlySession };

export default function ReadonlyDocumentPreview({ session }: Props) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (session.format !== 'image') return;
    const bytes = session.originalBytes.slice().buffer as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([bytes], { type: session.mime }));
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [session.id, session.format, session.mime, session.originalBytes]);

  return (
    <section className="document-readonly-preview" aria-label="只读文档预览">
      <div className="document-pane-heading"><strong>{session.format === 'image' ? '图片预览' : '文档内容预览'}</strong><span>只读 · {session.name}</span></div>
      {session.format === 'image' && imageUrl ? <img className="document-image-preview" src={imageUrl} alt={session.name} /> : null}
      {session.previewText ? <pre className="document-extracted-text">{session.previewText}</pre> : null}
      {!session.previewText && session.format !== 'image' && <div className="document-readonly-empty">此格式当前可查看或提取公式，但没有完整正文编辑适配器。原文件保持不变。</div>}
    </section>
  );
}

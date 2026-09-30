import { useEffect, useState } from 'react';
import { Button } from '@fluentui/react-components';
import { ChevronLeft, ChevronRight, ClipboardCopy, ExternalLink, FolderOpen, Sigma, X, ZoomIn, ZoomOut } from 'lucide-react';
import { canImportFormulas, fileKindForName, formatFileSize } from '../domain/fileView';

export type ViewerFile = {
  path: string;
  name: string;
  size: number;
  encoding: 'text' | 'base64' | 'binary' | 'too-large';
  mime?: string;
  data?: string;
  text?: string;
  truncated?: boolean;
};

type Props = {
  files: ViewerFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onImport: (file: ViewerFile) => void;
  onCopy: (file: ViewerFile) => void;
  onOpenExternal: (path: string) => void;
  onShowInFolder: (path: string) => void;
};

const KIND_LABEL: Record<string, string> = {
  markdown: 'Markdown',
  text: '文本',
  html: '网页',
  image: '图片',
  pdf: 'PDF',
  document: '办公/出版文档',
  binary: '二进制'
};

export default function FileViewer({ files, index, onIndexChange, onClose, onImport, onCopy, onOpenExternal, onShowInFolder }: Props) {
  const file = files[index];
  const kind = fileKindForName(file.name);
  const [zoom, setZoom] = useState(1);

  useEffect(() => setZoom(1), [index]);

  const importable = canImportFormulas(kind) && file.encoding !== 'binary' && file.encoding !== 'too-large';

  function body() {
    if (file.encoding === 'binary') return <div className="viewer-empty">此文件无法直接预览；可以尝试提取公式或使用系统程序打开。</div>;
    if (file.encoding === 'too-large') return <div className="viewer-empty">文件超过 20 MB，请用系统程序打开。</div>;
    if (kind === 'document' && file.encoding === 'base64') return <div className="viewer-empty">已识别为办公/出版文档。点击下方“导入此文件的公式”进行解析。</div>;
    if (kind === 'image' && file.mime === 'image/tiff') return <div className="viewer-empty">TIFF 暂不能在此预览；仍可使用本地或联网 OCR 提取公式。</div>;
    if (kind === 'image') return <img className="viewer-image" style={{ transform: `scale(${zoom})` }} src={`data:${file.mime};base64,${file.data}`} alt={file.name} />;
    if (kind === 'pdf') return <iframe className="viewer-frame" src={`data:application/pdf;base64,${file.data}`} title={file.name} />;
    if (kind === 'html') return <iframe className="viewer-frame" srcDoc={file.text ?? ''} sandbox="" title={file.name} />;
    return (
      <pre className="viewer-text">
        {file.text ?? ''}
        {file.truncated ? '\n\n…… 内容过长已截断，完整内容请用系统程序打开。' : ''}
      </pre>
    );
  }

  return (
    <div className="viewer-backdrop" role="dialog" aria-label="文件查看器">
      <div className="viewer">
        <div className="viewer-header">
          <span className="viewer-kind">{KIND_LABEL[kind] ?? '文件'}</span>
          <span className="viewer-name" title={file.path}>{file.name}</span>
          <span className="viewer-size">{formatFileSize(file.size)}</span>
          {files.length > 1 && (
            <span className="viewer-nav">
              <Button size="small" appearance="subtle" icon={<ChevronLeft size={14} />} disabled={index === 0} onClick={() => onIndexChange(index - 1)} aria-label="上一个文件" />
              <span>{index + 1} / {files.length}</span>
              <Button size="small" appearance="subtle" icon={<ChevronRight size={14} />} disabled={index === files.length - 1} onClick={() => onIndexChange(index + 1)} aria-label="下一个文件" />
            </span>
          )}
          <Button size="small" appearance="subtle" className="viewer-header-close" icon={<X size={14} />} onClick={onClose} aria-label="关闭查看器" />
        </div>

        <div className="viewer-body">
          {kind === 'image' && (
            <div className="viewer-zoom">
              <Button size="small" appearance="subtle" icon={<ZoomOut size={14} />} onClick={() => setZoom((value) => Math.max(0.2, value - 0.2))} aria-label="缩小" />
              <span>{Math.round(zoom * 100)}%</span>
              <Button size="small" appearance="subtle" icon={<ZoomIn size={14} />} onClick={() => setZoom((value) => Math.min(5, value + 0.2))} aria-label="放大" />
            </div>
          )}
          {body()}
        </div>

        <div className="viewer-actions">
          {importable && <Button size="small" appearance="primary" icon={<Sigma size={14} />} onClick={() => onImport(file)}>导入此文件的公式</Button>}
          {importable && <Button size="small" appearance="subtle" icon={<ClipboardCopy size={14} />} onClick={() => onCopy(file)}>复制全文</Button>}
          <Button size="small" appearance="subtle" icon={<ExternalLink size={14} />} onClick={() => onOpenExternal(file.path)}>用系统程序打开</Button>
          <Button size="small" appearance="subtle" icon={<FolderOpen size={14} />} onClick={() => onShowInFolder(file.path)}>显示所在文件夹</Button>
          <span className="viewer-path" title={file.path}>{file.path}</span>
        </div>
      </div>
    </div>
  );
}

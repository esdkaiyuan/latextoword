import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';

type Props = { value: string; format: string; readOnly: boolean; onChange: (value: string) => void };

function sourceExtensions(format: string) {
  return format === 'markdown' ? [markdown()] : [];
}

export default function SourceDocumentEditor({ value, format, readOnly, onChange }: Props) {
  return (
    <section className="document-editor-column" aria-label="文档编辑区">
      <div className="document-pane-heading"><strong>源码编辑</strong><span>{value.length.toLocaleString()} 字符</span></div>
      <div className="document-source-editor">
        <CodeMirror value={value} height="100%" extensions={sourceExtensions(format)} onChange={onChange} readOnly={readOnly} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} aria-label="整份文档源码" />
      </div>
    </section>
  );
}

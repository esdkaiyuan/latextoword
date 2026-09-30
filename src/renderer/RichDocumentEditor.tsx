import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { Link } from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

type Props = { id: string; html: string; onChange: (html: string) => void };

function commandButton(editor: ReturnType<typeof useEditor>, label: string, run: () => void, active = false) {
  return <button type="button" className={active ? 'active' : ''} disabled={!editor} onClick={run}>{label}</button>;
}

export default function RichDocumentEditor({ id, html, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, TableKit.configure({ table: { resizable: true } }), Link.configure({ openOnClick: false, protocols: ['http', 'https', 'mailto'] }), Image.configure({ allowBase64: true })],
    content: html,
    onUpdate: ({ editor: current }) => onChange(current.getHTML())
  }, [id]);

  return (
    <section className="document-editor-column" aria-label="Word 文档编辑区">
      <div className="document-pane-heading"><strong>富文本编辑</strong><span>常用段落、标题、列表、表格与图片</span></div>
      <div className="rich-editor-toolbar">
        {commandButton(editor, '粗体', () => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold'))}
        {commandButton(editor, '斜体', () => editor?.chain().focus().toggleItalic().run(), editor?.isActive('italic'))}
        {commandButton(editor, '标题', () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), editor?.isActive('heading'))}
        {commandButton(editor, '项目符号', () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList'))}
        {commandButton(editor, '编号', () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList'))}
        {commandButton(editor, '撤销', () => editor?.chain().focus().undo().run())}
        {commandButton(editor, '重做', () => editor?.chain().focus().redo().run())}
      </div>
      <EditorContent editor={editor} className="rich-editor-content" />
    </section>
  );
}

import { useCallback, useMemo, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { latex } from './latexLanguage';

export type CursorPosition = { line: number; column: number; lines: number };

type Props = {
  value: string;
  dark: boolean;
  macros: Record<string, string>;
  onChange: (value: string) => void;
  onCreateEditor: (view: EditorView) => void;
  onScrollRatio?: (ratio: number) => void;
  onCursor?: (position: CursorPosition) => void;
};

export default function LatexEditor({ value, dark, macros, onChange, onCreateEditor, onScrollRatio, onCursor }: Props) {
  // 回调放 ref，扩展只随 macros 重建，避免每次渲染都重配编辑器
  const handlers = useRef({ onScrollRatio, onCursor });
  handlers.current = { onScrollRatio, onCursor };

  const extensions = useMemo(() => [
    latex(macros),
    EditorView.updateListener.of((update) => {
      if (!update.selectionSet && !update.docChanged) return;
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      handlers.current.onCursor?.({ line: line.number, column: head - line.from + 1, lines: update.state.doc.lines });
    })
  ], [macros]);

  const handleCreateEditor = useCallback((view: EditorView) => {
    onCreateEditor(view);
    const scroller = view.scrollDOM;
    scroller.addEventListener('scroll', () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      handlers.current.onScrollRatio?.(max > 0 ? scroller.scrollTop / max : 0);
    }, { passive: true });
  }, [onCreateEditor]);

  return (
    <div className="latex-editor-wrap">
      <CodeMirror
        value={value}
        height="100%"
        theme={dark ? 'dark' : 'light'}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={handleCreateEditor}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          autocompletion: false,
          closeBrackets: false,
          bracketMatching: true,
          highlightActiveLine: true,
          searchKeymap: true
        }}
      />
    </div>
  );
}

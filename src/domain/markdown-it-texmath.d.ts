declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it';

  type TexMathOptions = {
    engine: { renderToString: (source: string, options?: Record<string, unknown>) => string };
    delimiters?: string | string[];
    katexOptions?: Record<string, unknown>;
  };

  const texmath: (markdown: MarkdownIt, options: TexMathOptions) => void;
  export default texmath;
}

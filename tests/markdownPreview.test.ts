import { describe, expect, it } from 'vitest';
import { renderMarkdownPreview, renderSourcePreview } from '../src/domain/markdownPreview';

describe('Markdown preview', () => {
  it('renders headings and display math from the current source', () => {
    const html = renderMarkdownPreview('# 模型\n\n$$\nx^2+y^2=1\n$$');

    expect(html).toContain('<h1>模型</h1>');
    expect(html).toContain('katex-display');
  });

  it('escapes raw HTML and rejects executable URL schemes', () => {
    const html = renderMarkdownPreview('<script>alert(1)</script>\n\n[危险](javascript:alert(1))');

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });

  it('renders common LaTeX document headings and equation environments', () => {
    const html = renderSourcePreview('latex', '\\documentclass{article}\n\\begin{document}\n\\section{方法}\n\\begin{equation}x^2=1\\end{equation}\n\\end{document}');

    expect(html).toContain('<h2>方法</h2>');
    expect(html).toContain('katex-display');
  });

  it('keeps plain-text punctuation literal in text-file previews', () => {
    expect(renderSourcePreview('text', '*literal* <tag>')).toContain('*literal* &lt;tag&gt;');
  });
});

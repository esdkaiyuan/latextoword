import MarkdownIt from 'markdown-it';
import katex from 'katex';
import texmath from 'markdown-it-texmath';
import { rtfToText } from './documentImport';
import { sanitizeRichDocumentHtml } from './richDocument';

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false, typographer: false });
markdown.use(texmath, {
  engine: katex,
  delimiters: ['dollars', 'brackets', 'beg_end'],
  katexOptions: { throwOnError: false, trust: false, strict: 'ignore' }
});

export function renderMarkdownPreview(source: string): string {
  return markdown.render(source);
}

function latexToPreviewMarkdown(source: string): string {
  return source
    .replace(/^\\(?:documentclass|usepackage)(?:\[[^\]]*\])?\{[^}]*\}\s*$/gm, '')
    .replace(/\\begin\{document\}|\\end\{document\}|\\maketitle/g, '')
    .replace(/\\title\{([^}]*)\}/g, '# $1')
    .replace(/\\section\{([^}]*)\}/g, '## $1')
    .replace(/\\subsection\{([^}]*)\}/g, '### $1')
    .replace(/\\subsubsection\{([^}]*)\}/g, '#### $1');
}

function renderPlainText(source: string): string {
  return source.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
}

function escapeHtml(source: string): string {
  return source.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function renderSourcePreview(format: string, source: string): string {
  if (format === 'html') return sanitizeRichDocumentHtml(source);
  if (format === 'latex') return renderMarkdownPreview(latexToPreviewMarkdown(source));
  if (format === 'rtf') return renderPlainText(rtfToText(source));
  if (format === 'markdown') return renderMarkdownPreview(source);
  if (format === 'text') return renderPlainText(source);
  return renderPlainText(source);
}

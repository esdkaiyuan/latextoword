export type DocumentEditMode = 'source' | 'rich-text' | 'pdf-annotation' | 'readonly';
export type DocumentCapability = {
  mode: DocumentEditMode;
  format: string;
  preview: boolean;
  saveAs: boolean;
  extractFormulas: boolean;
};

const SOURCE_EXTENSIONS = new Map([
  ['.md', 'markdown'], ['.markdown', 'markdown'], ['.mdown', 'markdown'], ['.mkdn', 'markdown'],
  ['.mdx', 'markdown'], ['.qmd', 'markdown'], ['.rmd', 'markdown'], ['.txt', 'text'],
  ['.tex', 'latex'], ['.latex', 'latex'], ['.ltx', 'latex'], ['.html', 'html'], ['.htm', 'html'],
  ['.xhtml', 'html'], ['.rtf', 'rtf'], ['.rst', 'structured-text'], ['.org', 'structured-text'],
  ['.py', 'structured-text'], ['.r', 'structured-text'], ['.m', 'structured-text'], ['.jl', 'structured-text'],
  ['.sage', 'structured-text'], ['.csv', 'text'], ['.tsv', 'text']
]);

function extensionOf(name: string): string {
  const leaf = name.split(/[\\/]/).at(-1) ?? name;
  const dot = leaf.lastIndexOf('.');
  return dot < 0 ? '' : leaf.slice(dot).toLowerCase();
}

export function documentCapabilities(name: string): DocumentCapability {
  const extension = extensionOf(name);
  const sourceFormat = SOURCE_EXTENSIONS.get(extension);
  if (sourceFormat) return { mode: 'source', format: sourceFormat, preview: true, saveAs: true, extractFormulas: true };
  if (['.docx', '.docm', '.odt', '.doc'].includes(extension)) {
    return { mode: 'rich-text', format: extension.slice(1), preview: true, saveAs: true, extractFormulas: true };
  }
  if (extension === '.pdf') return { mode: 'pdf-annotation', format: 'pdf', preview: true, saveAs: true, extractFormulas: true };
  return { mode: 'readonly', format: extension.slice(1) || 'unknown', preview: true, saveAs: false, extractFormulas: true };
}

export function isDocumentSaveTarget(name: string, mode: DocumentEditMode): boolean {
  const extension = extensionOf(name);
  if (mode === 'source') return Array.from(SOURCE_EXTENSIONS.keys()).includes(extension);
  if (mode === 'rich-text') return ['.docx', '.odt'].includes(extension);
  return mode === 'pdf-annotation' && extension === '.pdf';
}

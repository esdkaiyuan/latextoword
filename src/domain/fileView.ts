export type ViewFileKind = 'markdown' | 'text' | 'html' | 'image' | 'pdf' | 'document' | 'binary';

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|tif|tiff)$/i;
const HTML_EXTS = /\.(html?|xhtml)$/i;
const MARKDOWN_EXTS = /\.(md|markdown|mdown|mkdn|mdx|qmd|rmd)$/i;
const TEXT_EXTS = /\.(txt|tex|latex|ltx|json|ltw|csv|tsv|rst|org|r|m|jl|sage|log|xml|yml|yaml|ini|cfg|conf|toml|env|bat|sh|ps1|py|js|jsx|ts|tsx|css|scss|c|h|cpp|hpp|java|rs|go|sql|license|readme)$/i;
const DOCUMENT_EXTS = /\.(rtf|ipynb|doc|docx|docm|ppt|pptx|pptm|pps|ppsx|xls|xlsx|xlsm|xlsb|odt|odp|ods|epub)$/i;

export function fileKindForName(name: string): ViewFileKind {
  const lower = name.toLowerCase();
  if (IMAGE_EXTS.test(lower)) return 'image';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (DOCUMENT_EXTS.test(lower)) return 'document';
  if (HTML_EXTS.test(lower)) return 'html';
  if (MARKDOWN_EXTS.test(lower)) return 'markdown';
  if (TEXT_EXTS.test(lower) || !lower.includes('.')) return 'text';
  return 'binary';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 'B';
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

/** 文本类文件才能从中提取公式。 */
export function canImportFormulas(kind: ViewFileKind): boolean {
  return kind === 'text' || kind === 'markdown' || kind === 'html' || kind === 'document' || kind === 'pdf' || kind === 'image';
}

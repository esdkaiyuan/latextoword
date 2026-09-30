import { inlineKatexFonts } from '../domain/imageExport';
import katexCss from 'katex/dist/katex.min.css?raw';

const fontModules = import.meta.glob('/node_modules/katex/dist/fonts/*.woff2', {
  query: '?inline',
  import: 'default',
  eager: true
}) as Record<string, string>;

const fonts: Record<string, string> = {};
for (const [path, dataUrl] of Object.entries(fontModules)) {
  const name = path.split('/').pop();
  if (name) fonts[name] = dataUrl;
}

let cached: string | null = null;

/** 图片导出用的 KaTeX 样式：字体已内嵌为 data URI，脱离页面也能正确渲染。 */
export function getKatexCssWithFonts(): string {
  if (cached === null) cached = inlineKatexFonts(katexCss, fonts);
  return cached;
}

export type FontSources = Record<string, string>;

/** KaTeX 的 woff/ttf 回退源在独立 SVG 中无法解析，先移除，再把 woff2 换成内嵌数据 URI。 */
export function inlineKatexFonts(css: string, fonts: FontSources): string {
  const modernOnly = css.replace(
    /,\s*url\((?:fonts\/)?[\w-]+\.woff\)\s*format\("woff"\),\s*url\((?:fonts\/)?[\w-]+\.ttf\)\s*format\("truetype"\)/g,
    ''
  );
  return modernOnly.replace(/url\((?:fonts\/)?([\w-]+\.woff2)\)/g, (match, name: string) =>
    fonts[name] ? `url(${fonts[name]})` : match
  );
}

export type FormulaBox = { width: number; height: number; padding?: number };

/** 生成自带字体与样式的独立 SVG，可脱离页面直接保存或栅格化。 */
export function buildFormulaSvg(html: string, css: string, box: FormulaBox, background = '#ffffff'): string {
  const padding = Math.max(0, box.padding ?? 16);
  const width = Math.max(1, Math.ceil(box.width + padding * 2));
  const height = Math.max(1, Math.ceil(box.height + padding * 2));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${background}"/>`,
    '<foreignObject width="100%" height="100%">',
    `<div xmlns="http://www.w3.org/1999/xhtml" style="background:${background};padding:${padding}px">`,
    `<style>${css}</style>`,
    html,
    '</div></foreignObject></svg>'
  ].join('');
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '').trim();
  return cleaned.slice(0, 60) || 'formula';
}

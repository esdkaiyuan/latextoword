import { buildFormulaSvg, svgToDataUrl } from '../domain/imageExport';

const PADDING = 16;
const PNG_SCALE = 3;

/** 在离屏节点里量出 KaTeX 输出的实际尺寸。 */
export function measureHtml(html: string): { width: number; height: number } {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;display:inline-block';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const rect = host.getBoundingClientRect();
    return { width: rect.width || host.scrollWidth || 1, height: rect.height || host.scrollHeight || 1 };
  } finally {
    host.remove();
  }
}

export function buildFormulaImage(html: string, css: string): { svg: string; width: number; height: number } {
  const box = measureHtml(html);
  const svg = buildFormulaSvg(html, css, { width: box.width, height: box.height, padding: PADDING });
  return { svg, width: Math.ceil(box.width + PADDING * 2), height: Math.ceil(box.height + PADDING * 2) };
}

export async function svgToPngDataUrl(svg: string, width: number, height: number, scale = PNG_SCALE): Promise<string> {
  const image = new Image();
  image.src = svgToDataUrl(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前环境不支持画布渲染');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

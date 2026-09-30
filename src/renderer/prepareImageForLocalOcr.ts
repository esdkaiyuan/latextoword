const RASTERIZE_EXTENSIONS = /\.(svg|avif|gif)$/i;

function safeSvg(bytes: Uint8Array): Blob {
  const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') throw new Error('SVG 图片格式无效');
  document.querySelectorAll('script,foreignObject,iframe,object,embed').forEach((node) => node.remove());
  for (const element of [document.documentElement, ...Array.from(document.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      if (attribute.name === 'href' || attribute.name.endsWith(':href')) {
        if (attribute.value && !attribute.value.startsWith('#') && !attribute.value.startsWith('data:image/')) element.removeAttribute(attribute.name);
      }
      if (attribute.name === 'style' && /url\(/i.test(attribute.value)) element.removeAttribute(attribute.name);
    }
  }
  document.querySelectorAll('style').forEach((style) => {
    if (/@import|url\(/i.test(style.textContent ?? '')) style.remove();
  });
  return new Blob([new XMLSerializer().serializeToString(document)], { type: 'image/svg+xml' });
}

async function rasterize(source: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, 8192 / bitmap.width, 8192 / bitmap.height, Math.sqrt(32_000_000 / (bitmap.width * bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
    canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建图片 OCR 画布');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法转换图片')) , 'image/png'));
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

export async function prepareImageForLocalOcr(name: string, bytes: Uint8Array): Promise<{ name: string; bytes: Uint8Array }> {
  if (bytes.length > 100 * 1024 * 1024) throw new Error('图片超过 100 MB 安全上限');
  if (!RASTERIZE_EXTENSIONS.test(name)) return { name, bytes };
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const source = /\.svg$/i.test(name) ? safeSvg(bytes) : new Blob([buffer]);
  return { name: `${name.replace(/\.[^.]+$/, '')}.png`, bytes: await rasterize(source) };
}

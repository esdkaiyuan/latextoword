const IMAGE_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.tif': 'image/tiff',
  '.tiff': 'image/tiff', '.bmp': 'image/bmp', '.webp': 'image/webp', '.gif': 'image/gif'
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

function safeFileName(name) {
  return String(name || 'document').split(/[\\/]/).at(-1).replace(/[\r\n\0]/g, '').slice(0, 180) || 'document';
}

async function responseJson(response, context) {
  if (!response.ok) throw new Error(`${context}失败（HTTP ${response.status}）`);
  return response.json();
}

function createMathpixClient(loadCredentials, fetcher = fetch) {
  async function headers() {
    const credentials = await loadCredentials();
    if (!credentials?.appId || !credentials?.appKey) throw new Error('请先在导入设置中配置 Mathpix 凭据');
    return { app_id: credentials.appId, app_key: credentials.appKey };
  }

  async function recognizeImage(name, bytes) {
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('联网单图识别限制为 10 MB');
    const ext = require('node:path').extname(name).toLowerCase();
    const type = IMAGE_MIME[ext];
    if (!type) throw new Error('联网图片识别暂不支持此图片格式');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), safeFileName(name));
    form.append('options_json', JSON.stringify({ formats: ['text'], rm_spaces: true, metadata: { improve_mathpix: false } }));
    const response = await fetcher('https://api.mathpix.com/v3/text', {
      method: 'POST', headers: await headers(), body: form, signal: AbortSignal.timeout(60_000)
    });
    const result = await responseJson(response, 'Mathpix 图片识别');
    return typeof result.text === 'string' ? result.text : '';
  }

  async function recognizeDocument(name, bytes, onProgress = () => {}) {
    if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error('联网文档识别限制为 100 MB');
    const form = new FormData();
    form.append('file', new Blob([bytes]), safeFileName(name));
    form.append('options_json', JSON.stringify({ include_page_breaks: true, metadata: { improve_mathpix: false } }));
    const auth = await headers();
    const submitted = await fetcher('https://api.mathpix.com/v3/pdf', {
      method: 'POST', headers: auth, body: form, signal: AbortSignal.timeout(120_000)
    });
    const { pdf_id: pdfId } = await responseJson(submitted, 'Mathpix 文档上传');
    if (typeof pdfId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(pdfId)) throw new Error('Mathpix 未返回有效任务编号');
    try {
      for (let attempt = 0; attempt < 180; attempt += 1) {
        const statusResponse = await fetcher(`https://api.mathpix.com/v3/pdf/${encodeURIComponent(pdfId)}`, {
          headers: auth, signal: AbortSignal.timeout(30_000)
        });
        const status = await responseJson(statusResponse, 'Mathpix 状态查询');
        onProgress({ stage: '识别中', percent: Number(status.percent_done) || 0 });
        if (status.status === 'error') throw new Error('Mathpix 无法识别此文件');
        if (status.status === 'completed') {
          const output = await fetcher(`https://api.mathpix.com/v3/pdf/${encodeURIComponent(pdfId)}.mmd`, {
            headers: auth, signal: AbortSignal.timeout(60_000)
          });
          if (!output.ok) throw new Error(`Mathpix 结果下载失败（HTTP ${output.status}）`);
          onProgress({ stage: '解析完成', percent: 100 });
          return output.text();
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error('Mathpix 识别超时，可重试此文件');
    } finally {
      await fetcher(`https://api.mathpix.com/v3/pdf/${encodeURIComponent(pdfId)}`, {
        method: 'DELETE', headers: auth, signal: AbortSignal.timeout(15_000)
      }).catch(() => undefined);
    }
  }

  return { recognizeImage, recognizeDocument };
}

module.exports = { createMathpixClient };

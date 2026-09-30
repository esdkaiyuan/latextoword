import { Unzip, UnzipInflate } from 'fflate';

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_XML_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_XML_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 10_000;
const XML_ENTRY = /\.(xml|xhtml|html|opf|rels)$/i;
const IMAGE_ENTRY = /\.(png|jpe?g|tiff?|bmp|webp)$/i;

async function readSelectedEntries(bytes: Uint8Array, filter: RegExp, maxEntryBytes: number, maxTotalBytes: number): Promise<Map<string, Uint8Array>> {
  if (bytes.length > MAX_ARCHIVE_BYTES) throw new Error('压缩文档超过 100 MB，无法安全解析');
  return new Promise((resolve, reject) => {
    const archive = new Unzip();
    const entries = new Map<string, Uint8Array>();
    let entryCount = 0;
    let activeFiles = 0;
    let totalBytes = 0;
    let pushed = false;
    let settled = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    const finishIfReady = () => {
      if (!settled && pushed && activeFiles === 0) {
        settled = true;
        resolve(entries);
      }
    };

    archive.register(UnzipInflate);
    archive.onfile = (file) => {
      entryCount += 1;
      if (entryCount > MAX_ARCHIVE_ENTRIES) return fail('压缩文档包含过多条目');
      if (!filter.test(file.name)) return;
      if (file.name.startsWith('/') || file.name.includes('..\\') || file.name.split('/').includes('..')) return fail('压缩文档包含不安全路径');
      if ((file.originalSize ?? 0) > maxEntryBytes) return fail('文档部件超过单项安全限制');
      activeFiles += 1;
      const chunks: Uint8Array[] = [];
      let entryBytes = 0;
      file.ondata = (error, chunk, final) => {
        if (settled) return;
        if (error) return fail(`无法解压 ${file.name}`);
        entryBytes += chunk.length;
        totalBytes += chunk.length;
        if (entryBytes > maxEntryBytes || totalBytes > maxTotalBytes) return fail('解压后的文档内容超过安全限制');
        chunks.push(chunk);
        if (final) {
          const joined = new Uint8Array(entryBytes);
          let offset = 0;
          for (const part of chunks) { joined.set(part, offset); offset += part.length; }
          entries.set(file.name, joined);
          activeFiles -= 1;
          finishIfReady();
        }
      };
      try { file.start(); } catch { fail(`无法读取压缩部件 ${file.name}`); }
    };

    try {
      archive.push(bytes, true);
      pushed = true;
      finishIfReady();
    } catch {
      fail('文件不是有效或受支持的压缩文档');
    }
  });
}

export async function readArchiveXml(bytes: Uint8Array): Promise<Map<string, string>> {
  const entries = await readSelectedEntries(bytes, XML_ENTRY, MAX_XML_BYTES, MAX_TOTAL_XML_BYTES);
  return new Map(Array.from(entries, ([name, content]) => [name, new TextDecoder('utf-8').decode(content)]));
}

export function readArchiveImages(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  return readSelectedEntries(bytes, IMAGE_ENTRY, 50 * 1024 * 1024, 150 * 1024 * 1024);
}

import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { strToU8, zipSync } from 'fflate';
import { buildDocxParts } from '../src/domain/docx';
import { importRichDocument, sanitizeRichDocumentHtml } from '../src/domain/richDocument';

const require = createRequire(import.meta.url);
const htmlToDocx = require('html-to-docx') as (html: string) => Promise<Uint8Array>;

describe('rich document HTML safety', () => {
  it('removes scripts, event handlers, unsafe links, and remote embeds', () => {
    const html = sanitizeRichDocumentHtml('<h1 onclick="run()">标题</h1><script>run()</script><a href="javascript:run()">链接</a><img src="https://example.com/image.png">');

    expect(html).toContain('<h1>标题</h1>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('https://example.com');
  });

  it('imports paragraphs, headings, and tables from a complete DOCX package', async () => {
    const docx = await htmlToDocx('<h1>研究方法</h1><p>正文段落</p><table><tr><td>变量</td><td>数值</td></tr></table>');
    const imported = await importRichDocument(new Uint8Array(docx));

    expect(imported.html).toContain('<h1>研究方法</h1>');
    expect(imported.html).toContain('正文段落');
    expect(imported.html).toContain('<table>');
  });

  it('surfaces a warning when a Word equation is not represented in rich-text HTML', async () => {
    const parts = buildDocxParts('公式', [{ name: 'x', mathml: '<math><mi>x</mi></math>', displayMode: 'block', fontFamily: 'Cambria Math', fontSizePt: 14 }]);
    const packageBytes = zipSync(Object.fromEntries(parts.map((part) => [part.path, strToU8(part.content)])));
    const imported = await importRichDocument(packageBytes);

    expect(imported.warnings.length).toBeGreaterThan(0);
  });
});

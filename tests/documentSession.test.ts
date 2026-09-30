import { describe, expect, it } from 'vitest';
import { openDocumentSession } from '../src/renderer/openDocumentSession';

describe('document session opening', () => {
  it('opens a Markdown file as an editable whole-document source', async () => {
    const bytes = new TextEncoder().encode('# 研究记录\n\n公式 $x^2$');
    const session = await openDocumentSession({ path: 'C:/papers/notes.md', name: 'notes.md', size: bytes.length, bytes });

    expect(session).toMatchObject({ mode: 'source', format: 'markdown', savePath: 'C:/papers/notes.md', text: '# 研究记录\n\n公式 $x^2$' });
  });

  it('opens image files in the image preview path for later OCR', async () => {
    const session = await openDocumentSession({ path: 'C:/papers/scan.png', name: 'scan.png', size: 8, bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) });

    expect(session).toMatchObject({ mode: 'readonly', format: 'image', mime: 'image/png' });
  });
});

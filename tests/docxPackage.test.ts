import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { buildDocxParts } from '../src/domain/docx';

const require = createRequire(import.meta.url);
const { createZip } = require('../src/main/zip.cjs') as { createZip: (entries: Array<{ name: string; data: Buffer }>) => Buffer };

function toMathml(latex: string): string {
  return katex.renderToString(latex, { displayMode: true, throwOnError: true, output: 'mathml' });
}

describe('docx packaging', () => {
  it('writes a zip that carries every ooxml part', () => {
    const parts = buildDocxParts('测试公式集', [
      { name: '二次方程', mathml: toMathml('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'), displayMode: 'block', fontFamily: 'Cambria Math', fontSizePt: 14 }
    ]);

    const archive = createZip(parts.map((part) => ({ name: part.path, data: Buffer.from(part.content, 'utf8') })));

    expect(archive.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(archive.subarray(archive.length - 22, archive.length - 20).toString('hex')).toBe('504b');
    for (const part of parts) expect(archive.includes(Buffer.from(part.path, 'utf8'))).toBe(true);
    expect(archive.includes(Buffer.from('<m:oMathPara>', 'utf8'))).toBe(true);

    const output = 'test-artifacts/sample.docx';
    mkdirSync('test-artifacts', { recursive: true });
    writeFileSync(output, archive);
    expect(readFileSync(output).length).toBe(archive.length);
  });
});

import { describe, expect, it } from 'vitest';
import { copyPdfBytesForWorker } from '../src/domain/pdfImport';

describe('PDF.js document loading', () => {
  it('keeps the source byte buffer intact when PDF.js transfers its input to a worker', () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const workerInput = copyPdfBytesForWorker(source);

    structuredClone(workerInput.buffer, { transfer: [workerInput.buffer] });

    expect(source).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

});

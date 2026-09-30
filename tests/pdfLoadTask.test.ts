import { describe, expect, it, vi } from 'vitest';
import { observePdfLoad } from '../src/domain/pdfLoadTask';

describe('PDF loading task lifecycle', () => {
  it('ignores a loading-aborted rejection after its effect is cleaned up', async () => {
    let rejectTask!: (reason: Error) => void;
    const promise = new Promise<unknown>((_, reject) => { rejectTask = reject; });
    const onError = vi.fn();
    const cancel = observePdfLoad(promise, () => undefined, () => undefined, onError);

    cancel();
    rejectTask(new Error('Loading aborted'));
    await Promise.resolve();

    expect(onError).not.toHaveBeenCalled();
  });

  it('reports actual errors while the PDF view is still active', async () => {
    const failure = new Error('Invalid PDF structure');
    const onError = vi.fn();

    observePdfLoad(Promise.reject(failure), () => undefined, () => undefined, onError);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(failure);
  });
});

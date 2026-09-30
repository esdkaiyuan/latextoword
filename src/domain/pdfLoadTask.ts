export function observePdfLoad<T>(
  promise: Promise<T>,
  cancel: () => void | Promise<void>,
  onLoad: (value: T) => void,
  onError: (reason: unknown) => void
): () => void {
  let cancelled = false;
  promise.then(
    (value) => { if (!cancelled) onLoad(value); },
    (reason: unknown) => { if (!cancelled) onError(reason); }
  );
  return () => {
    cancelled = true;
    void Promise.resolve(cancel()).catch(() => undefined);
  };
}

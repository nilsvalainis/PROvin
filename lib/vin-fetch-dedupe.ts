/**
 * Īss atmiņas kešs vienam avota zvanam (session/VIN/URL).
 * Stripe webhook sēkla un VIN SCAN bieži prasa to pašu avotu vienlaikus.
 */

const DEFAULT_TTL_MS = 60_000;

type Slot = { at: number; promise: Promise<unknown> };

const slots = new Map<string, Slot>();

export function dedupeAsync<T>(key: string, run: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const prev = slots.get(key);
  if (prev && now - prev.at < ttlMs) return prev.promise as Promise<T>;
  const promise = Promise.resolve().then(run);
  const slot: Slot = { at: now, promise };
  slots.set(key, slot);
  promise.then(
    () => undefined,
    () => {
      if (slots.get(key) === slot) slots.delete(key);
    },
  );
  return promise;
}

export function resetVinFetchDedupe(): void {
  slots.clear();
}

/**
 * VIN SCAN palaišanas lēmumi bez I/O: iestrēdzis „running”, already_done, 60 s dedupe.
 */

export const ORDER_VIN_SCAN_STUCK_MS = 10 * 60 * 1000;
export const ORDER_VIN_SCAN_DEDUPE_MS = 60_000;

const slots = new Map<string, { at: number; promise: Promise<unknown> }>();

export function orderVinScanRunningAgeMs(at: string, now = Date.now()): number {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - t);
}

export function orderVinScanRunningIsStuck(at: string, now = Date.now()): boolean {
  return orderVinScanRunningAgeMs(at, now) >= ORDER_VIN_SCAN_STUCK_MS;
}

/** unknown / timeout / blocked nav „pabeigts”: already_done tos ignorē un skenē vēlreiz. */
export function orderVinScanSourceNeedsRescan(status: string): boolean {
  return status === "unknown" || status === "timeout" || status === "blocked";
}

export function orderVinScanAlreadyDone(indicators: readonly { status: string }[]): boolean {
  return indicators.length > 0 && !indicators.some((row) => orderVinScanSourceNeedsRescan(row.status));
}

export function orderVinScanDedupeKey(sessionId: string, vin: string): string {
  return `${sessionId.trim()}:${vin.trim().toUpperCase()}`;
}

export function takeOrderVinScanSlot<T>(
  key: string,
  force: boolean,
  run: () => Promise<T>,
  now = Date.now(),
): Promise<T> {
  const prev = slots.get(key);
  if (!force && prev && now - prev.at < ORDER_VIN_SCAN_DEDUPE_MS) return prev.promise as Promise<T>;
  const promise = Promise.resolve().then(run);
  const slot = { at: now, promise: promise as Promise<unknown> };
  slots.set(key, slot);
  promise.then(
    () => undefined,
    () => {
      if (slots.get(key) === slot) slots.delete(key);
    },
  );
  return promise;
}

export function resetOrderVinScanSlots(): void {
  slots.clear();
}

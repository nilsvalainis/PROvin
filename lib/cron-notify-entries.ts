/** Cron paziņojumu dedupe ieraksti: atslēga -> pēdējās sūtīšanas laiks (ISO). */
export type CronNotifyEntries = Record<string, string>;

/** Izmet ierakstus, kas vecāki par `ttlMs` (lai fails neaug bezgalīgi). */
export function pruneCronNotifyEntries(entries: CronNotifyEntries, nowMs: number, ttlMs: number): CronNotifyEntries {
  const out: CronNotifyEntries = {};
  for (const [k, v] of Object.entries(entries)) {
    const t = Date.parse(v);
    if (Number.isFinite(t) && nowMs - t < ttlMs) out[k] = v;
  }
  return out;
}

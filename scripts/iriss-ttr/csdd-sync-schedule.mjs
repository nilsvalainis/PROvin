// CSDD numuru periodiskās sinhronizācijas grafiks (Nils 23.10, j13). Tīrs (bez IO), testi: lib/iriss-ttr-control.test.ts.
// - Tikai dienā 08:00-19:00 Europe/Riga; naktī (19:00-08:00) NEKĀ (ne sync, ne VPN turēšana sinhronizācijai).
// - Neregulāri: ik ~60-75 min ar nejaušu nobīdi, nekad uz "apaļām" minūtēm (:00, :05, ... :30 ...).
// - Pirms un pēc katra pavadzīmes darba sync notiek darba ietvarā (waybill-worker-core.mjs), ne šeit.

export const CSDD_SYNC_TZ = "Europe/Riga";
export const CSDD_SYNC_DAY_START_H = 8;
export const CSDD_SYNC_DAY_END_H = 19;
export const CSDD_SYNC_GAP_MIN = 60;
export const CSDD_SYNC_GAP_MAX = 75;

const MIN_MS = 60_000;
const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: CSDD_SYNC_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Rīgas vietējais laiks: { y, mo (1-12), d, h, mi, s }. */
export function rigaParts(ms) {
  const o = {};
  for (const p of fmt.formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { y: o.year, mo: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
}

/** Rīgas vietējais laiks -> UTC ms (ņem vērā vasaras/ziemas laiku). */
export function rigaLocalToUtc(y, mo, d, h, mi = 0, s = 0) {
  const want = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetAt = (ms) => {
    const p = rigaParts(ms);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
  };
  let guess = want - offsetAt(want);
  guess = want - offsetAt(guess);
  return guess;
}

/** Vai šis brīdis ir sinhronizācijas logā (08:00 <= Rīgas laiks < 19:00). */
export function isCsddSyncWindow(ms) {
  const { h } = rigaParts(ms);
  return h >= CSDD_SYNC_DAY_START_H && h < CSDD_SYNC_DAY_END_H;
}

/** "Apaļa" minūte = dalās ar 5 (:00, :05, :15, :30 ...). */
export function isRoundMinute(ms) {
  return rigaParts(ms).mi % 5 === 0;
}

/** Pabīda uz priekšu par 1-2 min, ja minūte ir apaļa. */
function avoidRound(ms, rand) {
  return isRoundMinute(ms) ? ms + (1 + Math.floor(rand() * 2)) * MIN_MS : ms;
}

/**
 * Nākamās periodiskās sinhronizācijas laiks (UTC ms) pēc nowMs.
 * Dienā: now + 60-75 min (+ nejaušas sekundes), ja tas vēl ir pirms 19:00. Citādi: nākamais rīts 08:03-08:25.
 * rand: () => [0,1) (testos fiksēts).
 */
export function nextPeriodicSyncAt(nowMs, rand = Math.random) {
  const gapMs = (CSDD_SYNC_GAP_MIN + rand() * (CSDD_SYNC_GAP_MAX - CSDD_SYNC_GAP_MIN)) * MIN_MS + Math.floor(rand() * 60) * 1000;
  const cand = avoidRound(nowMs + gapMs, rand);
  if (isCsddSyncWindow(cand)) return cand;
  const p = rigaParts(cand);
  // Pēc 19:00 -> nākamās dienas rīts; pirms 08:00 -> šī paša datuma rīts.
  const day = new Date(Date.UTC(p.y, p.mo - 1, p.d + (p.h >= CSDD_SYNC_DAY_END_H ? 1 : 0)));
  const morning = rigaLocalToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), CSDD_SYNC_DAY_START_H, 0, 0);
  const offsetMs = (3 + Math.floor(rand() * 23)) * MIN_MS + Math.floor(rand() * 60) * 1000;
  return avoidRound(morning + offsetMs, rand);
}

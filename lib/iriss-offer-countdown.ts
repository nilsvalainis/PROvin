/**
 * Klienta taimeris piedāvājuma termiņam (validUntilAt).
 * >= 24 h: dienas / stundas / minūtes (atjauno reizi minūtē).
 * < 24 h: stundas / minūtes / sekundes (reizi sekundē, oranžs akcents).
 * Laiks vienmēr no servera nobīdes, rādīšana Europe/Riga.
 */

import { formatOfferDeadlineLv, rigaLocalParts } from "@/lib/iriss-offer-valid-until";

export type OfferCountdownCell = { value: string; label: string };

export type OfferCountdown =
  | { mode: "days" | "hours"; cells: [OfferCountdownCell, OfferCountdownCell, OfferCountdownCell]; leftMs: number }
  | { mode: "expired"; cells: []; leftMs: 0 };

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

/** Latviešu skaitlis: 1, 21, 31 ... (bet ne 11) - vienskaitlis. */
export function lvCountWord(n: number, one: string, many: string): string {
  return n % 10 === 1 && n % 100 !== 11 ? one : many;
}

export function offerCountdown(deadlineMs: number, nowMs: number): OfferCountdown {
  const left = deadlineMs - nowMs;
  if (!Number.isFinite(left) || left <= 0) return { mode: "expired", cells: [], leftMs: 0 };
  if (left >= DAY_MS) {
    const days = Math.floor(left / DAY_MS);
    const hours = Math.floor((left % DAY_MS) / HOUR_MS);
    const minutes = Math.floor((left % HOUR_MS) / MIN_MS);
    return {
      mode: "days",
      leftMs: left,
      cells: [
        { value: String(days), label: lvCountWord(days, "diena", "dienas") },
        { value: String(hours), label: lvCountWord(hours, "stunda", "stundas") },
        { value: String(minutes), label: lvCountWord(minutes, "minūte", "minūtes") },
      ],
    };
  }
  const hours = Math.floor(left / HOUR_MS);
  const minutes = Math.floor((left % HOUR_MS) / MIN_MS);
  const seconds = Math.floor((left % MIN_MS) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    mode: "hours",
    leftMs: left,
    cells: [
      { value: pad(hours), label: lvCountWord(hours, "stunda", "stundas") },
      { value: pad(minutes), label: lvCountWord(minutes, "minūte", "minūtes") },
      { value: pad(seconds), label: lvCountWord(seconds, "sekunde", "sekundes") },
    ],
  };
}

/** Cik ms līdz nākamajai pārzīmēšanai (minūtes vai sekundes robeža). */
export function offerCountdownTickMs(deadlineMs: number, nowMs: number): number {
  const left = deadlineMs - nowMs;
  if (left <= 0) return 0;
  const step = left >= DAY_MS ? MIN_MS : 1000;
  const rest = left % step;
  // Pāreja uz stundu režīmu notiek tieši pie 24 h robežas.
  if (left >= DAY_MS && left - DAY_MS < step) return Math.max(left - DAY_MS + 1, 50);
  return Math.max(rest === 0 ? step : rest, 50);
}

/** "līdz 26.10.2026 18:00" vai "līdz šodien 18:00" (Rīgas diena). */
export function formatOfferDeadlineUntilLv(deadlineIso: string, nowMs: number): string {
  const full = formatOfferDeadlineLv(deadlineIso);
  if (!full) return "";
  const at = rigaLocalParts(Date.parse(deadlineIso));
  const today = rigaLocalParts(nowMs);
  if (at && today && at.ymd === today.ymd) return `līdz šodien ${at.hm}`;
  return `līdz ${full}`;
}

/** Ekrāna lasītājam - tikai minūšu precizitāte (aria-live nemainās katru sekundi). */
export function offerCountdownSpokenLv(c: OfferCountdown): string {
  if (c.mode === "expired") return "Piedāvājuma termiņš beidzies";
  if (c.mode === "days") return `Piedāvājums spēkā vēl ${c.cells.map((x) => `${x.value} ${x.label}`).join(" ")}`;
  const [h, m] = c.cells;
  return `Piedāvājums spēkā vēl ${Number(h.value)} ${h.label} ${Number(m.value)} ${m.label}`;
}

/** Klienta pulksteņa nobīde pret serveri (ms), ko pieskaita Date.now(). */
export function offerClockSkewMs(serverNowIso: string, clientNowMs: number): number {
  const server = Date.parse(serverNowIso);
  if (!Number.isFinite(server)) return 0;
  return server - clientNowMs;
}

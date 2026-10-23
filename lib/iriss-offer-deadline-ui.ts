/**
 * Admin: piedāvājuma termiņš (T4) - "Atlicis N d. N st.", ievades sākuma vērtības un saraksta zīme.
 * Tīra loģika; laiks vienmēr Europe/Riga, glabā UTC (validUntilAt).
 */

import { normalizeOfferValidUntilAt, rigaLocalParts } from "@/lib/iriss-offer-valid-until";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

/** "Atlicis 2 d. 20 st." / "Atlicis 3 st. 15 min." / "Atlicis 4 min." / "Beidzies". */
export function offerDeadlineRemainingLv(deadlineMs: number, nowMs: number): string {
  const left = deadlineMs - nowMs;
  if (!Number.isFinite(left) || left <= 0) return "Beidzies";
  if (left >= DAY_MS) {
    const d = Math.floor(left / DAY_MS);
    const h = Math.floor((left % DAY_MS) / HOUR_MS);
    return `Atlicis ${d} d. ${h} st.`;
  }
  if (left >= HOUR_MS) {
    const h = Math.floor(left / HOUR_MS);
    const m = Math.floor((left % HOUR_MS) / MIN_MS);
    return `Atlicis ${h} st. ${m} min.`;
  }
  return `Atlicis ${Math.max(1, Math.ceil(left / MIN_MS))} min.`;
}

/** Saraksta zīmei īsi: "2 d. 4 st." / "3 st. 15 min." */
export function offerDeadlineShortLv(deadlineMs: number, nowMs: number): string {
  const s = offerDeadlineRemainingLv(deadlineMs, nowMs);
  return s.startsWith("Atlicis ") ? s.slice("Atlicis ".length) : s;
}

/**
 * Ievades sākuma vērtības: no validUntilAt (Rīgas laikā) vai no vecā validUntil datuma (laiks tukšs - Nils ievada pats).
 */
export function offerDeadlineInputInitial(offer: { validUntilAt?: string; validUntil?: string }): { ymd: string; hm: string } {
  const iso = normalizeOfferValidUntilAt(offer.validUntilAt);
  if (iso) {
    const p = rigaLocalParts(Date.parse(iso));
    if (p) return p;
  }
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(offer.validUntil ?? "") ? offer.validUntil! : "";
  return { ymd, hm: "" };
}

export type IrissOfferListBadge = { label: string; tone: "approved" | "declined" | "expired" | "time" };

export type IrissOfferLinkSummaryEntry = {
  offerId: string;
  /** Saites stāvoklis: tikai saglabātie lēmumi; "Beidzies" tiek aprēķināts. */
  status: "sent" | "approved" | "declined" | "revoked";
  at: string;
  validUntilAt: string;
};

/** Pasūtījumu saraksta zīme jaunākajam piedāvājumam ar saiti: Apstiprināts / Noraidīts / Beidzies / atlikušais laiks. */
export function irissOfferListBadge(entry: IrissOfferLinkSummaryEntry | null | undefined, nowMs: number): IrissOfferListBadge | null {
  if (!entry || entry.status === "revoked") return null;
  if (entry.status === "approved") return { label: "Apstiprināts", tone: "approved" };
  if (entry.status === "declined") return { label: "Noraidīts", tone: "declined" };
  const iso = normalizeOfferValidUntilAt(entry.validUntilAt);
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (nowMs >= ms) return { label: "Beidzies", tone: "expired" };
  return { label: offerDeadlineShortLv(ms, nowMs), tone: "time" };
}

/**
 * CheckCar.vin importa tīrās palīgfunkcijas: pasūtījuma izvēle pēc VIN un Autobid oriģinālo
 * bilžu ieteikums no VIN atmiņas. Bez tīkla un krātuves (testējams).
 */

import type { VinMemoryEntry } from "@/lib/vin-memory";

export type CheckcarOrderCandidate = {
  id: string;
  created: number;
  vin: string | null;
  isDemo?: boolean;
  checkoutLine?: string;
};

function vinKey(raw: string | null | undefined): string {
  return String(raw || "").replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Jaunākais pasūtījums ar šo VIN. VIN var būt Stripe rindā vai melnrakstā labots (dashboard indekss).
 * Demo un PROVIN SELECT konsultācijas neder (tām nav `cc_vin` bloka).
 */
export function pickLatestOrderForVin(
  vin: string,
  rows: readonly CheckcarOrderCandidate[],
  index: readonly { sessionId: string; vin: string | null }[],
): string | null {
  const want = vinKey(vin);
  if (want.length !== 17) return null;
  const draftVin = new Map(index.map((e) => [e.sessionId, vinKey(e.vin)]));
  let best: CheckcarOrderCandidate | null = null;
  for (const row of rows) {
    if (row.isDemo || row.checkoutLine === "provin_select") continue;
    const edited = draftVin.get(row.id);
    const matches = edited ? edited === want : vinKey(row.vin) === want;
    if (!matches) continue;
    if (!best || row.created > best.created) best = row;
  }
  return best?.id ?? null;
}

export type CheckcarAutobidHint = {
  /** Cik Autobid novērojumu ar šo VIN ir arhīvā. */
  lots: number;
  /** Cik bilžu tajos jau saglabāts (bez CheckCar ūdenszīmēm). */
  photos: number;
  /** Jaunākā novērojuma datums (gggg-mm-dd). */
  lastDate: string;
  /** Izsoles ID, ja zināms. */
  auctionId: string;
};

/**
 * Autobid oriģinālās bildes: VIN atmiņā ir Autobid novērojumi (arī TheCarApi ieraksti ar Autobid
 * platformu). Ja ir, operatoram iesakām tās bildes, nevis CheckCar kopijas ar ūdenszīmēm.
 */
export function autobidOriginalHint(entry: VinMemoryEntry | null | undefined): CheckcarAutobidHint | null {
  const obs = (entry?.observations ?? []).filter(
    (o) => o.source === "autobid" || /autobid/i.test(`${o.platform ?? ""} ${o.venue ?? ""}`),
  );
  if (obs.length === 0) return null;
  const sorted = [...obs].sort((a, b) => b.date.localeCompare(a.date));
  return {
    lots: obs.length,
    photos: obs.reduce((n, o) => n + (o.photos?.length ?? 0), 0),
    lastDate: sorted[0]?.date ?? "",
    auctionId: sorted.find((o) => o.auctionId)?.auctionId ?? "",
  };
}

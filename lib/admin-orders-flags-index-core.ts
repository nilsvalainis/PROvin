/**
 * PRO pasūtījumu saraksta karodziņu indekss (tīrā loģika, bez I/O).
 * Viens dokuments ar katra pasūtījuma „Izpildīts”, rezultāta krāsu un upsell kopsavilkumu,
 * lai saraksts un žetoni nelasa 3×N atsevišķus Blob failus. Avota patiesība paliek per-id faili;
 * indekss ir kešs: rakstīšana ierakstu atjauno uz vietas (ar `at`),  trūkstošos ierakstus nolasa no avota un ieliek atpakaļ,
 * un periodiski (REBUILD_MS) viss indekss tiek pārbūvēts fonā.
 */
import type { AuditResultColor } from "@/lib/admin-audit-result-color";
import type { UpsellOfferSnapshot } from "@/lib/order-upsell";

export type OrderFlagsEntry = {
  complete: boolean;
  color: AuditResultColor | null;
  upsell: UpsellOfferSnapshot[];
  /** Avota nolasīšanas sākuma laiks (ms). Vecāks ieraksts nekad nepārraksta jaunāku. */
  at?: number;
};

export type OrderFlagsIndexDoc = {
  v: 1;
  builtAt: string;
  entries: Record<string, OrderFlagsEntry>;
};

export const ORDER_FLAGS_REBUILD_MS = 10 * 60_000;

export function emptyOrderFlagsIndex(nowIso: string): OrderFlagsIndexDoc {
  return { v: 1, builtAt: nowIso, entries: {} };
}

export function parseOrderFlagsIndex(raw: unknown): OrderFlagsIndexDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<OrderFlagsIndexDoc>;
  if (r.v !== 1 || typeof r.builtAt !== "string" || !r.entries || typeof r.entries !== "object") return null;
  return r as OrderFlagsIndexDoc;
}

/** Kuri id indeksā trūkst (jānolasa no avota). */
export function missingOrderFlagIds(doc: OrderFlagsIndexDoc | null, ids: readonly string[]): string[] {
  if (!doc) return [...ids];
  return ids.filter((id) => !doc.entries[id]);
}

export function needsOrderFlagsRebuild(doc: OrderFlagsIndexDoc | null, nowMs: number): boolean {
  if (!doc) return true;
  const t = Date.parse(doc.builtAt);
  return !Number.isFinite(t) || nowMs - t > ORDER_FLAGS_REBUILD_MS;
}

export function withOrderFlagEntries(
  doc: OrderFlagsIndexDoc | null,
  add: Record<string, OrderFlagsEntry>,
  nowIso: string,
  rebuilt = false,
): OrderFlagsIndexDoc {
  const base = doc ?? emptyOrderFlagsIndex(nowIso);
  const entries = { ...base.entries };
  for (const [id, e] of Object.entries(add)) {
    const cur = entries[id];
    if (cur && (cur.at ?? 0) > (e.at ?? 0)) continue;
    entries[id] = e;
  }
  return { v: 1, builtAt: rebuilt ? nowIso : base.builtAt, entries };
}

export function withoutOrderFlagEntry(doc: OrderFlagsIndexDoc, id: string): OrderFlagsIndexDoc {
  if (!doc.entries[id]) return doc;
  const entries = { ...doc.entries };
  delete entries[id];
  return { ...doc, entries };
}

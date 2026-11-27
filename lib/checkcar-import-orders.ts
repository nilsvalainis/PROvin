/**
 * CheckCar.vin importa tīrās palīgfunkcijas: mērķa izvēle pēc VIN (pasūtījums vai ātrais vērtējums)
 * un Autobid oriģinālo bilžu ieteikums no VIN atmiņas. Bez tīkla un krātuves (testējams).
 */

import type { VinMemoryEntry } from "@/lib/vin-memory";

export type CheckcarOrderCandidate = {
  id: string;
  created: number;
  vin: string | null;
  isDemo?: boolean;
  checkoutLine?: string;
};

export type CheckcarQuickEvalCandidate = {
  peekId: string;
  createdAt: string;
  vin: string | null;
};

export type CheckcarTargetKind = "order" | "quick_eval";

export type CheckcarTarget = { kind: CheckcarTargetKind; id: string; at: number };

function vinKey(raw: string | null | undefined): string {
  return String(raw || "").replace(/[\s-]/g, "").toUpperCase();
}

/** Pasūtījumi ar šo VIN (Stripe VIN vai melnrakstā labotais VIN). Demo un PROVIN SELECT neder. */
export function orderTargetsForVin(
  vin: string,
  rows: readonly CheckcarOrderCandidate[],
  index: readonly { sessionId: string; vin: string | null }[],
): CheckcarTarget[] {
  const want = vinKey(vin);
  if (want.length !== 17) return [];
  const draftVin = new Map(index.map((e) => [e.sessionId, vinKey(e.vin)]));
  const out: CheckcarTarget[] = [];
  for (const row of rows) {
    if (row.isDemo || row.checkoutLine === "provin_select") continue;
    const edited = draftVin.get(row.id);
    const matches = edited ? edited === want : vinKey(row.vin) === want;
    if (matches) out.push({ kind: "order", id: row.id, at: row.created * 1000 });
  }
  return out;
}

const VALID_VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Derīgs 17 zīmju VIN (bez I/O/Q) vai "". */
export function usableVin(raw: unknown): string {
  const k = vinKey(typeof raw === "string" ? raw : "");
  return VALID_VIN_RE.test(k) ? k : "";
}

/** Lauki avotu blokos, kuros glabājas pārbaudītais VIN (CSDD, OneAuto, Outvin, JoJ u.c.). */
const DRAFT_VIN_KEYS = new Set(["vin", "vinCode", "lastFetchedVin", "vehicle_identification_number"]);

function collectBlockVins(node: unknown, out: Set<string>, depth: number): void {
  if (depth > 6 || node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node.slice(0, 50)) collectBlockVins(item, out, depth + 1);
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string") {
      if (DRAFT_VIN_KEYS.has(key)) {
        const v = usableVin(value);
        if (v) out.add(v);
      }
    } else if (value && typeof value === "object") {
      collectBlockVins(value, out, depth + 1);
    }
  }
}

export type CheckcarOrderVinSources = {
  /** Stripe pieteikuma VIN (pēc numurzīmes pasūtot - numurs vai tukšs). */
  stripeVin?: string | null;
  /** Dashboard indeksa VIN (orderEdits kopija). */
  indexVin?: string | null;
  draft?: {
    orderEdits?: { vin?: string } | null;
    workspace?: { sourceBlocks?: unknown } | null;
    vinScan?: { vin?: string } | null;
  } | null;
};

/**
 * Visi VIN, kas zināmi pasūtījumam: Stripe, melnrakstā labotais / numurzīmes atrisinātais
 * (orderEdits), VIN SCAN un avotu bloki (CSDD, OneAuto, Outvin, JoJ). Pasūtot pēc numurzīmes
 * Stripe VIN nav - tad VIN ir tikai melnrakstā.
 */
export function orderKnownVins(src: CheckcarOrderVinSources): string[] {
  const out = new Set<string>();
  for (const raw of [src.draft?.orderEdits?.vin, src.indexVin, src.stripeVin, src.draft?.vinScan?.vin]) {
    const v = usableVin(raw);
    if (v) out.add(v);
  }
  collectBlockVins(src.draft?.workspace?.sourceBlocks, out, 0);
  return [...out];
}

/** Vai pasūtījumam (Stripe un indeksā) jau ir derīgs VIN; ja nav - VIN jāmeklē melnrakstā. */
export function orderHasListedVin(row: CheckcarOrderCandidate, indexVin: string | null | undefined): boolean {
  return Boolean(usableVin(indexVin) || usableVin(row.vin));
}

/** Ātrie vērtējumi ar šo VIN (pieteikuma VIN vai CSDD VIN vērtējuma failā). */
export function quickEvalTargetsForVin(vin: string, rows: readonly CheckcarQuickEvalCandidate[]): CheckcarTarget[] {
  const want = vinKey(vin);
  if (want.length !== 17) return [];
  return rows
    .filter((r) => vinKey(r.vin) === want)
    .map((r) => ({ kind: "quick_eval" as const, id: r.peekId, at: Date.parse(r.createdAt) || 0 }));
}

/**
 * Mērķis: ja operators atvēra konkrēta pasūtījuma / ātrā vērtējuma lapu un tam ir šis VIN - tas;
 * citādi jaunākais pēc laika no abiem. Pārējie atgriežas kā alternatīvas (adminā var izvēlēties,
 * atverot vajadzīgo lapu un nospiežot pogu vēlreiz).
 */
export function pickCheckcarTarget(
  candidates: readonly CheckcarTarget[],
  hint?: { kind?: string; id?: string } | null,
): { target: CheckcarTarget | null; alternatives: CheckcarTarget[] } {
  const sorted = [...candidates].sort((a, b) => b.at - a.at);
  const hinted = hint?.id ? sorted.find((c) => c.kind === hint.kind && c.id === hint.id) : undefined;
  const target = hinted ?? sorted[0] ?? null;
  return { target, alternatives: sorted.filter((c) => c !== target) };
}

/** Saderība: tikai pasūtījumi, jaunākais. */
export function pickLatestOrderForVin(
  vin: string,
  rows: readonly CheckcarOrderCandidate[],
  index: readonly { sessionId: string; vin: string | null }[],
): string | null {
  return pickCheckcarTarget(orderTargetsForVin(vin, rows, index)).target?.id ?? null;
}

/** Ātrā vērtējuma foto glabātuves „sesija” (tā pati JPEG krātuve kā pasūtījuma cc_vin foto). */
export function quickEvalCheckcarPhotoSession(peekId: string): string {
  const clean = peekId.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 64);
  return clean ? `qe_${clean}` : "";
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

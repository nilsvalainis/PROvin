/**
 * Ātrie vērtējumi un VIN SCAN: tas pats avotu katalogs, tās pašas zondes un tas pats kešs pēc VIN.
 * Avotu saraksts NAV atsevišķs - tas ir `defaultVinScanSourceIds()` (tas, ko VIN SCAN / «Ātrā pārbaude»
 * palaiž pēc noklusējuma, ieskaitot TheCarApi, ja ieslēgts). Jauns avots katalogā automātiski nonāk arī šeit.
 * Maksas avoti (JoJ, OneAuto, Speckr) pēc noklusējuma nepalaižas - tāpat kā «Ātrajā pārbaudē»; tos
 * palaiž ar klikšķi «Ātrajā pārbaudē», un rezultāts caur kopīgo kešu redzams arī ātrajā vērtējumā.
 * Bezmaksas seed (CSDD / sludinājums / DK-EE-SE) paliek atsevišķi un aizpilda darba zonas blokus.
 */

import { defaultVinScanSourceIds, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { parseVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { nordicVinSearchLinks, type NordicVinSearchLink } from "@/lib/vin-scan/vin-decode";

export function quickEvalVinScanSourceIds(): VinScanSourceId[] {
  return defaultVinScanSourceIds();
}

export function quickEvalVinScanPlatesFromCsdd(registrationNumber?: string | null): VinScanPlates {
  return parseVinScanPlates({ lv: registrationNumber ?? "" });
}

export function quickEvalNordicSearchLinks(vin: string): NordicVinSearchLink[] {
  return nordicVinSearchLinks(vin);
}

export function quickEvalVinScanInput(opts: {
  vin: string;
  listingUrl?: string | null;
  registrationNumber?: string | null;
}): {
  vin: string;
  listingUrl: string;
  plates: VinScanPlates;
  sourceIds: VinScanSourceId[];
} {
  return {
    vin: opts.vin,
    listingUrl: opts.listingUrl?.trim() ?? "",
    plates: quickEvalVinScanPlatesFromCsdd(opts.registrationNumber),
    sourceIds: quickEvalVinScanSourceIds(),
  };
}

export type QuickEvalVinScanView = { at: string; indicators: VinScanIndicator[] };

function rowMs(row: VinScanIndicator, fallbackAt: string): number {
  const own = typeof row.scannedAt === "string" ? Date.parse(row.scannedAt) : Number.NaN;
  if (Number.isFinite(own)) return own;
  const fb = Date.parse(fallbackAt);
  return Number.isFinite(fb) ? fb : 0;
}

/**
 * Ātrā vērtējuma saglabātās rindas + kopīgais VIN SCAN momentuzņēmums (ar userscript importiem un
 * «Ātrajā pārbaudē» palaistajiem avotiem). Katram avotam uzvar jaunākā rinda; secība - kā VIN SCAN katalogā.
 */
export function mergeQuickEvalVinScan(
  own: QuickEvalVinScanView | null | undefined,
  shared: { scannedAt: string; indicators: readonly VinScanIndicator[] } | null | undefined,
): QuickEvalVinScanView | null {
  if (!own && !shared) return null;
  const byId = new Map<string, { row: VinScanIndicator; ms: number }>();
  if (own) for (const row of own.indicators) byId.set(row.id, { row, ms: rowMs(row, own.at) });
  if (shared) {
    for (const row of shared.indicators) {
      const ms = rowMs(row, shared.scannedAt);
      const prev = byId.get(row.id);
      if (!prev || ms >= prev.ms) byId.set(row.id, { row, ms });
    }
  }
  const order: readonly string[] = quickEvalVinScanSourceIds();
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  const indicators = [...byId.values()].sort((a, b) => rank(a.row.id) - rank(b.row.id)).map((v) => v.row);
  const times = [own?.at, shared?.scannedAt].map((t) => (t ? Date.parse(t) : Number.NaN)).filter(Number.isFinite);
  const at = times.length ? new Date(Math.max(...times)).toISOString() : (own?.at ?? shared?.scannedAt ?? "");
  return { at, indicators };
}

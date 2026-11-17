/**
 * Pārlūka importu pārklājums VIN SCAN momentuzņēmumam.
 * Katrs imports glabājas arī savā atslēgā (`<VIN>.browser.<avots>`), jo momentuzņēmums ir viens JSON bez bloķēšanas:
 * servera skenēšana vai cits imports to var pārrakstīt ar vecāku saturu. Lasot un pirms rakstīšanas importus uzliek virsū.
 */

import { vinScanRowScannedAtMs, vinScanRowWithinTtl } from "@/lib/vin-scan/source-ttl";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

export type VinScanBrowserImport = {
  vin: string;
  id: string;
  importedAt: string;
  row: VinScanIndicator;
};

function isResult(status: string): boolean {
  return status === "found" || status === "none";
}

/**
 * Vai saglabātais pārlūka imports aizstāj momentuzņēmuma rindu.
 * - imports ir found/none un vēl derīgs pēc sava avota TTL (citādi vecs imports nekad neatgriežas);
 * - rindas nav, vai tā nav rezultāts (browser_only, unknown u.c.), vai imports ir jaunāks par rindu.
 */
export function browserImportWinsOverRow(
  row: VinScanIndicator | undefined,
  snapshotScannedAt: string,
  imp: VinScanBrowserImport,
  nowMs = Date.now(),
): boolean {
  if (!isResult(imp.row.status)) return false;
  const importedMs = Date.parse(imp.importedAt);
  if (!Number.isFinite(importedMs)) return false;
  if (!vinScanRowWithinTtl({ ...imp.row, scannedAt: imp.importedAt }, imp.importedAt, nowMs)) return false;
  if (!row || !isResult(row.status)) return true;
  const rowMs = vinScanRowScannedAtMs(row, snapshotScannedAt);
  return !Number.isFinite(rowMs) || importedMs > rowMs;
}

/** Uzliek derīgos importus virsū rindām; trūkstošās rindas pieliek beigās. Ievadi nemaina. */
export function overlayVinScanBrowserImports(
  indicators: readonly VinScanIndicator[],
  snapshotScannedAt: string,
  imports: readonly VinScanBrowserImport[],
  nowMs = Date.now(),
): VinScanIndicator[] {
  if (!imports.length) return [...indicators];
  const byId = new Map<string, VinScanBrowserImport>();
  for (const imp of imports) {
    const seen = byId.get(imp.id);
    if (!seen || Date.parse(imp.importedAt) > Date.parse(seen.importedAt)) byId.set(imp.id, imp);
  }
  const out = indicators.map((row) => {
    const imp = byId.get(row.id);
    if (!imp) return row;
    byId.delete(row.id);
    if (!browserImportWinsOverRow(row, snapshotScannedAt, imp, nowMs)) return row;
    return { ...imp.row, scannedAt: imp.importedAt };
  });
  for (const imp of byId.values()) {
    if (browserImportWinsOverRow(undefined, snapshotScannedAt, imp, nowMs)) {
      out.push({ ...imp.row, scannedAt: imp.importedAt });
    }
  }
  return out;
}

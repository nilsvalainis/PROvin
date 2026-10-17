/**
 * Pārlūka VIN SCAN rezultāts atsevišķajā rīkā (admin-order-drafts/vin-scans/).
 * Tas pats HTML parses, kas pasūtījuma kartītei (`applyBrowserArchiveHtml`).
 */

import { ORDER_VIN_SCAN_BROWSER_IMPORT_IDS, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import { applyBrowserArchiveHtml } from "@/lib/order-vin-scan-browser-html";
import { isPaidVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

export type VinScanBrowserSnapshot = {
  vin: string;
  plates: VinScanPlates;
  scannedAt: string;
  indicators: VinScanIndicator[];
};

export type VinScanBrowserResultInput = {
  id: string;
  status?: string;
  summary?: string;
  html?: string;
  pageUrl?: string;
  httpStatus?: number;
};

export function applyVinScanBrowserResultToSnapshot(input: {
  snapshot: VinScanBrowserSnapshot | null;
  vin: string;
  plates?: VinScanPlates;
  browserResult: VinScanBrowserResultInput;
  now?: string;
}): { ok: true; snapshot: VinScanBrowserSnapshot } | { ok: false; error: string } {
  const vin = input.vin.trim().toUpperCase();
  const id = input.browserResult.id.trim();
  if (!vin || !id) return { ok: false, error: "invalid_browser_result" };
  if (isPaidVinScanSourceId(id) || !ORDER_VIN_SCAN_BROWSER_IMPORT_IDS.includes(id)) {
    return { ok: false, error: "invalid_browser_result" };
  }
  if (input.snapshot && input.snapshot.vin.trim().toUpperCase() !== vin) {
    return { ok: false, error: "vin_mismatch" };
  }

  const base: VinScanBrowserSnapshot = input.snapshot ?? {
    vin,
    plates: input.plates ?? emptyVinScanPlates(),
    scannedAt: input.now ?? new Date().toISOString(),
    indicators: [],
  };

  const record: OrderVinScanRecord = {
    at: base.scannedAt,
    vin: base.vin,
    status: "done",
    indicators: base.indicators,
  };

  const html = input.browserResult.html ?? "";
  if (html.trim()) {
    const applied = applyBrowserArchiveHtml({
      record,
      id,
      html,
      pageUrl: input.browserResult.pageUrl,
      vin,
      httpStatus: input.browserResult.httpStatus,
    });
    if (applied.ok) {
      return { ok: true, snapshot: { ...base, vin, indicators: applied.record.indicators } };
    }
    const clientStatus =
      input.browserResult.status === "found" || input.browserResult.status === "none"
        ? input.browserResult.status
        : "";
    const hasRow = base.indicators.some((row) => row.id === id);
    if (applied.error !== "page_not_ready" || !clientStatus || !hasRow) {
      return { ok: false, error: applied.error };
    }
  }

  const status: "found" | "none" | "" =
    input.browserResult.status === "found" || input.browserResult.status === "none"
      ? input.browserResult.status
      : "";
  if (!status) return { ok: false, error: "invalid_browser_result" };
  const hasRow = base.indicators.some((row) => row.id === id);
  if (!hasRow) return { ok: false, error: "invalid_browser_result" };
  const summary = (input.browserResult.summary ?? "").trim().slice(0, 300);
  return {
    ok: true,
    snapshot: {
      ...base,
      vin,
      indicators: base.indicators.map((row) =>
        row.id === id
          ? {
              ...row,
              status,
              summary: summary || (status === "found" ? "Atrasts (pārlūkā)" : "Nav datu (pārlūkā)"),
            }
          : row,
      ),
    },
  };
}

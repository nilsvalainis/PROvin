/**
 * Avoti, kuru servera un datucentru IP saņem Cloudflare / HTTP 403.
 * Josla paliek „from browser”: HTML atnes Tampermonkey no operatora pārlūka (kā stat.vin).
 */

import type { VinScanSourceId } from "@/lib/vin-scan/catalog";

export const VIN_SCAN_BROWSER_FETCH_IDS = [
  "stat_vin",
  "bid_cars",
  "bidfax",
  "checkcar_vin",
  "plc_auction",
  "carfax_eu",
  "poctra",
  "lt_itpr",
  "biluppgifter",
  "nicb",
] as const satisfies readonly VinScanSourceId[];

export type VinScanBrowserFetchId = (typeof VIN_SCAN_BROWSER_FETCH_IDS)[number];

const LABEL: Record<VinScanBrowserFetchId, string> = {
  stat_vin: "stat.vin",
  bid_cars: "bid.cars",
  bidfax: "BidFax",
  checkcar_vin: "checkcar.vin",
  plc_auction: "plc.auction",
  carfax_eu: "CARFAX.eu",
  poctra: "Poctra",
  lt_itpr: "epolicija.lt",
  biluppgifter: "biluppgifter.se",
  nicb: "NICB",
};

export function isVinScanBrowserFetchId(id: string): id is VinScanBrowserFetchId {
  return (VIN_SCAN_BROWSER_FETCH_IDS as readonly string[]).includes(id);
}

export function browserFetchSummary(id: VinScanBrowserFetchId): string {
  return `${LABEL[id]}: no pārlūka (from browser)`;
}

export function browserFetchLane(id: VinScanBrowserFetchId): { status: "browser_only"; summary: string } {
  return { status: "browser_only", summary: browserFetchSummary(id) };
}

export function browserFetchAwaiting(
  row: { id?: string; status?: string; summary?: string } | null | undefined,
): boolean {
  if (!row?.id || !isVinScanBrowserFetchId(row.id)) return false;
  if (row.status === "found" || row.status === "none") return false;
  return row.status === "browser_only" && /from browser/i.test(row.summary || "");
}

export function browserFetchToken(vin: string, at: string): string {
  const v = vin.trim().toUpperCase();
  const stamp = at.trim();
  if (!v || !stamp) return "";
  return `${v}:${stamp}`;
}

export type VinScanBrowserFetchHandoff = {
  token: string;
  ids: VinScanBrowserFetchId[];
  attrs: {
    "data-provin-browser-fetch": string;
    "data-provin-browser-fetch-ids": string;
    "data-provin-stat-vin-fetch"?: string;
  };
};

/** Tampermonkey v1.22.0 lasa šos atribūtus uz `/admin` (pasūtījums un atsevišķais VIN SCAN). */
export function browserFetchHandoff(
  vin: string,
  at: string,
  rows: readonly { id?: string; status?: string; summary?: string }[] | null | undefined,
): VinScanBrowserFetchHandoff | null {
  if (!rows?.length) return null;
  const ids = rows
    .filter(browserFetchAwaiting)
    .map((row) => row.id)
    .filter((id): id is VinScanBrowserFetchId => typeof id === "string" && isVinScanBrowserFetchId(id));
  if (!ids.length) return null;
  const token = browserFetchToken(vin, at);
  if (!token) return null;
  return {
    token,
    ids,
    attrs: {
      "data-provin-browser-fetch": token,
      "data-provin-browser-fetch-ids": ids.join(","),
      ...(ids.includes("stat_vin") ? { "data-provin-stat-vin-fetch": token } : {}),
    },
  };
}

export function browserImportErrorLv(code: string | undefined): string {
  if (code === "vin_mismatch") return "VIN lapā nesakrīt ar pasūtījumu";
  if (code === "too_large") return "Lapa ir par lielu importam";
  if (code === "page_not_ready") return "Lapa vēl nav gatava. Pagaidiet, kamēr ielādējas, un mēģiniet vēlreiz";
  if (code === "write_failed") return "Importēšana neizdevās saglabāt";
  return "Importēšana neizdevās";
}

export type VinScanBrowserEventDetail = {
  id: string;
  vin: string;
  status: string;
  summary: string;
  html: string;
  pageUrl: string;
  httpStatus?: number;
};

/** `provin-vin-scan-result` no Tampermonkey: HTML vai jau found/none. */
export function parseVinScanBrowserEventDetail(raw: unknown): VinScanBrowserEventDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const id = typeof d.id === "string" ? d.id.trim() : "";
  const vin = typeof d.vin === "string" ? d.vin.replace(/[\s-]/g, "").toUpperCase() : "";
  if (!id || !vin) return null;
  const html = typeof d.html === "string" ? d.html : "";
  const status = typeof d.status === "string" ? d.status : "";
  if (!html.trim() && status !== "found" && status !== "none") return null;
  const pageUrl =
    (typeof d.pageUrl === "string" && d.pageUrl.trim()) ||
    (typeof d.finalUrl === "string" && d.finalUrl.trim()) ||
    "";
  return {
    id,
    vin,
    status,
    summary: typeof d.summary === "string" ? d.summary : "",
    html,
    pageUrl,
    ...(typeof d.httpStatus === "number" && Number.isFinite(d.httpStatus) ? { httpStatus: d.httpStatus } : {}),
  };
}

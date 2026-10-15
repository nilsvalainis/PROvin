/**
 * Pārlūka HTML imports VIN SCAN momentuzņēmumā.
 * Operators atver bloķēto arhīvu savā pārlūkā; serveris parsē HTML un saglabā foto un izsoles.
 * Bez tīkla, bez starpnieka.
 */

import { ORDER_VIN_SCAN_BROWSER_IMPORT_IDS, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import { isVinScanSourceId, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { classifyCheckcarVinText, classifyPlcAuction } from "@/lib/vin-scan/parse";
import { parseAuctionArchive } from "@/lib/vin-scan/parse-extra";
import { parseStatVinPage } from "@/lib/vin-scan/parse-stat-vin";
import { isSwedishBrowserSourceId, parseSwedishVehiclePage, swedishSourceLabel } from "@/lib/vin-scan/parse-sweden";
import { buildVinScanIndicator, type VinScanAuction, type VinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";

/** Aptuveni 900 KB. Garāku lapu skripts saīsina, serveris noraida. */
export const ORDER_VIN_SCAN_BROWSER_HTML_MAX = 900_000;

const VIN_TOKEN = /[A-HJ-NPR-Z0-9]{17}/g;
const PHOTO_SKIP_RE = /logo|favicon|sprite|pixel|1x1|avatar|icon|emoji|placeholder|spinner|badge|flag/i;

const ARCHIVE_LABEL: Partial<Record<VinScanSourceId, string>> = {
  bid_cars: "bid.cars",
  bidfax: "BidFax",
  poctra: "Poctra",
};

export type BrowserArchiveHtmlError = "too_large" | "vin_mismatch" | "page_not_ready" | "unsupported";

export type BrowserArchiveHtmlResult =
  | { ok: true; record: OrderVinScanRecord }
  | { ok: false; error: BrowserArchiveHtmlError };

function vinsIn(raw: string): string[] {
  const found = new Set<string>();
  const text = raw.toUpperCase();
  for (const match of text.matchAll(VIN_TOKEN)) {
    if (match[0]) found.add(match[0]);
  }
  return [...found];
}

function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

function kmLv(raw: string): string {
  const n = Number(String(raw).replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Math.round(n).toLocaleString("lv-LV")} km`;
}

function labeled(text: string, labels: string, requireDigit = false): string {
  const re = new RegExp(`(?:${labels})[:\\s]+([^\\n]{2,80})`, "gi");
  let fallback = "";
  for (const match of text.matchAll(re)) {
    const raw =
      match[1]?.split(/\s+(?=sale date\b|final bid\b|winning bid\b|odometer\b|mileage\b|lot\b|damage\b)/i)[0]?.replace(/\s+/g, " ").trim() ??
      "";
    if (!raw) continue;
    if (!fallback) fallback = raw;
    if (!requireDigit || /\d/.test(raw)) return raw;
  }
  return requireDigit ? "" : fallback;
}

function htmlPhotoUrls(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(?:src|data-src|data-lazy|data-original)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  for (const match of html.matchAll(re)) {
    const url = (match[1] ?? "").split("#")[0]?.trim() ?? "";
    if (!url || seen.has(url) || PHOTO_SKIP_RE.test(url)) continue;
    if (!/\.(jpe?g|webp|png)(\?|$)/i.test(url) && !/copart|iaai|stat\.vin|bidfax|poctra|bid\.cars|checkcar|cloudfront|auction/i.test(url)) {
      continue;
    }
    seen.add(url);
    out.push(url);
    if (out.length >= 20) break;
  }
  return out;
}

function withPhotos(parsed: VinScanParse, html: string): VinScanParse {
  const extra = htmlPhotoUrls(html);
  if (!extra.length && !parsed.media?.photoUrl && !(parsed.media?.photoUrls?.length)) return parsed;
  const photoUrls = [...(parsed.media?.photoUrls ?? [])];
  const seen = new Set(photoUrls);
  for (const url of extra) {
    if (seen.has(url)) continue;
    seen.add(url);
    photoUrls.push(url);
    if (photoUrls.length >= 20) break;
  }
  const photoUrl = parsed.media?.photoUrl || photoUrls[0];
  const photoCount = Math.max(parsed.media?.photoCount ?? 0, photoUrls.length);
  return {
    ...parsed,
    media: {
      photoUrl: photoUrl || undefined,
      photoCount: photoCount > 0 ? photoCount : undefined,
      photoUrls: photoUrls.slice(0, 20),
    },
  };
}

function enrichFound(parsed: VinScanParse, html: string): VinScanParse {
  if (parsed.status !== "found") return parsed;
  const text = visibleText(html);
  const location = labeled(text, "location|sale location|branch|yard");
  const price = labeled(text, "final bid|winning bid|sold for|sold price", true);
  const lot = /lot[:\s#№]*([0-9]{5,10})/i.exec(text)?.[1] ?? "";
  const odo = /(?:odometer|mileage|odometrs)[:\s]*([\d\s,]{3,12})/i.exec(text)?.[1] ?? "";
  const km = odo ? kmLv(odo) : "";
  const auctions = (parsed.auctions ?? []).map((row, index) => {
    if (index !== 0) return row;
    let title = row.title || "";
    if (lot && !title.includes(lot)) title = [title, `lots ${lot}`].filter(Boolean).join(" · ");
    if (location && !title.toLowerCase().includes(location.toLowerCase()) && row.venue?.toLowerCase() !== location.toLowerCase()) {
      title = [title, location].filter(Boolean).join(" · ");
    }
    if (km && !/km/i.test(title)) title = [title, km].filter(Boolean).join(" · ");
    const next: VinScanAuction = {
      ...row,
      title: title.slice(0, 180) || row.title,
      price: row.price || (price ? price.slice(0, 40) : undefined),
      venue: row.venue || location || undefined,
    };
    return next;
  });
  const mileage =
    parsed.mileage && parsed.mileage.length > 0
      ? parsed.mileage
      : km
        ? [{ date: auctions[0]?.date || "", odometer: km }]
        : parsed.mileage;
  return { ...parsed, auctions, mileage };
}

function readyParse(parsed: VinScanParse | null): VinScanParse | BrowserArchiveHtmlError {
  if (!parsed) return "page_not_ready";
  if (parsed.status !== "found" && parsed.status !== "none") return "page_not_ready";
  return parsed;
}

function parseArchiveHtml(id: string, html: string, pageUrl: string, vin: string): VinScanParse | BrowserArchiveHtmlError {
  if (id === "stat_vin") {
    return readyParse(parseStatVinPage({ status: 200, html, vin, finalUrl: pageUrl || null }));
  }
  if (id === "bid_cars" || id === "bidfax" || id === "poctra") {
    const label = ARCHIVE_LABEL[id] || id;
    return readyParse(parseAuctionArchive(200, html, vin, label));
  }
  if (id === "plc_auction") {
    return readyParse(classifyPlcAuction(visibleText(html)));
  }
  if (id === "checkcar_vin") {
    return readyParse(classifyCheckcarVinText(visibleText(html), vin));
  }
  if (isSwedishBrowserSourceId(id)) {
    const parsed = parseSwedishVehiclePage(html, pageUrl);
    if (!parsed.ok) return parsed.error;
    if (parsed.id !== id) return "unsupported";
    return parsed.parsed;
  }
  return "unsupported";
}

function indicatorFromParse(id: string, vin: string, parsed: VinScanParse, pageUrl: string): VinScanIndicator {
  const summary = parsed.summary.slice(0, 300);
  const detail = (parsed.detail || "").slice(0, 2000);
  if (id === "transportstyrelsen") {
    return {
      id: "transportstyrelsen" as VinScanSourceId,
      label: swedishSourceLabel("transportstyrelsen"),
      country: "SE",
      status: parsed.status,
      summary,
      detail,
      openUrl: pageUrl || parsed.openUrl || null,
      vehicle: parsed.vehicle,
      mileage: (parsed.mileage ?? []).map((row) => ({ ...row, source: "Transportstyrelsen" })),
      inspections: parsed.inspections,
      flags: { ...parsed.flags, registrationCountry: "SE" },
    };
  }
  return buildVinScanIndicator(id as VinScanSourceId, vin, {
    ...parsed,
    summary,
    detail,
    openUrl: pageUrl || parsed.openUrl || undefined,
  });
}

function vinMatchesPage(html: string, pageUrl: string, vin: string): boolean {
  const htmlVins = vinsIn(html);
  const urlVins = vinsIn(pageUrl);
  if (htmlVins.length > 0 && !htmlVins.includes(vin)) return false;
  if (htmlVins.length === 0 && urlVins.length > 0 && !urlVins.includes(vin)) return false;
  return true;
}

function mergeIndicator(prev: VinScanIndicator | undefined, id: string, vin: string, parsed: VinScanParse, pageUrl: string): VinScanIndicator {
  const built = indicatorFromParse(id, vin, parsed, pageUrl || prev?.openUrl || "");
  if (!prev) return built;
  const cleared = parsed.status === "none";
  return {
    ...prev,
    status: parsed.status,
    summary: built.summary,
    detail: built.detail || (cleared ? "" : prev.detail),
    openUrl: prev.openUrl || built.openUrl,
    vehicle: parsed.vehicle ?? prev.vehicle,
    mileage: cleared ? prev.mileage : parsed.mileage?.length ? built.mileage : prev.mileage,
    media: cleared ? undefined : parsed.media ?? prev.media,
    flags: parsed.flags ?? prev.flags,
    inspections: cleared ? [] : parsed.inspections?.length ? built.inspections : prev.inspections,
    auctions: cleared ? [] : parsed.auctions?.length ? parsed.auctions : prev.auctions,
  };
}

/**
 * Servera skenēšana, kas sākās pirms importa, nedrīkst pārrakstīt jau saglabātu pārlūka found/none
 * ar unknown (datacentra IP joprojām bloķēts). Ja serveris pats atgriež found vai none, tas paliek.
 */
export function preferBrowserArchiveImport(
  latest: readonly VinScanIndicator[],
  incoming: readonly VinScanIndicator[],
): VinScanIndicator[] {
  const browser = new Map(
    latest
      .filter(
        (row) =>
          ORDER_VIN_SCAN_BROWSER_IMPORT_IDS.includes(row.id) && (row.status === "found" || row.status === "none"),
      )
      .map((row) => [row.id, row]),
  );
  if (browser.size === 0) return [...incoming];
  const merged = incoming.map((row) => {
    const kept = browser.get(row.id);
    if (!kept) return row;
    browser.delete(row.id);
    if (row.status === "found" || row.status === "none") return row;
    return kept;
  });
  for (const kept of browser.values()) merged.push(kept);
  return merged;
}

export function applyBrowserArchiveHtml(input: {
  record: OrderVinScanRecord;
  id: string;
  html: string;
  pageUrl?: string;
  vin: string;
}): BrowserArchiveHtmlResult {
  const vin = input.vin.trim().toUpperCase();
  const id = input.id.trim();
  const html = input.html || "";
  const pageUrl = (input.pageUrl || "").trim().slice(0, 500);
  if (!ORDER_VIN_SCAN_BROWSER_IMPORT_IDS.includes(id)) return { ok: false, error: "unsupported" };
  if (id !== "transportstyrelsen" && !isVinScanSourceId(id)) return { ok: false, error: "unsupported" };
  if (input.record.vin.trim().toUpperCase() !== vin) return { ok: false, error: "vin_mismatch" };
  if (html.length > ORDER_VIN_SCAN_BROWSER_HTML_MAX) return { ok: false, error: "too_large" };
  if (!html.trim()) return { ok: false, error: "page_not_ready" };
  if (!vinMatchesPage(html, pageUrl, vin)) return { ok: false, error: "vin_mismatch" };

  const parsed = parseArchiveHtml(id, html, pageUrl, vin);
  if (typeof parsed === "string") return { ok: false, error: parsed };
  const enriched = isSwedishBrowserSourceId(id) ? parsed : enrichFound(withPhotos(parsed, html), html);
  const prev = input.record.indicators.find((row) => row.id === id);
  const nextRow = mergeIndicator(prev, id, vin, enriched, pageUrl);
  const indicators = prev
    ? input.record.indicators.map((row) => (row.id === id ? nextRow : row))
    : [...input.record.indicators, nextRow];
  return {
    ok: true,
    record: {
      ...input.record,
      vin,
      indicators,
    },
  };
}

/**
 * TheCarApi vēstures un detaļu JSON -> VinScanParse.
 * Tīra funkcija: bez tīkla, bez keša.
 */

import { isAllowedVinScanAuctionPhotoUrl } from "@/lib/order-vin-scan-photos";
import {
  mergeThecarapiRaw,
  thecarapiDownloadUrls,
  thecarapiFieldsOf,
  thecarapiImageUrls,
  thecarapiPhotoCaption,
  thecarapiPhotoDate,
  thecarapiRecordKey,
  type ThecarapiAdminRecord,
} from "@/lib/vin-scan/thecarapi-fields";
import { THECARAPI_DEFAULT_BASE } from "@/lib/vin-scan/thecarapi-flags";
import type { VinScanAuction, VinScanParse } from "@/lib/vin-scan/types";

export type ThecarapiAuctionRef = {
  site: string;
  id: string;
  active: boolean;
};

export type ThecarapiDetailParsed = {
  site: string;
  id: string;
  pending: boolean;
  active: boolean;
  photoUrls: string[];
  equipment: string[];
};

const SITE_LABELS: Record<string, string> = {
  auto1: "AUTO1",
  openlane: "Openlane",
  bca: "BCA",
  autorola: "Autorola",
  dealercars: "dealercars",
  encar: "Encar",
  korea: "Encar",
  ecarstrade: "eCarsTrade",
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function unwrap(json: unknown): Record<string, unknown> {
  if (Array.isArray(json)) return { auctions: json };
  const root = asRecord(json);
  if (!root) return {};
  const data = asRecord(root.data);
  if (data && (Array.isArray(data.auctions) || Array.isArray(data.records) || Array.isArray(data.items))) {
    return data;
  }
  return root;
}

function asAuctionRecord(row: Record<string, unknown>): Record<string, unknown> {
  const inner = asRecord(row.auction);
  if (!inner) return row;
  const next: Record<string, unknown> = { ...inner };
  for (const key of ["contract_version", "data_updated_at", "request_id", "server_time", "success"]) {
    if (row[key] != null && next[key] == null) next[key] = row[key];
  }
  if (!next.site_name && !next.site && row.site_name) next.site_name = row.site_name;
  if (!next.site_name && !next.site && row.site) next.site = row.site;
  return next;
}

function rowsOf(json: unknown): Record<string, unknown>[] {
  const root = unwrap(json);
  const list = root.auctions ?? root.records ?? root.items ?? root.results ?? root.details;
  if (Array.isArray(list)) {
    return list
      .map((item) => asRecord(item))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map(asAuctionRecord);
  }
  if (asRecord(root.auction)) return [asAuctionRecord(root)];
  return [];
}

function text(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.trunc(raw));
  return "";
}

function asNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function groupInt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(Math.round(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function isoDay(raw: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(text(raw));
  return m?.[1] ?? "";
}

function siteSlug(raw: unknown): string {
  return text(raw).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

function auctionId(raw: unknown): string {
  return text(raw).replace(/[^\w.-]/g, "").slice(0, 80);
}

export function thecarapiSiteLabel(site: string): string {
  const slug = siteSlug(site);
  return SITE_LABELS[slug] || text(site) || slug;
}

function eurPrice(row: Record<string, unknown>): string {
  const pub = asNumber(row.public_price_eur);
  if (pub != null && pub > 0) return `${groupInt(pub)} EUR`;
  for (const key of ["final_price", "current_price", "start_price"] as const) {
    const n = asNumber(row[key]);
    if (n != null && n > 0) return `${groupInt(n)} EUR`;
  }
  return "";
}

function mileageLabel(raw: unknown): string {
  const n = asNumber(raw);
  if (n == null || n <= 0) return "";
  return `${groupInt(n)} km`;
}

export function thecarapiAbsoluteUrl(baseUrl: string, detailPath: string, site: string, id: string): string {
  const base = baseUrl.replace(/\/+$/, "") || THECARAPI_DEFAULT_BASE;
  if (detailPath.startsWith("https://")) return detailPath;
  if (detailPath.startsWith("/")) return `${base}${detailPath}`;
  return `${base}/api/auction/${encodeURIComponent(site)}/${encodeURIComponent(id)}`;
}

function stampOf(row: Record<string, unknown>): string {
  return isoDay(row.last_seen_at) || isoDay(row.first_seen_at) || isoDay(row.date) || isoDay(row.data_updated_at);
}

function pendingFlag(raw: unknown, depth: number): boolean {
  if (depth > 6 || !raw || typeof raw !== "object") return false;
  if (Array.isArray(raw)) return raw.some((item) => pendingFlag(item, depth + 1));
  const rec = raw as Record<string, unknown>;
  if (rec.details_pending === true || rec.read_again === true) return true;
  return Object.values(rec).some((value) => pendingFlag(value, depth + 1));
}

export function thecarapiPayloadPending(status: number, json: unknown, bodyText = ""): boolean {
  if (status === 202) return true;
  if (json != null) return pendingFlag(json, 0);
  return /read again|details_pending/i.test(bodyText);
}

export function thecarapiHistoryRefs(json: unknown): ThecarapiAuctionRef[] {
  const out: ThecarapiAuctionRef[] = [];
  const seen = new Set<string>();
  for (const row of rowsOf(json)) {
    const site = siteSlug(row.site_name ?? row.site ?? row.platform);
    const id = auctionId(row.auction_id ?? row.id ?? row.auctionId);
    if (!site || !id) continue;
    const key = `${site}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ site, id, active: row.is_active === true });
    if (out.length >= 100) break;
  }
  return out;
}

export function parseThecarapiHistory(input: {
  json: unknown;
  baseUrl?: string;
}): { parse: VinScanParse; refs: ThecarapiAuctionRef[] } {
  const base = input.baseUrl?.replace(/\/+$/, "") || THECARAPI_DEFAULT_BASE;
  const rows = rowsOf(input.json)
    .map((row) => ({ row, stamp: stampOf(row) }))
    .sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0))
    .slice(0, 100);
  const refs = thecarapiHistoryRefs({ auctions: rows.map((item) => item.row) });
  if (rows.length === 0) {
    return { parse: { status: "none", summary: "nav ierakstu" }, refs: [] };
  }

  const auctions: VinScanAuction[] = [];
  const mileage: { date: string; odometer: string }[] = [];
  const lines: string[] = [];
  for (const { row } of rows) {
    const site = siteSlug(row.site_name ?? row.site ?? row.platform);
    const id = auctionId(row.auction_id ?? row.id ?? row.auctionId);
    const venue = thecarapiSiteLabel(site || text(row.site_name));
    const date = stampOf(row);
    const odometer = mileageLabel(row.mileage ?? row.odometer);
    const price = eurPrice(row);
    const detailPath = text(row.detail_path) || (site && id ? `/api/auction/${site}/${id}` : "");
    const link = site && id ? thecarapiAbsoluteUrl(base, detailPath, site, id) : detailPath;
    auctions.push({
      date,
      venue,
      lot: id,
      odometer,
      price,
      title: [venue, id].filter(Boolean).join(" · "),
    });
    if (date || odometer) mileage.push({ date, odometer });
    lines.push([date, venue, odometer, price, link, detailPath].filter(Boolean).join(" | "));
  }

  const venues = [...new Set(auctions.map((a) => a.venue).filter(Boolean))];
  const year = auctions[0]?.date?.slice(0, 4) || "";
  const summary = [venues.join("/"), year, `${auctions.length} ieraksti`].filter(Boolean).join(", ");
  const firstLink = lines
    .flatMap((line) => line.split(" | "))
    .find((part) => part.startsWith("https://"));

  return {
    refs,
    parse: {
      status: "found",
      summary: summary || "Ir EU izsoles ieraksts",
      detail: lines.join("\n"),
      openUrl: firstLink,
      auctions,
      mileage,
    },
  };
}

export function parseThecarapiDetail(json: unknown): ThecarapiDetailParsed {
  const row = asAuctionRecord(asRecord(json) ?? {});
  const site = siteSlug(row.site_name ?? row.site ?? row.platform);
  const id = auctionId(row.auction_id ?? row.id ?? row.auctionId);
  const pending = thecarapiPayloadPending(200, json);
  const urls = thecarapiImageUrls(row);
  const seen = new Set<string>();
  const photoUrls: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url) || !isAllowedVinScanAuctionPhotoUrl(url)) continue;
    seen.add(url);
    photoUrls.push(url);
  }
  const equipmentRaw = row.equipment ?? row.Equipment;
  const equipment = Array.isArray(equipmentRaw)
    ? equipmentRaw.map((item) => text(item)).filter(Boolean).slice(0, 40)
    : text(equipmentRaw)
      ? [text(equipmentRaw)]
      : [];
  return {
    site,
    id,
    pending,
    active: row.is_active === true,
    photoUrls,
    equipment,
  };
}

export function parseThecarapiDetailList(json: unknown): ThecarapiDetailParsed[] {
  const rows = rowsOf(json);
  if (rows.length === 0) {
    const one = parseThecarapiDetail(json);
    return one.site || one.id || one.photoUrls.length ? [one] : [];
  }
  return rows.map((row) => parseThecarapiDetail(row));
}

export function thecarapiDetailRows(json: unknown): Record<string, unknown>[] {
  return rowsOf(json);
}

export function buildThecarapiAdminRecords(input: {
  historyJson: unknown;
  detailJson?: unknown;
  imagesByKey?: Readonly<Record<string, unknown>>;
}): ThecarapiAdminRecord[] {
  const details = thecarapiDetailRows(input.detailJson);
  const detailByKey = new Map<string, Record<string, unknown>>();
  for (const row of details) {
    const site = siteSlug(row.site_name ?? row.site ?? row.platform);
    const id = auctionId(row.auction_id ?? row.id ?? row.auctionId);
    if (site && id) detailByKey.set(thecarapiRecordKey(site, id), row);
  }
  const historyRows = rowsOf(input.historyJson);
  const sourceRows = historyRows.length > 0 ? historyRows : details;
  const out: ThecarapiAdminRecord[] = [];
  const seen = new Set<string>();
  for (const row of sourceRows) {
    const site = siteSlug(row.site_name ?? row.site ?? row.platform);
    const id = auctionId(row.auction_id ?? row.id ?? row.auctionId);
    const key = site && id ? thecarapiRecordKey(site, id) : "";
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const history = historyRows.includes(row) ? row : historyRows.find((item) => thecarapiRecordKey(siteSlug(item.site_name ?? item.site), auctionId(item.auction_id ?? item.id)) === key) ?? null;
    const detail = (key && detailByKey.get(key)) || (!historyRows.length ? row : null);
    const images = key ? input.imagesByKey?.[key] ?? null : null;
    const merged = mergeThecarapiRaw(history, detail, images);
    const photoDate = thecarapiPhotoDate(merged);
    const venue = thecarapiSiteLabel(site || text(row.site_name));
    const urls = thecarapiDownloadUrls(thecarapiImageUrls(history, detail, images, merged), isAllowedVinScanAuctionPhotoUrl);
    out.push({
      site,
      id,
      date: stampOf(merged) || photoDate,
      venue,
      photoDate,
      photoUrls: urls,
      fields: thecarapiFieldsOf(merged),
      raw: merged,
      rawHistory: history,
      rawDetail: detail,
      rawImages: images,
      photos: [],
    });
    if (out.length >= 100) break;
  }
  return out;
}

export function thecarapiImageCaption(record: Pick<ThecarapiAdminRecord, "venue" | "photoDate">): string {
  return thecarapiPhotoCaption(record.venue, record.photoDate);
}

export function mergeThecarapiDetails(parse: VinScanParse, details: readonly ThecarapiDetailParsed[]): VinScanParse {
  if (parse.status !== "found" || !parse.auctions?.length || details.length === 0) return parse;
  const byId = new Map<string, ThecarapiDetailParsed>();
  for (const detail of details) {
    if (detail.pending) continue;
    if (detail.id) byId.set(detail.id, detail);
  }
  const auctions = parse.auctions.map((auction) => {
    const detail = auction.lot ? byId.get(auction.lot) : undefined;
    if (!detail || detail.photoUrls.length === 0) return auction;
    return {
      ...auction,
      photoUrl: detail.photoUrls[0],
      photoCount: detail.photoUrls.length,
      photoUrls: detail.photoUrls,
    };
  });
  const photos: string[] = [];
  const seen = new Set<string>();
  for (const auction of auctions) {
    for (const url of auction.photoUrls ?? []) {
      if (seen.has(url)) continue;
      seen.add(url);
      photos.push(url);
    }
  }
  const equipment = details
    .flatMap((detail) => detail.equipment.map((item) => (detail.id ? `${detail.id}: ${item}` : item)))
    .filter(Boolean);
  const detailText = [parse.detail?.trim() || "", equipment.length ? `Aprīkojums: ${equipment.join(", ")}` : ""]
    .filter(Boolean)
    .join("\n");
  return {
    ...parse,
    detail: detailText || parse.detail,
    auctions,
    media: photos.length
      ? { photoUrl: photos[0], photoCount: photos.length, photoUrls: photos }
      : parse.media,
  };
}

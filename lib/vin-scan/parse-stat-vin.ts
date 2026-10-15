/**
 * stat.vin (https://stat.vin/cars/<VIN>) tīrais parseris. Bez tīkla.
 * Izsole (Copart, IAAI u.c.), lots, bojājums, odometrs, foto URL.
 * Cloudflare / 429 / 403 - skaidrs statuss, nevis „Lapa nav atpazīta”.
 */

import type { VinScanAuction, VinScanParse, VinScanVehicle } from "@/lib/vin-scan/types";

export type StatVinPageInput = {
  status: number;
  html: string;
  vin: string;
  challenge?: string | null;
  /** After redirects. Missing VIN on stat.vin lands on `/car-not-found`. */
  finalUrl?: string | null;
};

const CF_RE =
  /just a moment|security verification|checking your browser|verify you are human|attention required|cf-browser-verification|access blocked/i;
const RATE_RE = /too many requests|rate limit(?:ed)?|try again later/i;
const NONE_RE =
  /not found|page not found|car not found|car-not-found|no vehicle|nothing found|no results|no similar cars|were not found|no sale history|sale history\s*\(\s*0\s*\)|we couldn['’]?t find/i;
const AUCTION_RE = /\b(auction|sold|sale date|odometer|mileage|lot|bid|copart|iaai)\b/i;
const PHOTO_SKIP_RE = /logo|favicon|sprite|pixel|1x1|avatar|icon|emoji|placeholder|spinner|badge/i;
const AUCTION_PHOTO_HOST_RE = /copart|iaai|stat\.vin|bidfax|poctra|cloudfront|auction/i;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasVin(text: string, vin: string): boolean {
  const v = vin.trim().toUpperCase();
  return Boolean(v) && text.toUpperCase().includes(v);
}

export function isStatVinNotFoundUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    return /\/car-not-found(?:\/|$)/i.test(new URL(url).pathname);
  } catch {
    return /car-not-found/i.test(url);
  }
}

function yearFromDate(raw: string): string {
  const iso = /(\d{4})/.exec(raw);
  return iso?.[1] && Number(iso[1]) >= 1990 && Number(iso[1]) <= 2100 ? iso[1] : "";
}

function kmLv(raw: string): string {
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return raw.trim();
  return `${Math.round(n).toLocaleString("lv-LV")} km`;
}

function venueName(raw: string): string {
  const t = raw.trim();
  if (/iaai|iaa i/i.test(t)) return "IAAI";
  if (/copart/i.test(t)) return "Copart";
  if (/manheim/i.test(t)) return "Manheim";
  if (t) return t.slice(0, 40);
  return "";
}

function isHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw);
}

function normalizePhotoUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("//")) return `https:${t}`;
  if (isHttpUrl(t)) return t.split("#")[0] ?? t;
  return "";
}

export function extractStatVinPhotoUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const url = normalizePhotoUrl(raw);
    if (!url || seen.has(url)) return;
    if (PHOTO_SKIP_RE.test(url) && !AUCTION_PHOTO_HOST_RE.test(url)) return;
    if (!/\.(jpe?g|webp|png)(\?|$)/i.test(url) && !AUCTION_PHOTO_HOST_RE.test(url)) return;
    seen.add(url);
    urls.push(url);
  };

  const attrRe = /(?:src|data-src|data-lazy|data-original|href)\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(attrRe)) push(m[1] ?? "");

  const jsonUrlRe = /https?:\\?\/\\?\/[^\s"'\\<>]+/gi;
  for (const m of html.matchAll(jsonUrlRe)) {
    push(m[0]!.replace(/\\\//g, "/"));
  }
  return urls.slice(0, 80);
}

function extractEmbeddedJson(html: string): unknown[] {
  const out: unknown[] = [];
  const next = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (next?.[1]) {
    try {
      out.push(JSON.parse(next[1]));
    } catch {
      /* ignore */
    }
  }
  for (const m of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!m[1]) continue;
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function walkAuctionRecords(node: unknown, vin: string, out: VinScanAuction[], depth = 0): void {
  if (depth > 8 || out.length >= 20) return;
  if (Array.isArray(node)) {
    for (const item of node) walkAuctionRecords(item, vin, out, depth + 1);
    return;
  }
  const rec = asRecord(node);
  if (!Object.keys(rec).length) return;

  const lot = str(rec.lot || rec.lotNumber || rec.lot_number || rec.itemId || rec.item_id);
  const venue = venueName(str(rec.auction || rec.auctionName || rec.site || rec.seller || rec.venue || rec.source));
  const date = str(rec.date || rec.saleDate || rec.sale_date || rec.auctionDate || rec.soldDate);
  const price = str(rec.price || rec.finalBid || rec.final_bid || rec.soldPrice || rec.highBid);
  const odometer = str(rec.odometer || rec.mileage || rec.odometerValue);
  const damage = str(rec.damage || rec.primaryDamage || rec.primary_damage || rec.secondaryDamage);
  const photo =
    normalizePhotoUrl(str(rec.photo || rec.photoUrl || rec.image || rec.thumbnail || rec.imageUrl)) ||
    normalizePhotoUrl(str(asArray(rec.photos || rec.images)[0]));
  const photoCountRaw = Number(rec.photoCount ?? rec.photosCount ?? asArray(rec.photos || rec.images).length);
  const looksAuction = Boolean(lot || venue || damage || rec.auction || rec.saleDate || rec.sale_date);
  if (looksAuction && (lot || date || venue || damage)) {
    const titleBits = [venue || "Izsole", lot ? `lots ${lot}` : "", damage].filter(Boolean);
    out.push({
      title: titleBits.join(" · ").slice(0, 160),
      date: date.slice(0, 32) || undefined,
      price: price ? price.slice(0, 40) : undefined,
      venue: venue || undefined,
      photoUrl: photo || undefined,
      photoCount: Number.isFinite(photoCountRaw) && photoCountRaw > 0 ? photoCountRaw : undefined,
    });
  }
  for (const key of ["saleHistory", "sales", "auctions", "lots", "records", "history", "props", "pageProps", "data", "car"]) {
    if (key in rec) walkAuctionRecords(rec[key], vin, out, depth + 1);
  }
}

function auctionsFromText(text: string, vin: string): VinScanAuction[] {
  if (!hasVin(text, vin)) return [];
  const out: VinScanAuction[] = [];
  const copart = /copart/i.test(text);
  const iaai = /iaai|iaa i/i.test(text);
  const lot = /lot[:\s#№]*([0-9]{5,10})/i.exec(text)?.[1] ?? "";
  const odo = /(?:odometer|mileage|odometrs)[:\s]*([\d\s,]{3,12})/i.exec(text)?.[1] ?? "";
  const damage = /(?:damage|bojājums|primary damage)[:\s]+([A-Za-zĀ-ž /-]{3,40})/i.exec(text)?.[1] ?? "";
  const year =
    yearFromDate(/((?:19|20)\d{2})/.exec(text)?.[1] ?? "") ||
    yearFromDate(/sale(?:\s+date)?[:\s]+([0-9./-]{6,12})/i.exec(text)?.[1] ?? "");
  const photos = /(\d+)\s*(?:photos?|images?|pictures?|foto)/i.exec(text);
  const photoCount = photos ? Number(photos[1]) : 0;
  if (copart) {
    out.push({
      title: ["Copart", year, lot ? `lots ${lot}` : "", damage].filter(Boolean).join(" · "),
      date: year || undefined,
      venue: "Copart",
      photoCount: Number.isFinite(photoCount) && photoCount > 0 ? photoCount : undefined,
    });
  }
  if (iaai) {
    out.push({
      title: ["IAAI", year, lot ? `lots ${lot}` : "", damage].filter(Boolean).join(" · "),
      date: year || undefined,
      venue: "IAAI",
      photoCount: Number.isFinite(photoCount) && photoCount > 0 ? photoCount : undefined,
    });
  }
  if (!out.length && AUCTION_RE.test(text)) {
    out.push({
      title: [lot ? `Lots ${lot}` : "Izsole", damage].filter(Boolean).join(" · ") || "Izsoles ieraksts",
      date: year || undefined,
      photoCount: Number.isFinite(photoCount) && photoCount > 0 ? photoCount : undefined,
    });
  }
  if (out[0] && odo && !out[0].price) {
    out[0] = { ...out[0], title: [out[0].title, kmLv(odo)].filter(Boolean).join(" · ") };
  }
  return out.slice(0, 8);
}

function vehicleFromText(text: string): VinScanVehicle | undefined {
  const year = /(?:year|gads|model year)[:\s]+((?:19|20)\d{2})/i.exec(text)?.[1] ?? "";
  const make = /(?:make|marka)[:\s]+([A-Za-z0-9-]{2,24})/i.exec(text)?.[1] ?? "";
  const model = /(?:model|modelis)[:\s]+([A-Za-z0-9 -]{1,40})/i.exec(text)?.[1] ?? "";
  if (!make && !model && !year) return undefined;
  return { make, model, year };
}

function uniqueAuctions(rows: VinScanAuction[]): VinScanAuction[] {
  const seen = new Set<string>();
  const out: VinScanAuction[] = [];
  for (const row of rows) {
    const key = [row.venue, row.date, row.title, row.photoUrl].filter(Boolean).join("|").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= 12) break;
  }
  return out;
}

export function formatStatVinFoundSummary(auctions: readonly VinScanAuction[], photoCount: number): string {
  const first = auctions[0];
  const venue = first?.venue || (first?.title?.includes("Copart") ? "Copart" : first?.title?.includes("IAAI") ? "IAAI" : "");
  const year = yearFromDate(first?.date || first?.title || "");
  const head = [venue, year].filter(Boolean).join(" ");
  const bits = [head, photoCount > 0 ? `${photoCount} foto` : ""].filter(Boolean);
  if (bits.length) return bits.join(", ");
  if (auctions.length > 1) return `${auctions.length} izsoles ieraksti`;
  return "Ir izsoles ieraksts";
}

export function classifyStatVinText(text: string, vin: string): { status: "found" | "none" | "unknown"; summary: string } | null {
  if (CF_RE.test(text)) return null;
  if (RATE_RE.test(text) && !hasVin(text, vin)) {
    return { status: "unknown", summary: "stat.vin: pieprasījumu limits" };
  }
  if (!hasVin(text, vin)) {
    if (NONE_RE.test(text)) return { status: "none", summary: "Nav izsoles ieraksta" };
    if (text.trim().length < 40) return null;
    return { status: "unknown", summary: "stat.vin: lapa bez VIN un bez „nav atrasts”" };
  }
  if (AUCTION_RE.test(text)) {
    const auctions = auctionsFromText(text, vin);
    const photos = /(\d+)\s*(?:photos?|images?|pictures?|foto)/i.exec(text);
    const photoCount = photos ? Number(photos[1]) : 0;
    return {
      status: "found",
      summary: formatStatVinFoundSummary(auctions, Number.isFinite(photoCount) ? photoCount : 0),
    };
  }
  if (NONE_RE.test(text)) return { status: "none", summary: "Nav izsoles ieraksta" };
  return null;
}

export function parseStatVinPage(input: StatVinPageInput): VinScanParse {
  const vin = input.vin.trim().toUpperCase();
  const html = input.html || "";
  const text = visibleText(html);

  if (input.challenge) {
    return { status: "unknown", summary: `stat.vin: Cloudflare bloķē servera pārbaudi (${input.challenge})` };
  }
  if (input.status === 429 || (RATE_RE.test(text) && !hasVin(text, vin))) {
    return { status: "unknown", summary: "stat.vin: pieprasījumu limits (HTTP 429)" };
  }
  if (CF_RE.test(text) && !hasVin(text, vin)) {
    return { status: "unknown", summary: "stat.vin: Cloudflare bloķē servera pārbaudi" };
  }
  if (input.status === 403) {
    return { status: "unknown", summary: "stat.vin: piekļuve bloķēta (HTTP 403)" };
  }
  if (input.status === 404 || isStatVinNotFoundUrl(input.finalUrl)) {
    return { status: "none", summary: "Nav izsoles ieraksta" };
  }
  if (input.status >= 400) {
    return { status: "unknown", summary: `stat.vin: HTTP ${input.status}` };
  }

  const photos = extractStatVinPhotoUrls(html);
  const fromJson: VinScanAuction[] = [];
  for (const blob of extractEmbeddedJson(html)) walkAuctionRecords(blob, vin, fromJson);
  const auctions = uniqueAuctions([...fromJson, ...auctionsFromText(text, vin)]);
  const photoCount = Math.max(
    photos.length,
    ...auctions.map((row) => row.photoCount ?? 0),
    Number(/(\d+)\s*(?:photos?|images?|pictures?|foto)/i.exec(text)?.[1] ?? 0),
  );
  const firstPhoto = auctions.find((row) => row.photoUrl)?.photoUrl || photos[0] || "";
  if (auctions[0] && !auctions[0].photoUrl && firstPhoto) {
    auctions[0] = { ...auctions[0], photoUrl: firstPhoto, photoCount: photoCount || auctions[0].photoCount };
  }

  if (hasVin(text, vin) && (auctions.length > 0 || AUCTION_RE.test(text))) {
    const vehicle = vehicleFromText(text);
    return {
      status: "found",
      summary: formatStatVinFoundSummary(auctions, photoCount),
      detail: auctions
        .map((row) => [row.title, row.date, row.venue].filter(Boolean).join(" · "))
        .filter(Boolean)
        .join("\n"),
      vehicle,
      media:
        firstPhoto || photoCount > 0 || photos.length
          ? {
              photoUrl: firstPhoto || undefined,
              photoCount: photoCount || undefined,
              photoUrls: photos.slice(0, 200),
            }
          : undefined,
      flags: photoCount > 0 ? { photoCount } : undefined,
      auctions: auctions.length ? auctions : [{ title: "Izsoles ieraksts", photoUrl: firstPhoto || undefined, photoCount: photoCount || undefined }],
    };
  }

  if (NONE_RE.test(text)) {
    return { status: "none", summary: "Nav izsoles ieraksta" };
  }
  if (!hasVin(text, vin)) {
    return { status: "unknown", summary: "stat.vin: lapa bez VIN un bez „nav atrasts”" };
  }
  return { status: "unknown", summary: "stat.vin: lapa nav atpazīta" };
}

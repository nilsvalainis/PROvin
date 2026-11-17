/**
 * stat.vin (https://stat.vin/cars/<VIN>) tīrais parseris. Bez tīkla.
 * Izsole (Copart, IAAI u.c.), lots, bojājums, odometrs, foto URL.
 * Cloudflare / 429 / 403 - skaidrs statuss, nevis „Lapa nav atpazīta”.
 */

import { auctionDamageLv } from "@/lib/vin-scan/damage-labels-lv";
import { milesToKmRounded } from "@/lib/miles-to-km";
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
  /just a moment|performing security verification|security verification|verifies you are not a bot|checking your browser|verify you are human|attention required|cf-browser-verification|access blocked|sorry, you have been blocked/i;
const RATE_RE = /too many requests|rate limit(?:ed)?|try again later/i;
/** Tukša meklēšana / car-not-found. „No data found” un „Sale History (0)” ir kartītes blakus teksts, ne none. */
const NONE_RE =
  /page not found|car not found|car-not-found|no vehicle|nothing found|no results|we couldn['’]?t find a vehicle|vehicle not found/i;
const SOFT_NONE_RE = /no similar cars|were not found|no sale history|sale history\s*\(\s*0\s*\)|no data found/i;
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

/** stat.vin ASV kartīte raksta „Odometer, mi”. Bez vienības atstāj skaitli kā km (vecais HTML). */
export function formatStatVinOdometerKm(raw: string): string {
  const text = String(raw).trim();
  if (!text) return "";
  const n = Number(text.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  const miles = /\b(mi|mile|miles)\b/i.test(text);
  const km = miles ? milesToKmRounded(n) : Math.round(n);
  return `${km.toLocaleString("lv-LV")} km`;
}

/** Copart FI vai ES atrašanās vieta: odometrs vienmēr km (arī ar „mi” etiķeti). */
export function isEuAuctionLot(venue: string, location?: string): boolean {
  if (venue === "Copart FI") return true;
  return /\b(?:finland|suomi|sweden|germany|deutschland|estonia|latvia|lithuania|poland|denmark|netherlands|belgium|france|spain|italy|austria)\b/i.test(
    location ?? "",
  );
}

function kmLv(raw: string): string {
  return formatStatVinOdometerKm(raw);
}

const LOT_CAPTURE_RE = /lot(?:\s*number)?[:\s#№"']*([0-9]{5,10})|\/lot\/([0-9]{5,10})/i;
const ODO_CAPTURE_RE = /(?:odometer|mileage|odometrs)(?:,?\s*mi)?[:\s]*([\d\s,]{3,12})/i;

function venueName(raw: string): string {
  const t = raw.trim();
  if (/iaai|iaa i/i.test(t)) return "IAAI";
  if (/copart/i.test(t) && (/\bfi\b/i.test(t) || /finland|copart\.fi/i.test(t))) return "Copart FI";
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
  return urls.slice(0, 200);
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
  for (const m of html.matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!m[1]) continue;
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function auctionFromSchemaVehicle(rec: Record<string, unknown>, vin: string): VinScanAuction | null {
  const typeName = str(rec["@type"] || rec.type);
  if (!/vehicle/i.test(typeName)) return null;
  const idVin = str(rec.vehicleIdentificationNumber || rec.sku || rec.mpn).toUpperCase();
  if (vin && idVin && idVin !== vin) return null;
  const desc = str(rec.description);
  const lotHit = LOT_CAPTURE_RE.exec(desc);
  const lot = str(rec.lot || rec.lotNumber) || lotHit?.[1] || lotHit?.[2] || "";
  const venue = venueName(
    str(asRecord(rec.seller).name) || /copart\s*finland|copart\s*fi|\biaai\b|\bcopart\b/i.exec(desc)?.[0] || "",
  );
  const miles = /mileage of\s+([\d\s,]+)\s*miles/i.exec(desc)?.[1] ?? "";
  const odoRaw = miles || str(rec.mileageFromOdometer || rec.odometer || rec.mileage);
  // j26: Copart FI apraksts arī saka „miles”, bet vērtība ir km.
  const odometer = odoRaw ? kmLv(miles && !isEuAuctionLot(venue) ? `${odoRaw} mi` : odoRaw) : "";
  const damage = auctionDamageLv(str(rec.knownVehicleDamages || rec.damage || rec.primaryDamage));
  const date = str(rec.purchaseDate || rec.date || rec.saleDate).slice(0, 32);
  const photoList = asArray(rec.image)
    .map((item) => normalizePhotoUrl(typeof item === "string" ? item : str(asRecord(item).url || asRecord(item).src)))
    .filter(Boolean);
  if (!lot && !venue && !damage && !odometer && !photoList.length) return null;
  const photos = [...new Set(photoList)].slice(0, 200);
  return {
    title: [venue || "Izsole", lot ? `lots ${lot}` : "", damage, odometer].filter(Boolean).join(" · ").slice(0, 180),
    date: date || undefined,
    venue: venue || undefined,
    lot: lot || undefined,
    odometer: odometer || undefined,
    damage: damage || undefined,
    photoUrl: photos[0] || undefined,
    photoCount: photos.length || undefined,
    photoUrls: photos.length ? photos : undefined,
  };
}

function walkAuctionRecords(node: unknown, vin: string, out: VinScanAuction[], depth = 0): void {
  if (depth > 8 || out.length >= 20) return;
  if (Array.isArray(node)) {
    for (const item of node) walkAuctionRecords(item, vin, out, depth + 1);
    return;
  }
  const rec = asRecord(node);
  if (!Object.keys(rec).length) return;
  if (Array.isArray(rec["@graph"])) {
    walkAuctionRecords(rec["@graph"], vin, out, depth + 1);
  }
  if (/vehicle/i.test(str(rec["@type"] || rec.type))) {
    const schemaAuction = auctionFromSchemaVehicle(rec, vin);
    if (schemaAuction) out.push(schemaAuction);
  }

  const lot = str(rec.lot || rec.lotNumber || rec.lot_number || rec.itemId || rec.item_id);
  const place = str(rec.country || rec.countryCode || rec.location || rec.yard || rec.saleCountry || rec.saleLocation);
  const venue = venueName(
    [str(rec.auction || rec.auctionName || rec.site || rec.seller || rec.venue || rec.source), place].filter(Boolean).join(" "),
  );
  const date = str(rec.date || rec.saleDate || rec.sale_date || rec.auctionDate || rec.soldDate || rec.purchaseDate);
  const price = str(rec.price || rec.finalBid || rec.final_bid || rec.soldPrice || rec.highBid);
  const unit = str(rec.odometerUnit || rec.mileageUnit || rec.unit);
  const odometerRaw = str(rec.odometer || rec.mileage || rec.odometerValue || rec.mileageFromOdometer);
  // j26: Copart FI / ES loti - „mi” etiķete nav jūdzes, km nepārrēķina.
  const odometer = odometerRaw
    ? kmLv([odometerRaw, isEuAuctionLot(venue, place) ? "" : unit].filter(Boolean).join(" "))
    : "";
  const damage = auctionDamageLv(
    str(rec.damage || rec.primaryDamage || rec.primary_damage || rec.knownVehicleDamages || rec.secondaryDamage),
  );
  const photoList = asArray(rec.photos || rec.images)
    .map((item) => normalizePhotoUrl(typeof item === "string" ? item : str(asRecord(item).url || asRecord(item).src || asRecord(item).href)))
    .filter(Boolean);
  const photo =
    normalizePhotoUrl(str(rec.photo || rec.photoUrl || rec.image || rec.thumbnail || rec.imageUrl)) || photoList[0] || "";
  const photos = [...new Set([photo, ...photoList].filter(Boolean))].slice(0, 200);
  const photoCountRaw = Number(rec.photoCount ?? rec.photosCount ?? photos.length);
  const looksAuction = Boolean(lot || venue || damage || rec.auction || rec.saleDate || rec.sale_date);
  if (looksAuction && (lot || date || venue || damage)) {
    const titleBits = [venue || "Izsole", lot ? `lots ${lot}` : "", damage, odometer].filter(Boolean);
    out.push({
      title: titleBits.join(" · ").slice(0, 180),
      date: date.slice(0, 32) || undefined,
      price: price ? price.slice(0, 40) : undefined,
      venue: venue || undefined,
      lot: lot || undefined,
      odometer: odometer || undefined,
      damage: damage || undefined,
      photoUrl: photos[0] || undefined,
      photoCount: Math.max(photos.length, Number.isFinite(photoCountRaw) && photoCountRaw > 0 ? photoCountRaw : 0) || undefined,
      photoUrls: photos.length ? photos : undefined,
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
  const copartFi = copart && /copart\s*fi\b|copart\.fi|\bfinland\b/i.test(text);
  const iaai = /iaai|iaa i/i.test(text);
  const lotHit = LOT_CAPTURE_RE.exec(text);
  const lot = lotHit?.[1] || lotHit?.[2] || "";
  const odoMatch = ODO_CAPTURE_RE.exec(text);
  const odo = odoMatch?.[1] ?? "";
  const odoMiles = Boolean(odoMatch && /\bmi\b/i.test(odoMatch[0] + text.slice((odoMatch.index ?? 0) + odoMatch[0].length, (odoMatch.index ?? 0) + odoMatch[0].length + 8)));
  const damage = /(?:primary damage|bojājums|(?<![A-Za-z])damage):[:\s]*([A-Za-zĀ-ž /-]{3,40})/i.exec(text)?.[1] ?? "";
  const year =
    yearFromDate(/((?:19|20)\d{2})/.exec(text)?.[1] ?? "") ||
    yearFromDate(/sale(?:\s+date)?[:\s]+([0-9./-]{6,12})/i.exec(text)?.[1] ?? "");
  const photos = /(\d+)\s*(?:photos?|images?|pictures?|foto)/i.exec(text);
  const photoCount = photos ? Number(photos[1]) : 0;
  if (copart) {
    const venue = copartFi ? "Copart FI" : "Copart";
    out.push({
      title: [venue, year, lot ? `lots ${lot}` : "", damage].filter(Boolean).join(" · "),
      date: year || undefined,
      venue,
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
  if (out[0] && odo && !out[0].odometer) {
    const odometer = kmLv(odoMiles ? `${odo} mi` : odo);
    out[0] = { ...out[0], odometer, title: [out[0].title, odometer].filter(Boolean).join(" · ") };
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

function vehicleFromNode(node: unknown, depth = 0): VinScanVehicle | undefined {
  if (depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = vehicleFromNode(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const rec = asRecord(node);
  if (/vehicle/i.test(str(rec["@type"] || rec.type))) {
    const manufacturer = str(rec.manufacturer) || str(asRecord(rec.manufacturer).name);
    const year = yearFromDate(str(rec.productionDate || rec.modelDate || rec.vehicleModelDate || rec.year));
    const model = str(rec.model || rec.vehicleModel);
    if (manufacturer || model || year) return { make: manufacturer, model, year };
  }
  for (const key of ["@graph", "props", "pageProps", "data", "car"]) {
    if (key in rec) {
      const found = vehicleFromNode(rec[key], depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

function vehicleFromEmbedded(html: string): VinScanVehicle | undefined {
  for (const blob of extractEmbeddedJson(html)) {
    const found = vehicleFromNode(blob);
    if (found) return found;
  }
  return undefined;
}

function cutLabeled(text: string, labels: string): string {
  const re = new RegExp(`(?:${labels})[:\\s]+([^\\n]{1,80})`, "i");
  const raw = re.exec(text)?.[1] ?? "";
  return (
    raw
      .split(/\s+(?=sale date\b|final bid\b|winning bid\b|odometer\b|mileage\b|lot\b|damage\b|primary damage\b|location\b|auction\b)/i)[0]
      ?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function saleDateOf(text: string): string {
  const iso = /sale(?:\s+date)?[:\s]+((?:19|20)\d{2}-\d{2}-\d{2})/i.exec(text)?.[1];
  if (iso) return iso;
  const loose = /sale(?:\s+date)?[:\s]+([0-9./-]{6,12})/i.exec(text)?.[1] ?? "";
  return yearFromDate(loose) ? loose : yearFromDate(text);
}

function priceOf(text: string): string {
  const labeled = cutLabeled(text, "final bid|winning bid|sold for|sold price|high bid");
  if (labeled && /\d/.test(labeled)) return labeled.slice(0, 40);
  const money = /(?:\$|€|£)\s?[\d][\d\s,.]{1,14}/.exec(text)?.[0]?.replace(/\s+/g, "") ?? "";
  return money.slice(0, 40);
}

function lotMarks(html: string): { lot: string; index: number }[] {
  const out: { lot: string; index: number }[] = [];
  const re = /lot(?:\s*number)?[:\s#№"']*([0-9]{5,10})|\/lot\/([0-9]{5,10})/gi;
  for (const match of html.matchAll(re)) {
    const lot = match[1] || match[2] || "";
    if (!lot || out.some((row) => row.lot === lot)) continue;
    out.push({ lot, index: match.index ?? 0 });
  }
  return out;
}

function auctionFromChunk(chunkHtml: string, lot: string, allPhotos: readonly string[], onlyLot: boolean): VinScanAuction | null {
  const text = visibleText(chunkHtml).replace(/\b(copart(?:\s*fi)?|iaai|iaa i|manheim)\s*$/i, "").trim();
  const venue = venueName(
    /copart\s*fi\b|copart\.fi|\bfinland\b/i.test(text)
      ? "Copart FI"
      : /iaai|iaa i/i.test(text)
        ? "IAAI"
        : /copart/i.test(text)
          ? "Copart"
          : /manheim/i.test(text)
            ? "Manheim"
            : "",
  );
  if (!venue && !lot && !AUCTION_RE.test(text)) return null;
  const damage = auctionDamageLv(cutLabeled(text, "primary damage|bojājums|(?<![A-Za-z])damage").replace(/[.,;]+$/, ""));
  const odoLabeled = cutLabeled(text, "odometer(?:,?\\s*mi)?|mileage|odometrs");
  const odoRaw = odoLabeled.replace(/[^\d\s,.]/g, "").trim();
  const location = cutLabeled(text, "location|sale location|branch|yard");
  // j26: stat.vin raksta „Odometer, mi” arī ES lotiem - Copart FI / ES vienmēr km.
  const euLot = isEuAuctionLot(venue, location);
  const odometer = odoRaw ? kmLv(!euLot && /\bmi\b/i.test(odoLabeled) ? `${odoRaw} mi` : odoRaw) : "";
  const date = saleDateOf(text);
  const price = priceOf(text);
  const byLot = lot ? allPhotos.filter((url) => url.includes(lot)) : [];
  const inChunk = extractStatVinPhotoUrls(chunkHtml);
  const photos = [...new Set(byLot.length ? byLot : onlyLot ? [...allPhotos] : inChunk)].slice(0, 200);
  const title = [venue || "Izsole", lot ? `lots ${lot}` : "", damage, odometer, location].filter(Boolean).join(" · ").slice(0, 180);
  if (!title && !date && !price) return null;
  return {
    title: title || "Izsoles ieraksts",
    date: date || undefined,
    price: price || undefined,
    venue: venue || undefined,
    lot: lot || undefined,
    odometer: odometer || undefined,
    damage: damage || undefined,
    photoUrl: photos[0],
    photoCount: photos.length || undefined,
    photoUrls: photos.length ? photos : undefined,
  };
}

/** Katra izsole atsevišķi: lots, datums, km, bojājums, cena, vieta un šī lota foto. */
function auctionsFromSaleBlocks(html: string, text: string, vin: string): VinScanAuction[] {
  if (!hasVin(text, vin) && !hasVin(html, vin)) return [];
  const marks = lotMarks(html);
  const allPhotos = extractStatVinPhotoUrls(html);
  if (marks.length === 0) return auctionsFromText(text, vin);
  const out: VinScanAuction[] = [];
  for (let i = 0; i < marks.length && out.length < 12; i += 1) {
    const prev = i === 0 ? 0 : marks[i - 1]!.index + 1;
    const start = Math.max(prev, marks[i]!.index - 90);
    const end = i + 1 < marks.length ? marks[i + 1]!.index : html.length;
    const chunk = html.slice(start, end);
    const row = auctionFromChunk(chunk, marks[i]!.lot, allPhotos, marks.length === 1);
    if (row) out.push(row);
  }
  return out.length ? out : auctionsFromText(text, vin);
}

function uniqueAuctions(rows: VinScanAuction[]): VinScanAuction[] {
  const seen = new Set<string>();
  const out: VinScanAuction[] = [];
  for (const row of rows) {
    const key = [row.lot, row.venue, row.date, row.title, row.photoUrl].filter(Boolean).join("|").toLowerCase();
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
    if (NONE_RE.test(text) || SOFT_NONE_RE.test(text)) return { status: "none", summary: "Nav izsoles ieraksta" };
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
  if (input.status === 404 || isStatVinNotFoundUrl(input.finalUrl)) {
    return { status: "none", summary: "Nav izsoles ieraksta" };
  }

  const found = buildStatVinFound(html, text, vin);
  if (found) return found;

  if (input.status === 403) {
    return { status: "unknown", summary: "stat.vin: piekļuve bloķēta (HTTP 403)" };
  }
  if (input.status >= 400) {
    return { status: "unknown", summary: `stat.vin: HTTP ${input.status}` };
  }
  if (NONE_RE.test(text) || (!hasVin(text, vin) && SOFT_NONE_RE.test(text))) {
    return { status: "none", summary: "Nav izsoles ieraksta" };
  }
  if (!hasVin(text, vin)) {
    return { status: "unknown", summary: "stat.vin: lapa bez VIN un bez „nav atrasts”" };
  }
  return { status: "unknown", summary: "stat.vin: lapa nav atpazīta" };
}

/** Izsoles HTML ir rezultāts arī tad, ja navigācijas atbilde palika 403 (Cloudflare izaicinājums). */
function buildStatVinFound(html: string, text: string, vin: string): VinScanParse | null {
  if (CF_RE.test(text) && !/sale history|\bcopart\b|\biaai\b/i.test(text)) return null;
  const photos = extractStatVinPhotoUrls(html);
  const fromJson: VinScanAuction[] = [];
  for (const blob of extractEmbeddedJson(html)) walkAuctionRecords(blob, vin, fromJson);
  const fromPage = fromJson.length ? [] : auctionsFromSaleBlocks(html, text, vin);
  const auctions = uniqueAuctions([...fromJson, ...fromPage]);
  const photoCount = Math.max(
    photos.length,
    ...auctions.map((row) => row.photoCount ?? 0),
    Number(/(\d+)\s*(?:photos?|images?|pictures?|foto)/i.exec(text)?.[1] ?? 0),
  );
  const firstPhoto = auctions.find((row) => row.photoUrl)?.photoUrl || photos[0] || "";
  if (auctions[0] && !auctions[0].photoUrl && firstPhoto) {
    auctions[0] = { ...auctions[0], photoUrl: firstPhoto, photoCount: photoCount || auctions[0].photoCount };
  }
  const mileage = auctions
    .filter((row) => row.odometer)
    .map((row) => ({ date: row.date || "", odometer: row.odometer || "" }));

  if (hasVin(text, vin) && (auctions.length > 0 || AUCTION_RE.test(text))) {
    const vehicle = vehicleFromText(text) ?? vehicleFromEmbedded(html);
    return {
      status: "found",
      summary: formatStatVinFoundSummary(auctions, photoCount),
      detail: auctions
        .map((row) => [row.title, row.date, row.price, row.venue, row.lot ? `lots ${row.lot}` : "", row.odometer, row.damage].filter(Boolean).join(" · "))
        .filter(Boolean)
        .join("\n"),
      vehicle,
      mileage: mileage.length ? mileage : undefined,
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
  return null;
}

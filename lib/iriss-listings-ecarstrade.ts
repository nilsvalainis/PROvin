/**
 * eCarsTrade (ecarstrade.com) meklēšanas nolasīšana.
 *
 * Vietne ir PHP + jQuery: saraksts nāk no `GET /future_api.php?request_type=cars&…`
 * kā salīmēti JSON objekti `{status, car_id, data, result}`. `result` ir base64 HTML karte.
 * `data` dod solījumu / beigu laiku. Publiski (bez login) kartītes ir, cenas HTML slēpj
 * („Sign in to buy”), bet `data.max_bid` bieži ir. Login: `POST /api/v1/auth/login`
 * ar `{username, password}` -> `accessToken` / `refreshToken` (sīkdatnes eCT/user, eCT/refresh-token).
 *
 * Valsts filtrs vienmēr BE / NL / LU / DE (`country[]=BEL|NET|LUX|GER`).
 */

import {
  ECARSTRADE_ALLOWED_COUNTRY_QUERY,
  listingCountryAllowed,
  normalizeListingCountryCode,
} from "@/lib/iriss-listings-country-filter";
import { parseEnginePowerKwFromText } from "@/lib/engine-power-kw";

export const ECARSTRADE_ORIGIN = "https://ecarstrade.com";
export const ECARSTRADE_SEARCH_PATH = "/search";
export const ECARSTRADE_API_PATH = "/future_api.php";
export const ECARSTRADE_AUTH_PATH = "/api/v1/auth/login";
export const ECARSTRADE_DETAIL_PREFIX = `${ECARSTRADE_ORIGIN}/cars/`;
export const ECARSTRADE_DEFAULT_SORT = "time_left.asc";
export const ECARSTRADE_DEFAULT_PER_PAGE = 20;

const FILTER_KEYS = new Set([
  "mark[]",
  "model[]",
  "fuel[]",
  "gearbox[]",
  "color[]",
  "category[]",
  "auction_type[]",
  "condition[]",
  "vat[]",
  "sources[]",
  "ect_warehouse[]",
  "options[]",
  "is_viewed[]",
  "id_auction[]",
  "country_origin[]",
  "search",
  "year_from",
  "year_to",
  "mileage_from",
  "mileage_to",
  "price_from",
  "price_to",
  "power_from",
  "power_to",
  "doors_from",
  "doors_to",
  "places_from",
  "places_to",
  "engine_from",
  "engine_to",
  "emission_from",
  "sort",
]);

export type EcarstradeVehicle = {
  externalId: string;
  auctionId: string;
  title: string;
  manufacturer: string;
  detailUrl: string;
  auctionStage: string;
  auctionStartAt: string;
  auctionEndAt: string;
  priceStart: number | null;
  priceMinimal: number | null;
  priceCurrent: number | null;
  priceBuyNow: number | null;
  vatNote: string;
  taxDeduction: boolean | null;
  imageUrl: string;
  imageUrls: string[];
  firstRegistration: string;
  year: string;
  mileageKm: number | null;
  fuel: string;
  transmission: string;
  powerKw: string;
  location: string;
  countryCode: string;
  color?: string;
  bodyType?: string;
};

export type EcarstradeSearchPage = {
  vehicles: EcarstradeVehicle[];
  pageCount: number;
  pageNumber: number;
  perPage: number;
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function price(v: unknown): number | null {
  const n = num(v);
  return n !== null && n > 0 ? Math.round(n) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/** Salīmēti JSON objekti `{}{...}{...}` (eCarsTrade future_api.php). */
export function splitConcatenatedJsonObjects(raw: string): Rec[] {
  const out: Rec[] = [];
  let buf = "";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (const ch of raw) {
    if (depth === 0 && !ch.trim()) continue;
    buf += ch;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const t = buf.trim();
        buf = "";
        if (!t || t === "{}") continue;
        try {
          const parsed = JSON.parse(t) as unknown;
          if (isRec(parsed)) out.push(parsed);
        } catch {
          /* nederīgs gabals */
        }
      }
    }
  }
  return out;
}

export function decodeEcarstradeCardHtml(result: unknown): string {
  const raw = str(result);
  if (!raw) return "";
  try {
    return Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function ecarstradeDetailUrl(externalId: string): string {
  const id = externalId.trim();
  return id ? `${ECARSTRADE_DETAIL_PREFIX}${encodeURIComponent(id)}` : "";
}

function attr(html: string, name: string): string {
  const re = new RegExp(`${name}=["']([^"']+)["']`, "i");
  return decodeHtmlEntities(re.exec(html)?.[1] ?? "").trim();
}

function featureByTitle(html: string, title: string): string {
  const re = new RegExp(
    `data-original-title="${title}"[\\s\\S]*?<div class="feature-value">([\\s\\S]*?)</div>`,
    "i",
  );
  const m = html.match(re);
  return m ? stripTags(m[1] ?? "") : "";
}

function spanByTitle(html: string, title: string): string {
  const re = new RegExp(`data-original-title="${title}"[^>]*>([\\s\\S]*?)</span>`, "i");
  const m = html.match(re);
  return m ? stripTags(m[1] ?? "") : "";
}

function yearFromRegistration(reg: string): string {
  const m = reg.match(/((?:19|20)\d{2})/);
  return m?.[1] ?? "";
}

function mileageFromText(raw: string): number | null {
  const m = raw.replace(/\u00a0/g, " ").match(/([\d.\s]+)\s*(?:km|км)/i);
  if (!m) return num(raw);
  const n = Number.parseInt(m[1].replace(/[.\s]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function powerKwFromText(raw: string): string {
  const paren = raw.match(/\((\d+(?:[.,]\d+)?)\s*kW\)/i);
  if (paren) return paren[1].replace(",", ".");
  const kw = parseEnginePowerKwFromText(raw, { bareNumberIsKw: false });
  return kw != null ? String(kw) : raw.trim();
}

function absoluteEctUrl(path: string): string {
  const t = path.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("/")) return `${ECARSTRADE_ORIGIN}${t}`;
  return `${ECARSTRADE_ORIGIN}/${t}`;
}

function pickImages(html: string): string[] {
  const out: string[] = [];
  const push = (u: string) => {
    const url = absoluteEctUrl(u);
    if (url && !out.includes(url)) out.push(url);
  };
  for (const m of html.matchAll(/data-src=["']([^"']+)["']/gi)) push(m[1] ?? "");
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) push(m[1] ?? "");
  return out.filter((u) => /carsphotos|thumbnails|photo_/i.test(u)).slice(0, 40);
}

function countryFromCard(html: string): { countryCode: string; location: string } {
  const origin = /Country of origin:\s*([^"'<]+)/i.exec(html)?.[1] ?? "";
  const locTitle = /Car location\s*-\s*['"]?([^"'<]+)/i.exec(html)?.[1] ?? "";
  const flag = /\/images\/flags\/h\d+\/([a-z]{2})\.png/i.exec(html)?.[1] ?? "";
  const named = /<span>\s*(Belgium|The Netherlands|Netherlands|Luxembourg|Germany|France|Spain|Italy)\s*<\/span>/i.exec(html)?.[1] ?? "";
  const countryCode =
    normalizeListingCountryCode(flag) ||
    normalizeListingCountryCode(named) ||
    normalizeListingCountryCode(origin) ||
    normalizeListingCountryCode(locTitle);
  const location = [named || origin, locTitle].map((s) => s.trim()).filter(Boolean).join(", ");
  return { countryCode, location };
}

function vatFromCard(html: string): { vatNote: string; taxDeduction: boolean | null } {
  if (/VAT non-deductible|VAT not deductible|non-deductible/i.test(html)) {
    return { vatNote: "VAT non-deductible", taxDeduction: false };
  }
  if (/VAT deductible/i.test(html)) {
    return { vatNote: "VAT deductible", taxDeduction: true };
  }
  return { vatNote: "", taxDeduction: null };
}

function auctionStageFromType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "open") return "OPEN_AUCTION";
  if (t === "fix") return "FIXED_PRICE";
  if (t === "bid_or_fix") return "BID_OR_BUY_NOW";
  if (t === "stock") return "STOCK";
  if (t === "bid") return "BLIND_AUCTION";
  return t.toUpperCase();
}

function closeAtIso(html: string, dataClose: unknown): string {
  const utc = attr(html, "data-utc-time") || /data-utc-time=["']([^"']+)["']/i.exec(html)?.[1] || "";
  if (utc) {
    const t = Date.parse(utc);
    if (Number.isFinite(t)) return new Date(t).toISOString();
    return utc;
  }
  const close = str(dataClose);
  if (!close) return "";
  const t = Date.parse(close);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

export function parseEcarstradeCard(html: string, data: Rec = {}): EcarstradeVehicle | null {
  const externalId = str(data.id) || attr(html, "data-itemId") || attr(html, "data-itemid") || str(data.car_id);
  if (!externalId) return null;
  const title =
    stripTags(/<div class="item-title[\s\S]*?<span>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? "") ||
    stripTags(/aria-label="Share\s+([^"]+)"/i.exec(html)?.[1] ?? "");
  if (!title) return null;
  const sub = stripTags(/<div class="small text-muted">([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? "");
  const makeFromSub = sub.replace(/^#\d+\s*-\s*/i, "").split(/\s+/)[0] ?? "";
  const manufacturer = makeFromSub || title.split(/\s+/)[0] || "";
  const firstRegistration = featureByTitle(html, "First registration date");
  const transmission = featureByTitle(html, "Gearbox");
  const mileageKm = mileageFromText(featureByTitle(html, "Mileage"));
  const fuel = spanByTitle(html, "Fuel") || featureByTitle(html, "Fuel");
  const powerRaw = featureByTitle(html, "Power");
  const images = pickImages(html);
  const { countryCode, location } = countryFromCard(html);
  const vat = vatFromCard(html);
  const auctionType = attr(html, "data-auction-type");
  const auctionHref = /href="(\/auctions\/auction[^"]+)"/i.exec(html)?.[1] ?? "";
  const auctionId = /auction(\d+)/i.exec(auctionHref)?.[1] || str(data.auction_id);
  const maxBid = price(data.max_bid);
  const isFixed = auctionType === "fix" || auctionType === "bid_or_fix";
  return {
    externalId,
    auctionId,
    title,
    manufacturer,
    detailUrl: ecarstradeDetailUrl(externalId),
    auctionStage: auctionStageFromType(auctionType),
    auctionStartAt: "",
    auctionEndAt: closeAtIso(html, data.close_date),
    priceStart: null,
    priceMinimal: null,
    priceCurrent: isFixed ? null : maxBid,
    priceBuyNow: isFixed ? maxBid : null,
    vatNote: vat.vatNote,
    taxDeduction: vat.taxDeduction,
    imageUrl: images[0] ?? "",
    imageUrls: images,
    firstRegistration,
    year: yearFromRegistration(firstRegistration),
    mileageKm,
    fuel,
    transmission,
    powerKw: powerKwFromText(powerRaw),
    location,
    countryCode,
  };
}

export function parseEcarstradeApiPage(
  raw: string,
  pageNumber = 1,
  perPage = ECARSTRADE_DEFAULT_PER_PAGE,
): EcarstradeSearchPage | null {
  const objects = splitConcatenatedJsonObjects(raw);
  if (objects.length === 0 && raw.trim() && raw.trim() !== "{}") return null;
  const byId = new Map<string, EcarstradeVehicle>();
  for (const obj of objects) {
    const html = decodeEcarstradeCardHtml(obj.result);
    if (!html) continue;
    const data = isRec(obj.data) ? obj.data : {};
    if (!data.id && obj.car_id) data.id = obj.car_id;
    const v = parseEcarstradeCard(html, data);
    if (v && !byId.has(v.externalId) && listingCountryAllowed(v.countryCode)) byId.set(v.externalId, v);
  }
  const vehicles = [...byId.values()];
  const full = vehicles.length >= perPage;
  return {
    vehicles,
    pageNumber,
    perPage,
    pageCount: full ? pageNumber + 1 : Math.max(pageNumber, vehicles.length > 0 ? pageNumber : 0),
  };
}

export function isEcarstradeSearchUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (!(host === "ecarstrade.com" || host.endsWith(".ecarstrade.com"))) return false;
    return /\/search(?:\/|$)/i.test(u.pathname) || /\/selection\//i.test(u.pathname) || u.pathname === "/";
  } catch {
    return false;
  }
}

/** Operatora meklēšanas URL -> future_api.php, valsts vienmēr BEL/NET/LUX/GER. */
export function ecarstradeApiUrl(sourceUrl: string, start: number, perPage = ECARSTRADE_DEFAULT_PER_PAGE): string {
  const src = new URL(sourceUrl);
  const api = new URL(ECARSTRADE_API_PATH, ECARSTRADE_ORIGIN);
  api.searchParams.set("request_type", "cars");
  api.searchParams.set("auction_type", "search");
  api.searchParams.set("start", String(Math.max(0, start)));
  api.searchParams.set("perpage", String(Math.max(1, perPage)));
  const sort = src.searchParams.get("sort")?.trim() || ECARSTRADE_DEFAULT_SORT;
  api.searchParams.set("sort", sort.includes(".") ? sort : `${sort}.asc`);
  for (const [key, value] of src.searchParams.entries()) {
    if (key === "country[]" || key === "country") continue;
    if (!FILTER_KEYS.has(key) || !value.trim()) continue;
    api.searchParams.append(key, value);
  }
  for (const code of ECARSTRADE_ALLOWED_COUNTRY_QUERY) api.searchParams.append("country[]", code);
  return api.toString();
}

export function ecarstradePageStart(page: number, perPage = ECARSTRADE_DEFAULT_PER_PAGE): number {
  return Math.max(0, (Math.max(1, page) - 1) * perPage);
}

export function readEcarstradeAuth(
  env: Record<string, string | undefined> = process.env,
): { username: string; password: string } | null {
  const username = (env.ECARSTRADE_USER ?? "").trim();
  const password = (env.ECARSTRADE_PASS ?? "").trim();
  if (!username || !password) return null;
  return { username, password };
}

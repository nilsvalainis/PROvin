import "server-only";

import { createHash } from "node:crypto";
import { fetchUrlHtmlWithStealthBrowser } from "@/lib/iriss-listings-browser-fallback-fetch";
import { fetchUrlHtmlWithMobilePersistentProfile, hasUsableMobilePersistentProfile } from "@/lib/iriss-listings-mobile-persistent-fetch";
import { getPlatformAuthHeaders } from "@/lib/iriss-listings-session-auth";
import type { IrissListingPrice, IrissListingSourcePlatform, IrissListingSyncStatus } from "@/lib/iriss-listings-types";

export type IrissListingsScrapeInput = {
  url: string;
  platformHint: IrissListingSourcePlatform;
};

export type IrissListingsScrapeOutput = {
  status: IrissListingSyncStatus;
  statusNote: string;
  sourceDomain: string;
  title: string;
  year: string;
  imageUrl: string;
  pricePrimary: IrissListingPrice | null;
  priceSecondary: IrissListingPrice | null;
  rawSnapshotRef: string;
};

export type IrissListingsAdapter = {
  platform: IrissListingSourcePlatform;
  canHandle: (url: URL) => boolean;
  scrape: (input: IrissListingsScrapeInput) => Promise<IrissListingsScrapeOutput>;
};

const LOGIN_HINT_RE =
  /(login|log in|sign in|anmelden|anmeldung|pieslēgties|ielogoties|autoriz|konto|account|registr|password|passwort)/i;

const YEAR_RE = /\b((?:19|20)\d{2})\b/g;
const PRICE_RE = /(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})?)\s*(€|eur|eur\.|usd|\$|gbp|£)\b/gi;

function cleanText(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

function normalizeCurrency(raw: string): string {
  const c = raw.toLowerCase();
  if (c === "€" || c.startsWith("eur")) return "EUR";
  if (c === "$" || c.startsWith("usd")) return "USD";
  if (c === "£" || c.startsWith("gbp")) return "GBP";
  return raw.toUpperCase();
}

function normalizePriceValue(raw: string): string {
  return cleanText(raw.replace(/\./g, " ").replace(/\s{2,}/g, " "));
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveImageUrl(baseUrl: URL, raw: string): string {
  if (!raw) return "";
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

function pickTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (og) return cleanText(og);
  const tw = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (tw) return cleanText(tw);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return cleanText(stripTags(h1));
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) return cleanText(stripTags(title));
  return "";
}

function pickImage(baseUrl: URL, html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (og) return resolveImageUrl(baseUrl, cleanText(og));
  const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (tw) return resolveImageUrl(baseUrl, cleanText(tw));
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (img) return resolveImageUrl(baseUrl, cleanText(img));
  return "";
}

function pickYear(html: string): string {
  const text = stripTags(html);
  const candidates: string[] = [];
  for (const m of text.matchAll(YEAR_RE)) {
    if (m[1]) candidates.push(m[1]);
  }
  if (candidates.length === 0) return "";

  const labels = ["first registration", "izlaiduma gads", "pirmā reģistrācija", "model year", "fr", "year"];
  for (const lb of labels) {
    const rx = new RegExp(`${lb}[\\s:.-]{0,8}((?:19|20)\\d{2})`, "i");
    const hit = text.match(rx)?.[1];
    if (hit) return hit;
  }
  return candidates[0] ?? "";
}

function pickPrices(html: string): { primary: IrissListingPrice | null; secondary: IrissListingPrice | null } {
  const text = stripTags(html);
  const found: IrissListingPrice[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(PRICE_RE)) {
    const value = normalizePriceValue(m[1] ?? "");
    const currency = normalizeCurrency(m[2] ?? "");
    if (!value || !currency) continue;
    const k = `${value}|${currency}`;
    if (seen.has(k)) continue;
    seen.add(k);
    found.push({ value, currency });
    if (found.length >= 2) break;
  }
  return { primary: found[0] ?? null, secondary: found[1] ?? null };
}

/** Login forma pēc HTML (HTTP 401/403 tiek klasificēti atsevišķi pirms šīs funkcijas). */
function looksLikeLoginPage(_statusCode: number, html: string): boolean {
  const tiny = stripTags(html.slice(0, 12000)).toLowerCase();
  if (!LOGIN_HINT_RE.test(tiny)) return false;
  return /password|passwort|parole/.test(tiny);
}

async function fetchHtml(url: URL, platform: IrissListingSourcePlatform): Promise<{ ok: true; statusCode: number; html: string } | { ok: false; statusCode: number; note: string }> {
  const timeoutMs = Math.max(8000, Number.parseInt(process.env.IRISS_LISTINGS_FETCH_TIMEOUT_MS ?? "18000", 10) || 18000);
  const allowBrowserFallback = platform === "autobid" || platform === "openline";
  if (platform === "mobile" && (await hasUsableMobilePersistentProfile())) {
    return fetchUrlHtmlWithMobilePersistentProfile(url.toString(), timeoutMs);
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers =
      platform === "other"
        ? {
            "User-Agent": "Mozilla/5.0 (compatible; PROVIN-IRISS-SLUDINAJUMI/1.0; +https://provin.lv)",
            "Accept-Language": "lv,en;q=0.9,de;q=0.8",
            Accept: "text/html,application/xhtml+xml",
            Pragma: "no-cache",
            "Cache-Control": "no-cache",
          }
        : await getPlatformAuthHeaders(platform, url.toString());
    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const html = await res.text();
    if (allowBrowserFallback && (res.status === 401 || res.status === 403 || res.status === 429 || looksLikeLoginPage(res.status, html))) {
      const fallback = await fetchUrlHtmlWithStealthBrowser(url.toString(), timeoutMs);
      if (fallback.ok) return fallback;
    }
    return { ok: true, statusCode: res.status, html };
  } catch (e) {
    if (allowBrowserFallback) {
      const fallback = await fetchUrlHtmlWithStealthBrowser(url.toString(), timeoutMs);
      if (fallback.ok) return fallback;
      return fallback;
    }
    return { ok: false, statusCode: 0, note: e instanceof Error ? e.message : "fetch_failed" };
  } finally {
    clearTimeout(t);
  }
}

function makeRawSnapshotRef(url: string, html: string): string {
  const hash = createHash("sha256")
    .update(url)
    .update("\n")
    .update(html.slice(0, 20_000))
    .digest("hex")
    .slice(0, 16);
  return `raw:${hash}`;
}

function createGenericAdapter(platform: IrissListingSourcePlatform, hostMatchers: string[]): IrissListingsAdapter {
  return {
    platform,
    canHandle(url) {
      const host = url.hostname.toLowerCase();
      return hostMatchers.some((h) => host === h || host.endsWith(`.${h}`));
    },
    async scrape(input) {
      let u: URL;
      try {
        u = new URL(input.url);
      } catch {
        return {
          status: "fetch_failed",
          statusNote: "Nederīgs URL.",
          sourceDomain: "",
          title: "",
          year: "",
          imageUrl: "",
          pricePrimary: null,
          priceSecondary: null,
          rawSnapshotRef: "raw:invalid-url",
        };
      }
      const got = await fetchHtml(u, platform);
      if (!got.ok) {
        return {
          status: "fetch_failed",
          statusNote: got.note.slice(0, 220),
          sourceDomain: u.hostname.toLowerCase(),
          title: "",
          year: "",
          imageUrl: "",
          pricePrimary: null,
          priceSecondary: null,
          rawSnapshotRef: "raw:fetch-error",
        };
      }
      if (got.statusCode === 401) {
        return {
          status: "login_required",
          statusNote: "HTTP 401 (autentifikācija nepieciešama).",
          sourceDomain: u.hostname.toLowerCase(),
          title: "",
          year: "",
          imageUrl: "",
          pricePrimary: null,
          priceSecondary: null,
          rawSnapshotRef: makeRawSnapshotRef(input.url, got.html),
        };
      }
      if (got.statusCode === 403) {
        return {
          status: "blocked_by_waf",
          statusNote: "HTTP 403 (WAF / Akamai vai līdzīgs bloķētājs).",
          sourceDomain: u.hostname.toLowerCase(),
          title: "",
          year: "",
          imageUrl: "",
          pricePrimary: null,
          priceSecondary: null,
          rawSnapshotRef: makeRawSnapshotRef(input.url, got.html),
        };
      }
      if (got.statusCode >= 400) {
        return {
          status: "fetch_failed",
          statusNote: `HTTP ${got.statusCode}`,
          sourceDomain: u.hostname.toLowerCase(),
          title: "",
          year: "",
          imageUrl: "",
          pricePrimary: null,
          priceSecondary: null,
          rawSnapshotRef: makeRawSnapshotRef(input.url, got.html),
        };
      }
      if (looksLikeLoginPage(got.statusCode, got.html)) {
        return {
          status: "login_required",
          statusNote: "Avots pieprasa autorizāciju (login).",
          sourceDomain: u.hostname.toLowerCase(),
          title: "",
          year: "",
          imageUrl: "",
          pricePrimary: null,
          priceSecondary: null,
          rawSnapshotRef: makeRawSnapshotRef(input.url, got.html),
        };
      }
      const title = pickTitle(got.html);
      const year = pickYear(got.html);
      const imageUrl = pickImage(u, got.html);
      const prices = pickPrices(got.html);
      if (!title && !year && !prices.primary && !imageUrl) {
        return {
          status: "parse_failed",
          statusNote: "Neizdevās nolasīt būtiskos laukus no lapas.",
          sourceDomain: u.hostname.toLowerCase(),
          title: "",
          year: "",
          imageUrl: "",
          pricePrimary: null,
          priceSecondary: null,
          rawSnapshotRef: makeRawSnapshotRef(input.url, got.html),
        };
      }
      return {
        status: "ok",
        statusNote: "",
        sourceDomain: u.hostname.toLowerCase(),
        title,
        year,
        imageUrl,
        pricePrimary: prices.primary,
        priceSecondary: prices.secondary,
        rawSnapshotRef: makeRawSnapshotRef(input.url, got.html),
      };
    },
  };
}

const mobileAdapter = createGenericAdapter("mobile", ["mobile.de"]);
const autobidAdapter = createGenericAdapter("autobid", ["autobid.de", "autobid.eu", "autobid"]);
const openlineAdapter = createGenericAdapter("openline", ["openline", "openlane.eu", "openlane"]);
const auto1Adapter = createGenericAdapter("auto1", ["auto1.com", "auto1.eu", "auto1-group.com"]);
const otherAdapter = createGenericAdapter("other", []);

const allAdapters = [mobileAdapter, autobidAdapter, openlineAdapter, auto1Adapter] satisfies IrissListingsAdapter[];

export function detectPlatformFromUrl(url: string): IrissListingSourcePlatform {
  try {
    const u = new URL(url);
    const hit = allAdapters.find((a) => a.canHandle(u));
    return hit?.platform ?? "other";
  } catch {
    return "other";
  }
}

export async function scrapeIrissListing(input: IrissListingsScrapeInput): Promise<IrissListingsScrapeOutput> {
  const effectivePlatform = input.platformHint === "other" ? detectPlatformFromUrl(input.url) : input.platformHint;
  const adapter = allAdapters.find((a) => a.platform === effectivePlatform) ?? otherAdapter;
  return adapter.scrape({ ...input, platformHint: effectivePlatform });
}

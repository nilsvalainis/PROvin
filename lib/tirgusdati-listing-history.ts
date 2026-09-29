/**
 * tirgusdati.lv/vesture — bezmaksas sludinājumu cenu vēsture.
 * SSR HTML tabula `<table class="history">` (nav vajadzīgs JS).
 * Fallback, ja Adify neatbild (piem. Cloudflare bloķē Vercel IP).
 * Atbalsta ss.com / ss.lv un city24.lv.
 */

import { type AdifyListingHistorySnapshot, normalizeAdifyHistoryItems } from "@/lib/adify-listing-history";

export const TIRGUSDATI_HISTORY_PAGE_URL = "https://tirgusdati.lv/vesture";

const TIRGUSDATI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export function tirgusDatiSupportsListingUrl(listingUrlRaw: string): boolean {
  try {
    const u = new URL(listingUrlRaw.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    return host.includes("ss.lv") || host.includes("ss.com") || host.includes("city24.lv");
  } catch {
    return false;
  }
}

export function tirgusDatiHistoryPageLookupUrl(listingUrl: string): string {
  return `${TIRGUSDATI_HISTORY_PAGE_URL}?q=${encodeURIComponent(listingUrl.trim())}`;
}

export function looksLikeTirgusDatiCloudflareChallenge(html: string): boolean {
  return /just a moment|cf-browser-verification|performing security verification|enable javascript and cookies to continue/i.test(
    html,
  );
}

function tirgusDatiEurAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** "08.09.2026 18:34" -> "08.09.2026" (parseAdifyDay negaida laiku aiz datuma). */
function tirgusDatiDateOnly(text: string): string {
  return text.trim().split(/\s+/)[0] ?? "";
}

function cellText(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type TirgusDatiRawItem = {
  price: number;
  created: string;
  mileage: number | null;
  year: number | null;
};

export type TirgusDatiExtract = {
  items: TirgusDatiRawItem[];
  listingUrl: string | null;
};

/** Tīra funkcija testiem: parsē tirgusdati.lv/vesture HTML atbildi. */
export function extractTirgusDatiHistoryFromHtml(html: string): TirgusDatiExtract {
  const tableMatch = html.match(/<table[^>]*class="[^"]*\bhistory\b[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch?.[1]) return { items: [], listingUrl: null };

  const rows: TirgusDatiRawItem[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableMatch[1])) !== null) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cellText(m[1] ?? ""));
    if (cells.length < 2) continue;
    const date = tirgusDatiDateOnly(cells[0] ?? "");
    const price = tirgusDatiEurAmount(cells[1] ?? "");
    if (!date || price == null) continue;
    rows.push({ price, created: date, mileage: null, year: null });
  }

  const mileageBlock = html.match(/<dt>\s*Nobraukums\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
  const mileage = mileageBlock ? tirgusDatiEurAmount(cellText(mileageBlock[1] ?? "")) : null;
  const yearMatch = html.match(/<dt>\s*Gads\s*<\/dt>\s*<dd[^>]*>(\d{4})<\/dd>/i);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const urlMatch =
    html.match(/<a[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*href="([^"]+)"/i) ??
    html.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*\bbtn\b[^"]*"/i);
  const listingUrl = urlMatch?.[1] ? urlMatch[1].replace(/&amp;/g, "&") : null;

  // Nobraukums lapā ir pašreizējais (nevis katras vēstures rindas savs).
  if (rows.length > 0 && rows[0]) {
    rows[0] = { ...rows[0], mileage, year };
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row) rows[i] = { ...row, year };
    }
  }

  return { items: rows, listingUrl };
}

async function fetchTirgusDatiHistoryPage(listingUrl: string, signal: AbortSignal): Promise<Response> {
  return fetch(tirgusDatiHistoryPageLookupUrl(listingUrl), {
    method: "GET",
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "lv-LV,lv;q=0.9,en-US;q=0.8,en;q=0.7",
      "User-Agent": TIRGUSDATI_UA,
      "Cache-Control": "no-cache",
      Referer: "https://tirgusdati.lv/",
    },
    redirect: "follow",
    cache: "no-store",
  });
}

function emptySnapshot(message: string): AdifyListingHistorySnapshot {
  return {
    found: false,
    message,
    rows: [],
    durationDays: 0,
    oldestDate: "",
    newestDate: "",
    priceChangeEur: 0,
    listingUrl: null,
  };
}

export async function fetchTirgusDatiListingHistory(
  listingUrl: string,
  now: Date = new Date(),
): Promise<AdifyListingHistorySnapshot> {
  if (!tirgusDatiSupportsListingUrl(listingUrl)) {
    return emptySnapshot("Tirgus Dati atbalsta tikai ss.com un city24.lv sludinājumus");
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetchTirgusDatiHistoryPage(listingUrl, ctrl.signal);
    if (!res.ok) return emptySnapshot(`Tirgus Dati neatbildēja (HTTP ${res.status})`);
    const html = await res.text();
    if (looksLikeTirgusDatiCloudflareChallenge(html)) {
      return emptySnapshot("Tirgus Dati bloķēja pieprasījumu (Cloudflare)");
    }
    const { items, listingUrl: resolvedUrl } = extractTirgusDatiHistoryFromHtml(html);
    if (items.length === 0) return emptySnapshot("Šim sludinājumam Tirgus Dati vēl nav vēstures");
    const snap = normalizeAdifyHistoryItems(items, now);
    if (!snap.found) return snap;
    return {
      ...snap,
      listingUrl: snap.listingUrl ?? resolvedUrl,
      source: "tirgusdati",
      message: `Atrasta sludinājuma vēsture (Tirgus Dati, ${snap.rows.length} ieraksti)`,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return emptySnapshot(aborted ? "Tirgus Dati pieprasījums noildza" : "Neizdevās ielādēt Tirgus Dati vēsturi");
  } finally {
    clearTimeout(t);
  }
}

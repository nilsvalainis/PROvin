/**
 * tirgusdati.lv/vesture — bezmaksas sludinājumu cenu vēsture.
 * SSR HTML tabula `<table class="history">` (nav vajadzīgs JS).
 * Fallback, ja Adify neatbild (piem. Cloudflare bloķē Vercel IP).
 * Atbalsta ss.com / ss.lv un city24.lv.
 */

import { looksLikeListingHistoryCloudflareChallenge } from "@/lib/listing-history-cloudflare";

export const TIRGUSDATI_HISTORY_PAGE_URL = "https://tirgusdati.lv/vesture";

export const TIRGUSDATI_UA =
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
  return looksLikeListingHistoryCloudflareChallenge(html);
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


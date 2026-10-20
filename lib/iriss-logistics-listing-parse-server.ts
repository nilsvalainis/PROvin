import "server-only";

import { fetchListingHtmlViaJina } from "@/lib/listing-scrape";
import {
  isLogisticsListingUrl,
  parseLogisticsListingHtml,
  type LogisticsParsedListing,
} from "@/lib/iriss-logistics-listing-parse";

/**
 * Tikai bezmaksas HTML. Nav maksas ielādes un nav Chrome releja.
 * Tiešais fetch, tad Jina Reader.
 */
export async function fetchAndParseLogisticsListing(rawUrl: string): Promise<LogisticsParsedListing> {
  const url = rawUrl.trim();
  const empty = parseLogisticsListingHtml("", url);
  if (!isLogisticsListingUrl(url)) {
    return { ...empty, ok: false, note: "Nederīga saite." };
  }

  const html = (await fetchDirect(url)) || (await fetchListingHtmlViaJina(url));
  if (!html) {
    return { ...empty, ok: false, note: "Lapu neizdevās nolasīt (bezmaksas avoti). Saite saglabāta." };
  }
  return parseLogisticsListingHtml(html, url);
}

async function fetchDirect(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PROVIN.lv/1.0; +https://provin.lv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "de,en,lv;q=0.8",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length > 2_500_000) return null;
    if (/just a moment|cf-browser-verification|attention required/i.test(html)) return null;
    return html.trim() ? html : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

import "server-only";

import { fetchListingHtmlViaChromeRelay } from "@/lib/listing-history-relay";
import {
  failedListingSnapshot,
  fetchListingHtmlViaJina,
  isAllowedListingScrapeHost,
  isSsLvHost,
  parseGenericListingHtml,
  parseSsLvListingAiHtml,
  type ListingAiSnapshot,
  type ListingMarketSnapshot,
} from "@/lib/listing-scrape";

async function fetchListingPageHtml(listingUrl: string): Promise<
  | { ok: true; html: string; url: string; host: string }
  | { ok: false; snapshot: ListingAiSnapshot }
> {
  let u: URL;
  try {
    u = new URL(listingUrl.trim());
  } catch {
    return {
      ok: false,
      snapshot: failedListingSnapshot({ host: "", url: listingUrl.trim(), note: "Nederīga saite." }),
    };
  }

  const url = u.toString();
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return {
      ok: false,
      snapshot: failedListingSnapshot({ host: u.hostname, url, note: "Atļauts tikai HTTP(S)." }),
    };
  }

  if (!isAllowedListingScrapeHost(u.hostname)) {
    return {
      ok: false,
      snapshot: failedListingSnapshot({
        host,
        url,
        note: `Automātiska izguve šim saimniekam nav atļauta (${u.hostname}).`,
      }),
    };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 14_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PROVIN.lv/1.0; +https://provin.lv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "lv,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 2_500_000) {
        return {
          ok: false,
          snapshot: failedListingSnapshot({ host, url, note: "Lapa pārāk liela." }),
        };
      }
      if (!/just a moment|cf-browser-verification|attention required/i.test(html)) {
        return { ok: true, html, url, host };
      }
    }
  } catch {
    /* tiešais zvans bieži krīt ar 403; tālāk relejs */
  } finally {
    clearTimeout(t);
  }

  const relayed = await fetchListingHtmlViaJina(url);
  if (relayed && !/just a moment|cf-browser-verification|attention required/i.test(relayed)) {
    return { ok: true, html: relayed, url, host };
  }

  const chrome = await fetchListingHtmlViaChromeRelay(url);
  if (chrome.html && !/just a moment|cf-browser-verification|attention required/i.test(chrome.html)) {
    return { ok: true, html: chrome.html, url, host };
  }

  return {
    ok: false,
    snapshot: failedListingSnapshot({
      host,
      url,
      note: chrome.error
        ? `Neizdevās ielādēt sludinājumu. ${chrome.error}`
        : "Neizdevās ielādēt sludinājumu (tīkls, Cloudflare vai timeout).",
    }),
  };
}

export async function fetchListingAiSnapshot(listingUrl: string): Promise<ListingAiSnapshot> {
  const fetched = await fetchListingPageHtml(listingUrl);
  if (!fetched.ok) return fetched.snapshot;
  if (isSsLvHost(fetched.host)) return parseSsLvListingAiHtml(fetched.html, fetched.url);
  return parseGenericListingHtml(fetched.html, fetched.url);
}

function toMarketSnapshot(snapshot: ListingAiSnapshot): ListingMarketSnapshot {
  const {
    ok,
    host,
    fetchedAt,
    daysListed,
    postedDateRaw,
    currentKm,
    currentPriceEur,
    priceChanges,
    note,
  } = snapshot;
  return {
    ok,
    host,
    fetchedAt,
    daysListed,
    postedDateRaw,
    currentKm,
    currentPriceEur,
    priceChanges,
    note,
  };
}

export async function fetchListingMarketSnapshot(listingUrl: string): Promise<ListingMarketSnapshot> {
  return toMarketSnapshot(await fetchListingAiSnapshot(listingUrl));
}

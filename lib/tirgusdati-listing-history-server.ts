import "server-only";

import { type AdifyListingHistorySnapshot, normalizeAdifyHistoryItems } from "@/lib/adify-listing-history";
import { loadListingHistoryHtmlViaRelays } from "@/lib/listing-history-relay";
import {
  TIRGUSDATI_UA,
  extractTirgusDatiHistoryFromHtml,
  looksLikeTirgusDatiCloudflareChallenge,
  tirgusDatiHistoryPageLookupUrl,
  tirgusDatiSupportsListingUrl,
} from "@/lib/tirgusdati-listing-history";

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

/**
 * Hetzner Chrome (`/listings/page`) tirgusdati.lv neiziet: 10.-24.11.2026 49 no 49
 * mēģinājumiem HTTP 403 pēc ~53 s, un tas visu laiku aizņem vienīgo releja rindu
 * (VIN SCAN pārlūka avoti gaida). Tāpēc Chrome tikai ar `TIRGUSDATI_CHROME_RELAY=1`.
 * Reālā rezerve ir Tampermonkey no operatora IP (admin klients to palaiž paralēli).
 */
export function tirgusDatiChromeRelayEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.TIRGUSDATI_CHROME_RELAY ?? "").trim() === "1";
}

export const TIRGUSDATI_DIRECT_TIMEOUT_MS = 6_000;
export const TIRGUSDATI_RELAY_TIMEOUT_MS = 10_000;

/** Tiešā ielase, un ja Cloudflare noraida datacentra IP, tā pati lapa caur releju. */
async function loadTirgusDatiHistoryHtml(
  listingUrl: string,
): Promise<{ html: string | null; message: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIRGUSDATI_DIRECT_TIMEOUT_MS);
  let message = "Neizdevās ielādēt Tirgus Dati vēsturi";
  try {
    const res = await fetchTirgusDatiHistoryPage(listingUrl, ctrl.signal);
    const html = res.ok ? await res.text() : "";
    if (res.ok && !looksLikeTirgusDatiCloudflareChallenge(html)) return { html, message: "" };
    message = res.ok
      ? "Tirgus Dati bloķēja pieprasījumu (Cloudflare)"
      : `Tirgus Dati neatbildēja (HTTP ${res.status})`;
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    message = aborted ? "Tirgus Dati pieprasījums noildza" : "Neizdevās ielādēt Tirgus Dati vēsturi";
  } finally {
    clearTimeout(t);
  }

  const relayed = await loadListingHistoryHtmlViaRelays(tirgusDatiHistoryPageLookupUrl(listingUrl), {
    retryDelayMs: 0,
    timeoutMs: TIRGUSDATI_RELAY_TIMEOUT_MS,
    chrome: tirgusDatiChromeRelayEnabled(),
  });
  if (relayed.html && !looksLikeTirgusDatiCloudflareChallenge(relayed.html)) {
    return { html: relayed.html, message: "" };
  }
  if (relayed.error) return { html: null, message: `${message} · ${relayed.error}` };
  return { html: null, message };
}

export async function fetchTirgusDatiListingHistory(
  listingUrl: string,
  now: Date = new Date(),
): Promise<AdifyListingHistorySnapshot> {
  if (!tirgusDatiSupportsListingUrl(listingUrl)) {
    return emptySnapshot("Tirgus Dati atbalsta tikai ss.com un city24.lv sludinājumus");
  }

  const { html, message } = await loadTirgusDatiHistoryHtml(listingUrl);
  if (!html) {
    const blocked = /Cloudflare|HTTP 403/i.test(message);
    return { ...emptySnapshot(message), blocked };
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
}

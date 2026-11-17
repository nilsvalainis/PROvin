import "server-only";

/**
 * Adify vēstures ielase serverī.
 * Datacentra IP un Hetzner Chrome (18 s) paliek CF managed challenge.
 * Darba ceļš: tiešais GET, tad `ADIFY_PROXY_URL` / CapSolver + Fixie, tad pašu
 * HTTP releji (`LISTING_HISTORY_RELAY_URLS`). Jina un Chrome Adify nelaižam:
 * neviens neiziet CF izaicinājumu (Jina HTTP 422), un Chrome aizņem vienīgo
 * releja rindu (tirgusdati.lv Chrome tad gaida 40 s). Ja serveris neizdodas,
 * admin klients lapu ielasa caur Tampermonkey no operatora IP.
 */

import {
  type AdifyListingHistorySnapshot,
  adifyBlockedMessage,
  adifyBlockedSnapshot,
  adifyHistoryPageLookupUrl,
  adifySnapshotFromHistoryHtml,
  fetchAdifyHistoryPageDirect,
  normalizeAdifyHistoryItems,
} from "@/lib/adify-listing-history";
import { fetchAdifyHistoryHtmlViaCapsolver } from "@/lib/adify-listing-history-bypass";
import { looksLikeListingHistoryCloudflareChallenge } from "@/lib/listing-history-cloudflare";
import { loadListingHistoryHtmlViaRelays } from "@/lib/listing-history-relay";

export type FetchAdifyListingHistoryDeps = {
  bypass?: typeof fetchAdifyHistoryHtmlViaCapsolver;
  loadRelays?: typeof loadListingHistoryHtmlViaRelays;
};

export async function fetchAdifyListingHistory(
  listingUrl: string,
  now: Date = new Date(),
  deps: FetchAdifyListingHistoryDeps = {},
): Promise<AdifyListingHistorySnapshot> {
  const url = listingUrl.trim();
  if (!url) {
    return {
      found: false,
      message: "Nav sludinājuma saites",
      rows: [],
      durationDays: 0,
      oldestDate: "",
      newestDate: "",
      priceChangeEur: 0,
      listingUrl: null,
    };
  }

  const pageUrl = adifyHistoryPageLookupUrl(listingUrl);
  const bypass = deps.bypass ?? fetchAdifyHistoryHtmlViaCapsolver;
  const loadRelays = deps.loadRelays ?? loadListingHistoryHtmlViaRelays;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8_000);
  let message = "Neizdevās ielādēt Adify vēsturi";
  let sawCloudflare = false;
  try {
    const direct = await fetchAdifyHistoryPageDirect(listingUrl, ctrl.signal);
    if (direct.kind === "ok") {
      const parsed = adifySnapshotFromHistoryHtml(direct.html, now);
      if (parsed.snapshot) return parsed.snapshot;
      message = parsed.message;
    } else if (direct.kind === "cloudflare") {
      sawCloudflare = true;
      message = "Adify bloķēja pieprasījumu (Cloudflare)";
    } else {
      message = direct.message;
    }
  } finally {
    clearTimeout(t);
  }

  const bypassed = await bypass(pageUrl);
  if (bypassed.html) {
    if (looksLikeListingHistoryCloudflareChallenge(bypassed.html)) {
      return adifyBlockedSnapshot(adifyBlockedMessage(bypassed.error));
    }
    const parsed = adifySnapshotFromHistoryHtml(bypassed.html, now);
    if (parsed.snapshot) return parsed.snapshot;
    message = parsed.message;
  }

  // Tikai pašu HTTP relejs (ja uzstādīts). Jina un Chrome Adify neiziet CF.
  const relayed = await loadRelays(pageUrl, {
    timeoutMs: sawCloudflare ? 12_000 : undefined,
    retryDelayMs: 0,
    chrome: false,
    jina: false,
  });
  if (relayed.html) {
    if (looksLikeListingHistoryCloudflareChallenge(relayed.html)) {
      return adifyBlockedSnapshot(adifyBlockedMessage(relayed.error ?? bypassed.error));
    }
    const parsed = adifySnapshotFromHistoryHtml(relayed.html, now);
    if (parsed.snapshot) return parsed.snapshot;
    message = parsed.message;
  }

  const detail = [bypassed.error, relayed.error].filter(Boolean).join(" · ");
  if (sawCloudflare) {
    return adifyBlockedSnapshot(adifyBlockedMessage(detail || null));
  }
  return {
    ...normalizeAdifyHistoryItems([], now),
    message: detail ? `${message}. ${detail}` : message,
  };
}

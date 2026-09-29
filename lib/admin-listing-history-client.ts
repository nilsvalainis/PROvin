"use client";

import { adifyHistoryPageLookupUrl, type AdifyListingHistorySnapshot } from "@/lib/adify-listing-history";
import {
  tirgusDatiHistoryPageLookupUrl,
  tirgusDatiSupportsListingUrl,
} from "@/lib/tirgusdati-listing-history";

export function isProvinUserscriptInstalled(): boolean {
  return (
    typeof document !== "undefined" && Boolean(document.documentElement.getAttribute("data-provin-userscript"))
  );
}

/** Vēstures ielase caur GM_xmlhttpRequest ir no skripta 1.8.0. */
export function userscriptVersionAllowsListingHistoryFetch(raw: string): boolean {
  const [major, minor] = raw.split(".").map((n) => Number(n));
  if (!Number.isFinite(major)) return false;
  if (major > 1) return true;
  return major === 1 && Number.isFinite(minor) && minor >= 8;
}

export function userscriptCanFetchListingHistory(): boolean {
  if (typeof document === "undefined") return false;
  return userscriptVersionAllowsListingHistoryFetch(
    document.documentElement.getAttribute("data-provin-userscript") || "",
  );
}

type UserscriptHistoryResult = {
  requestId?: string;
  ok?: boolean;
  status?: number;
  html?: string;
  error?: string;
};

function fetchHistoryHtmlViaUserscript(fetchUrl: string, timeoutMs = 20_000): Promise<string | null> {
  if (!userscriptCanFetchListingHistory()) return Promise.resolve(null);
  const requestId = `lh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (html: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      document.removeEventListener("provin-listing-history-result", onResult);
      resolve(html);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<UserscriptHistoryResult>).detail;
      if (!detail || detail.requestId !== requestId) return;
      finish(detail.ok && typeof detail.html === "string" && detail.html.trim() ? detail.html : null);
    };
    document.addEventListener("provin-listing-history-result", onResult);
    document.dispatchEvent(
      new CustomEvent("provin-listing-history-request", { detail: { requestId, fetchUrl } }),
    );
  });
}

async function postListingHistory(body: { url: string; html?: string }): Promise<AdifyListingHistorySnapshot> {
  const res = await fetch("/api/admin/adify-history", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as AdifyListingHistorySnapshot & { error?: string };
  if (!res.ok) {
    const message =
      data.error === "invalid_url"
        ? "Nederīga sludinājuma saite"
        : data.error === "unauthorized"
          ? "Nav admin sesijas"
          : data.error === "html_too_large"
            ? "Vēstures lapa ir pārāk liela"
            : "Neizdevās ielādēt sludinājuma vēsturi";
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
  return data;
}

/** Serveris (Vercel) + ja 403, Tampermonkey ielase no operatora IP. */
export async function loadListingPriceHistorySnapshot(listingUrl: string): Promise<AdifyListingHistorySnapshot> {
  const url = listingUrl.trim();
  const server = await postListingHistory({ url });
  if (server.found) return server;

  const fetchUrls = [
    ...(tirgusDatiSupportsListingUrl(url) ? [tirgusDatiHistoryPageLookupUrl(url)] : []),
    adifyHistoryPageLookupUrl(url),
  ];

  for (const fetchUrl of fetchUrls) {
    const html = await fetchHistoryHtmlViaUserscript(fetchUrl);
    if (!html) continue;
    const parsed = await postListingHistory({ url, html });
    if (parsed.found) return parsed;
  }

  if (!userscriptCanFetchListingHistory()) {
    return {
      ...server,
      message: `${server.message}. Serveris ir bloķēts. Atjaunini PROVIN Tampermonkey skriptu uz 1.8+, lai ielasītu vēsturi no pārlūka.`,
    };
  }
  return server;
}

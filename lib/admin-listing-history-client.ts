"use client";

import { isProvinUserscriptPresent, readProvinUserscriptVersion } from "@/lib/provin-userscript-presence";
import { adifyHistoryPageLookupUrl, type AdifyListingHistorySnapshot } from "@/lib/adify-listing-history";
import {
  tirgusDatiHistoryPageLookupUrl,
  tirgusDatiSupportsListingUrl,
} from "@/lib/tirgusdati-listing-history";

export function isProvinUserscriptInstalled(): boolean {
  return isProvinUserscriptPresent();
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
    readProvinUserscriptVersion(),
  );
}

type UserscriptHistoryResult = {
  requestId?: string;
  ok?: boolean;
  status?: number;
  html?: string;
  error?: string;
};

/** Viena Tampermonkey ielase: HTML vai iemesls, kāpēc nav. */
export type BrowserHistoryFetch = {
  html: string | null;
  /** `cloudflare` - pārlūkam nav cf_clearance; `network` / `timeout` / `http_5xx` - vērts atkārtot. */
  error: "cloudflare" | "network" | "timeout" | "http" | "no_userscript" | string | null;
  status?: number;
};

const CF_BROWSER_RE = /just a moment|cf-browser-verification|performing security verification|checking your browser/i;

export const USERSCRIPT_HISTORY_TIMEOUT_MS = 20_000;

function fetchHistoryHtmlViaUserscript(
  fetchUrl: string,
  timeoutMs = USERSCRIPT_HISTORY_TIMEOUT_MS,
): Promise<BrowserHistoryFetch> {
  if (!userscriptCanFetchListingHistory()) return Promise.resolve({ html: null, error: "no_userscript" });
  const requestId = `lh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: BrowserHistoryFetch) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      document.removeEventListener("provin-listing-history-result", onResult);
      resolve(r);
    };
    const timer = window.setTimeout(() => finish({ html: null, error: "timeout" }), timeoutMs);
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<UserscriptHistoryResult>).detail;
      if (!detail || detail.requestId !== requestId) return;
      finish(classifyUserscriptHistoryResult(detail));
    };
    document.addEventListener("provin-listing-history-result", onResult);
    document.dispatchEvent(
      new CustomEvent("provin-listing-history-request", { detail: { requestId, fetchUrl } }),
    );
  });
}

/** Tampermonkey atbilde -> HTML vai klasificēts iemesls (tīra funkcija, testējama). */
export function classifyUserscriptHistoryResult(detail: UserscriptHistoryResult): BrowserHistoryFetch {
  const html = typeof detail.html === "string" ? detail.html : "";
  const status = typeof detail.status === "number" ? detail.status : undefined;
  if (html.trim() && CF_BROWSER_RE.test(html)) return { html: null, error: "cloudflare", status };
  if (detail.ok && html.trim()) return { html, error: null, status };
  if (status === 403 || status === 503) return { html: null, error: status === 503 ? "http_5xx" : "cloudflare", status };
  if (status != null && status >= 500) return { html: null, error: "http_5xx", status };
  if (detail.error === "timeout" || detail.error === "network") return { html: null, error: detail.error, status };
  return { html: null, error: detail.error || (status ? "http" : "network"), status };
}

/** Īslaicīgas kļūmes vērts atkārtot; Cloudflare / nav skripta - nē. */
export function browserHistoryErrorIsRetryable(error: BrowserHistoryFetch["error"]): boolean {
  return error === "timeout" || error === "network" || error === "http_5xx";
}

export const USERSCRIPT_HISTORY_RETRY_DELAYS_MS = [1_000, 3_000] as const;

export async function fetchHistoryHtmlViaUserscriptWithRetry(
  fetchUrl: string,
  deps: {
    fetchOnce?: (url: string) => Promise<BrowserHistoryFetch>;
    sleep?: (ms: number) => Promise<void>;
    delaysMs?: readonly number[];
  } = {},
): Promise<BrowserHistoryFetch> {
  const fetchOnce = deps.fetchOnce ?? ((u: string) => fetchHistoryHtmlViaUserscript(u));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delays = deps.delaysMs ?? USERSCRIPT_HISTORY_RETRY_DELAYS_MS;
  let last = await fetchOnce(fetchUrl);
  for (const delay of delays) {
    if (last.html || !browserHistoryErrorIsRetryable(last.error)) return last;
    await sleep(delay);
    last = await fetchOnce(fetchUrl);
  }
  return last;
}

async function postListingHistory(body: { url: string; html?: string }): Promise<AdifyListingHistorySnapshot> {
  let res: Response;
  try {
    res = await fetch("/api/admin/adify-history", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return emptyHistory("Neizdevās savienoties ar serveri");
  }
  const data = (await res.json().catch(() => ({}))) as AdifyListingHistorySnapshot & {
    error?: string;
    detail?: string;
  };
  if (!res.ok) {
    const mapped =
      data.error === "invalid_url"
        ? "Nederīga sludinājuma saite"
        : data.error === "unauthorized"
          ? "Nav admin sesijas"
          : data.error === "html_too_large"
            ? "Vēstures lapa ir pārāk liela"
            : "";
    const message =
      mapped ||
      (typeof data.message === "string" && data.message.trim()) ||
      (typeof data.detail === "string" && data.detail.trim()) ||
      `Neizdevās ielādēt sludinājuma vēsturi (HTTP ${res.status})`;
    return { ...emptyHistory(message), blocked: res.status === 403 || res.status >= 500 };
  }
  return data;
}

function emptyHistory(message: string): AdifyListingHistorySnapshot {
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

/** Īss statuss adminā, kamēr ielase notiek. */
export type ListingHistoryLoadStatus =
  | "Ielasa serveris un pārlūks…"
  | "Serveris bloķēts - gaida pārlūku (Tampermonkey)…"
  | "Ielādēts";

export type ListingHistoryLoadDeps = {
  post?: (body: { url: string; html?: string }) => Promise<AdifyListingHistorySnapshot>;
  viaBrowser?: (fetchUrl: string) => Promise<BrowserHistoryFetch>;
  canUseBrowser?: () => boolean;
  onStatus?: (status: ListingHistoryLoadStatus) => void;
};

function browserFailureNote(errors: BrowserHistoryFetch["error"][], canUseBrowser: boolean): string {
  if (!canUseBrowser) {
    return "Pārlūka ielase nav pieejama: ieslēdz PROVIN Tampermonkey skriptu (Work profils)";
  }
  if (errors.includes("cloudflare")) {
    return "Pārlūkā Cloudflare pārbaude: atver adify.lv (vai tirgusdati.lv) vienreiz šajā pārlūkā un mēģini vēlreiz";
  }
  if (errors.includes("timeout")) return "Pārlūka ielase noildza";
  if (errors.some((e) => e)) return "Pārlūka ielase neizdevās";
  return "";
}

/**
 * Serveris (tiešā saite / relejs) un Tampermonkey no operatora IP iet PARALĒLI.
 * Serverī Adify un tirgusdati.lv parasti bloķē Cloudflare, tāpēc nedrīkst gaidīt
 * servera atbildi pirms pārlūka ielases - uzvar pirmais atrastais rezultāts.
 */
export async function loadListingPriceHistorySnapshot(
  listingUrl: string,
  deps: ListingHistoryLoadDeps = {},
): Promise<AdifyListingHistorySnapshot> {
  const url = listingUrl.trim();
  const post = deps.post ?? postListingHistory;
  const viaBrowser = deps.viaBrowser ?? ((u: string) => fetchHistoryHtmlViaUserscriptWithRetry(u));
  const canUseBrowser = (deps.canUseBrowser ?? userscriptCanFetchListingHistory)();
  const onStatus = deps.onStatus ?? (() => {});

  const fetchUrls = canUseBrowser
    ? [
        ...(tirgusDatiSupportsListingUrl(url) ? [tirgusDatiHistoryPageLookupUrl(url)] : []),
        adifyHistoryPageLookupUrl(url),
      ]
    : [];

  onStatus("Ielasa serveris un pārlūks…");

  const browserErrors: BrowserHistoryFetch["error"][] = [];
  let serverSnap: AdifyListingHistorySnapshot | null = null;
  let browserSnap: AdifyListingHistorySnapshot | null = null;

  const serverTask = post({ url })
    .catch(() => emptyHistory("Neizdevās savienoties ar serveri"))
    .then((snap) => {
      serverSnap = snap;
      if (!snap.found && fetchUrls.length > 0) onStatus("Serveris bloķēts - gaida pārlūku (Tampermonkey)…");
      return snap;
    });

  const browserTasks = fetchUrls.map(async (fetchUrl) => {
    const got = await viaBrowser(fetchUrl).catch(
      (): BrowserHistoryFetch => ({ html: null, error: "network" }),
    );
    if (!got.html) {
      browserErrors.push(got.error);
      return emptyHistory("");
    }
    const parsed = await post({ url, html: got.html }).catch(() => emptyHistory(""));
    if (!parsed.found && !browserSnap) browserSnap = parsed;
    return parsed;
  });

  const all = [serverTask, ...browserTasks];
  const first = await new Promise<AdifyListingHistorySnapshot | null>((resolve) => {
    let remaining = all.length;
    for (const task of all) {
      void task.then(
        (snap) => {
          if (snap.found) resolve(snap);
          else if (--remaining === 0) resolve(null);
        },
        () => {
          if (--remaining === 0) resolve(null);
        },
      );
    }
  });
  if (first?.found) {
    onStatus("Ielādēts");
    return first;
  }

  const base: AdifyListingHistorySnapshot = serverSnap ?? emptyHistory("Neizdevās ielādēt sludinājuma vēsturi");
  const parsedNote = (browserSnap as AdifyListingHistorySnapshot | null)?.message?.trim() ?? "";
  const note = parsedNote || browserFailureNote(browserErrors, canUseBrowser);
  if (!note) return base;
  return { ...base, message: [base.message, note].filter(Boolean).join(" · ") };
}

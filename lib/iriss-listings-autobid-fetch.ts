import "server-only";

import { autobidPageUrl, parseAutobidSearchPage, type AutobidVehicle } from "@/lib/iriss-listings-autobid";
import type { IrissListingSourceStatus } from "@/lib/iriss-listings-types";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type AutobidSourceFetchResult = {
  status: IrissListingSourceStatus;
  note: string;
  vehicles: AutobidVehicle[];
  rawPages: string[];
  pagesFetched: number;
  pageCount: number;
};

export type AutobidFetchOptions = {
  maxPages: number;
  timeoutMs: number;
  /** Pauze starp lapām (ms). Nejauša vērtība intervālā, lai neizskatās pēc robota. */
  pauseMinMs: number;
  pauseMaxMs: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function randomPauseMs(min: number, max: number): number {
  const lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(lo, max);
  return Math.round(lo + Math.random() * (hi - lo));
}

async function fetchPageHtml(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; statusCode: number; html: string } | { ok: false; note: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9,de;q=0.8,lv;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const html = await res.text();
    return { ok: true, statusCode: res.status, html };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, note: aborted ? `Noildze ${Math.round(timeoutMs / 1000)} s` : e instanceof Error ? e.message.slice(0, 200) : "fetch_failed" };
  } finally {
    clearTimeout(t);
  }
}

function httpStatusToSource(statusCode: number): { status: IrissListingSourceStatus; note: string } | null {
  if (statusCode === 401) return { status: "login_required", note: "HTTP 401: Autobid pieprasa autorizāciju." };
  if (statusCode === 403) return { status: "blocked_by_waf", note: "HTTP 403: Autobid bloķē pieprasījumu (WAF)." };
  if (statusCode === 429) return { status: "blocked_by_waf", note: "HTTP 429: par daudz pieprasījumu, Autobid ierobežo." };
  if (statusCode >= 400) return { status: "fetch_failed", note: `HTTP ${statusCode}` };
  return null;
}

/** Nolasa visas meklēšanas lapas (līdz `maxPages`). Ja pirmā lapa neizdodas, statuss nav `ok`. */
export async function fetchAutobidSource(sourceUrl: string, opts: AutobidFetchOptions): Promise<AutobidSourceFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const vehicles = new Map<string, AutobidVehicle>();
  const rawPages: string[] = [];
  let pageCount = 0;
  let pagesFetched = 0;
  let partialNote = "";

  for (let page = 1; page <= Math.max(1, opts.maxPages); page += 1) {
    if (page > 1) {
      if (page > pageCount) break;
      await sleep(randomPauseMs(opts.pauseMinMs, opts.pauseMaxMs));
    }
    let url: string;
    try {
      url = autobidPageUrl(sourceUrl, page);
    } catch {
      return { status: "fetch_failed", note: "Nederīgs URL.", vehicles: [], rawPages, pagesFetched, pageCount };
    }
    const got = await fetchPageHtml(url, opts.timeoutMs, fetchImpl);
    if (!got.ok) {
      if (page === 1) return { status: "fetch_failed", note: got.note, vehicles: [], rawPages, pagesFetched, pageCount };
      partialNote = `${page}. lapa neizdevās: ${got.note}`;
      break;
    }
    const http = httpStatusToSource(got.statusCode);
    if (http) {
      if (page === 1) return { ...http, vehicles: [], rawPages, pagesFetched, pageCount };
      partialNote = `${page}. lapa: ${http.note}`;
      break;
    }
    const parsed = parseAutobidSearchPage(got.html);
    if (!parsed) {
      if (page === 1) {
        rawPages.push(got.html.slice(0, 400_000));
        return {
          status: "parse_failed",
          note: "Lapā nav `__NUXT_DATA__` ar auto sarakstu. Iespējams, mainīta struktūra; skat. raw.",
          vehicles: [],
          rawPages,
          pagesFetched: 1,
          pageCount,
        };
      }
      partialNote = `${page}. lapu neizdevās parsēt.`;
      break;
    }
    pagesFetched += 1;
    pageCount = Math.max(pageCount, parsed.pageCount);
    const nuxt = got.html.match(/<script[^>]*\bid=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? "";
    rawPages.push(nuxt.slice(0, 1_500_000));
    for (const v of parsed.vehicles) if (!vehicles.has(v.externalId)) vehicles.set(v.externalId, v);
    /** Pēdējā lapa var būt nepilna; ja atgriež 0 auto, tālāk nav jēgas. */
    if (parsed.vehicles.length === 0) break;
  }

  const notes: string[] = [];
  if (vehicles.size === 0) notes.push("Meklējums šobrīd nedod rezultātus (0 auto).");
  if (pageCount > opts.maxPages) notes.push(`Nolasītas ${pagesFetched}/${pageCount} lapas (limits ${opts.maxPages}).`);
  if (partialNote) notes.push(partialNote);
  return {
    status: "ok",
    note: notes.join(" "),
    vehicles: [...vehicles.values()],
    rawPages,
    pagesFetched,
    pageCount,
  };
}

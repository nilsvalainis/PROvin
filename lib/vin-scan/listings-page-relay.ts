/**
 * VIN SCAN izsoļu lapas caur Hetzner IRISS Chrome releju (`POST /listings/page`).
 * stat.vin WAF (plaintext Access blocked) CapSolver nespēj; īsts Chrome var.
 * Env: IRISS_LISTINGS_RELAY_URL + IRISS_LISTINGS_RELAY_TOKEN (tie paši, kas LIST).
 */

import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import { readIrissRelayConfig } from "@/lib/iriss-listings-relay";
import { isCloudflareChallengeHtml, looksLikeCloudflareWafBlock } from "@/lib/vin-sources/html-extract";

export type VinScanHttpLike = {
  status: number;
  text: string;
  cookie?: string;
  ua?: string;
  proxyUrl?: string;
  finalUrl?: string;
  challengeReason?: string;
};

export type VinScanRelayPageOk = { ok: true; status: number; html: string; finalUrl: string };
export type VinScanRelayPageErr = { ok: false; reason: string };
export type VinScanRelayPage = VinScanRelayPageOk | VinScanRelayPageErr;

const DEFAULT_TIMEOUT_MS = 70_000;

/** Tāds pats allowlist kā relay/provin-listings/lib/vinscan-page.mjs */
export const VIN_SCAN_RELAY_HOSTS = [
  "stat.vin",
  "bid.cars",
  "checkcar.vin",
  "bidfax.info",
  "poctra.com",
  "plc.auction",
] as const;

export function isVinScanRelayUrl(raw: string): boolean {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return VIN_SCAN_RELAY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function vinScanPageNeedsRelay(page: VinScanHttpLike): boolean {
  if (page.challengeReason) return true;
  if (page.status === 0) return true;
  if (isCloudflareChallengeHtml(page.text, page.status)) return true;
  if (looksLikeCloudflareWafBlock(page.text, page.status)) return true;
  return page.status === 403 || page.status === 429 || page.status === 503;
}

export async function fetchVinScanPageViaRelay(
  url: string,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanRelayPage> {
  const cfg = readIrissRelayConfig(deps.env ?? process.env);
  if (!cfg) return { ok: false, reason: "Relejs nav konfigurēts (IRISS_LISTINGS_RELAY_URL)" };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/page`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ url }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (!res.ok) {
      const err = String(rec.error ?? rec.note ?? "").trim();
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "Relejs noraidīja tokenu (IRISS_LISTINGS_RELAY_TOKEN)" };
      }
      if (res.status === 429) return { ok: false, reason: err || "Releja dienas limits VIN SCAN" };
      if (res.status === 503) return { ok: false, reason: err || "Relejs aizņemts (rinda pilna)" };
      return { ok: false, reason: err || `Relejs atbildēja HTTP ${res.status}` };
    }
    const html = String(rec.html ?? "");
    if (!html.trim()) return { ok: false, reason: "Relejs atgrieza tukšu HTML" };
    return {
      ok: true,
      status: typeof rec.status === "number" ? rec.status : 200,
      html,
      finalUrl: String(rec.finalUrl ?? url),
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    if (aborted) return { ok: false, reason: `Relejs neatbildēja ${Math.round(timeoutMs / 1000)} s laikā` };
    return { ok: false, reason: `Releja savienojums neizdevās: ${formatFetchError(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function applyVinScanRelayIfBlocked(
  url: string,
  page: VinScanHttpLike,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanHttpLike> {
  if (!isVinScanRelayUrl(url)) return page;
  if (!vinScanPageNeedsRelay(page)) return page;
  const relayed = await fetchVinScanPageViaRelay(url, deps);
  if (!relayed.ok) {
    if (/nav konfigurēts/i.test(relayed.reason)) return page;
    return { ...page, challengeReason: page.challengeReason || relayed.reason };
  }
  return {
    status: relayed.status || 200,
    text: relayed.html,
    cookie: page.cookie ?? "",
    ua: page.ua,
    proxyUrl: page.proxyUrl,
    finalUrl: relayed.finalUrl,
  };
}

/**
 * Tiešais fetch (bez CapSolver). WAF / 403 / timeout -> Hetzner Chrome.
 * Ja relejs nav konfigurēts, atstāj sākotnējo lapu vai no jauna izmet kļūdu.
 */
export async function fetchVinScanAuctionPage(
  url: string,
  directFetch: () => Promise<VinScanHttpLike>,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanHttpLike> {
  try {
    const direct = await directFetch();
    return await applyVinScanRelayIfBlocked(url, direct, deps);
  } catch (e) {
    if (!isVinScanRelayUrl(url)) throw e;
    const relayed = await fetchVinScanPageViaRelay(url, deps);
    if (relayed.ok) {
      return {
        status: relayed.status || 200,
        text: relayed.html,
        cookie: "",
        finalUrl: relayed.finalUrl,
      };
    }
    throw e;
  }
}

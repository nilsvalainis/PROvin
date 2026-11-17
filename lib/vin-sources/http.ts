import "server-only";

import { ProxyAgent } from "undici";

import { cookieHeaderFromSetCookieLines, mergeCookieHeader, splitCombinedSetCookieHeader } from "@/lib/vin-sources/html-extract";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const VIN_HTTP_UA = UA;

export type VinHttpResult = {
  status: number;
  text: string;
  cookie: string;
  /** Final URL after redirects (`redirect: "follow"`). stat.vin not-found → `/car-not-found`. */
  finalUrl?: string;
};

function cookieFrom(res: Response): string {
  const rows = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (rows.length > 0) return cookieHeaderFromSetCookieLines(rows);
  const single = res.headers.get("set-cookie");
  if (!single) return "";
  return cookieHeaderFromSetCookieLines(splitCombinedSetCookieHeader(single));
}

const proxyAgents = new Map<string, ProxyAgent>();

/** Viens `ProxyAgent` uz proxy URL (savienojumu pūls), nevis jauns katram pieprasījumam. */
function proxyAgentFor(proxyUrl: string): ProxyAgent {
  let agent = proxyAgents.get(proxyUrl);
  if (!agent) {
    agent = new ProxyAgent(proxyUrl);
    proxyAgents.set(proxyUrl, agent);
  }
  return agent;
}

/** Tikai testiem: aizmirst kešotos ProxyAgent. */
export function resetVinHttpProxyAgentsForTests(): void {
  proxyAgents.clear();
}

const PROXY_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ERR_TUNNEL_CONNECTION_FAILED",
]);

function errorChain(e: unknown): Array<{ code: string; message: string }> {
  const out: Array<{ code: string; message: string }> = [];
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i += 1) {
    const o = cur as { code?: unknown; message?: unknown; cause?: unknown };
    out.push({
      code: typeof o.code === "string" ? o.code : "",
      message: typeof o.message === "string" ? o.message : "",
    });
    cur = o.cause;
  }
  return out;
}

/**
 * Kļūda, ko izraisa pats proxy (tunelis/CONNECT, 407, savienojums ar proxy), nevis mērķa vietne.
 * Atgriež īsu kodu žurnālam vai null.
 */
export function vinHttpProxyFailureCode(e: unknown): string | null {
  if (e instanceof Error && (e.name === "AbortError" || e.message === "timeout")) return null;
  for (const { code, message } of errorChain(e)) {
    if (/proxy response \(407\)|\b407\b.*proxy|proxy.*\b407\b/i.test(message)) return "PROXY_407";
    if (code === "UND_ERR_ABORTED" && /proxy|tunnel/i.test(message)) return code;
    if (code === "UND_ERR_ABORTED") continue;
    if (code.startsWith("UND_ERR_") || PROXY_ERROR_CODES.has(code)) return code;
    if (/tunnel|proxy connect/i.test(message)) return "PROXY_TUNNEL";
  }
  return null;
}

export async function vinHttpFetch(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cookie?: string;
    timeoutMs?: number;
    proxyUrl?: string;
  } = {},
): Promise<VinHttpResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20_000);
  try {
    const headers: Record<string, string> = {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "et-EE,et;q=0.9,en;q=0.8",
      "user-agent": UA,
      ...init.headers,
    };
    if (init.cookie) headers.cookie = init.cookie;
    const fetchInit: RequestInit & { dispatcher?: ProxyAgent } = {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    };
    let res: Response | null = null;
    if (init.proxyUrl) {
      const proxiedInit: RequestInit & { dispatcher?: ProxyAgent } = {
        ...fetchInit,
        dispatcher: proxyAgentFor(init.proxyUrl),
      };
      let proxyFailure: string | null = null;
      try {
        res = await fetch(url, proxiedInit);
        if (res.status === 407) proxyFailure = "PROXY_407";
      } catch (e) {
        proxyFailure = ctrl.signal.aborted ? null : vinHttpProxyFailureCode(e);
        if (!proxyFailure) throw e;
      }
      if (proxyFailure) {
        // Proxy nav pieejams: vienu reizi tieši (bez proxy). Proxy URL žurnālā nerakstām.
        console.warn(JSON.stringify({ vinHttp: true, event: "proxy_failed_direct_retry", code: proxyFailure }));
        await res?.body?.cancel().catch(() => undefined);
        res = null;
      }
    }
    if (!res) res = await fetch(url, fetchInit);
    const text = await res.text();
    return {
      status: res.status,
      text,
      cookie: mergeCookieHeader(init.cookie ?? "", cookieFrom(res)),
      finalUrl: res.url || url,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}


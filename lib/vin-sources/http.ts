import "server-only";

import { ProxyAgent } from "undici";

import { mergeCookieHeader } from "@/lib/vin-sources/html-extract";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const VIN_HTTP_UA = UA;

export type VinHttpResult = {
  status: number;
  text: string;
  cookie: string;
};

function cookieFrom(res: Response): string {
  const rows = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const parts = rows.map((row) => row.split(";")[0]?.trim() ?? "").filter(Boolean);
  if (parts.length > 0) return parts.join("; ");
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0]!.trim() : "";
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
    if (init.proxyUrl) fetchInit.dispatcher = new ProxyAgent(init.proxyUrl);
    const res = await fetch(url, fetchInit);
    const text = await res.text();
    return { status: res.status, text, cookie: mergeCookieHeader(init.cookie ?? "", cookieFrom(res)) };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}


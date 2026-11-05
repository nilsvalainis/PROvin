import "server-only";

import { embedHostFromUrl, isEmbedHostAllowed } from "@/lib/b2b-partner-embed";

const TIMEOUT_MS = 4500;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export type ListingFetchResult = { ok: true; html: string } | { ok: false; error: "network" | "status" | "host" };

/**
 * Nolasa partnera sludinājuma lapu (tikai partnera domēnos, arī pēc pāradresācijām).
 * Lieto tikai VIN klātbūtnes pārbaudei; saturu nesaglabā.
 */
export async function fetchPartnerListingHtml(url: string, domains: readonly string[]): Promise<ListingFetchResult> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isEmbedHostAllowed(embedHostFromUrl(current), domains)) return { ok: false, error: "host" };
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PROVIN-LinkCheck/1.0)", Accept: "text/html" },
      });
    } catch {
      return { ok: false, error: "network" };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, error: "status" };
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok || !res.body) return { ok: false, error: "status" };
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      size += value.byteLength;
      chunks.push(value);
      if (size >= MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    return { ok: true, html: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
  return { ok: false, error: "status" };
}

/**
 * Izsoļu JPEG lejupielāde ar atkārtošanu. Bez klusas izlaišanas: katrs URL ir ok vai failed.
 */

import { createHash } from "crypto";

import { ADMIN_PHOTO_UPLOAD_MAX_SOURCE_BYTES, jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";
import { isAllowedVinScanAuctionPhotoUrl } from "@/lib/order-vin-scan-photos";

export const AUCTION_PHOTO_FETCH_TIMEOUT_MS = 25_000;
export const AUCTION_PHOTO_FETCH_ATTEMPTS = 3;
export const AUCTION_PHOTO_CONCURRENCY = 6;

export type AuctionPhotoFetchOk = {
  ok: true;
  url: string;
  jpeg: Buffer;
  contentHash: string;
};

export type AuctionPhotoFetchFail = {
  ok: false;
  url: string;
  reason: string;
};

export type AuctionPhotoFetchResult = AuctionPhotoFetchOk | AuctionPhotoFetchFail;

function refererForAuctionPhoto(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("copart.fi")) return "https://www.copart.fi/";
    if (host.includes("copart")) return "https://www.copart.com/";
    if (host.includes("iaai")) return "https://www.iaai.com/";
    if (host.includes("stat.vin")) return "https://stat.vin/";
    if (host.includes("import-motor.com")) return "https://www.copart.com/";
  } catch {
    return undefined;
  }
  return undefined;
}

export function auctionPhotoContentHash(jpeg: Buffer): string {
  return createHash("sha256").update(jpeg).digest("hex");
}

async function fetchOnce(url: string, storedMaxBytes: number): Promise<AuctionPhotoFetchResult> {
  if (!isAllowedVinScanAuctionPhotoUrl(url)) {
    return { ok: false, url, reason: "host_not_allowed" };
  }
  const referer = refererForAuctionPhoto(url);
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(AUCTION_PHOTO_FETCH_TIMEOUT_MS),
      headers: {
        Accept: "image/jpeg,image/webp,image/png,image/*;q=0.8,*/*;q=0.5",
        ...(referer ? { Referer: referer } : {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.name : "fetch_error";
    return { ok: false, url, reason: msg === "TimeoutError" ? "timeout" : "network" };
  }
  if (!res.ok) return { ok: false, url, reason: `http_${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return { ok: false, url, reason: "empty" };
  if (buf.length > ADMIN_PHOTO_UPLOAD_MAX_SOURCE_BYTES) return { ok: false, url, reason: "too_large" };
  const normalized = await jpegFromAdminPhotoUpload(buf, storedMaxBytes);
  if (!normalized.ok) return { ok: false, url, reason: normalized.error };
  return {
    ok: true,
    url,
    jpeg: normalized.jpeg,
    contentHash: auctionPhotoContentHash(normalized.jpeg),
  };
}

export async function fetchAuctionPhotoJpeg(
  url: string,
  storedMaxBytes: number,
): Promise<AuctionPhotoFetchResult> {
  let last: AuctionPhotoFetchResult = { ok: false, url, reason: "unknown" };
  for (let attempt = 0; attempt < AUCTION_PHOTO_FETCH_ATTEMPTS; attempt += 1) {
    last = await fetchOnce(url, storedMaxBytes);
    if (last.ok) return last;
    if (last.reason === "host_not_allowed" || last.reason === "too_large") return last;
  }
  return last;
}

export async function fetchAuctionPhotoJpegs(
  urls: readonly string[],
  storedMaxBytes: number,
  opts?: { concurrency?: number },
): Promise<{ ok: AuctionPhotoFetchOk[]; failed: AuctionPhotoFetchFail[] }> {
  const wanted = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  const ok: AuctionPhotoFetchOk[] = [];
  const failed: AuctionPhotoFetchFail[] = [];
  let i = 0;
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? AUCTION_PHOTO_CONCURRENCY, wanted.length || 1));
  const workers = Array.from({ length: Math.min(concurrency, wanted.length) }, async () => {
    while (i < wanted.length) {
      const url = wanted[i];
      i += 1;
      if (!url) continue;
      const result = await fetchAuctionPhotoJpeg(url, storedMaxBytes);
      if (result.ok) ok.push(result);
      else failed.push(result);
    }
  });
  await Promise.all(workers);
  return { ok, failed };
}

import "server-only";

import archiver from "archiver";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";

import { listingImageHostnameAllowed } from "@/lib/iriss-listing-image";

const MAX_PHOTOS = 40;
const MAX_BYTES = 3_500_000;
const MAX_REDIRECTS = 3;

export function isAllowedListingPhotoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (u.port && u.port !== "443") return false;
    const host = u.hostname.toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
    if (listingImageHostnameAllowed(u.toString())) return true;
    return host === "auto1.eu" || host.endsWith(".auto1.eu");
  } catch {
    return false;
  }
}

async function fetchAllowedListingPhoto(url: string): Promise<Response | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedListingPhotoUrl(current)) return null;
    const res = await fetch(current, {
      cache: "no-store",
      redirect: "manual",
      headers: /openlane/i.test(current) ? { Referer: "" } : undefined,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try {
        current = new URL(loc, current).toString();
      } catch {
        return null;
      }
      continue;
    }
    return res.ok ? res : null;
  }
  return null;
}

export async function zipListingPhotoUrls(urls: string[]): Promise<Buffer> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(isAllowedListingPhotoUrl))].slice(0, MAX_PHOTOS);
  if (unique.length === 0) throw new Error("nav_bildes");
  const archive = archiver("zip", { zlib: { level: 5 } });
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", (c: Buffer) => chunks.push(c));
  archive.pipe(sink);
  let i = 0;
  for (const url of unique) {
    i += 1;
    try {
      const res = await fetchAllowedListingPhoto(url);
      if (!res) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_BYTES) continue;
      const ext = /\.png(\?|$)/i.test(url) ? "png" : /\.webp(\?|$)/i.test(url) ? "webp" : "jpg";
      archive.append(buf, { name: `foto-${String(i).padStart(2, "0")}.${ext}` });
    } catch {
      /* viena bilde nedrīkst nogāzt ZIP */
    }
  }
  await archive.finalize();
  await finished(sink);
  const out = Buffer.concat(chunks);
  if (out.length < 22) throw new Error("zip_tukss");
  return out;
}

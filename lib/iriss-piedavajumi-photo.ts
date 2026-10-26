import "server-only";

/**
 * j70: piedāvājuma bilde pēc kārtas numura. Klients bildes saņem tikai caur `/p/d/<token>/foto/<n>`,
 * tāpēc izsoles CDN adrese (avots) un Dropbox id netiek atklāti.
 * Ārējās bildes: tikai https, bez IP/lokāliem hostiem, tikai attēli līdz 15 MB.
 */

import { readOfferSourcePhoto } from "@/lib/iriss-offer-source";
import { parseOfferSourceRef } from "@/lib/iriss-stock-photos";
import type { IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const MAX_BYTES = 15 * 1024 * 1024;

export function isFetchableIrissPdPhotoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    if (!h.includes(".") || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.startsWith("[") || h === "localhost") return false;
    return true;
  } catch {
    return false;
  }
}

export async function loadIrissPdPhoto(
  rec: IrissPiedavajums,
  index: number,
  size: "thumb" | "full",
): Promise<{ bytes: Buffer; type: string } | null> {
  const photo = rec.photos[index];
  if (!photo) return null;
  if (photo.kind === "dropbox") {
    const ref = parseOfferSourceRef(photo.ref);
    if (!ref) return null;
    const bytes = await readOfferSourcePhoto(ref, photo.id, size).catch(() => null);
    return bytes ? { bytes, type: "image/jpeg" } : null;
  }
  if (!isFetchableIrissPdPhotoUrl(photo.url)) return null;
  try {
    const res = await fetch(photo.url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "image/jpeg,image/webp,image/png,image/*;q=0.8" },
    });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!res.ok || !/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return null;
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
    return { bytes, type };
  } catch {
    return null;
  }
}

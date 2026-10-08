import "server-only";

import archiver from "archiver";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";

const HOST_OK = /(^|\.)(openlane\.(eu|com)|autobid\.(de|eu)|auto1\.(com|eu)|img-pa\.auto1\.com|cdn\.autobid\.de)$/i;
const MAX_PHOTOS = 40;
const MAX_BYTES = 3_500_000;

export function isAllowedListingPhotoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && HOST_OK.test(u.hostname);
  } catch {
    return false;
  }
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
      const res = await fetch(url, {
        cache: "no-store",
        headers: /openlane/i.test(url) ? { Referer: "" } : undefined,
        redirect: "follow",
      });
      if (!res.ok) continue;
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

import "server-only";

import sharp from "sharp";

/** Samazina attēlu pirms pdf-lib iegulšanas — novērš lielu base64 PNG/JPEG izšķīdināšanu serverī un iOS lejupielādes laikā. */
export async function shrinkImageBytesForIrissPdf(input: Buffer): Promise<Uint8Array | null> {
  const pipeline = () =>
    sharp(input)
      .rotate()
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true });
  try {
    const buf = await pipeline().flatten({ background: "#ffffff" }).toBuffer();
    return new Uint8Array(buf);
  } catch {
    try {
      const buf = await pipeline().toBuffer();
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  }
}

import "server-only";

import sharp from "sharp";

/** Samazina attēlu pirms pdf-lib iegulšanas — PDF šūna ir maza; klienta kompresija jau samazina augšupielādi. */
export async function shrinkImageBytesForIrissPdf(input: Buffer): Promise<Uint8Array | null> {
  const pipeline = () =>
    sharp(input)
      .rotate()
      .resize(820, 820, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 68, mozjpeg: true });
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

import sharp from "sharp";

/** Režģa miniatūra. Pilnais attēls paliek PDF un klienta saitei. */
export const IRISS_OFFER_THUMB_MAX_EDGE = 240;

export function irissOfferThumbBlobPath(fullBlobPath: string): string {
  const trimmed = fullBlobPath.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return "";
  if (trimmed.endsWith("-thumb")) return trimmed;
  return `${trimmed}-thumb`;
}

export async function renderIrissOfferThumbJpeg(bytes: Buffer): Promise<Buffer | null> {
  if (!bytes.length) return null;
  try {
    const out = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize(IRISS_OFFER_THUMB_MAX_EDGE, IRISS_OFFER_THUMB_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 62, mozjpeg: true })
      .toBuffer();
    if (out.length < 32) return null;
    return out;
  } catch {
    return null;
  }
}

import sharp from "sharp";

import {
  coverCheckcarVinWatermarkRgb,
  type CheckcarWatermarkHit,
} from "@/lib/checkcar-watermark-mask";

export type CheckcarWatermarkCoverResult = {
  covered: boolean;
  jpeg: Buffer;
  hit: CheckcarWatermarkHit | null;
};

const JPEG_QUALITY = 88;

/**
 * Uzliek fiksētu CheckCar.vin mozaīkas joslu kadra vidū.
 * Ja josla jau ir mozaīka, atgriež oriģinālo buferi bez pārkodēšanas.
 */
export async function coverCheckcarVinWatermark(
  jpegBody: Buffer,
): Promise<CheckcarWatermarkCoverResult> {
  try {
    return await coverCheckcarVinWatermarkUnsafe(jpegBody);
  } catch {
    return { covered: false, jpeg: jpegBody, hit: null };
  }
}

async function coverCheckcarVinWatermarkUnsafe(
  jpegBody: Buffer,
): Promise<CheckcarWatermarkCoverResult> {
  let raw: { data: Buffer; info: sharp.OutputInfo };
  try {
    raw = await sharp(jpegBody).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch {
    return { covered: false, jpeg: jpegBody, hit: null };
  }

  const { data, info } = raw;
  if (info.channels !== 3 || info.width < 80 || info.height < 60) {
    return { covered: false, jpeg: jpegBody, hit: null };
  }

  const img = {
    data: new Uint8Array(data),
    width: info.width,
    height: info.height,
    channels: 3 as const,
  };
  const hit = coverCheckcarVinWatermarkRgb(img);
  if (!hit) return { covered: false, jpeg: jpegBody, hit: null };

  const jpeg = await sharp(Buffer.from(img.data), {
    raw: { width: img.width, height: img.height, channels: 3 },
  })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { covered: true, jpeg, hit };
}

/** Saglabāšanai: JPEG ar centra joslu, vai oriģināls, ja josla jau ir. */
export async function jpegWithCheckcarWatermarkCovered(jpegBody: Buffer): Promise<Buffer> {
  const result = await coverCheckcarVinWatermark(jpegBody);
  return result.jpeg;
}

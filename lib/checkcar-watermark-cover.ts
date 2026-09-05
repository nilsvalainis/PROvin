import sharp from "sharp";

import {
  applyGrayMosaicBar,
  detectCheckcarVinWatermark,
  type CheckcarWatermarkHit,
  type RgbBuffer,
} from "@/lib/checkcar-watermark-mask";

export type CheckcarWatermarkCoverResult = {
  covered: boolean;
  jpeg: Buffer;
  hit: CheckcarWatermarkHit | null;
};

const JPEG_QUALITY = 88;
const DETECT_LONG_EDGE = 900;

/**
 * Ja attēlā ir CheckCar.vin ūdenszīme, aizklāj to un atgriež jaunu JPEG.
 * Ja nav, atgriež oriģinālo buferi bez pārkodēšanas.
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

function scaleHit(hit: CheckcarWatermarkHit, scale: number): CheckcarWatermarkHit {
  if (scale === 1) return hit;
  const inv = 1 / scale;
  return {
    ...hit,
    box: {
      x: Math.round(hit.box.x * inv),
      y: Math.round(hit.box.y * inv),
      w: Math.round(hit.box.w * inv),
      h: Math.round(hit.box.h * inv),
    },
  };
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

  const full: RgbBuffer = {
    data: new Uint8Array(data),
    width: info.width,
    height: info.height,
    channels: 3,
  };

  const longEdge = Math.max(info.width, info.height);
  let detectImg: RgbBuffer = full;
  let scale = 1;
  if (longEdge > DETECT_LONG_EDGE) {
    scale = DETECT_LONG_EDGE / longEdge;
    const dw = Math.max(80, Math.round(info.width * scale));
    const dh = Math.max(60, Math.round(info.height * scale));
    const small = await sharp(Buffer.from(full.data), {
      raw: { width: info.width, height: info.height, channels: 3 },
    })
      .resize(dw, dh)
      .raw()
      .toBuffer({ resolveWithObject: true });
    detectImg = {
      data: new Uint8Array(small.data),
      width: small.info.width,
      height: small.info.height,
      channels: 3,
    };
  }

  const rawHit = detectCheckcarVinWatermark(detectImg);
  if (!rawHit) return { covered: false, jpeg: jpegBody, hit: null };
  const hit = scaleHit(rawHit, scale);
  applyGrayMosaicBar(full, hit.box);

  const jpeg = await sharp(Buffer.from(full.data), {
    raw: { width: full.width, height: full.height, channels: 3 },
  })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { covered: true, jpeg, hit };
}

/** Saglabāšanai: tīrs JPEG, vai oriģināls, ja ūdenszīmes nav. */
export async function jpegWithCheckcarWatermarkCovered(jpegBody: Buffer): Promise<Buffer> {
  const result = await coverCheckcarVinWatermark(jpegBody);
  return result.jpeg;
}

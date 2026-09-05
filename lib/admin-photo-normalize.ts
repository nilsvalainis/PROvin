import sharp from "sharp";

function isJpegMagicBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/** iPhone HEIC pirms kompresijas; pēc konversijas tiek samazināts līdz store limitam. */
export const ADMIN_PHOTO_UPLOAD_MAX_SOURCE_BYTES = 12 * 1024 * 1024;

const MAX_EDGE = 1680;

const HEIC_BRANDS = new Set(["heic", "heix", "heif", "hevc", "heim", "heis", "mif1", "msf1"]);

export function isHeicMagicBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  return HEIC_BRANDS.has(buf.toString("ascii", 8, 12).toLowerCase());
}

export function isLikelyHeicImageFile(file: { type?: string; name?: string }): boolean {
  const type = (file.type ?? "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.hei[cf]$/i.test(file.name ?? "");
}

async function heicBufferToJpeg(input: Buffer): Promise<Buffer | null> {
  try {
    const { default: convert } = await import("heic-convert");
    const out = await convert({ buffer: input, format: "JPEG", quality: 0.88 });
    const jpeg = Buffer.from(out);
    return isJpegMagicBuffer(jpeg) ? jpeg : null;
  } catch {
    return null;
  }
}

async function rasterBufferToJpeg(input: Buffer): Promise<Buffer | null> {
  try {
    const jpeg = await sharp(input)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return isJpegMagicBuffer(jpeg) ? jpeg : null;
  } catch {
    return null;
  }
}

async function shrinkJpegToMax(jpeg: Buffer, maxBytes: number): Promise<Buffer> {
  if (jpeg.length <= maxBytes) return jpeg;
  let edge = MAX_EDGE;
  let quality = 80;
  let out = jpeg;
  for (let i = 0; i < 14; i++) {
    if (out.length <= maxBytes) return out;
    edge = Math.max(480, Math.round(edge * 0.86));
    quality = Math.max(34, quality - 6);
    out = await sharp(jpeg)
      .rotate()
      .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }
  return out.length <= maxBytes ? out : jpeg;
}

async function toJpegBuffer(raw: Buffer): Promise<Buffer | null> {
  if (isJpegMagicBuffer(raw)) return raw;
  if (isHeicMagicBuffer(raw)) {
    const fromHeic = await heicBufferToJpeg(raw);
    if (fromHeic) return fromHeic;
  }
  return rasterBufferToJpeg(raw);
}

/**
 * Admin foto POST: JPEG paliek JPEG; HEIC/HEIF, PNG, WebP kļūst par JPEG un ietilpst store limitā.
 */
export async function jpegFromAdminPhotoUpload(
  raw: Buffer,
  storedMaxBytes: number,
): Promise<{ ok: true; jpeg: Buffer } | { ok: false; error: "file_too_large" | "invalid_jpeg" }> {
  if (raw.length === 0) return { ok: false, error: "invalid_jpeg" };
  if (raw.length > ADMIN_PHOTO_UPLOAD_MAX_SOURCE_BYTES) return { ok: false, error: "file_too_large" };

  const jpeg = await toJpegBuffer(raw);
  if (!jpeg || !isJpegMagicBuffer(jpeg)) return { ok: false, error: "invalid_jpeg" };

  try {
    const fitted = await shrinkJpegToMax(jpeg, storedMaxBytes);
    if (!isJpegMagicBuffer(fitted)) return { ok: false, error: "invalid_jpeg" };
    if (fitted.length > storedMaxBytes) return { ok: false, error: "file_too_large" };
    return { ok: true, jpeg: fitted };
  } catch {
    return { ok: false, error: "invalid_jpeg" };
  }
}

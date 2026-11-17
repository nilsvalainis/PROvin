import sharp from "sharp";

export {
  IRISS_OFFER_DISPLAY_DEFAULT_WIDTH,
  IRISS_OFFER_DISPLAY_WIDTHS,
  pickIrissOfferDisplayWidth,
} from "@/lib/iriss-offer-public-photo";

/** Režģa miniatūra. Pilnais attēls paliek PDF un klienta saitei. */
export const IRISS_OFFER_THUMB_MAX_EDGE = 240;

export type IrissOfferImageFormat = "avif" | "webp" | "jpeg";

export function irissOfferThumbBlobPath(fullBlobPath: string): string {
  const trimmed = fullBlobPath.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return "";
  if (trimmed.endsWith("-thumb")) return trimmed;
  return `${trimmed}-thumb`;
}

/**
 * On-the-fly AVIF uz Vercel funkcijas aizņem sekundes (live /p/ hero "migla").
 * WebP ir pietiekami ass un kodējas ātri; JPEG - rezerve.
 */
export function pickIrissOfferImageFormat(acceptHeader: string | null): IrissOfferImageFormat {
  const accept = (acceptHeader || "").toLowerCase();
  if (accept.includes("image/webp")) return "webp";
  return "jpeg";
}

export function irissOfferImageMimeForFormat(format: IrissOfferImageFormat): string {
  if (format === "avif") return "image/avif";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

async function renderIrissOfferImageVariant(
  bytes: Buffer,
  opts: { maxEdge: number; quality: number; format: IrissOfferImageFormat },
): Promise<Buffer | null> {
  if (!bytes.length) return null;
  try {
    const resized = sharp(bytes, { failOn: "none" })
      .rotate()
      .resize(opts.maxEdge, opts.maxEdge, { fit: "inside", withoutEnlargement: true });
    const pipeline =
      opts.format === "avif"
        ? resized.avif({ quality: opts.quality })
        : opts.format === "webp"
          ? resized.webp({ quality: opts.quality })
          : resized.jpeg({ quality: opts.quality, mozjpeg: true });
    const out = await pipeline.toBuffer();
    if (out.length < 32) return null;
    return out;
  } catch {
    return null;
  }
}

export async function renderIrissOfferThumbJpeg(bytes: Buffer): Promise<Buffer | null> {
  return renderIrissOfferImageVariant(bytes, { maxEdge: IRISS_OFFER_THUMB_MAX_EDGE, quality: 62, format: "jpeg" });
}

/** Publiskās galerijas samazināta "display" rendition, kad avots ir lielāks par pieprasīto platumu. */
export async function renderIrissOfferDisplayImage(
  bytes: Buffer,
  width: number,
  format: IrissOfferImageFormat,
): Promise<Buffer | null> {
  const quality = format === "jpeg" ? 82 : format === "webp" ? 80 : 72;
  return renderIrissOfferImageVariant(bytes, { maxEdge: width, quality, format });
}

export async function readIrissOfferImageWidth(bytes: Buffer): Promise<number> {
  if (!bytes.length) return 0;
  try {
    const meta = await sharp(bytes, { failOn: "none" }).metadata();
    return meta.width ?? 0;
  } catch {
    return 0;
  }
}

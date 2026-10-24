import sharp from "sharp";

/** Režģa miniatūra. Pilnais attēls paliek PDF un klienta saitei. */
export const IRISS_OFFER_THUMB_MAX_EDGE = 240;

/** Publiskās galerijas "hero" bildes platuma varianti (j49) - atbilst 1x/2x/3x DPR konteinera platumam ~688px. */
export const IRISS_OFFER_DISPLAY_WIDTHS = [480, 800, 1280] as const;
export const IRISS_OFFER_DISPLAY_DEFAULT_WIDTH = 800;

export type IrissOfferImageFormat = "avif" | "webp" | "jpeg";

export function irissOfferThumbBlobPath(fullBlobPath: string): string {
  const trimmed = fullBlobPath.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return "";
  if (trimmed.endsWith("-thumb")) return trimmed;
  return `${trimmed}-thumb`;
}

/** Fiksēts platumu saraksts - nepieļauj patvaļīgu `?w=` vērtību (resursu izsmelšanas risks). */
export function pickIrissOfferDisplayWidth(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return IRISS_OFFER_DISPLAY_DEFAULT_WIDTH;
  return (IRISS_OFFER_DISPLAY_WIDTHS as readonly number[]).includes(n) ? n : IRISS_OFFER_DISPLAY_DEFAULT_WIDTH;
}

/** Mūsdienu pārlūki `<img>` pieprasījumam sūta `Accept: image/avif,image/webp,...` - droši noteikt formātu no servera puses. */
export function pickIrissOfferImageFormat(acceptHeader: string | null): IrissOfferImageFormat {
  const accept = (acceptHeader || "").toLowerCase();
  if (accept.includes("image/avif")) return "avif";
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

/** Publiskās galerijas "hero" bilde - optimizēts platums + formāts (AVIF/WebP, kad pārlūks atbalsta). */
export async function renderIrissOfferDisplayImage(
  bytes: Buffer,
  width: number,
  format: IrissOfferImageFormat,
): Promise<Buffer | null> {
  const quality = format === "jpeg" ? 72 : 68;
  return renderIrissOfferImageVariant(bytes, { maxEdge: width, quality, format });
}

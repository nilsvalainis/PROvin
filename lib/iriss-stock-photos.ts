/**
 * Piedāvājuma bildes no auto Dropbox /STOCK mapes (tīra loģika, bez tīkla).
 * Secība "kā PRO": fotografēšanas (nosaukuma) secībā, IMG_2 < IMG_10; pirmā = vāks.
 * Ja Autoparkā ir galvenā bilde, tā ir pirmā. Ne vairāk par 60 (Nila atbildes 1 un 2).
 */

import { IRISS_MAX_OFFER_ATTACHMENTS, type IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";

export const IRISS_STOCK_PHOTO_LIMIT = IRISS_MAX_OFFER_ATTACHMENTS;

export type OfferSourceKind = "autoparks" | "logistics";
export type OfferSourceRef = { kind: OfferSourceKind; id: string };
export type StockPhoto = { dropboxId: string; name: string };

const SOURCE_RE = /^(autoparks|logistics):([A-Za-z0-9_-]{1,80})$/;
const DROPBOX_ID_RE = /^id:[A-Za-z0-9_-]{4,120}$/;

export function parseOfferSourceRef(raw: unknown): OfferSourceRef | null {
  if (typeof raw !== "string") return null;
  const m = SOURCE_RE.exec(raw.trim());
  if (!m) return null;
  return { kind: m[1] as OfferSourceKind, id: m[2]! };
}

export function offerSourceRefString(ref: OfferSourceRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function isSafeDropboxFileId(id: unknown): id is string {
  return typeof id === "string" && DROPBOX_ID_RE.test(id);
}

const COLLATOR = new Intl.Collator("lv", { numeric: true, sensitivity: "base" });

export function orderStockPhotos(
  files: ReadonlyArray<{ id: string; name: string; serverModified?: string }>,
  opts: { mainPhotoId?: string | null; limit?: number } = {},
): StockPhoto[] {
  const sorted = files
    .filter((f) => isSafeDropboxFileId(f.id) && f.name)
    .sort((a, b) => COLLATOR.compare(a.name, b.name) || (a.serverModified ?? "").localeCompare(b.serverModified ?? ""));
  const main = opts.mainPhotoId ? sorted.findIndex((f) => f.id === opts.mainPhotoId) : -1;
  if (main > 0) sorted.unshift(...sorted.splice(main, 1));
  return sorted.slice(0, opts.limit ?? IRISS_STOCK_PHOTO_LIMIT).map((f) => ({ dropboxId: f.id, name: f.name }));
}

export function offerSeedPhotoPath(ref: OfferSourceRef, dropboxId: string, size: "thumb" | "full"): string {
  const q = new URLSearchParams({ from: offerSourceRefString(ref), id: dropboxId, s: size });
  return `/api/admin/iriss-offer-seed/photo?${q.toString()}`;
}

/** Pielikums formai: vēl nav kopēts (tikai Dropbox id); saglabājot serveris to ielādē Blob. */
export function stockPhotoAttachment(ref: OfferSourceRef, photo: StockPhoto): IrissOfferAttachment {
  const base = photo.dropboxId.replace(/^id:/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(-24);
  const name = photo.name.replace(/\.(heic|heif|png|webp|gif)$/i, ".jpg");
  return {
    id: `dbx-${base}`.slice(0, 80),
    name,
    mimeType: "image/jpeg",
    size: 0,
    dataUrl: "",
    dropboxId: photo.dropboxId,
    thumbUrl: offerSeedPhotoPath(ref, photo.dropboxId, "thumb"),
  };
}

/** Cik bilžu vēl nav ielādētas Blob (rāda formā "N bildes vēl nav ielādētas"). */
export function pendingDropboxPhotoCount(attachments: ReadonlyArray<Pick<IrissOfferAttachment, "dropboxId" | "blobPath" | "dataUrl">>): number {
  return attachments.filter((a) => a.dropboxId && !a.blobPath && !a.dataUrl).length;
}

/** Papildu sadaļa, kas vajadzīga avota datu lasīšanai (bez tās seed/bildes netiek dotas). */
export function offerSourceSection(ref: OfferSourceRef): "ap_pamatdati" | "logistika" {
  return ref.kind === "autoparks" ? "ap_pamatdati" : "logistika";
}

/**
 * IRISS pasūtījuma apskates un dokumentu foto. Tā pati pielikumu shēma
 * kā piedāvājumā, lai varētu atkārtoti izmantot IrissOfferImageSorter.
 */

import type { IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";

export const IRISS_ORDER_PHOTO_ALBUMS = ["inspection", "documents"] as const;
export type IrissOrderPhotoAlbumId = (typeof IRISS_ORDER_PHOTO_ALBUMS)[number];

export type IrissOrderPhotoAlbum = {
  attachments: IrissOfferAttachment[];
  coverAttachmentId?: string;
};

export const IRISS_ORDER_PHOTO_ALBUM_LV: Record<IrissOrderPhotoAlbumId, string> = {
  inspection: "Apskates foto",
  documents: "Dokumentu foto",
};

export function emptyIrissOrderPhotoAlbum(): IrissOrderPhotoAlbum {
  return { attachments: [] };
}

export function irissOrderPhotoAlbumHasContent(album: IrissOrderPhotoAlbum | undefined): boolean {
  return Boolean(album?.attachments.length);
}

export function normalizeIrissOrderPhotoAlbum(
  raw: unknown,
  normalizeAttachments: (raw: unknown) => IrissOfferAttachment[],
): IrissOrderPhotoAlbum | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const attachments = normalizeAttachments(o.attachments ?? raw);
  if (attachments.length === 0) return undefined;
  const cover = typeof o.coverAttachmentId === "string" ? o.coverAttachmentId.trim().slice(0, 64) : "";
  return {
    attachments,
    ...(cover ? { coverAttachmentId: cover } : {}),
  };
}

export function irissOrderPhotoAlbumOfferId(album: IrissOrderPhotoAlbumId): string {
  return album === "inspection" ? "__inspection" : "__documents";
}

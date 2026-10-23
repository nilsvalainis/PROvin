/**
 * Piedāvājuma attēlu kārtošana: režģa secība, vāka foto, vairākatlase, sesijas atsaukšana.
 * PDF un klienta saite liek vāku pirmo, pārējos atstāj operatora secībā.
 */

export type OfferImageSorterItem = { id: string };

export type OfferImageFrame<T extends OfferImageSorterItem> = {
  images: T[];
  coverId: string | null;
  selectedIds: string[];
};

export function resolveOfferCoverId<T extends OfferImageSorterItem>(
  images: readonly T[],
  coverId: string | null | undefined,
): string | null {
  if (coverId && images.some((img) => img.id === coverId)) return coverId;
  return images[0]?.id ?? null;
}

export function moveOfferImage<T extends OfferImageSorterItem>(
  images: readonly T[],
  activeId: string,
  overId: string,
): T[] {
  if (!activeId || activeId === overId) return images.slice();
  const from = images.findIndex((img) => img.id === activeId);
  const to = images.findIndex((img) => img.id === overId);
  if (from < 0 || to < 0) return images.slice();
  const next = images.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function toggleOfferImageSelection(selectedIds: readonly string[], id: string): string[] {
  if (!id) return selectedIds.slice();
  return selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
}

/** Vāks kļūst par pirmo attēlu, lai režģis, PDF un klienta saite sakristu. */
export function setOfferCoverPhoto<T extends OfferImageSorterItem>(
  images: readonly T[],
  id: string,
): { images: T[]; coverId: string } | null {
  const idx = images.findIndex((img) => img.id === id);
  if (idx < 0) return null;
  if (idx === 0) return { images: images.slice(), coverId: id };
  const next = images.slice();
  const [item] = next.splice(idx, 1);
  next.unshift(item!);
  return { images: next, coverId: id };
}

export function deleteOfferImages<T extends OfferImageSorterItem>(
  images: readonly T[],
  coverId: string | null | undefined,
  ids: readonly string[],
): { images: T[]; coverId: string | null; removed: T[] } {
  const drop = new Set(ids.filter(Boolean));
  if (drop.size === 0) {
    return { images: images.slice(), coverId: resolveOfferCoverId(images, coverId), removed: [] };
  }
  const removed = images.filter((img) => drop.has(img.id));
  const next = images.filter((img) => !drop.has(img.id));
  const coverStill = coverId && next.some((img) => img.id === coverId) ? coverId : (next[0]?.id ?? null);
  return { images: next, coverId: coverStill, removed };
}

/**
 * Atjauno dzēstos attēlus un iepriekšējo secību.
 * Attēli, kas pievienoti pēc kadra, paliek beigās.
 */
export function restoreOfferImageSession<T extends OfferImageSorterItem>(
  snapshot: OfferImageFrame<T>,
  current: OfferImageFrame<T>,
): OfferImageFrame<T> {
  const currentById = new Map(current.images.map((img) => [img.id, img]));
  const snapshotIds = new Set(snapshot.images.map((img) => img.id));
  const images: T[] = [];
  for (const img of snapshot.images) images.push(currentById.get(img.id) ?? img);
  for (const img of current.images) {
    if (!snapshotIds.has(img.id)) images.push(img);
  }
  const selectedIds = snapshot.selectedIds.filter((id) => images.some((img) => img.id === id));
  const coverId =
    snapshot.coverId && images.some((img) => img.id === snapshot.coverId) ? snapshot.coverId : (images[0]?.id ?? null);
  return { images, coverId, selectedIds };
}

export function orderOfferAttachmentsForPdf<T extends OfferImageSorterItem & { mimeType?: string }>(offer: {
  attachments: readonly T[];
  coverAttachmentId?: string | null;
}): T[] {
  const images: T[] = [];
  const other: T[] = [];
  for (const att of offer.attachments) {
    if (typeof att.mimeType === "string" && att.mimeType.startsWith("image/")) images.push(att);
    else other.push(att);
  }
  const coverId = resolveOfferCoverId(images, offer.coverAttachmentId);
  const ordered: T[] = [];
  if (coverId) {
    const cover = images.find((img) => img.id === coverId);
    if (cover) ordered.push(cover);
  }
  for (const img of images) {
    if (img.id !== coverId) ordered.push(img);
  }
  return [...ordered, ...other];
}

export function offerImageGridSrc(att: {
  thumbDataUrl?: string;
  dataUrl?: string;
  thumbUrl?: string;
  blobUrl?: string;
}): string {
  const thumbData = att.thumbDataUrl ?? "";
  if (thumbData.startsWith("data:image")) return thumbData;
  const thumbUrl = att.thumbUrl ?? "";
  if (/^https?:\/\//i.test(thumbUrl)) return thumbUrl;
  const dataUrl = att.dataUrl ?? "";
  if (dataUrl.startsWith("data:image")) return dataUrl;
  const blobUrl = att.blobUrl ?? "";
  if (/^https?:\/\//i.test(blobUrl)) return blobUrl;
  return "";
}

/** Pilnais attēls skatam (Lightbox): oriģināls, ja ir; citādi sīktēls. */
export function offerImageFullSrc(att: {
  thumbDataUrl?: string;
  dataUrl?: string;
  thumbUrl?: string;
  blobUrl?: string;
}): string {
  const dataUrl = att.dataUrl ?? "";
  if (dataUrl.startsWith("data:image")) return dataUrl;
  const blobUrl = att.blobUrl ?? "";
  if (/^https?:\/\//i.test(blobUrl)) return blobUrl;
  return offerImageGridSrc(att);
}

export function offerImageDeleteToast(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "Attēls dzēsts";
  return `${count} attēli dzēsti`;
}

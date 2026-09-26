/** Ātro vērtējumu fotogrāfijas, ko operators pievieno un nosūta klientam e-pastā. */

export const LISTING_PEEK_MAX_PHOTOS = 6;
/** Pēc JPEG saspiešanas. Avota fails drīkst būt lielāks, kamēr sharp to samazina. */
export const LISTING_PEEK_PHOTO_STORED_MAX_BYTES = 500_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ListingPeekPhotoRef = {
  id: string;
};

export function isSafeListingPeekId(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export function listingPeekPhotoCid(photoId: string): string {
  return `peek-photo-${photoId.trim().toLowerCase()}@provin.lv`;
}

/** Metadati indeksā. Nederīgi vai liekie ieraksti tiek atmesti. */
export function parseListingPeekPhotos(raw: unknown): ListingPeekPhotoRef[] {
  if (!Array.isArray(raw)) return [];
  const out: ListingPeekPhotoRef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= LISTING_PEEK_MAX_PHOTOS) break;
    const idRaw =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
          ? (item as { id: string }).id
          : "";
    const id = idRaw.trim().toLowerCase();
    if (!isSafeListingPeekId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id });
  }
  return out;
}

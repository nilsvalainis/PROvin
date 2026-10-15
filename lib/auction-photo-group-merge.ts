/**
 * Izsoļu foto grupu sapludināšana: trūkstošās bildes esošajās grupās, bez dublikātiem.
 */

export type AuctionPhotoMetaLike = {
  id: string;
  sourceUrl?: string;
  contentHash?: string;
};

export type AuctionPhotoGroupLike<P extends AuctionPhotoMetaLike = AuctionPhotoMetaLike> = {
  id: string;
  title: string;
  photos: P[];
};

export type IncomingAuctionPhotoGroup<P extends AuctionPhotoMetaLike = AuctionPhotoMetaLike> = {
  title: string;
  photos: P[];
};

function normTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseGroupTitle(title: string): { source: string; venue: string; lot: string; year: string } {
  const parts = title.split("·").map((p) => p.trim()).filter(Boolean);
  const source = (parts[0] || "").toLowerCase();
  const venue = (parts[1] || "").toLowerCase();
  let lot = "";
  let year = "";
  for (const part of parts.slice(2)) {
    const lotMatch = /^lots\s+(\S+)/i.exec(part);
    if (lotMatch?.[1]) lot = lotMatch[1].toLowerCase();
    else if (/^\d{4}$/.test(part)) year = part;
  }
  return { source, venue, lot, year };
}

function photoKey(photo: AuctionPhotoMetaLike): string[] {
  const keys = [photo.id];
  if (photo.sourceUrl?.trim()) keys.push(`url:${photo.sourceUrl.trim()}`);
  if (photo.contentHash?.trim()) keys.push(`hash:${photo.contentHash.trim().toLowerCase()}`);
  return keys;
}

export function collectPhotoDedupeKeys(groups: readonly AuctionPhotoGroupLike[] | null | undefined): Set<string> {
  const seen = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      for (const key of photoKey(photo)) seen.add(key);
    }
  }
  return seen;
}

function titlesMatch(existingTitle: string, incomingTitle: string): boolean {
  if (normTitle(existingTitle) === normTitle(incomingTitle)) return true;
  const a = parseGroupTitle(existingTitle);
  const b = parseGroupTitle(incomingTitle);
  if (!a.source || !b.source || a.source !== b.source) return false;
  if (a.venue && b.venue && a.venue !== b.venue) return false;
  if (a.year && b.year && a.year !== b.year) return false;
  if (a.lot && b.lot) return a.lot === b.lot;
  return false;
}

export function findMatchingPhotoGroupIndex<G extends AuctionPhotoGroupLike>(
  existing: readonly G[],
  incomingTitle: string,
): number {
  const exact = existing.findIndex((g) => normTitle(g.title) === normTitle(incomingTitle));
  if (exact >= 0) return exact;
  const incoming = parseGroupTitle(incomingTitle);
  if (!incoming.lot) {
    return existing.findIndex((g) => titlesMatch(g.title, incomingTitle));
  }
  const lotHit = existing.findIndex((g) => {
    const parsed = parseGroupTitle(g.title);
    return parsed.source === incoming.source && parsed.lot === incoming.lot;
  });
  if (lotHit >= 0) return lotHit;
  return -1;
}

export function mergeImportedPhotoGroups<G extends AuctionPhotoGroupLike>(
  existing: readonly G[],
  incoming: readonly IncomingAuctionPhotoGroup<G["photos"][number]>[],
  makeGroupId: () => string,
): G[] {
  const out: G[] = existing.map((g) => ({ ...g, photos: [...g.photos] }));
  const seen = collectPhotoDedupeKeys(out);

  for (const group of incoming) {
    const photos: G["photos"] = [];
    for (const photo of group.photos ?? []) {
      if (!photo?.id) continue;
      const keys = photoKey(photo);
      if (keys.some((k) => seen.has(k))) continue;
      for (const k of keys) seen.add(k);
      photos.push(photo);
    }
    if (photos.length === 0) continue;
    const idx = findMatchingPhotoGroupIndex(out, group.title);
    if (idx >= 0) {
      const current = out[idx]!;
      out[idx] = { ...current, photos: [...current.photos, ...photos] };
      continue;
    }
    out.push({
      id: makeGroupId(),
      title: group.title.trim().slice(0, 120),
      photos,
    } as G);
  }
  return out;
}

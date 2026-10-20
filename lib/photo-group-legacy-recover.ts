/**
 * Back-compat: titled-but-empty groups (after #387 default archive titles) must not
 * hide a legacy flat `photos` array on the same record.
 */
export function appendMissingFlatPhotos<G extends { photos: P[] }, P extends { id: string }>(
  groups: G[],
  flat: P[],
): G[] {
  if (flat.length === 0 || groups.length === 0) return groups;
  const seen = new Set<string>();
  for (const group of groups) {
    for (const photo of group.photos) {
      if (photo?.id) seen.add(photo.id);
    }
  }
  const extras = flat.filter((photo) => photo?.id && !seen.has(photo.id));
  if (extras.length === 0) return groups;
  const first = groups[0]!;
  return [{ ...first, photos: [...first.photos, ...extras] }, ...groups.slice(1)];
}

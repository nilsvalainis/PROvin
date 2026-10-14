/** K5: pievieno augšupielādētās bildes jaunākajam grupu stāvoklim (bez dublikātiem). */
export function appendUploadedPhotosToGroup<G extends { id: string; photos: { id: string }[] }>(
  latest: G[],
  targetGroupId: string,
  uploaded: { id: string }[],
): G[] {
  return latest.map((g) => {
    if (g.id !== targetGroupId) return g;
    const have = new Set(g.photos.map((p) => p.id));
    return { ...g, photos: [...g.photos, ...uploaded.filter((p) => !have.has(p.id))] };
  });
}

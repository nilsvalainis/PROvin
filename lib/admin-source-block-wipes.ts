import { SOURCE_BLOCK_KEYS, type SourceBlockKey } from "@/lib/admin-source-blocks";

/** Operatora apzināta avota notīrīšana — coalesce nedrīkst atjaunot šos blokus no baseline. */
export function parseSourceBlockWipes(raw: unknown): SourceBlockKey[] {
  if (!Array.isArray(raw)) return [];
  const out: SourceBlockKey[] = [];
  const seen = new Set<SourceBlockKey>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (!(SOURCE_BLOCK_KEYS as readonly string[]).includes(item)) continue;
    const key = item as SourceBlockKey;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function addSourceBlockWipe(
  wipes: readonly SourceBlockKey[] | undefined,
  key: SourceBlockKey,
): SourceBlockKey[] {
  const next = parseSourceBlockWipes(wipes);
  if (!next.includes(key)) next.push(key);
  return next;
}

export function dropSourceBlockWipe(
  wipes: readonly SourceBlockKey[] | undefined,
  key: SourceBlockKey,
): SourceBlockKey[] {
  return parseSourceBlockWipes(wipes).filter((k) => k !== key);
}

export function sourceBlockWipesSnapshotField(
  wipes: readonly SourceBlockKey[] | undefined,
): { sourceBlockWipes?: SourceBlockKey[] } {
  const next = parseSourceBlockWipes(wipes);
  return next.length > 0 ? { sourceBlockWipes: next } : {};
}

/**
 * Dashboard / pasūtījumu tabulas lauki no melnraksta (bez server-only).
 * Marka/modelis — no CSDD `makeModel`, kad ievadīts.
 */

export function extractCsddMakeModelFromWorkspace(workspace: unknown): string | null {
  if (!workspace || typeof workspace !== "object") return null;
  const blocks = (workspace as { sourceBlocks?: unknown }).sourceBlocks;
  if (!blocks || typeof blocks !== "object") return null;
  const csdd = (blocks as { csdd?: unknown }).csdd;
  if (!csdd || typeof csdd !== "object") return null;
  const raw = (csdd as { makeModel?: unknown }).makeModel;
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return null;
  return t.length > 120 ? `${t.slice(0, 119).trim()}…` : t;
}

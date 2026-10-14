/**
 * K2: apzināti iztukšoti lauki. Saglabāšana „bagātākais uzvar” citādi atjauno izdzēstu tekstu no baseline.
 * `clearedFields` = { lauks: iztukšošanas laiks ms }. Ja ienākošais lauks ir tukšs UN tam ir marķieris — tukšais uzvar.
 * Teksta lauki: "iriss", "apskatesPlāns", "tehniskoRiskuAnalize", "cenasAtbilstiba"; avotu bloki: "block:<key>".
 */
export type ClearedFields = Record<string, number>;

export const CLEARABLE_TEXT_FIELDS = ["iriss", "apskatesPlāns", "tehniskoRiskuAnalize", "cenasAtbilstiba"] as const;

export function parseClearedFields(raw: unknown): ClearedFields {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ClearedFields = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 80 || typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    out[k] = v;
    if (++n >= 200) break;
  }
  return out;
}

export function mergeClearedFields(...all: unknown[]): ClearedFields {
  const out: ClearedFields = {};
  for (const raw of all) {
    for (const [k, v] of Object.entries(parseClearedFields(raw))) out[k] = Math.max(out[k] ?? 0, v);
  }
  return out;
}

export function clearedFieldsSnapshotField(raw: unknown): { clearedFields?: ClearedFields } {
  const c = parseClearedFields(raw);
  return Object.keys(c).length ? { clearedFields: c } : {};
}

export function plainTextLen(v: unknown): number {
  if (typeof v !== "string") return 0;
  return v.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length;
}

/** Vai blokā kāds iepriekš aizpildīts teksta lauks tagad ir tukšs (dziļi; masīvi pēc indeksa). */
export function blockHasClearedText(prev: unknown, next: unknown): boolean {
  if (typeof prev === "string") return plainTextLen(prev) > 0 && plainTextLen(next) === 0;
  if (!prev || typeof prev !== "object") return false;
  if (Array.isArray(prev)) {
    const n = Array.isArray(next) ? next : [];
    // Rinda / sekcija izdzēsta pavisam — arī iztukšošana.
    if (n.length < prev.length && prev.slice(n.length).some((x) => hasAnyText(x))) return true;
    return prev.some((x, i) => blockHasClearedText(x, n[i]));
  }
  const nx = next && typeof next === "object" ? (next as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(prev as Record<string, unknown>)) {
    if (k === "photos" || k === "photoGroups" || k === "coverPhoto") continue;
    if (blockHasClearedText(v, nx[k])) return true;
  }
  return false;
}

function hasAnyText(v: unknown): boolean {
  if (typeof v === "string") return plainTextLen(v) > 0;
  if (Array.isArray(v)) return v.some(hasAnyText);
  if (v && typeof v === "object") return Object.values(v).some(hasAnyText);
  return false;
}

/** Klienta pusē: atjauno marķierus pēc lietotāja labojuma (prev → next). */
export function nextClearedFields(
  prev: { sourceBlocks?: unknown } & Record<string, unknown>,
  next: { sourceBlocks?: unknown } & Record<string, unknown>,
  current: unknown,
  nowMs: number,
): ClearedFields {
  const out = { ...parseClearedFields(current) };
  for (const f of CLEARABLE_TEXT_FIELDS) {
    const a = plainTextLen(prev[f]);
    const b = plainTextLen(next[f]);
    if (a > 0 && b === 0) out[f] = nowMs;
    else if (b > 0) delete out[f];
  }
  const pb = (prev.sourceBlocks ?? {}) as Record<string, unknown>;
  const nb = (next.sourceBlocks ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(pb)) {
    if (blockHasClearedText(pb[key], nb[key])) out[`block:${key}`] = nowMs;
  }
  return out;
}

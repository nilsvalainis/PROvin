/**
 * Sludinājumu piezīmes un favorīti serverī (Nils 29.10: agrāk «saglabājas tikai šajā ierīcē» -
 * telefonā ierakstītais nebija redzams datorā un pazuda, notīrot pārlūku).
 * Glabā tikai īsu tekstu un id - bez auto datiem.
 */

export type IrissListingMarks = { notes: Record<string, string>; fav: string[] };

export const IRISS_LISTING_NOTE_MAX = 2000;
export const IRISS_LISTING_MARKS_MAX = 5000;

const ID_RE = /^[\w:-]{1,120}$/;

export function emptyIrissListingMarks(): IrissListingMarks {
  return { notes: {}, fav: [] };
}

export function parseIrissListingMarks(raw: unknown): IrissListingMarks {
  const out = emptyIrissListingMarks();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { notes?: unknown; fav?: unknown };
  if (r.notes && typeof r.notes === "object") {
    for (const [id, text] of Object.entries(r.notes as Record<string, unknown>)) {
      if (Object.keys(out.notes).length >= IRISS_LISTING_MARKS_MAX) break;
      if (!ID_RE.test(id) || typeof text !== "string" || !text.trim()) continue;
      out.notes[id] = text.slice(0, IRISS_LISTING_NOTE_MAX);
    }
  }
  if (Array.isArray(r.fav)) {
    const seen = new Set<string>();
    for (const id of r.fav) {
      if (typeof id !== "string" || !ID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      out.fav.push(id);
      if (out.fav.length >= IRISS_LISTING_MARKS_MAX) break;
    }
  }
  return out;
}

export type IrissListingMarkPatch = { id: string; note?: string; fav?: boolean };

export function parseIrissListingMarkPatch(raw: unknown): IrissListingMarkPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { id?: unknown; note?: unknown; fav?: unknown };
  if (typeof r.id !== "string" || !ID_RE.test(r.id)) return null;
  const p: IrissListingMarkPatch = { id: r.id };
  if (typeof r.note === "string") p.note = r.note.slice(0, IRISS_LISTING_NOTE_MAX);
  if (typeof r.fav === "boolean") p.fav = r.fav;
  return p.note === undefined && p.fav === undefined ? null : p;
}

/** Viena auto izmaiņa: tukša piezīme dzēš ierakstu; favorīts pievieno / noņem. */
export function applyIrissListingMarkPatch(marks: IrissListingMarks, p: IrissListingMarkPatch): IrissListingMarks {
  const notes = { ...marks.notes };
  let fav = marks.fav;
  if (p.note !== undefined) {
    if (p.note.trim()) notes[p.id] = p.note;
    else delete notes[p.id];
  }
  if (p.fav !== undefined) {
    const has = fav.includes(p.id);
    if (p.fav && !has) fav = [...fav, p.id];
    if (!p.fav && has) fav = fav.filter((x) => x !== p.id);
  }
  return parseIrissListingMarks({ notes, fav });
}

/**
 * Atverot lapu: serveris ir galvenais; lokāli ieraksti, kuru serverī vēl nav (no laika pirms sinhronizācijas),
 * paliek un tiek atgriezti kā `toPush`, lai tos aizsūtītu uz serveri.
 */
export function mergeIrissListingMarks(
  local: { notes: Record<string, string>; fav: string[] },
  server: IrissListingMarks,
): { notes: Record<string, string>; fav: string[]; toPush: IrissListingMarkPatch[] } {
  const notes = { ...server.notes };
  const toPush: IrissListingMarkPatch[] = [];
  for (const [id, text] of Object.entries(local.notes)) {
    if (!text.trim() || notes[id] !== undefined) continue;
    notes[id] = text;
    toPush.push({ id, note: text });
  }
  const fav = [...server.fav];
  for (const id of local.fav) {
    if (fav.includes(id)) continue;
    fav.push(id);
    toPush.push({ id, fav: true });
  }
  return { notes, fav, toPush };
}

/** Ko sūtīt serverim pēc lokālas izmaiņas (salīdzina iepriekšējo un nākamo stāvokli). */
export function diffIrissListingMarks(
  prev: { notes: Record<string, string>; fav: string[] },
  next: { notes: Record<string, string>; fav: string[] },
): IrissListingMarkPatch[] {
  const out: IrissListingMarkPatch[] = [];
  const ids = new Set([...Object.keys(prev.notes), ...Object.keys(next.notes)]);
  for (const id of ids) {
    const a = prev.notes[id] ?? "";
    const b = next.notes[id] ?? "";
    if (a !== b) out.push({ id, note: b });
  }
  for (const id of next.fav) if (!prev.fav.includes(id)) out.push({ id, fav: true });
  for (const id of prev.fav) if (!next.fav.includes(id)) out.push({ id, fav: false });
  return out;
}

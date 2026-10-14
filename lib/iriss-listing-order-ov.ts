/**
 * LIST auto → pasūtījuma saite (`orderOv`). Avots ir serveris, ne localStorage.
 * Vecais localStorage paliek lasāms migrācijai; datus nedzēš.
 */

export type IrissListingOrderOv = Record<string, string[]>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function idList(v: unknown, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string" || !x || seen.has(x)) continue;
    seen.add(x);
    out.push(x.slice(0, 160));
    if (out.length >= max) break;
  }
  return out;
}

export function parseIrissListingOrderOv(raw: unknown, maxEntries = 4000): IrissListingOrderOv {
  if (!isPlainObject(raw)) return {};
  const out: IrissListingOrderOv = {};
  for (const [k, val] of Object.entries(raw)) {
    if (!k) continue;
    const ids = idList(val);
    if (ids.length === 0) continue;
    out[k.slice(0, 160)] = ids;
    if (Object.keys(out).length >= maxEntries) break;
  }
  return out;
}

export function setListingOrderOvLink(ov: IrissListingOrderOv, vehicleId: string, orderId: string | null): IrissListingOrderOv {
  const next = { ...ov };
  const key = vehicleId.slice(0, 160);
  if (!orderId) {
    delete next[key];
    return next;
  }
  next[key] = [orderId.slice(0, 160)];
  return next;
}

/**
 * Serveris ir kanons, ja tajā jau ir saites. Ja serveris tukšs, ņem localStorage.
 * Local kešu nedzēš, kamēr serveris nav apstiprinājis.
 */
export function mergeListingOrderOvMigration(
  server: IrissListingOrderOv,
  local: IrissListingOrderOv,
): { next: IrissListingOrderOv; persistServer: boolean } {
  const serverKeys = Object.keys(server);
  if (serverKeys.length > 0) return { next: server, persistServer: false };
  const localKeys = Object.keys(local);
  if (localKeys.length === 0) return { next: {}, persistServer: false };
  return { next: local, persistServer: true };
}

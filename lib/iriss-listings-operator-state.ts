/**
 * IRISS LIST servera favorīti un noraidījumi. Tīrs modulis (Vitest, bez Blob).
 */

import type { IrissListingVehicle, IrissListingsOperatorState, IrissListingsRejectedEntry } from "@/lib/iriss-listings-types";

const MAX_IDS = 2000;

export const IRISS_LIST_SERVER_IDS_MIGRATED_KEY = "provin-iriss-list-server-ids-v1";

export function emptyIrissListingsOperatorState(): IrissListingsOperatorState {
  return { version: 1, fav: [], rejected: [] };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function idList(v: unknown, max = MAX_IDS): string[] {
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

function snapshotVehicle(v: unknown): IrissListingVehicle | null {
  if (!isObj(v)) return null;
  const id = typeof v.id === "string" ? v.id.trim() : "";
  const platform = typeof v.platform === "string" ? v.platform : "";
  const externalId = typeof v.externalId === "string" ? v.externalId.trim() : "";
  if (!id || !externalId) return null;
  if (platform !== "autobid" && platform !== "openline" && platform !== "auto1") return null;
  return v as IrissListingVehicle;
}

export function parseIrissListingsOperatorState(raw: unknown): IrissListingsOperatorState {
  const base = emptyIrissListingsOperatorState();
  if (!isObj(raw)) return base;
  const fav = idList(raw.fav);
  const rejected: IrissListingsRejectedEntry[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(raw.rejected) ? raw.rejected : [];
  for (const item of list) {
    if (!isObj(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 160) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const rejectedAt = typeof item.rejectedAt === "string" && item.rejectedAt.trim() ? item.rejectedAt : "";
    rejected.push({
      id,
      rejectedAt: rejectedAt || new Date(0).toISOString(),
      vehicle: snapshotVehicle(item.vehicle),
    });
    if (rejected.length >= MAX_IDS) break;
  }
  return { version: 1, fav, rejected };
}

export function operatorRejectedIds(state: IrissListingsOperatorState): Set<string> {
  return new Set(state.rejected.map((r) => r.id));
}

export function withFavorite(state: IrissListingsOperatorState, id: string, fav: boolean): IrissListingsOperatorState {
  const key = id.trim().slice(0, 160);
  if (!key) return state;
  const set = new Set(state.fav);
  if (fav) set.add(key);
  else set.delete(key);
  return { ...state, fav: [...set].slice(0, MAX_IDS) };
}

export function withRejected(
  state: IrissListingsOperatorState,
  id: string,
  rejected: boolean,
  at: string,
  vehicle: IrissListingVehicle | null,
): IrissListingsOperatorState {
  const key = id.trim().slice(0, 160);
  if (!key) return state;
  const rest = state.rejected.filter((r) => r.id !== key);
  if (!rejected) return { ...state, rejected: rest };
  const next: IrissListingsRejectedEntry = {
    id: key,
    rejectedAt: at,
    vehicle: vehicle ?? rest.find((r) => r.id === key)?.vehicle ?? null,
  };
  return { ...state, rejected: [next, ...rest].slice(0, MAX_IDS) };
}

/** Vienreizēja pārlūka hidden/fav savienošana ar serveri. */
export function mergeMigratedClientIds(
  state: IrissListingsOperatorState,
  input: { fav: string[]; hidden: string[]; vehicles?: IrissListingVehicle[]; at: string },
): IrissListingsOperatorState {
  let next = state;
  for (const id of idList(input.fav)) next = withFavorite(next, id, true);
  const byId = new Map((input.vehicles ?? []).map((v) => [v.id, v]));
  for (const id of idList(input.hidden)) {
    next = withRejected(next, id, true, input.at, byId.get(id) ?? null);
  }
  return next;
}

export function filterRejectedVehicles<T extends { id: string }>(vehicles: T[], rejectedIds: Set<string>): T[] {
  if (rejectedIds.size === 0) return vehicles;
  return vehicles.filter((v) => !rejectedIds.has(v.id));
}

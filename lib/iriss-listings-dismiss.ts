/**
 * IRISS LIST ✕ (paslēpt) saglabāšana.
 * Dzīvo atsevišķā `dismissed.json`, ne `latest.json`: sync/relejs pārraksta latest
 * un nedrīkst zaudēt slēpšanu. Atslēga: stabils listing id un/vai platform+externalId.
 */

import { IRISS_LISTING_PLATFORMS, type IrissListingPlatform, type IrissListingVehicle } from "@/lib/iriss-listings-types";

export const IRISS_LISTINGS_DISMISSED_MAX = 10_000;

export type IrissListingDismissedEntry = {
  id: string;
  platform?: IrissListingPlatform;
  externalId?: string;
  at: string;
};

export type IrissListingsDismissedView = {
  version: 1;
  updatedAt: string;
  entries: IrissListingDismissedEntry[];
};

export type IrissListingDismissPatch = {
  hidden: boolean;
  id?: string;
  platform?: string;
  externalId?: string;
};

export type IrissListingDismissKey = Pick<IrissListingVehicle, "id" | "platform" | "externalId">;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isPlatform(v: string): v is IrissListingPlatform {
  return (IRISS_LISTING_PLATFORMS as readonly string[]).includes(v);
}

export function emptyIrissListingsDismissed(): IrissListingsDismissedView {
  return { version: 1, updatedAt: "", entries: [] };
}

export function parseDismissedEntry(v: unknown): IrissListingDismissedEntry | null {
  if (!isObj(v)) return null;
  const id = str(v.id).slice(0, 160);
  const platformRaw = str(v.platform);
  const platform = isPlatform(platformRaw) ? platformRaw : undefined;
  const externalId = str(v.externalId).slice(0, 160) || undefined;
  if (!id && !(platform && externalId)) return null;
  return {
    id,
    ...(platform ? { platform } : {}),
    ...(externalId ? { externalId } : {}),
    at: str(v.at),
  };
}

export function normalizeDismissedView(raw: unknown): IrissListingsDismissedView {
  const empty = emptyIrissListingsDismissed();
  if (!isObj(raw)) return empty;
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(parseDismissedEntry).filter((x): x is IrissListingDismissedEntry => x !== null)
    : [];
  return {
    version: 1,
    updatedAt: str(raw.updatedAt),
    entries: capDismissed(dedupeDismissed(entries)),
  };
}

function capDismissed(entries: IrissListingDismissedEntry[]): IrissListingDismissedEntry[] {
  if (entries.length <= IRISS_LISTINGS_DISMISSED_MAX) return entries;
  return entries.slice(entries.length - IRISS_LISTINGS_DISMISSED_MAX);
}

export function uniqueListingIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const v = id.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function entryMatchesKey(e: IrissListingDismissedEntry, key: { id?: string; platform?: string; externalId?: string }): boolean {
  const id = (key.id ?? "").trim();
  const platform = (key.platform ?? "").trim();
  const externalId = (key.externalId ?? "").trim();
  if (id && e.id && e.id === id) return true;
  if (platform && externalId && e.platform === platform && e.externalId === externalId) return true;
  return false;
}

export function listingIsDismissed(v: IrissListingDismissKey, entries: readonly IrissListingDismissedEntry[]): boolean {
  return entries.some((e) => entryMatchesKey(e, v));
}

/** Id, kas jāslēpj LIST kartītēm: saglabātie id + aktuālie auto, kas sakrīt pēc platform+externalId. */
export function dismissedHiddenIds(
  entries: readonly IrissListingDismissedEntry[],
  vehicles: readonly IrissListingDismissKey[],
): string[] {
  const ids = new Set<string>();
  for (const e of entries) if (e.id) ids.add(e.id);
  for (const v of vehicles) if (listingIsDismissed(v, entries)) ids.add(v.id);
  return [...ids];
}

export function parseDismissPatches(body: unknown): IrissListingDismissPatch[] {
  if (!isObj(body)) return [];
  const rawItems = Array.isArray(body.items) ? body.items : [body];
  const out: IrissListingDismissPatch[] = [];
  for (const item of rawItems) {
    if (!isObj(item) || typeof item.hidden !== "boolean") continue;
    const id = str(item.id).slice(0, 160);
    const platform = str(item.platform);
    const externalId = str(item.externalId).slice(0, 160);
    if (!id && !(isPlatform(platform) && externalId)) continue;
    out.push({
      hidden: item.hidden,
      ...(id ? { id } : {}),
      ...(platform ? { platform } : {}),
      ...(externalId ? { externalId } : {}),
    });
  }
  return out;
}

/**
 * Paslēpt: upsert pēc id vai platform+externalId, laukus papildina, neizmet.
 * Rādīt atkal: izņem visus sakritīgos ierakstus.
 * Sync šo sarakstu neskārās.
 */
export function applyListingDismissPatch(
  entries: readonly IrissListingDismissedEntry[],
  patch: IrissListingDismissPatch,
  at: string,
): IrissListingDismissedEntry[] {
  const next = entries.filter((e) => !entryMatchesKey(e, patch));
  if (patch.hidden !== true) return next;

  const id = (patch.id ?? "").trim().slice(0, 160);
  const platformRaw = (patch.platform ?? "").trim();
  const platform = isPlatform(platformRaw) ? platformRaw : undefined;
  const externalId = (patch.externalId ?? "").trim().slice(0, 160) || undefined;
  if (!id && !(platform && externalId)) return [...entries];

  const prev = entries.find((e) => entryMatchesKey(e, patch));
  const resolvedPlatform = platform ?? prev?.platform;
  const resolvedExternalId = externalId ?? prev?.externalId;
  const entry: IrissListingDismissedEntry = {
    id: id || prev?.id || "",
    at,
    ...(resolvedPlatform ? { platform: resolvedPlatform } : {}),
    ...(resolvedExternalId ? { externalId: resolvedExternalId } : {}),
  };
  return capDismissed(dedupeDismissed([...next, entry]));
}

export function applyListingDismissPatches(
  entries: readonly IrissListingDismissedEntry[],
  patches: readonly IrissListingDismissPatch[],
  at: string,
): IrissListingDismissedEntry[] {
  let next = [...entries];
  for (const patch of patches) next = applyListingDismissPatch(next, patch, at);
  return next;
}

function dedupeDismissed(entries: IrissListingDismissedEntry[]): IrissListingDismissedEntry[] {
  const out: IrissListingDismissedEntry[] = [];
  for (const e of entries) {
    const idx = out.findIndex((x) => entryMatchesKey(x, e) || (e.id && x.id === e.id));
    if (idx >= 0) {
      const prev = out[idx];
      const platform = e.platform ?? prev.platform;
      const externalId = e.externalId ?? prev.externalId;
      out[idx] = {
        id: e.id || prev.id,
        at: e.at || prev.at,
        ...(platform ? { platform } : {}),
        ...(externalId ? { externalId } : {}),
      };
      continue;
    }
    out.push(e);
  }
  return out;
}

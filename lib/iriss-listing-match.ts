/**
 * IRISS auto atbilstība: jau nolasītie sludinājumi pret aktīvo pasūtījumu
 * meklēšanas kritērijiem (tas pats filtrs, ko lieto klientu filtri).
 * Šis modulis neko neielādē no maksas avotiem un neizsauc sync.
 */

import { isIrissScanOrderId } from "@/lib/iriss-scan-listings";
import {
  ingestFilterForListingSource,
  listingSearchFilterHasBounds,
  vehicleMatchesSearchFilter,
  type ListingSearchVehicle,
} from "@/lib/iriss-listings-search-filter";
import { buildIrissListingSources } from "@/lib/iriss-listings-sources";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";
import { isIrissPasutijumsWorkingStatus, type IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";
import {
  isIrissListingHitStatus,
  irissListingMatchKey,
  type IrissListingHitStatus,
  type IrissListingMatchNotice,
} from "@/lib/iriss-listing-match-client";

export {
  IRISS_LISTING_HIT_STATUSES,
  IRISS_LISTING_HIT_STATUS_LV,
  isIrissListingHitStatus,
  irissListingMatchKey,
  type IrissListingHitStatus,
  type IrissListingMatchNotice,
} from "@/lib/iriss-listing-match-client";

export const IRISS_LISTING_MATCH_MAX = 8_000;

export type IrissListingMatchEntry = {
  orderId: string;
  listingId: string;
  matchedAt: string;
  status: IrissListingHitStatus;
  statusAt: string;
};

export type IrissListingMatchState = {
  version: 1;
  updatedAt: string;
  seeded: boolean;
  unseenCount: number;
  entries: IrissListingMatchEntry[];
};

export type IrissListingMatchVehicle = ListingSearchVehicle & {
  id: string;
  platform: IrissListingPlatform;
  orderIds?: readonly string[];
  change?: string;
  title?: string;
};

export type IrissListingMatchOrder = {
  id: string;
  brandModel: string;
  listStatus?: IrissPasutijumsListStatus | string | null;
  deletedAt?: string | null;
  clientFirstName?: string;
  clientLastName?: string;
  listingLinkAutobid?: unknown;
  listingLinkOpenline?: unknown;
  listingLinkAuto1?: unknown;
  listingLinkEcarstrade?: unknown;
  listingLinksOther?: unknown;
};

export type IrissListingMatchPatch = {
  listingId: string;
  orderId?: string;
  status: IrissListingHitStatus;
  /** Maina tikai rindas, kurām statuss jau ir šis. Neatceļ Interesants / Piedāvāts. */
  onlyIf?: IrissListingHitStatus;
};

export function emptyIrissListingMatchState(): IrissListingMatchState {
  return { version: 1, updatedAt: "", seeded: false, unseenCount: 0, entries: [] };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function parseIrissListingMatchEntry(v: unknown): IrissListingMatchEntry | null {
  if (!isObj(v)) return null;
  const orderId = str(v.orderId);
  const listingId = str(v.listingId);
  const status = str(v.status, 40);
  if (!orderId || !listingId || !isIrissListingHitStatus(status)) return null;
  return {
    orderId,
    listingId,
    matchedAt: str(v.matchedAt, 40),
    status,
    statusAt: str(v.statusAt, 40),
  };
}

export function normalizeIrissListingMatchState(raw: unknown): IrissListingMatchState {
  const empty = emptyIrissListingMatchState();
  if (!isObj(raw)) return empty;
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(parseIrissListingMatchEntry).filter((x): x is IrissListingMatchEntry => x !== null)
    : [];
  const seeded = raw.seeded === true;
  const unseenRaw = typeof raw.unseenCount === "number" && Number.isFinite(raw.unseenCount) ? Math.max(0, Math.floor(raw.unseenCount)) : 0;
  return {
    version: 1,
    updatedAt: str(raw.updatedAt, 40),
    seeded,
    unseenCount: seeded ? unseenRaw : countUnseenListingMatches(entries),
    entries: capMatchEntries(dedupeMatchEntries(entries)),
  };
}

function dedupeMatchEntries(entries: readonly IrissListingMatchEntry[]): IrissListingMatchEntry[] {
  const map = new Map<string, IrissListingMatchEntry>();
  for (const e of entries) map.set(irissListingMatchKey(e.orderId, e.listingId), e);
  return [...map.values()];
}

function capMatchEntries(entries: IrissListingMatchEntry[]): IrissListingMatchEntry[] {
  if (entries.length <= IRISS_LISTING_MATCH_MAX) return entries;
  const fresh = entries.filter((e) => e.status === "jauns");
  const rest = entries.filter((e) => e.status !== "jauns");
  const room = Math.max(0, IRISS_LISTING_MATCH_MAX - fresh.length);
  return [...rest.slice(rest.length - room), ...fresh].slice(-IRISS_LISTING_MATCH_MAX);
}

export function countUnseenListingMatches(
  entries: readonly IrissListingMatchEntry[],
  liveListingIds?: ReadonlySet<string> | null,
  activeOrderIds?: ReadonlySet<string> | null,
): number {
  let n = 0;
  for (const e of entries) {
    if (e.status !== "jauns") continue;
    if (liveListingIds && !liveListingIds.has(e.listingId)) continue;
    if (activeOrderIds && !activeOrderIds.has(e.orderId)) continue;
    n += 1;
  }
  return n;
}

function activeMatchOrders(orders: readonly IrissListingMatchOrder[]): IrissListingMatchOrder[] {
  return orders.filter((o) => {
    const id = (o.id ?? "").trim();
    if (!id || isIrissScanOrderId(id)) return false;
    if ((o.deletedAt ?? "").trim()) return false;
    return isIrissPasutijumsWorkingStatus((o.listStatus ?? "active") as IrissPasutijumsListStatus);
  });
}

/**
 * Sludinājums atbilst pasūtījumam, ja tas jau piesaistīts ingestā
 * vai iziet to pašu klientu filtra kritēriju (platforma + gads, cena, marka).
 * Tukšs meklējums (bez robežām) nepieskaita visu inventāru.
 */
export function discoverListingOrderMatches(
  vehicles: readonly IrissListingMatchVehicle[],
  orders: readonly IrissListingMatchOrder[],
): Array<{ orderId: string; listingId: string }> {
  const active = activeMatchOrders(orders);
  const sources = buildIrissListingSources(
    active.map((o) => ({
      id: o.id,
      brandModel: o.brandModel,
      listStatus: (o.listStatus ?? "active") as IrissPasutijumsListStatus,
      deletedAt: (o.deletedAt ?? "").trim() || undefined,
      listingLinkAutobid: o.listingLinkAutobid,
      listingLinkOpenline: o.listingLinkOpenline,
      listingLinkAuto1: o.listingLinkAuto1,
      listingLinkEcarstrade: o.listingLinkEcarstrade,
      listingLinksOther: o.listingLinksOther,
    })),
  );
  const byOrder = new Map<string, typeof sources>();
  for (const src of sources) {
    const list = byOrder.get(src.orderId) ?? [];
    list.push(src);
    byOrder.set(src.orderId, list);
  }
  // Filtrs atkarīgs tikai no avota; URL parsēšana ~0,5 ms, tāpēc to nedrīkst atkārtot katram sludinājumam.
  const boundedFilterBySource = new Map<(typeof sources)[number], ReturnType<typeof ingestFilterForListingSource> | null>();
  const boundedFilterFor = (src: (typeof sources)[number]) => {
    if (boundedFilterBySource.has(src)) return boundedFilterBySource.get(src)!;
    const filter = ingestFilterForListingSource(src.platform, src.sourceUrl, src.orderBrandModel);
    const bounded = listingSearchFilterHasBounds(filter) ? filter : null;
    boundedFilterBySource.set(src, bounded);
    return bounded;
  };
  const out: Array<{ orderId: string; listingId: string }> = [];
  const seen = new Set<string>();
  for (const vehicle of vehicles) {
    const listingId = vehicle.id.trim();
    if (!listingId || vehicle.change === "gone") continue;
    const linked = new Set((vehicle.orderIds ?? []).map((id) => id.trim()).filter(Boolean));
    for (const [orderId, orderSources] of byOrder) {
      const already = linked.has(orderId);
      const criteria = orderSources.some((src) => {
        if (src.platform !== vehicle.platform) return false;
        const filter = boundedFilterFor(src);
        return filter ? vehicleMatchesSearchFilter(vehicle, filter) : false;
      });
      if (!already && !criteria) continue;
      const key = irissListingMatchKey(orderId, listingId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ orderId, listingId });
    }
  }
  return out;
}

export function mergeListingOrderMatches(
  previous: IrissListingMatchState,
  found: readonly { orderId: string; listingId: string }[],
  nowIso: string,
  liveListingIds?: ReadonlySet<string> | null,
  activeOrderIds?: ReadonlySet<string> | null,
): IrissListingMatchState {
  const prev = normalizeIrissListingMatchState(previous);
  if (!prev.seeded && found.length === 0) return prev;
  const seed = !prev.seeded;
  const prevByKey = new Map(prev.entries.map((e) => [irissListingMatchKey(e.orderId, e.listingId), e]));
  const next: IrissListingMatchEntry[] = [];
  const seen = new Set<string>();
  for (const hit of found) {
    const key = irissListingMatchKey(hit.orderId, hit.listingId);
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = prevByKey.get(key);
    if (existing) {
      next.push(existing);
      continue;
    }
    const status: IrissListingHitStatus = seed ? "skatits" : "jauns";
    next.push({
      orderId: hit.orderId,
      listingId: hit.listingId,
      matchedAt: nowIso,
      status,
      statusAt: nowIso,
    });
  }
  for (const old of prev.entries) {
    const key = irissListingMatchKey(old.orderId, old.listingId);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(old);
  }
  const entries = capMatchEntries(next);
  return {
    version: 1,
    updatedAt: nowIso,
    seeded: true,
    unseenCount: countUnseenListingMatches(entries, liveListingIds, activeOrderIds),
    entries,
  };
}

export function listingMatchStateUnchanged(a: IrissListingMatchState, b: IrissListingMatchState): boolean {
  if (a.seeded !== b.seeded || a.unseenCount !== b.unseenCount || a.entries.length !== b.entries.length) return false;
  const left = new Map(a.entries.map((e) => [irissListingMatchKey(e.orderId, e.listingId), e]));
  for (const e of b.entries) {
    const prev = left.get(irissListingMatchKey(e.orderId, e.listingId));
    if (!prev || prev.status !== e.status || prev.matchedAt !== e.matchedAt || prev.statusAt !== e.statusAt) return false;
  }
  return true;
}

export function applyListingMatchStatusPatches(
  entries: readonly IrissListingMatchEntry[],
  patches: readonly IrissListingMatchPatch[],
  nowIso: string,
): IrissListingMatchEntry[] {
  const next = dedupeMatchEntries(entries).map((e) => ({ ...e }));
  const index = new Map(next.map((e, i) => [irissListingMatchKey(e.orderId, e.listingId), i]));
  for (const patch of patches) {
    const listingId = patch.listingId.trim();
    const status = patch.status;
    if (!listingId || !isIrissListingHitStatus(status)) continue;
    const orderId = patch.orderId?.trim() ?? "";
    if (orderId) {
      const key = irissListingMatchKey(orderId, listingId);
      const at = index.get(key);
      if (at == null) {
        if (patch.onlyIf) continue;
        next.push({ orderId, listingId, matchedAt: nowIso, status, statusAt: nowIso });
        index.set(key, next.length - 1);
        continue;
      }
      const row = next[at]!;
      if (patch.onlyIf && row.status !== patch.onlyIf) continue;
      if (row.status === status) continue;
      next[at] = { ...row, status, statusAt: nowIso };
      continue;
    }
    for (let i = 0; i < next.length; i += 1) {
      const row = next[i]!;
      if (row.listingId !== listingId) continue;
      if (patch.onlyIf && row.status !== patch.onlyIf) continue;
      if (row.status === status) continue;
      next[i] = { ...row, status, statusAt: nowIso };
    }
  }
  return capMatchEntries(next);
}

export function nextUnseenCount(prevCount: number, before: readonly IrissListingMatchEntry[], after: readonly IrissListingMatchEntry[]): number {
  const was = before.filter((e) => e.status === "jauns").length;
  const now = after.filter((e) => e.status === "jauns").length;
  return Math.max(0, prevCount + (now - was));
}

export function parseListingMatchPatches(body: unknown): IrissListingMatchPatch[] {
  if (!isObj(body)) return [];
  const rawItems = Array.isArray(body.items) ? body.items : [body];
  const out: IrissListingMatchPatch[] = [];
  for (const raw of rawItems) {
    if (!isObj(raw)) continue;
    const listingId = str(raw.listingId);
    const status = str(raw.status, 40);
    if (!listingId || !isIrissListingHitStatus(status)) continue;
    const orderId = str(raw.orderId);
    const onlyIf = str(raw.onlyIf, 40);
    out.push({
      listingId,
      ...(orderId ? { orderId } : {}),
      status,
      ...(isIrissListingHitStatus(onlyIf) ? { onlyIf } : {}),
    });
    if (out.length >= 200) break;
  }
  return out;
}

export function listingHitStatusMap(entries: readonly IrissListingMatchEntry[], orderId: string): Record<string, IrissListingHitStatus> {
  const out: Record<string, IrissListingHitStatus> = {};
  for (const e of entries) {
    if (e.orderId !== orderId) continue;
    out[e.listingId] = e.status;
  }
  return out;
}

export function listingMatchOrderIdsByListing(entries: readonly IrissListingMatchEntry[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of entries) {
    const list = out[e.listingId] ?? [];
    if (!list.includes(e.orderId)) list.push(e.orderId);
    out[e.listingId] = list;
  }
  return out;
}

function clientLabel(order: IrissListingMatchOrder): string {
  const name = [order.clientFirstName ?? "", order.clientLastName ?? ""].map((s) => s.trim()).filter(Boolean).join(" ");
  const brand = (order.brandModel ?? "").trim();
  return name || brand || "Klients";
}

export function buildIrissListingMatchNotices(
  entries: readonly IrissListingMatchEntry[],
  vehicles: readonly { id: string; title?: string; platform?: string; change?: string }[],
  orders: readonly IrissListingMatchOrder[],
  limit = 20,
): IrissListingMatchNotice[] {
  const live = new Set(vehicles.filter((v) => v.id && v.change !== "gone").map((v) => v.id));
  const byVehicle = new Map(vehicles.map((v) => [v.id, v]));
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  const active = new Set(activeMatchOrders(orders).map((o) => o.id));
  const notices: IrissListingMatchNotice[] = [];
  const sorted = [...entries].sort((a, b) => b.matchedAt.localeCompare(a.matchedAt) || a.listingId.localeCompare(b.listingId));
  for (const e of sorted) {
    if (e.status !== "jauns") continue;
    if (!live.has(e.listingId) || !active.has(e.orderId)) continue;
    const vehicle = byVehicle.get(e.listingId);
    const order = byOrder.get(e.orderId);
    const platform = (vehicle?.platform ?? "") as IrissListingPlatform;
    notices.push({
      orderId: e.orderId,
      listingId: e.listingId,
      title: (vehicle?.title ?? "").trim() || "Sludinājums",
      clientName: order ? clientLabel(order) : "Klients",
      platform: IRISS_LISTING_PLATFORM_LABEL[platform] ?? platform,
      href: `/admin/iriss/pasutijumi/${encodeURIComponent(e.orderId)}?room=search`,
      matchedAt: e.matchedAt,
    });
    if (notices.length >= limit) break;
  }
  return notices;
}

export function extraListingIdsForOrder(entries: readonly IrissListingMatchEntry[], orderId: string): Set<string> {
  const ids = new Set<string>();
  for (const e of entries) if (e.orderId === orderId) ids.add(e.listingId);
  return ids;
}

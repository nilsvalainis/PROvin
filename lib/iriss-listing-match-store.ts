import "server-only";

import {
  applyListingMatchStatusPatches,
  buildIrissListingMatchNotices,
  discoverListingOrderMatches,
  emptyIrissListingMatchState,
  extraListingIdsForOrder,
  listingHitStatusMap,
  listingMatchOrderIdsByListing,
  listingMatchStateUnchanged,
  mergeListingOrderMatches,
  nextUnseenCount,
  normalizeIrissListingMatchState,
  type IrissListingHitStatus,
  type IrissListingMatchNotice,
  type IrissListingMatchOrder,
  type IrissListingMatchPatch,
  type IrissListingMatchState,
  type IrissListingMatchVehicle,
} from "@/lib/iriss-listing-match";
import { duplicateMapForListings, type IrissVinDuplicateLink } from "@/lib/iriss-vin-duplicates";
import { listIrissVinAnchors } from "@/lib/iriss-vin-anchor-store";
import {
  getIrissListingsStorageState,
  IRISS_LISTINGS_READ_CACHE_TTL_MS,
  readIrissListingMatchState,
  subscribeIrissListingsLatestCacheInvalidate,
  writeIrissListingMatchState,
} from "@/lib/iriss-listings-aggregate-store";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { isIrissPasutijumsWorkingStatus, type IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

export async function loadIrissListingMatchState(): Promise<IrissListingMatchState> {
  const storage = getIrissListingsStorageState();
  if (!storage.enabled) return emptyIrissListingMatchState();
  return readIrissListingMatchState();
}

/**
 * Salīdzina jau saglabātos sludinājumus ar aktīvo pasūtījumu kritērijiem.
 * Nelasa maksas avotus un neizsauc sync.
 */
export async function refreshIrissListingMatches(input?: {
  vehicles?: readonly IrissListingMatchVehicle[];
  now?: string;
}): Promise<IrissListingMatchState> {
  const storage = getIrissListingsStorageState();
  if (!storage.enabled) return emptyIrissListingMatchState();
  const now = input?.now ?? new Date().toISOString();
  const vehicles =
    input?.vehicles ??
    ((await readIrissListingsLatestViewWithMarketplace().catch(() => null))?.vehicles ?? []);
  const previous = await readIrissListingMatchState();
  if (vehicles.length === 0 && !previous.seeded) return previous;
  const orders = await listIrissPasutijumi().catch(() => []);
  const matchOrders: IrissListingMatchOrder[] = orders.map((row) => ({
    id: row.id,
    brandModel: row.brandModel,
    listStatus: row.listStatus,
    deletedAt: row.deletedAt,
    clientFirstName: row.clientFirstName,
    clientLastName: row.clientLastName,
    listingLinkAutobid: row.listingLinkAutobid,
    listingLinkOpenline: row.listingLinkOpenline,
    listingLinkAuto1: row.listingLinkAuto1,
    listingLinkEcarstrade: row.listingLinkEcarstrade,
    listingLinksOther: row.listingLinksOther,
    productionYears: row.productionYears,
    maxMileage: row.maxMileage,
    totalBudget: row.totalBudget,
    engineType: row.engineType,
    transmission: row.transmission,
    powerKw: row.powerKwLabel,
  }));
  const found = discoverListingOrderMatches(vehicles, matchOrders);
  const live = new Set(vehicles.filter((v) => v.id && v.change !== "gone").map((v) => v.id));
  const active = new Set(
    matchOrders
      .filter((o) => isIrissPasutijumsWorkingStatus((o.listStatus ?? "active") as IrissPasutijumsListStatus) && !(o.deletedAt ?? "").trim())
      .map((o) => o.id),
  );
  const next = mergeListingOrderMatches(previous, found, now, live, active);
  if (listingMatchStateUnchanged(previous, next)) return previous;
  const write = await writeIrissListingMatchState(next);
  return write.ok ? normalizeIrissListingMatchState(next) : previous;
}

export type IrissListingMatchWorkspace = {
  state: IrissListingMatchState;
  notices: IrissListingMatchNotice[];
  orderIdsByListing: Record<string, string[]>;
  duplicatesByListing: Record<string, IrissVinDuplicateLink[]>;
};

type WorkspaceCache = { at: number; key: string; value: IrissListingMatchWorkspace };

let workspaceGen = 0;
let workspaceCache: WorkspaceCache | null = null;
let workspaceInflight: { key: string; promise: Promise<IrissListingMatchWorkspace> } | null = null;

function invalidateIrissListingMatchWorkspaceCache(): void {
  workspaceGen += 1;
  workspaceCache = null;
  workspaceInflight = null;
}

subscribeIrissListingsLatestCacheInvalidate(() => {
  invalidateIrissListingMatchWorkspaceCache();
});

function workspaceCacheKey(
  vehicles: readonly IrissListingMatchVehicle[],
  orders: readonly IrissListingMatchOrder[],
): string {
  let h = 2166136261;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  };
  mix(String(vehicles.length));
  for (const vehicle of vehicles) mix(`|${vehicle.id}:${vehicle.change ?? ""}:${vehicle.priceCurrent ?? ""}`);
  mix("#");
  mix(String(orders.length));
  for (const order of orders) mix(`|${order.id}:${order.listStatus ?? ""}`);
  return (h >>> 0).toString(36);
}

function workspaceCacheFresh(entry: WorkspaceCache, key: string): boolean {
  return entry.key === key && IRISS_LISTINGS_READ_CACHE_TTL_MS > 0 && Date.now() - entry.at < IRISS_LISTINGS_READ_CACHE_TTL_MS;
}

/** Atjauno atbilstības no keša un sagatavo žetonus. Maksas avotus nelasa. */
export async function prepareIrissListingMatchWorkspace(
  vehicles: readonly IrissListingMatchVehicle[],
  orders: readonly IrissListingMatchOrder[],
): Promise<IrissListingMatchWorkspace> {
  const key = workspaceCacheKey(vehicles, orders);
  if (workspaceCache && workspaceCacheFresh(workspaceCache, key)) return workspaceCache.value;
  if (workspaceInflight?.key === key) return workspaceInflight.promise;
  const gen = workspaceGen;
  const promise = (async () => {
    const state = await refreshIrissListingMatches({ vehicles });
    const anchors = await listIrissVinAnchors().catch(() => []);
    const value: IrissListingMatchWorkspace = {
      state,
      notices: buildIrissListingMatchNotices(state.entries, vehicles, orders),
      orderIdsByListing: listingMatchOrderIdsByListing(state.entries, vehicles, orders),
      duplicatesByListing: duplicateMapForListings(vehicles, anchors),
    };
    if (gen === workspaceGen && IRISS_LISTINGS_READ_CACHE_TTL_MS > 0) {
      workspaceCache = { at: Date.now(), key, value };
    }
    return value;
  })().finally(() => {
    if (workspaceInflight?.promise === promise) workspaceInflight = null;
  });
  workspaceInflight = { key, promise };
  return promise;
}

export function orderRoomMatchProps(
  state: IrissListingMatchState,
  orderId: string,
  duplicatesByListing: Record<string, IrissVinDuplicateLink[]>,
): { extraListingIds: string[]; hitStatus: Record<string, IrissListingHitStatus>; duplicates: Record<string, IrissVinDuplicateLink[]> } {
  const extra = extraListingIdsForOrder(state.entries, orderId);
  const hitStatus = listingHitStatusMap(state.entries, orderId);
  const duplicates: Record<string, IrissVinDuplicateLink[]> = {};
  for (const id of Object.keys(duplicatesByListing)) {
    const links = duplicatesByListing[id]?.filter((link) => !(link.kind === "order" && link.orderId === orderId)) ?? [];
    if (links.length > 0) duplicates[id] = links;
  }
  return { extraListingIds: [...extra], hitStatus, duplicates };
}

export async function patchIrissListingMatchStatus(
  patches: readonly IrissListingMatchPatch[],
  nowIso: string,
  history?: { by?: string; action?: "save" | "restore" },
): Promise<IrissListingMatchState | null> {
  const storage = getIrissListingsStorageState();
  if (!storage.enabled) return null;
  const previous = await readIrissListingMatchState();
  const entries = applyListingMatchStatusPatches(previous.entries, patches, nowIso);
  const next: IrissListingMatchState = {
    ...previous,
    updatedAt: nowIso,
    seeded: previous.seeded || entries.length > 0,
    entries,
    unseenCount: nextUnseenCount(previous.unseenCount, previous.entries, entries),
  };
  const write = await writeIrissListingMatchState(next);
  if (!write.ok) return null;
  invalidateIrissListingMatchWorkspaceCache();
  await rememberListingStatusHistory(previous.entries, next.entries, history).catch((e) => {
    console.error("[change-history]", e instanceof Error ? e.message : e);
  });
  return next;
}

async function rememberListingStatusHistory(
  before: readonly { orderId: string; listingId: string; status: string }[],
  after: readonly { orderId: string; listingId: string; status: string }[],
  history?: { by?: string; action?: "save" | "restore" },
): Promise<void> {
  const { diffAdminChangeFields, listingHistoryRecordId, snapshotListingStatus } = await import("@/lib/admin-change-history");
  const { ADMIN_SEARCH_OPERATOR_TENANT } = await import("@/lib/admin-global-search");
  const { recordAdminChangeHistory } = await import("@/lib/admin-change-history-store");
  const { adminActorLabel } = await import("@/lib/admin-auth");
  const prev = new Map(before.map((row) => [`${row.orderId}|${row.listingId}`, row.status]));
  for (const row of after) {
    const was = prev.get(`${row.orderId}|${row.listingId}`);
    if (was == null || was === row.status) continue;
    const left = snapshotListingStatus(was);
    const right = snapshotListingStatus(row.status);
    if (diffAdminChangeFields(left, right).length === 0) continue;
    const recordId = listingHistoryRecordId(row.orderId, row.listingId);
    await recordAdminChangeHistory({
      kind: "iriss-listing",
      recordId,
      tenantId: ADMIN_SEARCH_OPERATOR_TENANT,
      before: left,
      after: right,
      by: history?.by || adminActorLabel(),
      action: history?.action ?? "save",
    });
  }
}

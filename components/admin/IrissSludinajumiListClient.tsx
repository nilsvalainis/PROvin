"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IrissListDrawer } from "@/components/admin/IrissListDrawer";
import { IrissListingOrderPreview } from "@/components/admin/IrissListingOrderPreview";
import { IrissListingVehicleCard } from "@/components/admin/IrissListingVehicleCard";
import { IrissNewMatchNotice } from "@/components/admin/IrissNewMatchNotice";
import { IrissListingVirtualList } from "@/components/admin/IrissListingVirtualList";
import { IrissSludinajumiActivePills } from "@/components/admin/iriss-sludinajumi/IrissSludinajumiActivePills";
import { IrissSludinajumiCostsPanel } from "@/components/admin/iriss-sludinajumi/IrissSludinajumiCostsPanel";
import { IrissSludinajumiFiltersForm } from "@/components/admin/iriss-sludinajumi/IrissSludinajumiFiltersForm";
import { IrissSludinajumiMoreMenu } from "@/components/admin/iriss-sludinajumi/IrissSludinajumiMoreMenu";
import { IrissSludinajumiScrimPanel } from "@/components/admin/iriss-sludinajumi/IrissSludinajumiOverlay";
import { IrissSludinajumiSourceStatusBody } from "@/components/admin/iriss-sludinajumi/IrissSludinajumiSourceStatusPanel";
import "@/components/admin/iriss-sludinajumi/iriss-slud.css";
import { useAdminMobileViewport } from "@/components/admin/useAdminMobileViewport";
import { type ListingVinOcrPatch } from "@/hooks/useListingVinOcr";
import { useMobilePlatform } from "@/hooks/useMobilePlatform";
import { ArrowUpDown, Car, LayoutGrid, List, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import {
  AdminMobileChips,
  AdminMobileRoundBtn,
  AdminMobileSearchField,
  AdminMobileSegments,
  AdminMobileSheet,
  AdminMobileTopBar,
} from "@/components/admin/mobile/AdminMobileChrome";
import { isRealListingPriceChange } from "@/lib/iriss-listings-auto1-cents";
import { listingBidPrice, listingExtrasI, listingMaxBid, type ListingCostParts } from "@/lib/iriss-listings-cost";
import { listingExcludedForMissingPrice, listingIsOverBudgetHidden, parseOverBudgetThreshold } from "@/lib/iriss-listings-over-budget";
import { listingHasHardTechDamage } from "@/lib/iriss-listings-damage";
import {
  applyListingListQuery,
  countActiveListingFilters,
  LISTING_DEFAULT_SORT,
  LISTING_SORTS,
  LISTING_SOURCE_CHIPS,
  listingFilterPills,
  type ListingFilterPillId,
  type ListingSort,
  parseListingSort,
  parseListingSources,
  parseListingView,
  parsePriceBound,
  sortListingVehicles,
  vehicleInPriceRange,
  vehicleInSources,
} from "@/lib/iriss-listings-list-view";
import { listingFmtClock, listingFmtDateTime, LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-panel";
import {
  listingBudgetForVehicle,
  listingClientMatchRows,
  listingLinkedOrders,
  listingOrdersById,
  listingVehicleOrderIds,
  parseListingOrderFilter,
  buildListingClientOptions,
  serializeListingOrderFilter,
  vehicleMatchesOrderFilter,
  type IrissListingOrderBrief,
} from "@/lib/iriss-listings-orders";
import { irissListingMatchKey, type IrissListingHitStatus, type IrissListingMatchNotice } from "@/lib/iriss-listing-match-client";
import { mergeListingOrderOvMigration } from "@/lib/iriss-listing-order-ov";
import type { IrissVinDuplicateLink } from "@/lib/iriss-vin-duplicates";
import { irissPasutijumsOfferSeedFromListing } from "@/lib/iriss-pasutijums-from-listing";
import { irissScanSeedFromListing } from "@/lib/iriss-scan-from-listing";
import { isIrissPasutijumsWorkingStatus } from "@/lib/iriss-pasutijumi-types";
import { type IrissListingDataset, vehicleInListingDataset } from "@/lib/iriss-scan-listings";
import { irissListingPlatformIngestStats } from "@/lib/iriss-listings-ingest-stats";
import { nextIrissListingsAutomaticReadLabel } from "@/lib/iriss-listings-schedule";
import {
  dismissedHiddenIds,
  uniqueListingIds,
  type IrissListingDismissedEntry,
  type IrissListingDismissPatch,
} from "@/lib/iriss-listings-dismiss";
import {
  defaultIrissListPrefs,
  irissListBrowserStorage,
  listingCostsFor,
  migrateIrissListPrefs,
  persistIrissListPrefs,
  type IrissListPrefs,
  type IrissListTab,
} from "@/lib/iriss-listings-operator-prefs";
import {
  computeListingVatHealth,
  listingTaxCostArgs,
  listingTaxResolved,
  type ListingTax,
} from "@/lib/iriss-listings-vat";
import {
  type IrissListingPlatform,
  type IrissListingVehicle,
  type IrissListingsLatestView,
  type IrissPlatformHealthReport,
} from "@/lib/iriss-listings-types";

const PLATFORM_LABEL_LONG: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
  ecarstrade: "eCarsTrade",
  mobilede: "mobile.de",
  autoscout24: "AutoScout24",
};

/** „Jauns” un „cena mainīta” rāda pēc laika loga, ne tikai pēdējās palaišanas, lai atkārtots „Nolasīt tagad” tos neizdzēš. */
const RECENT_WINDOW_HOURS = 36;

type Tab = IrissListTab;

function fmtEur(n: number | null): string {
  if (n === null) return "";
  return `${Math.round(n).toLocaleString("lv-LV")} €`;
}

function hoursSince(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (nowMs - t) / 36e5;
}

function isNew(v: IrissListingVehicle, nowMs: number | null): boolean {
  if (nowMs == null) return false;
  return v.change !== "gone" && hoursSince(v.firstSeenAt, nowMs) <= RECENT_WINDOW_HOURS;
}

function recentPriceChanges(v: IrissListingVehicle, nowMs: number | null): IrissListingVehicle["priceHistory"] {
  if (nowMs == null) return [];
  return v.priceHistory.filter((c) => isRealListingPriceChange(c) && hoursSince(c.at, nowMs) <= RECENT_WINDOW_HOURS);
}

function taxOf(v: IrissListingVehicle, prefs: IrissListPrefs): ListingTax {
  return listingTaxResolved(v, prefs.taxOv[v.id]);
}

function extrasOf(v: IrissListingVehicle, prefs: IrissListPrefs): number {
  return listingExtrasI(listingCostsFor(prefs, v.id));
}

function effectiveListingOrderIds(
  v: Pick<IrissListingVehicle, "id" | "orderIds">,
  prefs: IrissListPrefs,
  extra: Record<string, string[]>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...listingVehicleOrderIds(v.id, v.orderIds, prefs.orderOv), ...(extra[v.id] ?? [])]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function linkedOrdersOf(
  v: Pick<IrissListingVehicle, "id" | "orderIds">,
  prefs: IrissListPrefs,
  byId: ReadonlyMap<string, IrissListingOrderBrief>,
  extra: Record<string, string[]>,
): IrissListingOrderBrief[] {
  return listingLinkedOrders(effectiveListingOrderIds(v, prefs, extra), byId);
}

function displayLinkedOf(
  v: Pick<IrissListingVehicle, "id" | "orderIds">,
  prefs: IrissListPrefs,
  byId: ReadonlyMap<string, IrissListingOrderBrief>,
  extra: Record<string, string[]>,
  dataset: IrissListingDataset,
): IrissListingOrderBrief[] {
  return listingClientMatchRows(linkedOrdersOf(v, prefs, byId, extra), dataset);
}

function budgetOf(
  v: Pick<IrissListingVehicle, "id" | "orderIds">,
  prefs: IrissListPrefs,
  byId: ReadonlyMap<string, IrissListingOrderBrief>,
  extra: Record<string, string[]>,
): number | null {
  return listingBudgetForVehicle(null, linkedOrdersOf(v, prefs, byId, extra));
}

function roomOf(v: IrissListingVehicle, prefs: IrissListPrefs, budget: number | null): number | null {
  if (budget == null) return null;
  const bid = listingBidPrice(v);
  if (bid == null) return null;
  const args = listingTaxCostArgs(taxOf(v, prefs));
  return listingMaxBid(args.kind, args.foreignVatPct, budget, extrasOf(v, prefs)) - bid;
}

function useListingGridColumns(): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(min-width: 1280px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => (window.matchMedia("(min-width: 1280px)").matches ? 4 : 3),
    () => 3,
  );
}

type Props = {
  latest: IrissListingsLatestView | null;
  orders: IrissListingOrderBrief[];
  /** SCAN ieraksti kā „pasūtījumi” ar `scan:` id. */
  scanOrders?: IrissListingOrderBrief[];
  /** Servera `dismissed.json`: paliek pēc refresh, citā ierīcē un pēc sync. */
  dismissed?: IrissListingDismissedEntry[];
  initialOrderOv?: Record<string, string[]>;
  matchNotices?: IrissListingMatchNotice[];
  matchOrderIds?: Record<string, string[]>;
  matchStatus?: Record<string, IrissListingHitStatus>;
  duplicatesByListing?: Record<string, IrissVinDuplicateLink[]>;
};

const DATASET_STORAGE_KEY = "iriss-list-dataset";

async function persistListingDismissItems(items: IrissListingDismissPatch[]): Promise<void> {
  if (items.length === 0) return;
  try {
    await fetch("/api/admin/iriss-listings/dismiss", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch {
    /* localStorage jau atjaunots; nākamā ielāde mēģinās vēlreiz */
  }
}

function dismissPatchesFromIds(
  ids: readonly string[],
  hidden: boolean,
  vehicles: readonly IrissListingVehicle[],
): IrissListingDismissPatch[] {
  return ids.map((id) => {
    const v = vehicles.find((x) => x.id === id);
    return {
      id,
      hidden,
      ...(v?.platform ? { platform: v.platform } : {}),
      ...(v?.externalId ? { externalId: v.externalId } : {}),
    };
  });
}

export function IrissSludinajumiListClient({
  latest,
  orders: clientOrders,
  scanOrders = [],
  dismissed = [],
  initialOrderOv = {},
  matchNotices = [],
  matchOrderIds = {},
  matchStatus = {},
  duplicatesByListing = {},
}: Props) {
  const [clearedMatches, setClearedMatches] = useState<Set<string>>(() => new Set());
  const [notices, setNotices] = useState(matchNotices);
  const [dataset, setDatasetState] = useState<IrissListingDataset>("orders");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(DATASET_STORAGE_KEY) === "scan") setDatasetState("scan");
    } catch {}
  }, []);
  const orders = dataset === "scan" ? scanOrders : clientOrders;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hiddenImages, setHiddenImages] = useState<Record<string, true>>({});
  const [vinPatch, setVinPatch] = useState<Record<string, ListingVinOcrPatch>>({});
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<IrissPlatformHealthReport | null>(null);
  const [query, setQuery] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<IrissListPrefs>(() => ({
    ...defaultIrissListPrefs(),
    hidden: dismissedHiddenIds(dismissed, latest?.vehicles ?? []),
  }));
  const [prefsReady, setPrefsReady] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [previewOrders, setPreviewOrders] = useState<IrissListingOrderBrief[] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sourceStatusOpen, setSourceStatusOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const phone = useAdminMobileViewport();
  const filterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const gridColumns = useListingGridColumns();

  useEffect(() => {
    if (!filterOpen && !menuOpen && !sortOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (t instanceof Element && t.closest("[data-admin-list-sheet]")) return;
      if (filterOpen && filterRef.current && !filterRef.current.contains(t)) setFilterOpen(false);
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (sortOpen && sortRef.current && !sortRef.current.contains(t)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFilterOpen(false);
        setMenuOpen(false);
        setSortOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen, menuOpen, sortOpen]);
  const mobile = useMobilePlatform();
  const restoredQueryRef = useRef(false);
  const tab = prefs.tab;
  const listScope = prefs.listScope;
  const hideTech = prefs.hideTech;
  const hideOverBudget = prefs.hideOverBudget;
  const overBudgetThreshold = prefs.overBudgetThreshold;
  const sort = parseListingSort(searchParams.get("sort")) ?? LISTING_DEFAULT_SORT;
  const view = parseListingView(searchParams.get("view"));
  const sources = parseListingSources(searchParams.get("src"));
  const priceMin = parsePriceBound(searchParams.get("min"));
  const priceMax = parsePriceBound(searchParams.get("max"));
  const orderFilter = parseListingOrderFilter(searchParams.get("ord"));
  const orderById = useMemo(() => listingOrdersById([...clientOrders, ...scanOrders]), [clientOrders, scanOrders]);

  useEffect(() => {
    const storage = irissListBrowserStorage();
    const loaded = storage ? migrateIrissListPrefs(storage) : defaultIrissListPrefs();
    const vehicles = latest?.vehicles ?? [];
    const serverHidden = dismissedHiddenIds(dismissed, vehicles);
    const hidden = uniqueListingIds([...serverHidden, ...loaded.hidden]);
    const migrated = mergeListingOrderOvMigration(initialOrderOv, loaded.orderOv);
    if (migrated.persistServer) {
      void fetch("/api/admin/iriss-listings/order-ov", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderOv: migrated.next }),
      });
    }
    // Atverot lapu vienmēr: cilne "Jauni", kārtot "Jaunākie" (neatjauno no localStorage).
    setPrefs({ ...loaded, costs: loaded.costs, hidden, tab: "new", listScope: "all", sort: null, budget: null, orderOv: migrated.next });
    setPrefsReady(true);
    setMounted(true);
    setNowMs(Date.now());
    const localOnly = loaded.hidden.filter((id) => !serverHidden.includes(id));
    void persistListingDismissItems(dismissPatchesFromIds(localOnly, true, vehicles));
    // Servera dismissed nāk no SSR pirmajā renderī; tikai starta hidrācija.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setNowMs(Date.now());
  }, [latest?.generatedAt, mounted]);

  useEffect(() => {
    if (!prefsReady) return;
    const storage = irissListBrowserStorage();
    if (!storage) return;
    persistIrissListPrefs(storage, prefs);
  }, [prefs, prefsReady]);

  function applyPrefs(next: IrissListPrefs) {
    const prevHidden = prefs.hidden;
    const orderOvChanged = JSON.stringify(next.orderOv) !== JSON.stringify(prefs.orderOv);
    setPrefs(next);
    const storage = irissListBrowserStorage();
    if (storage) persistIrissListPrefs(storage, next);
    if (orderOvChanged) {
      void fetch("/api/admin/iriss-listings/order-ov", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderOv: next.orderOv }),
      });
    }
    const added = next.hidden.filter((id) => !prevHidden.includes(id));
    const removed = prevHidden.filter((id) => !next.hidden.includes(id));
    if (added.length === 0 && removed.length === 0) return;
    const vehicles = latest?.vehicles ?? [];
    void persistListingDismissItems([
      ...dismissPatchesFromIds(added, true, vehicles),
      ...dismissPatchesFromIds(removed, false, vehicles),
    ]);
  }

  useEffect(() => {
    if (!drawerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerId]);

  useEffect(() => {
    if (!prefsReady || !mounted || restoredQueryRef.current) return;
    restoredQueryRef.current = true;
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (!searchParams.get("src") && prefs.sources.length > 0) {
      params.set("src", prefs.sources.join(","));
      changed = true;
    }
    if (!searchParams.get("min") && prefs.priceMin != null) {
      params.set("min", String(prefs.priceMin));
      changed = true;
    }
    if (!searchParams.get("max") && prefs.priceMax != null) {
      params.set("max", String(prefs.priceMax));
      changed = true;
    }
    if (!searchParams.get("ord") && prefs.orderFilter) {
      params.set("ord", prefs.orderFilter);
      changed = true;
    }
    if (!changed) return;
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [mounted, pathname, prefs.orderFilter, prefs.priceMax, prefs.priceMin, prefs.sort, prefs.sources, prefsReady, router, searchParams]);

  function writeListQuery(next: Parameters<typeof applyListingListQuery>[1]) {
    const params = applyListingListQuery(searchParams, next, {
      sort,
      view,
      sourceChipCount: LISTING_SOURCE_CHIPS.length,
    });
    setPrefs((p) => ({
      ...p,
      sort: null,
      ...(next.sources
        ? { sources: next.sources.length === 0 || next.sources.length === LISTING_SOURCE_CHIPS.length ? [] : next.sources }
        : {}),
      ...(next.min !== undefined ? { priceMin: parsePriceBound(next.min) } : {}),
      ...(next.max !== undefined ? { priceMax: parsePriceBound(next.max) } : {}),
      ...(next.ord !== undefined ? { orderFilter: next.ord ?? "" } : {}),
    }));
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function toggleSource(id: IrissListingPlatform) {
    const current = sources.length === 0 ? LISTING_SOURCE_CHIPS.map((s) => s.id) : sources;
    const has = current.includes(id);
    const next = has ? current.filter((s) => s !== id) : [...current, id];
    writeListQuery({ sources: next.length === LISTING_SOURCE_CHIPS.length ? [] : next });
  }

  function clearFilterPill(id: ListingFilterPillId) {
    if (id === "src") writeListQuery({ sources: [] });
    if (id === "price") writeListQuery({ min: null, max: null });
    if (id === "tech") setPrefs((p) => ({ ...p, hideTech: false }));
    if (id === "budget") setPrefs((p) => ({ ...p, hideOverBudget: false }));
    if (id === "hidden") setPrefs((p) => ({ ...p, listScope: "all" }));
  }

  function clearAllFilters() {
    writeListQuery({ sources: [], min: null, max: null });
    setPrefs((p) => ({ ...p, hideTech: false, hideOverBudget: false, listScope: "all" }));
  }

  const allVehicles = useMemo(
    () => (latest?.vehicles ?? []).map((v) => (vinPatch[v.id] ? { ...v, ...vinPatch[v.id] } : v)),
    [latest?.vehicles, vinPatch],
  );
  /** Divi datu kopumi: klientu pasūtījumu auto vai SCAN saraksta auto. Kartītes tās pašas. */
  const vehicles = useMemo(
    () => allVehicles.filter((v) => vehicleInListingDataset(effectiveListingOrderIds(v, prefs, matchOrderIds), dataset)),
    [allVehicles, dataset, prefs, matchOrderIds],
  );

  const counts = useMemo(() => {
    let fresh = 0;
    let price = 0;
    let gone = 0;
    for (const v of vehicles) {
      if (v.change === "gone") gone += 1;
      if (isNew(v, nowMs)) fresh += 1;
      if (recentPriceChanges(v, nowMs).length > 0) price += 1;
    }
    return { fresh, price, gone, all: vehicles.length - gone };
  }, [vehicles, nowMs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (tab === "gone") {
        if (v.change !== "gone") return false;
      } else {
        if (v.change === "gone") return false;
        if (tab === "fav" && !prefs.fav.includes(v.id)) return false;
        if (tab === "new" && !isNew(v, nowMs)) return false;
        if (tab === "price" && recentPriceChanges(v, nowMs).length === 0) return false;
      }
      if (listScope === "fav" && !prefs.fav.includes(v.id)) return false;
      if (listScope === "hidden") {
        if (!prefs.hidden.includes(v.id)) return false;
      } else if (prefs.hidden.includes(v.id)) {
        return false;
      }
      if (hideTech && listingHasHardTechDamage(v.damageRaw)) return false;
      if (!vehicleInSources(v.platform, sources)) return false;
      if (!vehicleInPriceRange(v, priceMin, priceMax)) return false;
      const linked = linkedOrdersOf(v, prefs, orderById, matchOrderIds);
      if (!vehicleMatchesOrderFilter(linked, orderFilter)) return false;
      const linkedBudget = listingBudgetForVehicle(null, linked);
      if (listingExcludedForMissingPrice(v, linkedBudget, hideOverBudget)) return false;
      if (
        listingIsOverBudgetHidden(
          v,
          listingCostsFor(prefs, v.id),
          prefs.taxOv[v.id],
          linkedBudget,
          hideOverBudget,
          overBudgetThreshold,
        )
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${v.title} ${v.manufacturer} ${v.year} ${v.location} ${v.vin ?? ""} ${v.stockNumber ?? ""} ${v.orderBrandModels.join(" ")} ${linked.map((o) => `${o.clientName} ${o.brandModel} ${o.preferredColors} ${o.brief}`).join(" ")} ${PLATFORM_LABEL_LONG[v.platform]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, tab, query, nowMs, sources, priceMin, priceMax, listScope, prefs, hideTech, hideOverBudget, overBudgetThreshold, orderById, orderFilter, matchOrderIds]);

  const sorted = useMemo(() => {
    const withRoom = visible.map((v) => ({ ...v, _room: roomOf(v, prefs, budgetOf(v, prefs, orderById, matchOrderIds)) }));
    // Favorīts nepārvieto auto saraksta augšā (lai lapa nelec); favorīti ir cilnē „★ Favorīti”.
    return sortListingVehicles(withRoom, sort, nowMs ?? Number.POSITIVE_INFINITY);
  }, [visible, sort, nowMs, prefs, orderById, matchOrderIds]);

  const vatHealth = useMemo(() => latest?.vatHealth ?? computeListingVatHealth(vehicles), [latest?.vatHealth, vehicles]);
  const drawerVehicle = useMemo(() => allVehicles.find((v) => v.id === drawerId) ?? null, [allVehicles, drawerId]);
  const techCount = useMemo(() => vehicles.filter((v) => v.change !== "gone" && !prefs.hidden.includes(v.id) && listingHasHardTechDamage(v.damageRaw)).length, [vehicles, prefs.hidden]);
  const overBudgetCount = useMemo(
    () =>
      vehicles.filter((v) => {
        if (v.change === "gone" || prefs.hidden.includes(v.id)) return false;
        return listingIsOverBudgetHidden(
          v,
          listingCostsFor(prefs, v.id),
          prefs.taxOv[v.id],
          budgetOf(v, prefs, orderById, matchOrderIds),
          true,
          overBudgetThreshold,
        );
      }).length,
    [vehicles, prefs, orderById, overBudgetThreshold, matchOrderIds],
  );
  const favCount = prefs.fav.filter((id) => vehicles.some((v) => v.id === id)).length;
  const hiddenCount = prefs.hidden.filter((id) => vehicles.some((v) => v.id === id)).length;

  const problemSources = useMemo(() => (latest?.sources ?? []).filter((s) => s.status !== "ok"), [latest?.sources]);
  const ingestStats = useMemo(
    () => irissListingPlatformIngestStats(latest?.sources ?? [], vehicles),
    [latest?.sources, vehicles],
  );
  const sortLabel = LISTING_SORTS.find((x) => x.id === sort)?.label ?? "Jaunākie";

  async function syncNow() {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      let restart = true;
      let lastProgress = { done: 0, total: 0 };
      let prevDone = -1;
      for (let batch = 0; batch < 40; batch += 1) {
        const res = await fetch("/api/admin/iriss-listings/sync-now", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restart }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          warnings?: string[];
          skipped?: string;
          continue?: boolean;
          progress?: { done?: number; total?: number };
        };
        if (!res.ok) {
          setSyncMsg(body.error ? `Nolasīšana neizdevās: ${body.error}` : "Nolasīšana neizdevās.");
          return;
        }
        const total = Math.max(0, body.progress?.total ?? 0);
        const done = Math.max(0, body.progress?.done ?? 0);
        lastProgress = { done, total };
        if (total > 0) setSyncMsg(`${done}/${total} meklējumi nolasīti`);
        restart = false;
        if (body.skipped === "already_done" || total === 0 || done >= total || done === prevDone || body.continue === false) break;
        prevDone = done;
      }
      setSyncMsg(lastProgress.total > 0 ? `${lastProgress.done}/${lastProgress.total} meklējumi nolasīti.` : "Nolasīšana pabeigta.");
      await loadHealth();
      router.refresh();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function loadHealth() {
    try {
      const res = await fetch("/api/admin/iriss-listings/session-health", { method: "GET", credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      setHealth((await res.json()) as IrissPlatformHealthReport);
    } catch {
      /* non-blocking */
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    const id = searchParams.get("listing");
    if (!id) return;
    setDrawerId(id);
    void markListingViewed(id);
    // Atvērums no saites. markListingViewed ir stabils pēc slēguma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "new", label: "Jauni", count: counts.fresh },
    { id: "price", label: "Cenu izmaiņas", count: counts.price },
    { id: "all", label: "Visi", count: counts.all },
    { id: "gone", label: "Pazuduši", count: counts.gone },
    { id: "fav", label: "Favorīti", count: favCount },
  ];

  const I = listingExtrasI(prefs.costs);
  const clientOptions = useMemo(
    () =>
      buildListingClientOptions(
        orders,
        (o) =>
          isIrissPasutijumsWorkingStatus(o.listStatus) ||
          vehicles.some((v) => effectiveListingOrderIds(v, prefs, matchOrderIds).includes(o.id)),
        serializeListingOrderFilter,
        fmtEur,
      ),
    [orders, vehicles, prefs, matchOrderIds],
  );
  const activeFilterCount = countActiveListingFilters({
    sources,
    priceMin,
    priceMax,
    hideTech,
    hideOverBudget,
    listScope,
  });
  const filterPills = listingFilterPills({
    sources,
    sourceLabels: LISTING_PLATFORM_LABEL,
    priceMin,
    priceMax,
    hideTech,
    hideOverBudget,
    overBudgetThreshold,
    listScope,
  });
  const refreshedAt = mounted && latest?.summary.finishedAt ? listingFmtClock(latest.summary.finishedAt, nowMs) : "";
  const nextReadLabel = mounted ? nextIrissListingsAutomaticReadLabel(new Date(), latest?.lastAutomaticSlot) : "";
  const finishedAtLabel = mounted && latest?.summary.finishedAt ? listingFmtDateTime(latest.summary.finishedAt) : "";

  function setDataset(next: IrissListingDataset) {
    if (next === dataset) return;
    setDatasetState(next);
    try {
      window.localStorage.setItem(DATASET_STORAGE_KEY, next);
    } catch {}
    // Klienta/SCAN filtrs nav savietojams starp kopumiem.
    if (orderFilter.kind !== "all") writeListQuery({ ord: null });
  }

  function setGlobalCost(part: keyof ListingCostParts, value: number) {
    setPrefs((p) => ({ ...p, costs: { ...p.costs, [part]: value } }));
  }

  function listingIsMatchNew(id: string, linked: readonly IrissListingOrderBrief[]): boolean {
    return linked.some((o) => {
      const key = irissListingMatchKey(o.id, id);
      return matchStatus[key] === "jauns" && !clearedMatches.has(key);
    });
  }

  async function markListingViewed(listingId: string) {
    const keys = Object.keys(matchStatus).filter((key) => key.endsWith(`|${listingId}`) && matchStatus[key] === "jauns" && !clearedMatches.has(key));
    if (keys.length === 0) return;
    setClearedMatches((prev) => {
      const next = new Set(prev);
      for (const key of keys) next.add(key);
      return next;
    });
    setNotices((prev) => prev.filter((n) => n.listingId !== listingId));
    try {
      await fetch("/api/admin/iriss-listings/match-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, status: "skatits", onlyIf: "jauns" }),
      });
      window.dispatchEvent(new Event("admin-iriss-matches-changed"));
    } catch {
      /* žetons paliek līdz nākamajai ielādei */
    }
  }

  async function openMatchNotice(notice: IrissListingMatchNotice) {
    setClearedMatches((prev) => new Set(prev).add(irissListingMatchKey(notice.orderId, notice.listingId)));
    setNotices((prev) => prev.filter((n) => irissListingMatchKey(n.orderId, n.listingId) !== irissListingMatchKey(notice.orderId, notice.listingId)));
    try {
      await fetch("/api/admin/iriss-listings/match-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ orderId: notice.orderId, listingId: notice.listingId, status: "skatits", onlyIf: "jauns" }],
        }),
      });
      window.dispatchEvent(new Event("admin-iriss-matches-changed"));
    } catch {
      /* saite tik un tā atveras */
    }
    router.push(notice.href);
  }

  const STROKE = 1.6;
  const extrasLabel = fmtEur(I);
  const selectedOrderValue = serializeListingOrderFilter(orderFilter);
  const selectedOrderLabel =
    clientOptions.find((o) => o.value === selectedOrderValue)?.label ??
    (dataset === "scan" ? "Viss monitorings" : "Visi klienti");

  function filtersForm(extra?: ReactNode) {
    return (
      <IrissSludinajumiFiltersForm
        sources={sources}
        onToggleSource={toggleSource}
        minKey={searchParams.get("min") ?? ""}
        maxKey={searchParams.get("max") ?? ""}
        minDefault={searchParams.get("min") ?? ""}
        maxDefault={searchParams.get("max") ?? ""}
        onMin={(v) => writeListQuery({ min: v })}
        onMax={(v) => writeListQuery({ max: v })}
        hideTech={hideTech}
        onHideTech={(v) => setPrefs((p) => ({ ...p, hideTech: v }))}
        techCount={techCount}
        hideOverBudget={hideOverBudget}
        onHideOverBudget={(v) => setPrefs((p) => ({ ...p, hideOverBudget: v }))}
        overBudgetThreshold={overBudgetThreshold}
        onThreshold={(v) => setPrefs((p) => ({ ...p, overBudgetThreshold: parseOverBudgetThreshold(v, p.overBudgetThreshold) }))}
        overBudgetCount={overBudgetCount}
        onlyHidden={listScope === "hidden"}
        onOnlyHidden={(v) => setPrefs((p) => ({ ...p, listScope: v ? "hidden" : "all" }))}
        hiddenCount={hiddenCount}
        resultCount={sorted.length}
        onApply={() => setFilterOpen(false)}
        extra={extra}
      />
    );
  }

  function sourceStatusBody() {
    return (
      <IrissSludinajumiSourceStatusBody
        finishedAtLabel={finishedAtLabel}
        ingest={ingestStats}
        vehicleCount={counts.all}
        freshCount={counts.fresh}
        priceCount={counts.price}
        okSources={latest?.summary.okCount ?? 0}
        totalSources={latest?.summary.totalSources ?? 0}
        vatHealth={vatHealth}
        health={health}
        problemSources={problemSources}
        problemsOpen={showSources}
        onToggleProblems={() => setShowSources((v) => !v)}
        syncBusy={syncBusy}
        syncMsg={syncMsg}
        onSync={() => void syncNow()}
        onHealthDone={() => void loadHealth()}
      />
    );
  }

  return (
    <div className="iriss-slud mt-1 space-y-2 touch-manipulation sm:mt-1.5 sm:space-y-2">
      <div className="md:hidden">
        <AdminMobileTopBar
          title="Sludinājumi"
          trailing={
            <>
              <AdminMobileRoundBtn
                name="atzime"
                label={`Jaunas atbilstības ${notices.length}`}
                badge={notices.length}
                onClick={() => {
                  if (notices.length === 0) return;
                  setMatchesOpen(true);
                  setMenuOpen(false);
                  setFilterOpen(false);
                  setMobileSortOpen(false);
                  setSourceStatusOpen(false);
                  setCostsOpen(false);
                }}
              />
              <AdminMobileRoundBtn
                name="filtri"
                label="Filtri"
                badge={activeFilterCount}
                onClick={() => { setFilterOpen(true); setMenuOpen(false); setMobileSortOpen(false); }}
              />
              <AdminMobileRoundBtn
                name="vairak"
                label="Vairāk"
                onClick={() => { setMenuOpen(true); setFilterOpen(false); setMobileSortOpen(false); }}
              />
            </>
          }
        >
          <AdminMobileSegments
            value={dataset}
            onChange={(id) => setDataset(id as typeof dataset)}
            items={[
              { id: "orders", label: `Pasūtījumi ${clientOrders.length}` },
              { id: "scan", label: `Monitorings ${scanOrders.length}` },
            ]}
          />
          <div className="mt-2">
            <AdminMobileSearchField
              value={query}
              onChange={setQuery}
              placeholder="Meklēt auto, VIN, klientu"
            />
          </div>
          <div className="mt-2">
            <AdminMobileChips
              value={tab}
              onChange={(id) => setPrefs((p) => ({ ...p, tab: id as Tab }))}
              items={tabs.map((t) => ({ id: t.id, label: t.id === "price" ? "Cenas" : t.label, count: t.count }))}
            />
          </div>
          <button
            type="button"
            className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--am-ink2)]"
            title={nextReadLabel ? `Nākamā nolasīšana ${nextReadLabel}` : "Nākamā nolasīšana"}
            onClick={() => { setSourceStatusOpen(true); setMenuOpen(false); }}
          >
            {problemSources.length > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--slud-warn,#c2410c)]" aria-hidden /> : null}
            <span>Atjaunots {refreshedAt || (latest?.summary.finishedAt ? "\u00a0" : "nav")}</span>
            {nextReadLabel ? <span>· nākamā {nextReadLabel}</span> : null}
          </button>
        </AdminMobileTopBar>
      </div>

      <header
        data-iriss-listings-toolbar=""
        className="relative z-20 hidden bg-transparent pb-1 pt-0.5 md:static md:z-auto md:block md:bg-transparent md:backdrop-blur-none"
      >
        <div className="slud-glass rounded-[28px] px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <h1 className="shrink-0 text-[26px] font-bold leading-none tracking-[-0.028em]">Sludinājumi</h1>
            <div role="tablist" aria-label="Datu kopums" className="inline-flex rounded-full bg-[var(--slud-fill)] p-[3px] text-[13px]">
              {([
                ["orders", "Klientu pasūtījumi", clientOrders.length],
                ["scan", "Mūsu monitorings", scanOrders.length],
              ] as const).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={dataset === id}
                  onClick={() => setDataset(id)}
                  className={`inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 transition ${dataset === id ? "bg-[var(--slud-s1)] font-semibold shadow-sm" : "font-medium text-[var(--slud-ink2)]"}`}
                >
                  {label}
                  <span className="text-[12px] font-normal text-[var(--slud-ink3)]">{n}</span>
                </button>
              ))}
            </div>
            <label className="inline-flex h-8 max-w-[min(100%,22rem)] min-w-0 items-center gap-1.5 rounded-full bg-[var(--slud-fill)] px-2.5 text-[13px]">
              <Car className="h-3.5 w-3.5 shrink-0 text-[var(--slud-ink2)]" strokeWidth={STROKE} aria-hidden />
              <select
                aria-label={dataset === "scan" ? "Monitorētais ieraksts" : "Klients un pasūtījums"}
                value={selectedOrderValue}
                onChange={(e) => writeListQuery({ ord: e.target.value || null })}
                className="min-w-0 flex-1 truncate bg-transparent font-medium outline-none"
                title={selectedOrderLabel}
              >
                <option value="">{dataset === "scan" ? "Viss monitorings" : "Visi klienti"}</option>
                {clientOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.indent ? "\u00a0\u00a0\u00a0- " : ""}
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <button
                type="button"
                title={nextReadLabel ? `Nākamā nolasīšana ${nextReadLabel}` : "Nākamā nolasīšana"}
                onClick={() => { setSourceStatusOpen(true); setMenuOpen(false); setFilterOpen(false); }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-[var(--slud-ink2)] hover:bg-[var(--slud-fill)]"
              >
                {problemSources.length > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--slud-warn)]" aria-hidden /> : null}
                <span>Atjaunots {refreshedAt || (latest?.summary.finishedAt ? "\u00a0" : "nav")}</span>
              </button>
              <IrissNewMatchNotice notices={notices} onOpen={(notice) => void openMatchNotice(notice)} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, tab: t.id }))}
                  data-on={tab === t.id ? "true" : "false"}
                  className="slud-chip inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--slud-fill)] px-3 text-[13px] font-medium"
                >
                  {t.label}
                  <span className="tabular-nums opacity-70">{t.id === "new" || t.id === "price" ? (mounted ? t.count : "\u00a0") : t.count}</span>
                </button>
              ))}
            </div>
            <label className="relative inline-flex h-8 min-w-[12rem] flex-1 items-center gap-1.5 rounded-full bg-[var(--slud-fill)] px-3 text-[13px] text-[var(--slud-ink2)]">
              <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={STROKE} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Meklēt auto, VIN, klientu"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--slud-ink)] outline-none placeholder:text-[var(--slud-ink3)]"
              />
            </label>
            <div ref={filterRef} className="relative shrink-0">
              <button
                type="button"
                aria-label="Filtri"
                aria-expanded={filterOpen}
                onClick={() => { setFilterOpen((v) => !v); setMenuOpen(false); setSortOpen(false); }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium hover:bg-[var(--slud-fill)]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={STROKE} aria-hidden />
                Filtri
                {activeFilterCount > 0 ? (
                  <span className="slud-badge inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums">{activeFilterCount}</span>
                ) : null}
              </button>
              {filterOpen ? (
                <div className="absolute right-0 top-10 z-40 hidden w-[min(92vw,22.5rem)] rounded-[22px] bg-[var(--slud-s1)] p-4 shadow-[var(--slud-shadow)] md:block">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[16px] font-semibold">Filtri</p>
                    <button type="button" onClick={clearAllFilters} className="text-[13px] font-medium text-[var(--slud-ink2)] hover:underline">
                      Notīrīt
                    </button>
                  </div>
                  {filtersForm()}
                </div>
              ) : null}
            </div>
            <div ref={sortRef} className="relative shrink-0">
              <button
                type="button"
                aria-label="Kārtot"
                aria-expanded={sortOpen}
                onClick={() => { setSortOpen((v) => !v); setFilterOpen(false); setMenuOpen(false); }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium hover:bg-[var(--slud-fill)]"
              >
                <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={STROKE} aria-hidden />
                {sortLabel}
              </button>
              {sortOpen ? (
                <div className="absolute right-0 top-10 z-40 hidden w-56 overflow-hidden rounded-2xl bg-[var(--slud-s1)] py-1 shadow-[var(--slud-shadow)] md:block">
                  {LISTING_SORTS.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => {
                        writeListQuery({ sort: x.id });
                        setSortOpen(false);
                      }}
                      className="flex min-h-10 w-full items-center justify-between px-3 text-left text-[14px] hover:bg-[var(--slud-fill)]"
                    >
                      {x.label}
                      {sort === x.id ? <span className="text-[var(--slud-ink3)]">✓</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div role="group" aria-label="Skats" className="inline-flex rounded-full bg-[var(--slud-fill)] p-[3px]">
              <button
                type="button"
                aria-label="Saraksts"
                aria-pressed={view === "list"}
                onClick={() => writeListQuery({ view: "list" })}
                className={`grid h-7 w-8 place-items-center rounded-full ${view === "list" ? "bg-[var(--slud-s1)] shadow-sm" : ""}`}
              >
                <List className="h-3.5 w-3.5" strokeWidth={STROKE} />
              </button>
              <button
                type="button"
                aria-label="Režģis"
                aria-pressed={view === "grid"}
                onClick={() => writeListQuery({ view: "grid" })}
                className={`grid h-7 w-8 place-items-center rounded-full ${view === "grid" ? "bg-[var(--slud-s1)] shadow-sm" : ""}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={STROKE} />
              </button>
            </div>
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                aria-label="Vairāk"
                aria-expanded={menuOpen}
                onClick={() => { setMenuOpen((v) => !v); setFilterOpen(false); setSortOpen(false); }}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--slud-fill)]"
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={STROKE} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-10 z-40 hidden w-[22rem] rounded-[22px] bg-[var(--slud-s1)] p-3.5 shadow-[var(--slud-shadow)] md:block">
                  <IrissSludinajumiMoreMenu
                    syncBusy={syncBusy}
                    syncMsg={syncMsg}
                    problemCount={problemSources.length}
                    extrasLabel={extrasLabel}
                    onSync={() => void syncNow()}
                    onSourceStatus={() => { setSourceStatusOpen(true); setMenuOpen(false); }}
                    onCosts={() => { setCostsOpen(true); setMenuOpen(false); }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <IrissSludinajumiActivePills pills={filterPills} onClear={clearFilterPill} onClearAll={clearAllFilters} />
        </div>
        {syncMsg && !syncBusy ? <p className="mt-1 text-center text-[11px] text-[var(--slud-ink3)]">{syncMsg}</p> : null}
      </header>

      <AdminMobileSheet open={phone && filterOpen} title="Filtri" onClose={() => setFilterOpen(false)}>
        <div className="iriss-slud">{filtersForm(
          <>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--am-ink3)]">Klients</p>
              <select
                aria-label={dataset === "scan" ? "Monitorētais ieraksts" : "Klients un pasūtījums"}
                value={selectedOrderValue}
                onChange={(e) => writeListQuery({ ord: e.target.value || null })}
                className="mt-2 h-11 w-full rounded-xl bg-[var(--am-fill)] px-3 text-[15px] outline-none"
              >
                <option value="">{dataset === "scan" ? "Viss monitorings" : "Visi klienti"}</option>
                {clientOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--am-ink3)]">Kārtot</p>
              <select
                aria-label="Kārtot pēc"
                value={sort}
                onChange={(e) => {
                  const next = parseListingSort(e.target.value);
                  if (next) writeListQuery({ sort: next });
                }}
                className="mt-2 h-11 w-full rounded-xl bg-[var(--am-fill)] px-3 text-[15px] outline-none"
              >
                {LISTING_SORTS.map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
            </div>
          </>,
        )}</div>
      </AdminMobileSheet>

      <AdminMobileSheet open={phone && menuOpen} title="Vairāk" onClose={() => setMenuOpen(false)}>
        <div className="iriss-slud">
        <IrissSludinajumiMoreMenu
          syncBusy={syncBusy}
          syncMsg={syncMsg}
          problemCount={problemSources.length}
          extrasLabel={extrasLabel}
          includeSort
          sortLabel={sortLabel}
          onSort={() => { setMenuOpen(false); setMobileSortOpen(true); }}
          onSync={() => void syncNow()}
          onSourceStatus={() => { setSourceStatusOpen(true); setMenuOpen(false); }}
          onCosts={() => { setCostsOpen(true); setMenuOpen(false); }}
        />
        </div>
      </AdminMobileSheet>

      <AdminMobileSheet open={phone && mobileSortOpen} title="Kārtot" onClose={() => setMobileSortOpen(false)}>
        <div className="overflow-hidden rounded-2xl bg-[var(--am-s1)]">
          {LISTING_SORTS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                writeListQuery({ sort: x.id });
                setMobileSortOpen(false);
              }}
              className="flex min-h-12 w-full items-center justify-between border-b border-[var(--am-hair)] px-4 text-[17px] last:border-b-0"
            >
              {x.label}
              {sort === x.id ? <span className="text-[var(--am-ink2)]">✓</span> : null}
            </button>
          ))}
        </div>
      </AdminMobileSheet>

      <AdminMobileSheet open={phone && sourceStatusOpen} title="Avotu statuss" onClose={() => setSourceStatusOpen(false)}>
        <div className="iriss-slud">{sourceStatusBody()}</div>
      </AdminMobileSheet>
      <AdminMobileSheet open={phone && costsOpen} title="Izmaksu pieņēmumi" onClose={() => setCostsOpen(false)}>
        <div className="iriss-slud">
          <IrissSludinajumiCostsPanel costs={prefs.costs} onChange={setGlobalCost} />
        </div>
      </AdminMobileSheet>
      <AdminMobileSheet open={phone && matchesOpen} title="Jaunas atbilstības" onClose={() => setMatchesOpen(false)}>
        <ul className="divide-y divide-[var(--am-hair)]">
          {notices.map((notice) => (
            <li key={`${notice.orderId}|${notice.listingId}`}>
              <a
                href={notice.href}
                className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px]"
                onClick={(e) => {
                  e.preventDefault();
                  setMatchesOpen(false);
                  void openMatchNotice(notice);
                }}
              >
                <span className="min-w-0 truncate">{notice.clientName} · {notice.title}</span>
                <span className="shrink-0 text-[12px] text-[var(--am-ink2)]">{LISTING_PLATFORM_LABEL[notice.platform as IrissListingPlatform] ?? notice.platform}</span>
              </a>
            </li>
          ))}
        </ul>
      </AdminMobileSheet>

      <IrissSludinajumiScrimPanel
        open={!phone && sourceStatusOpen}
        onClose={() => setSourceStatusOpen(false)}
        title="Avotu statuss"
        widthClass="w-[min(100vw,560px)]"
        side="right"
      >
        {sourceStatusBody()}
      </IrissSludinajumiScrimPanel>
      <IrissSludinajumiScrimPanel
        open={!phone && costsOpen}
        onClose={() => setCostsOpen(false)}
        title="Izmaksu pieņēmumi"
        widthClass="w-[min(92vw,26rem)]"
        side="center"
      >
        <IrissSludinajumiCostsPanel costs={prefs.costs} onChange={setGlobalCost} />
      </IrissSludinajumiScrimPanel>

      {visible.length === 0 ? (
        <section className="mx-4 rounded-2xl border border-dashed border-[var(--separator)] bg-[var(--surface)] px-6 py-10 text-center shadow-none max-md:mx-4">
          <p className="text-sm font-medium text-[var(--label)]">
            {vehicles.length === 0 ? "Nav nolasītu auto" : "Šajā filtrā nav auto"}
          </p>
          <p className="mt-1.5 text-[12px] text-[var(--color-provin-muted)]">
            {vehicles.length === 0
              ? "Spied „Nolasīt tagad”, lai ievāktu datus uzreiz, vai sagaidi ikdienas nolasīšanu. Lasa tikai aktīvo pasūtījumu izsoļu saites."
              : "Izvēlies citu cilni, avotu vai notīri meklēšanu un cenas diapazonu."}
          </p>
        </section>
      ) : null}

      <IrissListingVirtualList
        items={sorted}
        getKey={(v) => v.id}
        layout={view}
        columns={gridColumns}
        renderItem={(v) => (
          <IrissListingVehicleCard
            v={v}
            nowMs={nowMs}
            prefs={prefs}
            onPrefs={applyPrefs}
            linked={displayLinkedOf(v, prefs, orderById, matchOrderIds, dataset)}
            budget={budgetOf(v, prefs, orderById, matchOrderIds)}
            matchNew={listingIsMatchNew(v.id, displayLinkedOf(v, prefs, orderById, matchOrderIds, dataset))}
            duplicates={duplicatesByListing[v.id] ?? []}
            layout={view}
            onOpen={() => {
              setDrawerId(v.id);
              void markListingViewed(v.id);
            }}
            onPreviewOrder={(o) => setPreviewOrders([o])}
            onPreviewLinked={(orders) => setPreviewOrders([...orders])}
            mobile={mobile}
            imageHidden={Boolean(hiddenImages[v.id])}
            onImageError={() => setHiddenImages((prev) => ({ ...prev, [v.id]: true }))}
            onVinPatch={(id, patch) => setVinPatch((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
            onCreateRadar={async (vehicle) => {
              const seed = irissScanSeedFromListing(vehicle, crypto.randomUUID(), new Date().toISOString());
              const res = await fetch("/api/admin/iriss-scan", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ record: seed }),
              });
              const data = (await res.json().catch(() => ({}))) as { id?: unknown };
              if (!res.ok || typeof data.id !== "string") return;
              router.push(`/admin/iriss/scan/${encodeURIComponent(data.id)}`);
              router.refresh();
            }}
            onCreateOffer={async (vehicle) => {
              const offerId = crypto.randomUUID();
              const seed = irissPasutijumsOfferSeedFromListing(
                vehicle,
                crypto.randomUUID(),
                new Date().toISOString(),
                offerId,
              );
              const res = await fetch("/api/admin/iriss-pasutijumi", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ record: seed, listingVehicleId: vehicle.id }),
              });
              const data = (await res.json().catch(() => ({}))) as { id?: unknown };
              if (!res.ok || typeof data.id !== "string") return;
              router.push(
                `/admin/iriss/pasutijumi/${encodeURIComponent(data.id)}?offer=${encodeURIComponent(offerId)}&noClientPdf=1`,
              );
              router.refresh();
            }}
          />
        )}
      />

      {drawerVehicle ? (
        <>
          <button type="button" className="fixed inset-0 z-40 hidden bg-slate-900/20 sm:block" aria-label="Aizvērt atvilktni" onClick={() => setDrawerId(null)} />
          <IrissListDrawer
            v={drawerVehicle}
            prefs={prefs}
            orders={orders}
            linked={displayLinkedOf(drawerVehicle, prefs, orderById, matchOrderIds, dataset)}
            budget={budgetOf(drawerVehicle, prefs, orderById, matchOrderIds)}
            onClose={() => setDrawerId(null)}
            onPrefs={applyPrefs}
            onPreviewOrder={(o) => setPreviewOrders([o])}
            mobile={mobile}
            onVinPatch={(id, patch) => setVinPatch((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
          />
        </>
      ) : null}
      {previewOrders && previewOrders.length > 0 ? (
        <IrissListingOrderPreview orders={previewOrders} onClose={() => setPreviewOrders(null)} />
      ) : null}
    </div>
  );
}

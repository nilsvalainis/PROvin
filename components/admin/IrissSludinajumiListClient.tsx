"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminAnchoredSheet } from "@/components/admin/AdminBodyPortal";
import { IrissListDrawer } from "@/components/admin/IrissListDrawer";
import { IrissListingOrderPreview } from "@/components/admin/IrissListingOrderPreview";
import { IrissListingVehicleCard } from "@/components/admin/IrissListingVehicleCard";
import { IrissNewMatchNotice } from "@/components/admin/IrissNewMatchNotice";
import { IrissListingVirtualList } from "@/components/admin/IrissListingVirtualList";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { IrissListingsLoginButton } from "@/components/admin/IrissListingsLoginPanel";
import { type ListingVinOcrPatch } from "@/hooks/useListingVinOcr";
import { useMobilePlatform } from "@/hooks/useMobilePlatform";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import {
  AdminMobileRoundBtn,
  AdminMobileSearchField,
  AdminMobileSegments,
  AdminMobileTopBar,
} from "@/components/admin/mobile/AdminMobileChrome";
import { isRealListingPriceChange } from "@/lib/iriss-listings-auto1-cents";
import { listingBidPrice, listingExtrasI, listingMaxBid, type ListingCostParts } from "@/lib/iriss-listings-cost";
import { listingExcludedForMissingPrice, listingIsOverBudgetHidden, parseOverBudgetThreshold } from "@/lib/iriss-listings-over-budget";
import { listingHasHardTechDamage } from "@/lib/iriss-listings-damage";
import {
  LISTING_SORTS,
  type ListingSort,
  parseListingSort,
  parseListingSources,
  parsePriceBound,
  sortListingVehicles,
  vehicleInPriceRange,
  vehicleInSources,
} from "@/lib/iriss-listings-list-view";
import {
  listingBudgetForVehicle,
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
import { irissPasutijumsOfferSeedFromListing, irissPasutijumsSeedFromListing } from "@/lib/iriss-pasutijums-from-listing";
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
  IRISS_LISTING_PLATFORMS,
  IRISS_RELAY_LISTING_PLATFORMS,
  type IrissListingPlatform,
  type IrissListingSourceRun,
  type IrissListingVehicle,
  type IrissListingsLatestView,
  type IrissPlatformHealthItem,
  type IrissPlatformHealthReport,
} from "@/lib/iriss-listings-types";

const PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "AUTOBID",
  openline: "OPENLANE",
  auto1: "AUTO1",
  ecarstrade: "ECARSTRADE",
};

const PLATFORM_LABEL_LONG: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
  ecarstrade: "eCarsTrade",
};

/** „Jauns” un „cena mainīta” rāda pēc laika loga, ne tikai pēdējās palaišanas, lai atkārtots „Nolasīt tagad” tos neizdzēš. */
const RECENT_WINDOW_HOURS = 36;

type Tab = IrissListTab;

function healthLabel(status: IrissPlatformHealthItem["status"]): string {
  if (status === "ok") return "OK";
  if (status === "stale") return "novecojis";
  if (status === "blocked_by_waf") return "bloķēts (403)";
  if (status === "login_required") return "jāielogojas no jauna";
  if (status === "relay_not_configured") return "relejs nav pieslēgts";
  if (status === "no_sources") return "nav saišu";
  if (status === "not_run") return "nav lasīts";
  return "neizdevās";
}

function healthTextClass(status: IrissPlatformHealthItem["status"]): string {
  if (status === "ok") return "text-emerald-800";
  if (status === "stale" || status === "no_sources" || status === "not_run") return "text-slate-700";
  if (status === "relay_not_configured") return "text-sky-900";
  if (status === "login_required") return "text-amber-900";
  if (status === "blocked_by_waf") return "text-orange-950";
  return "text-red-900";
}

function sourceStatusLabel(status: IrissListingSourceRun["status"]): string {
  if (status === "ok") return "OK";
  if (status === "login_required") return "Jāielogojas";
  if (status === "blocked_by_waf") return "Bloķēts (403)";
  if (status === "parse_failed") return "Parse kļūda";
  if (status === "relay_not_configured") return "Relejs nav pieslēgts";
  if (status === "skipped") return "Izlaists";
  return "Nolasīšana neizdevās";
}

function fmtEur(n: number | null): string {
  if (n === null) return "";
  return `${Math.round(n).toLocaleString("lv-LV")} €`;
}

function fmtDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso || "";
  return new Intl.DateTimeFormat("lv-LV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Riga",
  }).format(new Date(t));
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

/** Atverot lapu vienmēr: cilne „Jauni”, kārtot „Jaunākie” (neatjauno no localStorage). */
const DEFAULT_SORT: ListingSort = "seen";

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

const SOURCE_CHIPS: ReadonlyArray<{ id: IrissListingPlatform; label: string }> = [
  { id: "autobid", label: "Autobid" },
  { id: "openline", label: "Openlane" },
  { id: "auto1", label: "Auto1" },
  { id: "ecarstrade", label: "eCarsTrade" },
];

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
  const [showCosts, setShowCosts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filtri un „⋯” aizveras, klikšķinot/pieskaroties jebkur ārpusē vai nospiežot Esc.
  useEffect(() => {
    if (!filterOpen && !menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (t instanceof Element && t.closest("[data-admin-list-sheet]")) return;
      if (filterOpen && filterRef.current && !filterRef.current.contains(t)) setFilterOpen(false);
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFilterOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen, menuOpen]);
  const mobile = useMobilePlatform();
  const restoredQueryRef = useRef(false);
  const tab = prefs.tab;
  const listScope = prefs.listScope;
  const hideTech = prefs.hideTech;
  const hideOverBudget = prefs.hideOverBudget;
  const overBudgetThreshold = prefs.overBudgetThreshold;
  const sort = parseListingSort(searchParams.get("sort")) ?? DEFAULT_SORT;
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
    if (false) {
      changed = true;
    }
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

  function writeListQuery(next: {
    sort?: ListingSort;
    sources?: IrissListingPlatform[];
    min?: string | null;
    max?: string | null;
    ord?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const sortNext = next.sort ?? sort;
    if (sortNext === DEFAULT_SORT) params.delete("sort");
    else params.set("sort", sortNext);
    setPrefs((p) => ({
      ...p,
      sort: null,
      ...(next.sources
        ? { sources: next.sources.length === 0 || next.sources.length === SOURCE_CHIPS.length ? [] : next.sources }
        : {}),
      ...(next.min !== undefined ? { priceMin: parsePriceBound(next.min) } : {}),
      ...(next.max !== undefined ? { priceMax: parsePriceBound(next.max) } : {}),
      ...(next.ord !== undefined ? { orderFilter: next.ord ?? "" } : {}),
    }));
    if (next.sources) {
      if (next.sources.length === 0 || next.sources.length === SOURCE_CHIPS.length) params.delete("src");
      else params.set("src", next.sources.join(","));
    }
    if (next.min !== undefined) {
      const n = parsePriceBound(next.min);
      if (n === null) params.delete("min");
      else params.set("min", String(n));
    }
    if (next.max !== undefined) {
      const n = parsePriceBound(next.max);
      if (n === null) params.delete("max");
      else params.set("max", String(n));
    }
    if (next.ord !== undefined) {
      const s = (next.ord ?? "").trim();
      if (!s) params.delete("ord");
      else params.set("ord", s);
    }
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function toggleSource(id: IrissListingPlatform) {
    const current = sources.length === 0 ? SOURCE_CHIPS.map((s) => s.id) : sources;
    const has = current.includes(id);
    const next = has ? current.filter((s) => s !== id) : [...current, id];
    writeListQuery({ sources: next.length === SOURCE_CHIPS.length ? [] : next });
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
  const ectIngest = ingestStats.find((s) => s.platform === "ecarstrade");

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
    { id: "fav", label: "★ Favorīti", count: favCount },
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
  const platformDots = (["auto1", "openline", "autobid", "ecarstrade"] as const).map((platform) => {
    const h = vatHealth[platform];
    const login = health?.items.find((x) => x.platform === platform);
    const warn = h.stale + h.missingFields + h.rateMissing + h.conflict + h.defaultUnrecognised;
    const label = PLATFORM_LABEL_LONG[platform];
    const vat =
      platform === "auto1"
        ? `${h.margin} Margin · ${h.gross} ar PVN · ${warn} ⚠`
        : platform === "openline"
          ? `${h.margin} · ${h.net} NETO · ${warn} ⚠`
          : platform === "ecarstrade"
            ? `${h.net} NETO · ${h.margin} · ${warn} ⚠`
            : `${h.margin} · ${h.gross} · ${warn} ⚠`;
    return { platform, label, vat, title: `${label}: ${login ? healthLabel(login.status) : "nav pārbaudīts"} · ${vat}${h.reason ? ` · ${h.reason}` : ""}` };
  });
  const activeFilterCount = (sources.length > 0 ? 1 : 0) + (priceMin != null || priceMax != null ? 1 : 0) + (hideTech ? 1 : 0) + (listScope === "hidden" ? 1 : 0);

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

  return (
    <div className="mt-1 space-y-2 touch-manipulation sm:mt-1.5 sm:space-y-2">
      <div className="md:hidden">
        <AdminMobileTopBar
          title="Sludinājumi"
          trailing={
            <>
              <AdminMobileRoundBtn
                name="kartot"
                label={`Kārtot: ${LISTING_SORTS.find((x) => x.id === sort)?.label ?? "Jaunākie"}`}
                onClick={() => { setMenuOpen(true); setFilterOpen(false); }}
              />
              <AdminMobileRoundBtn name="filtri" label="Filtri" onClick={() => { setFilterOpen(true); setMenuOpen(false); }} />
              <AdminMobileRoundBtn name="vairak" label="Vairāk" onClick={() => { setMenuOpen(true); setFilterOpen(false); }} />
            </>
          }
        >
          <AdminMobileSegments
            value={dataset}
            onChange={(id) => setDataset(id as typeof dataset)}
            items={[
              { id: "orders", label: `Klientu pasūtījumi ${clientOrders.length}` },
              { id: "scan", label: `Mūsu monitorings ${scanOrders.length}` },
            ]}
          />
          <div className="mt-2">
            <AdminMobileSearchField
              value={query}
              onChange={setQuery}
              placeholder="Meklēt marku, modeli, VIN"
            />
          </div>
        </AdminMobileTopBar>
      </div>
      {/* Web (md+): panelis nav lipīgs. Atbilstības ir žetons rīku rindā, ne atsevišķa josla. */}
      <header
        data-iriss-listings-toolbar=""
        className="relative z-20 -mx-2 hidden bg-transparent px-2 pb-1 pt-0.5 md:static md:z-auto md:mx-0 md:block md:bg-transparent md:px-0 md:backdrop-blur-none"
      >
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] md:flex-none md:overflow-visible [&::-webkit-scrollbar]:hidden">
            <div role="tablist" aria-label="Datu kopums" className="inline-flex rounded-full bg-[#e9e9ee] p-[2px] text-[12px]">
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
                  className={`inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 transition sm:h-7 sm:px-3 ${dataset === id ? "bg-white font-semibold text-[var(--color-apple-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"}`}
                >
                  {label}
                  <span className="text-[11px] font-normal text-[#8e8e93]">{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex w-full min-w-0 items-center gap-1 md:w-auto md:flex-1">
          <div className="flex min-w-0 flex-1 overflow-x-auto rounded-[10px] bg-[#e9e9ee] p-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, tab: t.id }))}
                className={`inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-[8px] px-2.5 text-[12.5px] transition sm:h-7 sm:px-3 ${
                  tab === t.id ? "bg-white font-semibold text-[var(--color-apple-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"
                }`}
              >
                {t.id === "price" ? <><span className="sm:hidden">Cenas</span><span className="hidden sm:inline">{t.label}</span></> : t.id === "fav" ? <><span className="sm:hidden">★</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
                <span className="text-[11px] font-normal text-[#8e8e93]">{t.id === "new" || t.id === "price" ? (mounted ? t.count : "\u00a0") : t.count}</span>
              </button>
            ))}
          </div>
          {searchOpen || query ? (
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => { if (!query) setSearchOpen(false); }}
              placeholder="Meklēt marku, modeli, VIN"
              className="h-10 w-36 shrink rounded-[9px] bg-[#e9e9ee] px-2.5 text-base text-[var(--color-apple-text)] outline-none placeholder:text-[#8e8e93] sm:h-7 sm:w-52 sm:text-[12.5px]"
            />
          ) : (
            <button type="button" aria-label="Meklēt" onClick={() => setSearchOpen(true)} className="inline-flex h-10 min-h-10 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-medium text-[#3a3a3c] hover:bg-[#e9e9ee] sm:h-7 sm:min-h-0">
              <Search className="h-4 w-4" aria-hidden />
              <span className="hidden min-[420px]:inline">Meklēt</span>
            </button>
          )}
          <div ref={filterRef} className="relative shrink-0">
            <button
              type="button"
              aria-label="Filtri"
              aria-expanded={filterOpen}
              onClick={() => { setFilterOpen((v) => !v); setMenuOpen(false); }}
              className={`inline-flex h-10 min-h-10 items-center gap-1 rounded-full px-2 text-[12px] font-medium hover:bg-[#e9e9ee] sm:h-7 sm:min-h-0 ${activeFilterCount > 0 ? "text-[var(--color-provin-accent)]" : "text-[#3a3a3c]"}`}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="hidden min-[420px]:inline">Filtri</span>
              {activeFilterCount > 0 ? <span className="rounded-full bg-[var(--color-provin-accent)] px-1.5 text-[10px] font-semibold leading-4 text-white">{activeFilterCount}</span> : null}
            </button>
            <AdminAnchoredSheet
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              closeLabel="Aizvērt filtrus"
              sheetId="list-filter"
              mobileClassName="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-[14px] bg-[#f2f2f7] p-4 pb-[max(16px,env(safe-area-inset-bottom))] text-[15px] shadow-[0_10px_32px_rgba(0,0,0,0.16)]"
              desktopClassName="hidden sm:absolute sm:right-0 sm:top-9 sm:z-40 sm:block sm:w-[300px] sm:rounded-xl sm:bg-white sm:p-3.5 sm:text-[12px] sm:shadow-[0_10px_32px_rgba(0,0,0,0.16)]"
            >
              {() => (
              <>
                <div className="mx-auto mb-3 h-1.5 w-9 rounded-full bg-[#c7c7cc] sm:hidden" aria-hidden />
                <p className="mb-2 text-center text-[17px] font-semibold sm:hidden">Filtri</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Avots</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SOURCE_CHIPS.map((src) => {
                    const on = sources.length === 0 || sources.includes(src.id);
                    return (
                      <button
                        key={src.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={src.label}
                        onClick={() => toggleSource(src.id)}
                        className={`inline-flex h-8 items-center bg-transparent px-0.5 sm:h-7 ${on ? "opacity-100" : "opacity-35"}`}
                      >
                        <IrissAuctionLogo platform={src.id} fallback={src.label} size="sm" />
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Cena €</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <input type="number" min={0} inputMode="numeric" aria-label="Cena no" placeholder="No" defaultValue={searchParams.get("min") ?? ""} key={`min-${searchParams.get("min") ?? ""}`} onBlur={(e) => writeListQuery({ min: e.target.value.trim() })} className="h-9 w-full rounded-lg bg-[#f2f2f5] px-2.5 text-base outline-none sm:h-7 sm:text-[12px]" />
                  <span className="text-[#8e8e93]">-</span>
                  <input type="number" min={0} inputMode="numeric" aria-label="Cena līdz" placeholder="Līdz" defaultValue={searchParams.get("max") ?? ""} key={`max-${searchParams.get("max") ?? ""}`} onBlur={(e) => writeListQuery({ max: e.target.value.trim() })} className="h-9 w-full rounded-lg bg-[#f2f2f5] px-2.5 text-base outline-none sm:h-7 sm:text-[12px]" />
                </div>
                <label className="mt-3 flex items-center gap-2 font-medium">
                  <input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={hideTech} onChange={(e) => setPrefs((p) => ({ ...p, hideTech: e.target.checked }))} />
                  Slēpt ar motora/kārbas bojājumiem ({techCount})
                </label>
                <label className="mt-2 flex items-start gap-2 font-medium">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 sm:h-4 sm:w-4" checked={hideOverBudget} onChange={(e) => setPrefs((p) => ({ ...p, hideOverBudget: e.target.checked }))} />
                  <span>
                    Slēpt virs budžeta +
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label="Slieksnis virs budžeta, €"
                      value={overBudgetThreshold}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") return;
                        setPrefs((p) => ({ ...p, overBudgetThreshold: parseOverBudgetThreshold(raw, p.overBudgetThreshold) }));
                      }}
                      className="mx-1 h-7 w-16 rounded-md bg-[#f2f2f5] px-1.5 text-center text-[12px] outline-none"
                    />
                    € ({overBudgetCount})
                  </span>
                </label>
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={listScope === "hidden"} onChange={(e) => setPrefs((p) => ({ ...p, listScope: e.target.checked ? "hidden" : "all" }))} />
                  Rādīt tikai paslēptos ({hiddenCount})
                </label>
                <button type="button" onClick={() => setFilterOpen(false)} className="mt-3 h-[50px] w-full rounded-xl bg-[var(--color-provin-accent)] text-[17px] font-semibold text-white sm:h-8 sm:rounded-lg sm:text-[12.5px]">
                  Rādīt {sorted.length} auto
                </button>
              </>
              )}
            </AdminAnchoredSheet>
          </div>
          <label className="inline-flex h-10 min-h-10 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] text-[#8e8e93] hover:bg-[#e9e9ee] sm:h-7 sm:min-h-0">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Kārtot</span>
            <select
              aria-label="Kārtot pēc"
              value={sort}
              onChange={(e) => {
                const next = parseListingSort(e.target.value);
                if (next) writeListQuery({ sort: next });
              }}
              className="max-w-[7.5rem] bg-transparent text-[12px] font-semibold text-[var(--color-apple-text)] outline-none sm:max-w-none"
            >
              {LISTING_SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <div ref={menuRef} className="relative shrink-0">
            <button type="button" aria-label="Vairāk" aria-expanded={menuOpen} onClick={() => { setMenuOpen((v) => !v); setFilterOpen(false); }} className="grid h-10 w-10 min-h-10 place-items-center rounded-full text-[16px] text-[#8e8e93] hover:bg-[#e9e9ee] sm:h-7 sm:w-7 sm:min-h-0">
              ⋯
            </button>
            <AdminAnchoredSheet
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              closeLabel="Aizvērt"
              sheetId="list-more"
              mobileClassName="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-[14px] bg-[#f2f2f7] p-4 pb-[max(16px,env(safe-area-inset-bottom))] text-[15px] shadow-[0_10px_32px_rgba(0,0,0,0.16)]"
              desktopClassName="hidden sm:absolute sm:right-0 sm:top-9 sm:z-40 sm:block sm:w-[340px] sm:rounded-xl sm:bg-white sm:p-3.5 sm:text-[12px] sm:shadow-[0_10px_32px_rgba(0,0,0,0.16)]"
            >
              {() => (
              <>
                <div className="mx-auto mb-3 h-1.5 w-9 rounded-full bg-[#c7c7cc] sm:hidden" aria-hidden />
                <p className="mb-2 text-center text-[17px] font-semibold sm:hidden">Vairāk</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93] sm:hidden">Kārtot</p>
                <div className="mb-3 overflow-hidden rounded-xl bg-[var(--surface)] sm:hidden">
                  {LISTING_SORTS.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => {
                        writeListQuery({ sort: x.id });
                        setMenuOpen(false);
                      }}
                      className="flex min-h-12 w-full items-center justify-between border-b border-[var(--separator)] px-4 text-[17px] last:border-b-0"
                    >
                      {x.label}
                      {sort === x.id ? <span className="text-[var(--label-secondary)]">✓</span> : null}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Nolasīšana</p>
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-y-0.5">
                  <span className="text-[#8e8e93]">Pēdējā</span><span>{mounted && latest?.summary.finishedAt ? fmtDateTime(latest.summary.finishedAt) : "nav veikta"}</span>
                  <span className="text-[#8e8e93]">Nākamā automātiskā</span><span>{mounted ? nextIrissListingsAutomaticReadLabel(new Date(), latest?.lastAutomaticSlot) : "\u00a0"}</span>
                  <span className="text-[#8e8e93]">Avoti OK · Auto · Jauni · Cenas</span><span>{latest?.summary.okCount ?? 0}/{latest?.summary.totalSources ?? 0} · {counts.all} · {mounted ? counts.fresh : ""} · {mounted ? counts.price : ""}</span>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Nolasīšana pa avotiem</p>
                {ingestStats.map((s) => (
                  <div key={s.platform} className="flex justify-between gap-3 py-0.5">
                    <span className="inline-flex items-center">
                      <IrissAuctionLogo platform={s.platform} fallback={PLATFORM_LABEL_LONG[s.platform]} size="sm" />
                    </span>
                    <span className="text-[#8e8e93]">
                      {s.sourceCount === 0
                        ? "nav saišu"
                        : `${s.okCount}/${s.sourceCount} avoti · ${s.vehicleCount} auto${s.status !== "ok" && s.status !== "none" ? ` · ${sourceStatusLabel(s.status)}` : ""}`}
                    </span>
                  </div>
                ))}
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">PVN pa avotiem</p>
                {platformDots.map((d) => (
                  <div key={d.platform} className="flex justify-between gap-3 py-0.5" title={d.title}>
                    <span className="flex items-center gap-1.5">
                      <IrissAuctionLogo platform={d.platform} fallback={d.label} size="sm" />
                    </span>
                    <span className="text-[#8e8e93]">{d.vat}</span>
                  </div>
                ))}
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Pieslēgumi</p>
                {(mounted && health?.items ? health.items : IRISS_LISTING_PLATFORMS.map((platform) => ({ platform, status: "not_run" as const, note: "", checkedAt: "" }))).map((item) => (
                  <div key={item.platform} className="flex items-center justify-between gap-2 py-0.5">
                    <span title={item.note} className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold">
                      <IrissAuctionLogo platform={item.platform} fallback={PLATFORM_LABEL_LONG[item.platform]} size="sm" />
                      <span className={healthTextClass(item.status)}>{healthLabel(item.status)}</span>
                    </span>
                    {IRISS_RELAY_LISTING_PLATFORMS.includes(item.platform) ? (
                      <IrissListingsLoginButton platform={item.platform} onDone={() => void loadHealth()} />
                    ) : (
                      <span className="text-[10.5px] text-[#8e8e93]">env ECARSTRADE_USER</span>
                    )}
                  </div>
                ))}
                {problemSources.length > 0 ? (
                  <>
                    <button type="button" onClick={() => setShowSources((v) => !v)} className="mt-2 text-[11px] font-medium text-[var(--color-provin-accent)] hover:underline">
                      {showSources ? "Slēpt avotu problēmas" : `Avotu problēmas (${problemSources.length})`}
                    </button>
                    {showSources ? (
                      <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                        {problemSources.map((src) => (
                          <li key={src.id} className="flex flex-wrap items-center gap-x-2">
                            <IrissAuctionLogo platform={src.platform} fallback={PLATFORM_LABEL[src.platform]} size="sm" />
                            <span className="font-medium text-[var(--color-apple-text)]">{src.orderBrandModel || src.orderId}</span>
                            <span>{sourceStatusLabel(src.status)}</span>
                            {src.note ? <span className="text-slate-500">{src.note}</span> : null}
                            <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-provin-accent)] hover:underline">avots</a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Izmaksas</p>
                <div className="flex items-center justify-between">
                  <span className="tabular-nums">I = <b>{fmtEur(I)}</b></span>
                  <button type="button" onClick={() => setShowCosts((x) => !x)} className="text-[12px] font-semibold text-[var(--color-provin-accent)]">
                    {showCosts ? "Slēpt I" : "Izmaksas ›"}
                  </button>
                </div>
                {showCosts ? (
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {([
                      ["fee", "Izsoles komisija"],
                      ["transport", "Transports"],
                      ["commission", "Komisija"],
                      ["unplanned", "Neplānotie"],
                    ] as const).map(([k, l]) => (
                      <label key={k} className="grid text-[10px] font-semibold text-slate-500">
                        {l}
                        <input type="number" inputMode="numeric" value={prefs.costs[k]} onChange={(e) => setGlobalCost(k, Number(e.target.value) || 0)} className="h-10 w-full rounded-md bg-[#f2f2f5] px-2 text-base font-normal text-[var(--color-apple-text)] outline-none sm:h-8 sm:text-[12px]" />
                      </label>
                    ))}
                  </div>
                ) : null}
                <p className="mt-1 text-[10.5px] text-[#8e8e93]">Budžets - no pasūtījumiem.</p>
                <button type="button" onClick={() => setMenuOpen(false)} className="mt-3 h-[50px] w-full rounded-xl bg-white text-[17px] font-semibold sm:hidden sm:h-10 sm:rounded-lg sm:bg-[#f2f2f5] sm:text-[12.5px]">Aizvērt</button>
              </>
              )}
            </AdminAnchoredSheet>
          </div>
          <IrissNewMatchNotice notices={notices} onOpen={(notice) => void openMatchNotice(notice)} />
        </div>
        </div>
        <div className="admin-source-logo-row mt-1 flex max-w-full flex-nowrap items-center gap-x-2 overflow-x-auto text-[11px] text-[#8e8e93] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="inline-flex shrink-0 items-center gap-1.5">
            {platformDots.map((d) => (
              <span key={d.platform} title={d.title} className="inline-flex items-center gap-1">
                <IrissAuctionLogo platform={d.platform} fallback={d.label} size="sm" />
              </span>
            ))}
          </span>
          <span className="shrink-0 whitespace-nowrap">
            Nolasīts {mounted && latest?.summary.finishedAt ? fmtDateTime(latest.summary.finishedAt) : latest?.summary.finishedAt ? "\u00a0" : "nav"}
            <span className="hidden sm:inline"> · nākamā {mounted ? nextIrissListingsAutomaticReadLabel(new Date(), latest?.lastAutomaticSlot) : "\u00a0"}</span>
            {" "}· {latest?.summary.okCount ?? 0}/{latest?.summary.totalSources ?? 0} avoti OK
            {ectIngest && (ectIngest.sourceCount > 0 || ectIngest.vehicleCount > 0) ? (
              <span title="eCarsTrade nolasīšana" className="inline-flex items-center gap-1">
                {" · "}
                <IrissAuctionLogo platform="ecarstrade" fallback="eCarsTrade" size="sm" />
                {ectIngest.okCount}/{ectIngest.sourceCount} · {ectIngest.vehicleCount} auto
              </span>
            ) : (
              <span title="eCarsTrade nolasīšana" className="inline-flex items-center gap-1">
                {" · "}
                <IrissAuctionLogo platform="ecarstrade" fallback="eCarsTrade" size="sm" />
                nav saišu
              </span>
            )}
          </span>
          <button type="button" onClick={() => void syncNow()} disabled={syncBusy} className="shrink-0 font-semibold text-[var(--color-provin-accent)] disabled:opacity-55">
            {syncBusy ? (syncMsg && /\d+\/\d+/.test(syncMsg) ? syncMsg.replace(" meklējumi nolasīti", "") : "Nolasa…") : "Nolasīt"}
          </button>
          <span className="shrink-0 text-[#d1d1d6]">|</span>
          <label className="inline-flex max-w-[60vw] shrink-0 items-center gap-1">
            <span>{dataset === "scan" ? "Monitorings" : "Klients"}</span>
            <select
              aria-label={dataset === "scan" ? "Monitorētais ieraksts" : "Klients un pasūtījums"}
              value={serializeListingOrderFilter(orderFilter)}
              onChange={(e) => writeListQuery({ ord: e.target.value || null })}
              className="max-w-[48vw] bg-transparent text-[11.5px] font-semibold text-[var(--color-apple-text)] outline-none sm:max-w-[260px]"
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
        </div>
        {syncMsg && !syncBusy ? <p className="mt-0.5 text-center text-[11px] text-[#8e8e93]">{syncMsg}</p> : null}
      </header>

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
        renderItem={(v) => (
          <IrissListingVehicleCard
            v={v}
            nowMs={nowMs}
            prefs={prefs}
            onPrefs={applyPrefs}
            linked={linkedOrdersOf(v, prefs, orderById, matchOrderIds)}
            budget={budgetOf(v, prefs, orderById, matchOrderIds)}
            matchNew={listingIsMatchNew(v.id, linkedOrdersOf(v, prefs, orderById, matchOrderIds))}
            duplicates={duplicatesByListing[v.id] ?? []}
            onOpen={() => {
              setDrawerId(v.id);
              void markListingViewed(v.id);
            }}
            onPreviewOrder={(o) => {
              const linked = linkedOrdersOf(v, prefs, orderById, matchOrderIds);
              setPreviewOrders(linked.length > 0 ? linked : [o]);
            }}
            mobile={mobile}
            imageHidden={Boolean(hiddenImages[v.id])}
            onImageError={() => setHiddenImages((prev) => ({ ...prev, [v.id]: true }))}
            onVinPatch={(id, patch) => setVinPatch((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
            onCreateOrder={async (vehicle) => {
              const seed = irissPasutijumsSeedFromListing(vehicle, crypto.randomUUID(), new Date().toISOString());
              const res = await fetch("/api/admin/iriss-pasutijumi", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ record: seed, listingVehicleId: vehicle.id }),
              });
              const data = (await res.json().catch(() => ({}))) as { id?: unknown };
              if (!res.ok || typeof data.id !== "string") return;
              router.push(`/admin/iriss/pasutijumi/${encodeURIComponent(data.id)}`);
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
            linked={linkedOrdersOf(drawerVehicle, prefs, orderById, matchOrderIds)}
            budget={budgetOf(drawerVehicle, prefs, orderById, matchOrderIds)}
            onClose={() => setDrawerId(null)}
            onPrefs={applyPrefs}
            onPreviewOrder={(o) => {
              const linked = linkedOrdersOf(drawerVehicle, prefs, orderById, matchOrderIds);
              setPreviewOrders(linked.length > 0 ? linked : [o]);
            }}
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

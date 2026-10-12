"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IrissListDrawer } from "@/components/admin/IrissListDrawer";
import { IrissListingOrderChips } from "@/components/admin/IrissListingOrderChips";
import { IrissListingOrderPreview } from "@/components/admin/IrissListingOrderPreview";
import { IrissListingSourceExtras, IrissListingSourceOpen } from "@/components/admin/IrissListingSourceOpen";
import { IrissListingsLoginButton } from "@/components/admin/IrissListingsLoginPanel";
import { IrissListTaxBadge } from "@/components/admin/IrissListTaxBadge";
import { useMobilePlatform } from "@/hooks/useMobilePlatform";
import { listingAuctionTypeLabel, isRealListingPriceChange } from "@/lib/iriss-listings-auto1-cents";
import { listingBidPrice, listingExtrasI, listingFinalPrice, listingMaxBid, listingRealCost, listingVatShareLine, type ListingCostParts } from "@/lib/iriss-listings-cost";
import { countryFlagLabel } from "@/lib/iriss-listings-country-flag";
import { classifyListingDamage, listingHasHardTechDamage } from "@/lib/iriss-listings-damage";
import { resolveListingDetailUrl } from "@/lib/iriss-listings-detail-url";
import type { IrissMobilePlatform } from "@/lib/iriss-listings-mobile-platform";
import {
  LISTING_SORTS,
  type ListingSort,
  listingYearLabel,
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
import { nextIrissListingsAutomaticReadLabel } from "@/lib/iriss-listings-schedule";
import {
  defaultIrissListPrefs,
  irissListBrowserStorage,
  listingCostsFor,
  migrateIrissListPrefs,
  persistIrissListPrefs,
  type IrissListPrefs,
  type IrissListTab,
} from "@/lib/iriss-listings-operator-prefs";
import { formatListingPowerKwLabel } from "@/lib/engine-power-kw";
import {
  computeListingVatHealth,
  listingTaxCostArgs,
  listingTaxResolved,
  type ListingTax,
} from "@/lib/iriss-listings-vat";
import {
  IRISS_LISTING_PLATFORMS,
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
};

const PLATFORM_LABEL_LONG: Record<IrissListingPlatform, string> = {
  autobid: "Autobid",
  openline: "Openlane",
  auto1: "Auto1",
};

/** „Jauns” un „cena mainīta” rāda pēc laika loga, ne tikai pēdējās palaišanas, lai atkārtots „Nolasīt tagad” tos neizdzēš. */
const RECENT_WINDOW_HOURS = 36;

type Tab = IrissListTab;

function platformBadgeClass(platform: IrissListingPlatform): string {
  if (platform === "autobid") return "bg-violet-50 text-violet-800 border-violet-200/80";
  if (platform === "openline") return "bg-indigo-50 text-indigo-800 border-indigo-200/80";
  return "bg-amber-50 text-amber-800 border-amber-200/80";
}

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

function healthClass(status: IrissPlatformHealthItem["status"]): string {
  if (status === "ok") return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
  if (status === "stale" || status === "no_sources" || status === "not_run") return "bg-slate-50 text-slate-700 border-slate-200/90";
  if (status === "relay_not_configured") return "bg-sky-50 text-sky-900 border-sky-200/80";
  if (status === "login_required") return "bg-amber-50 text-amber-900 border-amber-200/80";
  if (status === "blocked_by_waf") return "bg-orange-50 text-orange-950 border-orange-200/90";
  return "bg-red-50 text-red-900 border-red-200/80";
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

function fmtKm(n: number | null): string {
  if (n === null) return "";
  return `${Math.round(n).toLocaleString("lv-LV")} km`;
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

function stageLabel(stage: string): string {
  const s = stage.toUpperCase();
  if (s === "BEFORE_AUCTION") return "pirms izsoles";
  if (s === "IN_AUCTION" || s === "RUNNING") return "izsole notiek";
  if (s === "AFTER_AUCTION" || s === "FINISHED") return "izsole beigusies";
  return stage ? stage.toLowerCase().replace(/_/g, " ") : "";
}

function taxOf(v: IrissListingVehicle, prefs: IrissListPrefs): ListingTax {
  return listingTaxResolved(v, prefs.taxOv[v.id]);
}

function extrasOf(v: IrissListingVehicle, prefs: IrissListPrefs): number {
  return listingExtrasI(listingCostsFor(prefs, v.id));
}

function linkedOrdersOf(
  v: Pick<IrissListingVehicle, "id" | "orderIds">,
  prefs: IrissListPrefs,
  byId: ReadonlyMap<string, IrissListingOrderBrief>,
): IrissListingOrderBrief[] {
  return listingLinkedOrders(listingVehicleOrderIds(v.id, v.orderIds, prefs.orderOv), byId);
}

function budgetOf(
  v: Pick<IrissListingVehicle, "id" | "orderIds">,
  prefs: IrissListPrefs,
  byId: ReadonlyMap<string, IrissListingOrderBrief>,
): number | null {
  return listingBudgetForVehicle(null, linkedOrdersOf(v, prefs, byId));
}

function roomOf(v: IrissListingVehicle, prefs: IrissListPrefs, budget: number | null): number | null {
  if (budget == null) return null;
  const bid = listingBidPrice(v);
  if (bid == null) return null;
  const args = listingTaxCostArgs(taxOf(v, prefs));
  return listingMaxBid(args.kind, args.foreignVatPct, budget, extrasOf(v, prefs)) - bid;
}

function daysInAuction(v: IrissListingVehicle, nowMs: number | null): string {
  if (nowMs == null) return "";
  const t = Date.parse(v.auctionStartAt || v.firstSeenAt);
  if (!Number.isFinite(t)) return "";
  const d = (nowMs - t) / 86_400_000;
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} h izsolē` : `${Math.floor(d)} d izsolē`;
}

function countdown(endIso: string, nowMs: number | null): { t: string; k: string } {
  if (nowMs == null) return { t: "\u00a0", k: "text-slate-400" };
  if (!endIso.trim()) return { t: "Beigu laiks nav zināms", k: "text-slate-400" };
  const end = Date.parse(endIso);
  if (!Number.isFinite(end)) return { t: "Beigu laiks nav zināms", k: "text-slate-400" };
  const ms = end - nowMs;
  if (ms <= 0) return { t: "Beigusies", k: "text-slate-400" };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return { t: d ? `${d} d ${clock}` : clock, k: ms < 36e5 ? "text-red-600" : ms < 86_400_000 ? "text-orange-600" : "text-[var(--color-apple-text)]" };
}

function TaxBadge({ tax, size = "sm" }: { tax: ListingTax; size?: "sm" | "md" }) {
  return <IrissListTaxBadge tax={tax} size={size} />;
}

function CountryFlag({ code }: { code: string }) {
  const f = countryFlagLabel(code);
  if (!f) return null;
  return (
    <span title={f.title} aria-label={f.title}>
      {f.flag}
    </span>
  );
}

/** Atverot lapu vienmēr: cilne „Jauni”, kārtot „Jaunākie” (neatjauno no localStorage). */
const DEFAULT_SORT: ListingSort = "seen";

type Props = {
  latest: IrissListingsLatestView | null;
  orders: IrissListingOrderBrief[];
};

const SOURCE_CHIPS: ReadonlyArray<{ id: IrissListingPlatform; label: string }> = [
  { id: "autobid", label: "Autobid" },
  { id: "openline", label: "Openlane" },
  { id: "auto1", label: "Auto1" },
];

export function IrissSludinajumiListClient({ latest, orders }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hiddenImages, setHiddenImages] = useState<Record<string, true>>({});
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<IrissPlatformHealthReport | null>(null);
  const [query, setQuery] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<IrissListPrefs>(defaultIrissListPrefs);
  const [prefsReady, setPrefsReady] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [previewOrders, setPreviewOrders] = useState<IrissListingOrderBrief[] | null>(null);
  const [showCosts, setShowCosts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const mobile = useMobilePlatform();
  const restoredQueryRef = useRef(false);
  const tab = prefs.tab;
  const listScope = prefs.listScope;
  const hideTech = prefs.hideTech;
  const sort = parseListingSort(searchParams.get("sort")) ?? DEFAULT_SORT;
  const sources = parseListingSources(searchParams.get("src"));
  const priceMin = parsePriceBound(searchParams.get("min"));
  const priceMax = parsePriceBound(searchParams.get("max"));
  const orderFilter = parseListingOrderFilter(searchParams.get("ord"));
  const orderById = useMemo(() => listingOrdersById(orders), [orders]);

  useEffect(() => {
    const storage = irissListBrowserStorage();
    const loaded = storage ? migrateIrissListPrefs(storage) : defaultIrissListPrefs();
    setPrefs({ ...loaded, tab: "new", listScope: "all", sort: null, budget: null });
    setPrefsReady(true);
    setMounted(true);
    setNowMs(Date.now());
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

  useEffect(() => {
    if (!drawerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerId(null);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
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

  const vehicles = useMemo(() => latest?.vehicles ?? [], [latest?.vehicles]);

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
      const linked = linkedOrdersOf(v, prefs, orderById);
      if (!vehicleMatchesOrderFilter(linked, orderFilter)) return false;
      if (!q) return true;
      const hay = `${v.title} ${v.manufacturer} ${v.year} ${v.location} ${v.orderBrandModels.join(" ")} ${linked.map((o) => `${o.clientName} ${o.brandModel} ${o.preferredColors} ${o.brief}`).join(" ")} ${PLATFORM_LABEL_LONG[v.platform]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, tab, query, nowMs, sources, priceMin, priceMax, listScope, prefs, hideTech, orderById, orderFilter]);

  const sorted = useMemo(() => {
    const withRoom = visible.map((v) => ({ ...v, _room: roomOf(v, prefs, budgetOf(v, prefs, orderById)) }));
    // Favorīts nepārvieto auto saraksta augšā (lai lapa nelec); favorīti ir cilnē „★ Favorīti”.
    return sortListingVehicles(withRoom, sort, nowMs ?? Number.POSITIVE_INFINITY);
  }, [visible, sort, nowMs, prefs, orderById]);

  const vatHealth = useMemo(() => latest?.vatHealth ?? computeListingVatHealth(vehicles), [latest?.vatHealth, vehicles]);
  const drawerVehicle = useMemo(() => vehicles.find((v) => v.id === drawerId) ?? null, [vehicles, drawerId]);
  const techCount = useMemo(() => vehicles.filter((v) => v.change !== "gone" && !prefs.hidden.includes(v.id) && listingHasHardTechDamage(v.damageRaw)).length, [vehicles, prefs.hidden]);
  const favCount = prefs.fav.filter((id) => vehicles.some((v) => v.id === id)).length;
  const hiddenCount = prefs.hidden.filter((id) => vehicles.some((v) => v.id === id)).length;

  const problemSources = useMemo(() => (latest?.sources ?? []).filter((s) => s.status !== "ok"), [latest?.sources]);

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
        if (body.skipped === "already_done" || total === 0 || done >= total || done === prevDone) break;
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
        (o) => o.listStatus === "active" || vehicles.some((v) => listingVehicleOrderIds(v.id, v.orderIds, prefs.orderOv).includes(o.id)),
        serializeListingOrderFilter,
        fmtEur,
      ),
    [orders, vehicles, prefs.orderOv],
  );
  const platformDots = (["auto1", "openline", "autobid"] as const).map((platform) => {
    const h = vatHealth[platform];
    const login = health?.items.find((x) => x.platform === platform);
    const warn = h.stale + h.missingFields + h.rateMissing + h.conflict + h.defaultUnrecognised;
    const bad = h.level === "red" || (login && login.status !== "ok" && login.status !== "stale" && login.status !== "not_run" && login.status !== "no_sources");
    const amber = h.level === "amber" || warn > 0 || login?.status === "stale";
    const label = platform === "auto1" ? "Auto1" : platform === "openline" ? "Openlane" : "Autobid";
    const vat =
      platform === "auto1"
        ? `${h.margin} Margin · ${h.gross} ar PVN · ${warn} ⚠`
        : platform === "openline"
          ? `${h.margin} · ${h.net} NETO · ${warn} ⚠`
          : `${h.margin} · ${h.gross} · ${warn} ⚠`;
    return { platform, label, vat, tone: bad ? "bg-red-500" : amber ? "bg-amber-400" : "bg-emerald-500", title: `${label}: ${login ? healthLabel(login.status) : "nav pārbaudīts"} · ${vat}${h.reason ? ` · ${h.reason}` : ""}` };
  });
  const activeFilterCount = (sources.length > 0 ? 1 : 0) + (priceMin != null || priceMax != null ? 1 : 0) + (hideTech ? 1 : 0) + (listScope === "hidden" ? 1 : 0);

  function setGlobalCost(part: keyof ListingCostParts, value: number) {
    setPrefs((p) => ({ ...p, costs: { ...p.costs, [part]: value } }));
  }

  return (
    <div className="mt-2 space-y-2 touch-manipulation sm:mt-3 sm:space-y-3">
      {/* min-7: centrēta segmentu vadīkla + izvēršama meklēšana + filtri + „⋯”; zem tās sīka pelēka statusa rinda. */}
      <header className="sticky top-0 z-20 -mx-2 bg-[#F8F8F9]/95 px-2 pb-1.5 pt-1 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex items-center justify-center gap-2 sm:gap-2.5">
          <div className="flex min-w-0 max-w-full overflow-x-auto rounded-[10px] bg-[#e9e9ee] p-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, tab: t.id }))}
                className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-[8px] px-3 text-[12.5px] transition sm:h-7 ${
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
              className="h-9 w-40 shrink rounded-[9px] bg-[#e9e9ee] px-3 text-base text-[var(--color-apple-text)] outline-none placeholder:text-[#8e8e93] sm:h-7 sm:w-64 sm:text-[12.5px]"
            />
          ) : (
            <button type="button" aria-label="Meklēt" onClick={() => setSearchOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] text-[#8e8e93] hover:bg-[#e9e9ee] sm:h-7 sm:w-7">
              ⌕
            </button>
          )}
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Filtri"
              onClick={() => { setFilterOpen((v) => !v); setMenuOpen(false); }}
              className={`grid h-9 w-9 place-items-center rounded-full text-[14px] hover:bg-[#e9e9ee] sm:h-7 sm:w-7 ${activeFilterCount > 0 ? "text-[var(--color-provin-accent)]" : "text-[#8e8e93]"}`}
            >
              ⚲{activeFilterCount > 0 ? <sup className="text-[9px] font-semibold">{activeFilterCount}</sup> : null}
            </button>
            {filterOpen ? (
              <div className="fixed inset-x-2 bottom-2 z-40 rounded-2xl bg-white p-3.5 text-[12px] shadow-[0_10px_32px_rgba(0,0,0,0.16)] sm:absolute sm:inset-auto sm:right-0 sm:top-9 sm:w-[300px] sm:rounded-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Avots</p>
                <div className="mt-1 flex gap-1.5">
                  {SOURCE_CHIPS.map((src) => {
                    const on = sources.length === 0 || sources.includes(src.id);
                    return (
                      <button key={src.id} type="button" aria-pressed={on} onClick={() => toggleSource(src.id)} className={`h-9 rounded-lg px-2.5 text-[12px] font-semibold sm:h-7 ${on ? "bg-[var(--color-apple-text)] text-white" : "bg-[#f2f2f5] text-[#8e8e93]"}`}>
                        {src.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Cena €</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <input type="number" min={0} inputMode="numeric" aria-label="Cena no" placeholder="No" defaultValue={searchParams.get("min") ?? ""} key={`min-${searchParams.get("min") ?? ""}`} onBlur={(e) => writeListQuery({ min: e.target.value.trim() })} className="h-9 w-full rounded-lg bg-[#f2f2f5] px-2.5 text-base outline-none sm:h-7 sm:text-[12px]" />
                  <span className="text-[#8e8e93]">–</span>
                  <input type="number" min={0} inputMode="numeric" aria-label="Cena līdz" placeholder="Līdz" defaultValue={searchParams.get("max") ?? ""} key={`max-${searchParams.get("max") ?? ""}`} onBlur={(e) => writeListQuery({ max: e.target.value.trim() })} className="h-9 w-full rounded-lg bg-[#f2f2f5] px-2.5 text-base outline-none sm:h-7 sm:text-[12px]" />
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Kārtot</p>
                <select aria-label="Kārtot pēc" value={sort} onChange={(e) => { const next = parseListingSort(e.target.value); if (next) writeListQuery({ sort: next }); }} className="mt-1 h-9 w-full rounded-lg bg-[#f2f2f5] px-2 text-base font-semibold outline-none sm:h-7 sm:text-[12px]">
                  {LISTING_SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
                <label className="mt-3 flex items-center gap-2 font-medium">
                  <input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={hideTech} onChange={(e) => setPrefs((p) => ({ ...p, hideTech: e.target.checked }))} />
                  Slēpt ar motora/kārbas bojājumiem ({techCount})
                </label>
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={listScope === "hidden"} onChange={(e) => setPrefs((p) => ({ ...p, listScope: e.target.checked ? "hidden" : "all" }))} />
                  Rādīt tikai paslēptos ({hiddenCount})
                </label>
                <button type="button" onClick={() => setFilterOpen(false)} className="mt-3 h-10 w-full rounded-lg bg-[var(--color-provin-accent)] text-[12.5px] font-semibold text-white sm:h-8">
                  Rādīt {sorted.length} auto
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative shrink-0">
            <button type="button" aria-label="Vairāk" onClick={() => { setMenuOpen((v) => !v); setFilterOpen(false); }} className="grid h-9 w-9 place-items-center rounded-full text-[16px] text-[#8e8e93] hover:bg-[#e9e9ee] sm:h-7 sm:w-7">
              ⋯
            </button>
            {menuOpen ? (
              <div className="fixed inset-x-2 bottom-2 z-40 max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-3.5 text-[12px] shadow-[0_10px_32px_rgba(0,0,0,0.16)] sm:absolute sm:inset-auto sm:right-0 sm:top-9 sm:w-[340px] sm:rounded-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Nolasīšana</p>
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-y-0.5">
                  <span className="text-[#8e8e93]">Pēdējā</span><span>{mounted && latest?.summary.finishedAt ? fmtDateTime(latest.summary.finishedAt) : "nav veikta"}</span>
                  <span className="text-[#8e8e93]">Nākamā automātiskā</span><span>{mounted ? nextIrissListingsAutomaticReadLabel(new Date(), latest?.lastAutomaticSlot) : "\u00a0"}</span>
                  <span className="text-[#8e8e93]">Avoti OK · Auto · Jauni · Cenas</span><span>{latest?.summary.okCount ?? 0}/{latest?.summary.totalSources ?? 0} · {counts.all} · {mounted ? counts.fresh : ""} · {mounted ? counts.price : ""}</span>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">PVN pa avotiem</p>
                {platformDots.map((d) => (
                  <div key={d.platform} className="flex justify-between gap-3 py-0.5" title={d.title}>
                    <span className="flex items-center gap-1.5"><i className={`inline-block h-2 w-2 rounded-full ${d.tone}`} />{d.label}</span>
                    <span className="text-[#8e8e93]">{d.vat}</span>
                  </div>
                ))}
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">Pieslēgumi</p>
                {(mounted && health?.items ? health.items : IRISS_LISTING_PLATFORMS.map((platform) => ({ platform, status: "not_run" as const, note: "", checkedAt: "" }))).map((item) => (
                  <div key={item.platform} className="flex items-center justify-between gap-2 py-0.5">
                    <span title={item.note} className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${healthClass(item.status)}`}>
                      {PLATFORM_LABEL_LONG[item.platform]}: {healthLabel(item.status)}
                    </span>
                    <IrissListingsLoginButton platform={item.platform} onDone={() => void loadHealth()} />
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
                            <span className={`rounded-full border px-1.5 text-[10px] font-semibold ${platformBadgeClass(src.platform)}`}>{PLATFORM_LABEL[src.platform]}</span>
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
                <p className="mt-1 text-[10.5px] text-[#8e8e93]">Budžets – no pasūtījumiem.</p>
                <button type="button" onClick={() => setMenuOpen(false)} className="mt-3 h-10 w-full rounded-lg bg-[#f2f2f5] text-[12.5px] font-semibold sm:hidden">Aizvērt</button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] text-[#8e8e93]">
          <span className="inline-flex items-center gap-1.5">
            {platformDots.map((d) => (
              <span key={d.platform} title={d.title} className="inline-flex items-center gap-1">
                <i className={`inline-block h-[7px] w-[7px] rounded-full ${d.tone}`} />
                <span className="hidden sm:inline">{d.label}</span>
              </span>
            ))}
          </span>
          <span>
            Nolasīts {mounted && latest?.summary.finishedAt ? fmtDateTime(latest.summary.finishedAt) : latest?.summary.finishedAt ? "\u00a0" : "nav"}
            <span className="hidden sm:inline"> · nākamā {mounted ? nextIrissListingsAutomaticReadLabel(new Date(), latest?.lastAutomaticSlot) : "\u00a0"}</span>
            {" "}· {latest?.summary.okCount ?? 0}/{latest?.summary.totalSources ?? 0} avoti OK
          </span>
          <button type="button" onClick={() => void syncNow()} disabled={syncBusy} className="font-semibold text-[var(--color-provin-accent)] disabled:opacity-55">
            {syncBusy ? (syncMsg && /\d+\/\d+/.test(syncMsg) ? syncMsg.replace(" meklējumi nolasīti", "") : "Nolasa…") : "Nolasīt"}
          </button>
          <span className="text-[#d1d1d6]">|</span>
          <label className="inline-flex max-w-[60vw] items-center gap-1">
            <span>Klients</span>
            <select
              aria-label="Klients un pasūtījums"
              value={serializeListingOrderFilter(orderFilter)}
              onChange={(e) => writeListQuery({ ord: e.target.value || null })}
              className="max-w-[48vw] bg-transparent text-[11.5px] font-semibold text-[var(--color-apple-text)] outline-none sm:max-w-[260px]"
            >
              <option value="">Visi klienti</option>
              {clientOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.indent ? "\u00a0\u00a0\u00a0— " : ""}
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {syncMsg && !syncBusy ? <p className="mt-0.5 text-center text-[11px] text-[#8e8e93]">{syncMsg}</p> : null}
      </header>

      {visible.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-black">
            {vehicles.length === 0 ? "Nav nolasītu auto" : "Šajā filtrā nav auto"}
          </p>
          <p className="mt-1.5 text-[12px] text-[var(--color-provin-muted)]">
            {vehicles.length === 0
              ? "Spied „Nolasīt tagad”, lai ievāktu datus uzreiz, vai sagaidi ikdienas nolasīšanu. Lasa tikai aktīvo pasūtījumu izsoļu saites."
              : "Izvēlies citu cilni, avotu vai notīri meklēšanu un cenas diapazonu."}
          </p>
        </section>
      ) : null}

      <div className="space-y-1.5 sm:space-y-2">
        {sorted.map((v) => (
          <VehicleCard
            key={v.id}
            v={v}
            nowMs={nowMs}
            prefs={prefs}
            onPrefs={setPrefs}
            linked={linkedOrdersOf(v, prefs, orderById)}
            budget={budgetOf(v, prefs, orderById)}
            onOpen={() => setDrawerId(v.id)}
            onPreviewOrder={(o) => {
              const linked = linkedOrdersOf(v, prefs, orderById);
              setPreviewOrders(linked.length > 0 ? linked : [o]);
            }}
            mobile={mobile}
            imageHidden={Boolean(hiddenImages[v.id])}
            onImageError={() => setHiddenImages((prev) => ({ ...prev, [v.id]: true }))}
          />
        ))}
      </div>

      {drawerVehicle ? (
        <>
          <button type="button" className="fixed inset-0 z-40 hidden bg-slate-900/20 sm:block" aria-label="Aizvērt atvilktni" onClick={() => setDrawerId(null)} />
          <IrissListDrawer
            v={drawerVehicle}
            prefs={prefs}
            orders={orders}
            linked={linkedOrdersOf(drawerVehicle, prefs, orderById)}
            budget={budgetOf(drawerVehicle, prefs, orderById)}
            onClose={() => setDrawerId(null)}
            onPrefs={setPrefs}
            onPreviewOrder={(o) => {
              const linked = linkedOrdersOf(drawerVehicle, prefs, orderById);
              setPreviewOrders(linked.length > 0 ? linked : [o]);
            }}
            mobile={mobile}
          />
        </>
      ) : null}
      {previewOrders && previewOrders.length > 0 ? (
        <IrissListingOrderPreview orders={previewOrders} onClose={() => setPreviewOrders(null)} />
      ) : null}
    </div>
  );
}

function VehicleCard({
  v,
  nowMs,
  prefs,
  onPrefs,
  linked,
  budget,
  onOpen,
  onPreviewOrder,
  mobile,
  imageHidden,
  onImageError,
}: {
  v: IrissListingVehicle;
  nowMs: number | null;
  prefs: IrissListPrefs;
  onPrefs: (next: IrissListPrefs) => void;
  linked: IrissListingOrderBrief[];
  budget: number | null;
  onOpen: () => void;
  onPreviewOrder: (order: IrissListingOrderBrief) => void;
  mobile: IrissMobilePlatform | null;
  imageHidden: boolean;
  onImageError: () => void;
}) {
  const fresh = isNew(v, nowMs);
  const changes = recentPriceChanges(v, nowMs);
  const gone = v.change === "gone";
  const tax = taxOf(v, prefs);
  const extras = extrasOf(v, prefs);
  const bid = listingBidPrice(v);
  const taxArgs = listingTaxCostArgs(tax);
  const real = bid == null ? null : listingRealCost(taxArgs.kind, taxArgs.foreignVatPct, bid, extras);
  const gala = bid == null ? null : listingFinalPrice(tax, bid, extras);
  const mb = budget != null ? listingMaxBid(taxArgs.kind, taxArgs.foreignVatPct, budget, extras) : null;
  const room = mb != null && bid != null ? mb - bid : null;
  const dmg = classifyListingDamage(v.damageRaw);
  const fav = prefs.fav.includes(v.id);
  const hidden = prefs.hidden.includes(v.id);
  const customCost = Boolean(prefs.costOv[v.id]);
  const auctionTypeLabel = listingAuctionTypeLabel(v.auctionType);
  const cd = countdown(v.auctionEndAt, nowMs);
  const yearLabel = listingYearLabel(v);
  const sourceHref = resolveListingDetailUrl(v);
  const powerKwLabel = formatListingPowerKwLabel(v.powerKw);
  const specs = [yearLabel, fmtKm(v.mileageKm), v.fuel, v.transmission, powerKwLabel, v.location].filter(Boolean);
  const left = gala != null && budget != null ? budget - gala : null;
  const border =
    gone ? "border-[#E5E7EB] opacity-70" : fav ? "border-amber-200" : fresh ? "border-emerald-200" : changes.length > 0 ? "border-sky-200" : "border-[#E5E7EB]";
  const accent = v.platform === "autobid" ? "border-l-violet-500" : v.platform === "openline" ? "border-l-indigo-600" : "border-l-amber-500";

  function toggle(list: "fav" | "hidden") {
    const cur = prefs[list];
    const next = cur.includes(v.id) ? cur.filter((x) => x !== v.id) : [...cur, v.id];
    onPrefs({ ...prefs, [list]: next });
  }

  const mobileSpecs = [yearLabel, fmtKm(v.mileageKm), v.transmission, powerKwLabel].filter(Boolean);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`flex cursor-pointer flex-col gap-2 rounded-xl border border-l-[5px] bg-white p-2 shadow-sm [content-visibility:auto] [contain-intrinsic-size:1px_132px] touch-manipulation hover:border-slate-300 sm:flex-row sm:flex-nowrap sm:items-start sm:gap-3 sm:rounded-2xl sm:p-3.5 sm:[content-visibility:visible] ${border} ${accent} ${fav ? "shadow-[0_0_0_2px_#fde68a]" : ""} ${hidden ? "opacity-50" : ""}`}
    >
      <div className="flex min-w-0 gap-2 sm:contents">
        <div className="shrink-0" onClick={(e) => sourceHref && e.stopPropagation()}>
          {v.imageUrl && !imageHidden ? (
            sourceHref ? (
              <IrissListingSourceOpen v={v} mobile={mobile} title={`Atvērt ${PLATFORM_LABEL[v.platform]}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.imageUrl}
                  alt={v.title || "Auto foto"}
                  loading="lazy"
                  referrerPolicy={v.platform === "openline" || /images\.openlane\.eu/i.test(v.imageUrl) ? "no-referrer" : undefined}
                  className="h-16 w-[4.5rem] rounded-md border border-slate-200/90 bg-slate-50 object-cover sm:h-[88px] sm:w-32 sm:rounded-lg"
                  onError={onImageError}
                />
              </IrissListingSourceOpen>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.imageUrl}
                alt={v.title || "Auto foto"}
                loading="lazy"
                referrerPolicy={v.platform === "openline" || /images\.openlane\.eu/i.test(v.imageUrl) ? "no-referrer" : undefined}
                className="h-16 w-[4.5rem] rounded-md border border-slate-200/90 bg-slate-50 object-cover sm:h-[88px] sm:w-32 sm:rounded-lg"
                onError={onImageError}
              />
            )
          ) : (
            <div className="flex h-16 w-[4.5rem] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 sm:h-[88px] sm:w-32 sm:rounded-lg sm:text-[10px]">
              Nav foto
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {sourceHref ? (
              <IrissListingSourceOpen
                v={v}
                mobile={mobile}
                title={`Atvērt ${PLATFORM_LABEL[v.platform]}`}
                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px] ${platformBadgeClass(v.platform)}`}
              >
                {PLATFORM_LABEL[v.platform]}
              </IrissListingSourceOpen>
            ) : (
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px] ${platformBadgeClass(v.platform)}`}>
                {PLATFORM_LABEL[v.platform]}
              </span>
            )}
            <IrissListingSourceExtras v={v} mobile={mobile} />
            <CountryFlag code={v.countryCode} />
            <span className="hidden sm:inline">{daysInAuction(v, nowMs) ? <span className="inline-flex rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{daysInAuction(v, nowMs)}</span> : null}</span>
            {v.bidCount != null ? <span className="hidden rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline-flex">{v.bidCount} solījumi</span> : null}
            {auctionTypeLabel ? <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 sm:inline-flex">{auctionTypeLabel}</span> : null}
            {gone ? <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 sm:px-2 sm:text-[10px]">PAZUDIS</span> : null}
            {!gone && fresh ? <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 sm:px-2 sm:text-[10px]">JAUNS</span> : null}
            {customCost ? <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 sm:inline-flex" title="Izmaksas šim auto mainītas">I {fmtEur(extras)}</span> : null}
          </div>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <div className="truncate text-[13px] font-semibold leading-tight text-[var(--color-apple-text)] sm:text-[15px]" title={v.title}>
              {v.title || v.orderBrandModels[0] || "-"}
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500 sm:text-[12px]">{yearLabel}</span>
            {powerKwLabel ? (
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--color-apple-text)] sm:text-[12px]">{powerKwLabel}</span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-[var(--color-provin-muted)] sm:text-[12px] sm:hidden">{mobileSpecs.join(" · ")}</p>
          <p className="hidden truncate text-[12px] text-[var(--color-provin-muted)] sm:block">{specs.join(" · ")}</p>
          <div className="flex flex-wrap gap-1">
            {dmg.status === "nodata" ? (
              <span className="hidden rounded-md border border-[#E5E7EB] bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 sm:inline">
                {v.platform === "auto1" ? "bojājumi detaļās" : "Nav datu"}
              </span>
            ) : null}
            {dmg.status === "none" ? <span className="hidden rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 sm:inline">Tehn. bojājumi nav norādīti</span> : null}
            {dmg.cats.map((c, i) => (
              <span key={c.name} className={`rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px] ${i >= 2 ? "hidden sm:inline" : ""}`}>
                ⚠ {c.name}
              </span>
            ))}
            {dmg.cats.length > 2 ? <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white sm:hidden">+{dmg.cats.length - 2}</span> : null}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <IrissListingOrderChips orders={linked} onPreview={onPreviewOrder} />
          </div>
          <input
            className={`mt-1 hidden w-full rounded-md border border-dashed px-2 py-1 text-[12px] outline-none sm:block ${prefs.notes[v.id] ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}
            placeholder="✎ Pierakstīt piezīmi"
            value={prefs.notes[v.id] ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onPrefs({ ...prefs, notes: { ...prefs.notes, [v.id]: e.target.value } })}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-1 sm:hidden" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" title={fav ? "Noņemt no favorītiem" : "Favorīts"} onClick={() => toggle("fav")} className={`grid h-11 w-11 place-items-center rounded-lg border text-lg ${fav ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[#E5E7EB] bg-white"}`}>
            {fav ? "★" : "☆"}
          </button>
          <button type="button" title={hidden ? "Rādīt atkal" : "Nav interesanti"} onClick={() => toggle("hidden")} className="grid h-11 w-11 place-items-center rounded-lg border border-[#E5E7EB] bg-white text-lg">
            {hidden ? "↺" : "✕"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-dashed border-[#E5E7EB] pt-1.5 sm:contents">
        <div className="grid gap-0.5 sm:min-w-[165px] sm:justify-items-end sm:text-right">
          <div className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:block">Pašreizējā cena</div>
          <div className="flex flex-wrap items-center gap-1 sm:justify-end">
            <span className="text-[18px] font-extrabold tabular-nums leading-none sm:text-[22px]">{bid == null ? "-" : fmtEur(bid)}</span>
            <TaxBadge tax={tax} size="md" />
          </div>
          {v.priceBuyNow != null && v.priceBuyNow !== bid ? <div className="hidden text-[11px] text-slate-500 sm:block">pirkt uzreiz {fmtEur(v.priceBuyNow)}</div> : null}
          <div className={`text-[11px] font-extrabold tabular-nums sm:text-[12px] ${cd.k}`}>{cd.t}</div>
          {v.auctionStage ? <div className="hidden text-[11px] text-slate-500 sm:block">{stageLabel(v.auctionStage)}</div> : null}
        </div>

        <div className="grid gap-0.5 sm:min-w-[175px] sm:border-l sm:border-dashed sm:border-[#E5E7EB] sm:pl-3">
          {bid == null || !real ? (
            <div className="text-[11px] tabular-nums text-slate-500">
              {budget != null ? (
                <>
                  Budžets <b className="text-[var(--color-apple-text)]">{fmtEur(budget)}</b>
                </>
              ) : (
                <span className="font-semibold text-amber-900">Budžets nav</span>
              )}
              {bid == null ? " · Cenas nav" : ""}
            </div>
          ) : (
            <>
              {budget != null ? (
                <div className="hidden justify-between text-[11px] tabular-nums sm:flex">
                  <span>Budžets</span>
                  <b>{fmtEur(budget)}</b>
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-amber-900">Budžets nav</div>
              )}
              <div className="flex justify-between text-[11px] tabular-nums"><span>Gala</span><b>{fmtEur(gala ?? real.total)}</b></div>
              <div className="text-[10px] leading-snug text-slate-500">{listingVatShareLine(real, fmtEur)}</div>
              {left != null ? (
                <div>
                  {left >= 0 ? (
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 sm:text-[11px]">+{fmtEur(left)}</span>
                  ) : (
                    <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-extrabold text-red-800 sm:text-[11px]">-{fmtEur(-left)}</span>
                  )}
                </div>
              ) : null}
              {mb != null ? <div className="flex justify-between text-[11px] tabular-nums text-slate-500"><span>Maks.</span><b className="text-[var(--color-apple-text)]">{fmtEur(mb)}</b></div> : null}
              {room != null ? (
                <div className="hidden justify-between text-[11px] tabular-nums text-slate-500 sm:flex">
                  <span>{room >= 0 ? "var solīt vēl" : "virs maks."}</span>
                  <span>{fmtEur(Math.abs(room))}</span>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="hidden flex-col gap-1.5 sm:flex" onClick={(e) => e.stopPropagation()}>
        <button type="button" title={fav ? "Noņemt no favorītiem" : "Favorīts"} onClick={() => toggle("fav")} className={`grid h-11 w-11 place-items-center rounded-lg border ${fav ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[#E5E7EB] bg-white"}`}>
          {fav ? "★" : "☆"}
        </button>
        <button type="button" title={hidden ? "Rādīt atkal" : "Nav interesanti"} onClick={() => toggle("hidden")} className="grid h-11 w-11 place-items-center rounded-lg border border-[#E5E7EB] bg-white">
          {hidden ? "↺" : "✕"}
        </button>
      </div>
    </article>
  );
}

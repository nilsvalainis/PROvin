"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IrissListDrawer } from "@/components/admin/IrissListDrawer";
import { IrissListingsLoginButton } from "@/components/admin/IrissListingsLoginPanel";
import { listingBidPrice, listingExtrasI, listingMaxBid, listingRealCost, type ListingCostParts } from "@/lib/iriss-listings-cost";
import { countryFlagLabel } from "@/lib/iriss-listings-country-flag";
import { classifyListingDamage, listingHasHardTechDamage } from "@/lib/iriss-listings-damage";
import {
  LISTING_SORT_STORAGE_KEY,
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
  listingBudgetFor,
  listingClientLabel,
  listingDisplayYear,
  listingOrderNr,
  listingOrderRefs,
  listingSourceUrl,
  parseListingOrderFilter,
  vehicleInOrderFilter,
} from "@/lib/iriss-listings-order-link";
import { defaultIrissListPrefs, IRISS_LIST_PREFS_KEY, listingCostsFor, parseIrissListPrefs, type IrissListPrefs } from "@/lib/iriss-listings-operator-prefs";
import type { IrissPasutijumsListRow } from "@/lib/iriss-pasutijumi-types";
import { listingTaxLabel, listingTaxResolved, type ListingTax } from "@/lib/iriss-listings-vat";
import {
  IRISS_LISTING_PLATFORMS,
  type IrissListingPlatform,
  type IrissListingPriceChange,
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

type Tab = "new" | "price" | "all" | "gone";

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
  return new Intl.DateTimeFormat("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(t));
}

function hoursSince(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (nowMs - t) / 36e5;
}

function isNew(v: IrissListingVehicle, nowMs: number): boolean {
  return v.change !== "gone" && hoursSince(v.firstSeenAt, nowMs) <= RECENT_WINDOW_HOURS;
}

function recentPriceChanges(v: IrissListingVehicle, nowMs: number): IrissListingVehicle["priceHistory"] {
  return v.priceHistory.filter((c) => hoursSince(c.at, nowMs) <= RECENT_WINDOW_HOURS);
}

function stageLabel(stage: string): string {
  const s = stage.toUpperCase();
  if (s === "BEFORE_AUCTION") return "pirms izsoles";
  if (s === "IN_AUCTION" || s === "RUNNING") return "izsole notiek";
  if (s === "AFTER_AUCTION" || s === "FINISHED") return "izsole beigusies";
  return stage ? stage.toLowerCase().replace(/_/g, " ") : "";
}

function priceFieldLabel(field: IrissListingPriceChange["field"]): string {
  if (field === "start") return "sākuma";
  if (field === "minimal") return "min.";
  if (field === "buy_now") return "pirkt tūlīt";
  return "pašreizējā";
}

function taxOf(v: IrissListingVehicle, prefs: IrissListPrefs): ListingTax {
  return listingTaxResolved(v, prefs.taxOv[v.id]);
}

function extrasOf(v: IrissListingVehicle, prefs: IrissListPrefs): number {
  return listingExtrasI(listingCostsFor(prefs, v.id));
}

function roomOf(v: IrissListingVehicle, prefs: IrissListPrefs, ordersById: Record<string, IrissPasutijumsListRow>): number | null {
  const budget = listingBudgetFor(v, prefs, ordersById);
  if (budget.amount == null) return null;
  const bid = listingBidPrice(v);
  if (bid == null) return null;
  const tax = taxOf(v, prefs);
  return listingMaxBid(tax.kind, tax.rate ?? 0, budget.amount, extrasOf(v, prefs)) - bid;
}

function daysInAuction(v: IrissListingVehicle, nowMs: number): string {
  const t = Date.parse(v.auctionStartAt || v.firstSeenAt);
  if (!Number.isFinite(t)) return "";
  const d = (nowMs - t) / 86_400_000;
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} h izsolē` : `${Math.floor(d)} d izsolē`;
}

function countdown(endIso: string, nowMs: number): { t: string; k: string } {
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

function TaxBadge({ tax }: { tax: ListingTax }) {
  const cls =
    tax.kind === "net"
      ? "text-blue-800 bg-blue-50 border-blue-200"
      : tax.kind === "margin"
        ? "text-purple-800 bg-purple-50 border-purple-200"
        : tax.kind === "gross"
          ? "text-orange-800 bg-orange-50 border-orange-200"
          : "text-amber-800 bg-yellow-100 border-yellow-400 border-dashed";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-extrabold ${cls}`} title={tax.raw}>
      {listingTaxLabel(tax)}
    </span>
  );
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

type Props = {
  latest: IrissListingsLatestView | null;
  orders: IrissPasutijumsListRow[];
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
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [prefs, setPrefs] = useState<IrissListPrefs>(defaultIrissListPrefs);
  const [prefsReady, setPrefsReady] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [listScope, setListScope] = useState<"all" | "fav" | "hidden">("all");
  const [hideTech, setHideTech] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const sort = parseListingSort(searchParams.get("sort")) ?? "ending";
  const sources = parseListingSources(searchParams.get("src"));
  const priceMin = parsePriceBound(searchParams.get("min"));
  const priceMax = parsePriceBound(searchParams.get("max"));
  const orderFilter = parseListingOrderFilter(searchParams.get("ord"));
  const ordersById = useMemo(() => Object.fromEntries(orders.map((o) => [o.id, o])), [orders]);

  useEffect(() => {
    setNowMs(Date.now());
  }, [latest?.generatedAt]);

  useEffect(() => {
    setPrefs(parseIrissListPrefs(window.localStorage.getItem(IRISS_LIST_PREFS_KEY)));
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    window.localStorage.setItem(IRISS_LIST_PREFS_KEY, JSON.stringify(prefs));
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
    if (searchParams.get("sort")) {
      window.localStorage.setItem(LISTING_SORT_STORAGE_KEY, sort);
      return;
    }
    const stored = parseListingSort(window.localStorage.getItem(LISTING_SORT_STORAGE_KEY));
    if (!stored || stored === "ending") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", stored);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, sort]);

  function writeListQuery(next: { sort?: ListingSort; sources?: IrissListingPlatform[]; min?: string | null; max?: string | null; ord?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    const sortNext = next.sort ?? sort;
    if (sortNext === "ending") params.delete("sort");
    else params.set("sort", sortNext);
    window.localStorage.setItem(LISTING_SORT_STORAGE_KEY, sortNext);
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
      const id = parseListingOrderFilter(next.ord);
      if (!id) params.delete("ord");
      else params.set("ord", id);
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
      if (!vehicleInOrderFilter(v, orderFilter, prefs)) return false;
      if (!q) return true;
      const refs = listingOrderRefs(v, prefs, ordersById);
      const orderHay = refs.map((r) => `${r.clientName} ${r.brandModel} ${r.notes} ${r.id} ${listingOrderNr(r.id)}`).join(" ");
      const hay = `${v.title} ${v.manufacturer} ${listingDisplayYear(v)} ${v.location} ${v.orderBrandModels.join(" ")} ${orderHay} ${PLATFORM_LABEL_LONG[v.platform]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, tab, query, nowMs, sources, priceMin, priceMax, listScope, prefs, hideTech, orderFilter, ordersById]);

  const sorted = useMemo(() => {
    const withRoom = visible.map((v) => ({ ...v, _room: roomOf(v, prefs, ordersById) }));
    return sortListingVehicles(withRoom, sort, nowMs).sort((a, b) => Number(prefs.fav.includes(b.id)) - Number(prefs.fav.includes(a.id)));
  }, [visible, sort, nowMs, prefs, ordersById]);

  const orderFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ id: string; label: string }> = [];
    const push = (id: string, label: string) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ id, label });
    };
    const ranked = [...orders].sort((a, b) => Number((a.listStatus ?? "active") !== "active") - Number((b.listStatus ?? "active") !== "active"));
    for (const o of ranked) {
      const name = listingClientLabel(o);
      push(o.id, `${name || "Klients ?"} · ${o.brandModel.trim() || listingOrderNr(o.id)}`);
    }
    for (const v of vehicles) {
      for (let i = 0; i < v.orderIds.length; i += 1) {
        const id = v.orderIds[i]!;
        push(id, v.orderBrandModels[i]?.trim() || listingOrderNr(id));
      }
    }
    for (const id of Object.values(prefs.orderOv)) {
      push(id, listingOrderNr(id));
    }
    return out;
  }, [orders, vehicles, prefs.orderOv]);

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
      const res = await fetch("/api/admin/iriss-listings/sync-now", { method: "POST", credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        warnings?: string[];
        summary?: { totalSources?: number; okCount?: number; vehicleCount?: number; newCount?: number; priceChangedCount?: number };
      };
      if (!res.ok) {
        setSyncMsg(body.error ? `Nolasīšana neizdevās: ${body.error}` : "Nolasīšana neizdevās.");
        return;
      }
      const s = body.summary ?? {};
      const bits = [
        `Avoti OK: ${s.okCount ?? 0}/${s.totalSources ?? 0}`,
        `auto: ${s.vehicleCount ?? 0}`,
        `jauni: ${s.newCount ?? 0}`,
        `cenu izmaiņas: ${s.priceChangedCount ?? 0}`,
      ];
      if (body.warnings?.length) bits.push(body.warnings.join(" "));
      setSyncMsg(`Nolasīšana pabeigta. ${bits.join(", ")}.`);
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
  ];

  const I = listingExtrasI(prefs.costs);
  const maxNet = prefs.budget != null ? listingMaxBid("net", 0, prefs.budget, I) : null;
  const maxMargin = prefs.budget != null ? listingMaxBid("margin", 0, prefs.budget, I) : null;
  const maxGross19 = prefs.budget != null ? listingMaxBid("gross", 19, prefs.budget, I) : null;
  const maxGross21 = prefs.budget != null ? listingMaxBid("gross", 21, prefs.budget, I) : null;

  function setGlobalCost(part: keyof ListingCostParts, value: number) {
    setPrefs((p) => ({ ...p, costs: { ...p.costs, [part]: value } }));
  }

  return (
    <div className="mt-2 space-y-2 touch-manipulation sm:mt-3 sm:space-y-3">
      <section className="sticky top-0 z-20 rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[12px] shadow-sm sm:rounded-2xl sm:px-4 sm:py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-4 sm:gap-y-2">
          <label className="inline-flex min-h-11 items-center gap-2 font-semibold text-orange-900 sm:min-h-0">
            <span className="sm:hidden">Budžets</span>
            <span className="hidden sm:inline">Klienta budžets €</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={prefs.budget ?? ""}
              placeholder="ignorēšana"
              onChange={(e) => {
                const n = Number(e.target.value);
                setPrefs((p) => ({ ...p, budget: Number.isFinite(n) && n > 0 ? n : null }));
              }}
              className={`h-11 w-[7.5rem] rounded-lg border bg-white px-2 text-base font-bold tabular-nums outline-none sm:h-auto sm:w-[130px] sm:py-1 sm:text-[14px] ${prefs.budget == null ? "border-amber-400 shadow-[0_0_0_3px_#fde68a]" : "border-orange-300"}`}
            />
          </label>
          <span className="tabular-nums">I = <b>{fmtEur(I)}</b></span>
          <button
            type="button"
            onClick={() => setShowCosts((x) => !x)}
            className="inline-flex min-h-11 items-center rounded-full border border-orange-200 bg-white px-3 text-[12px] font-semibold text-orange-950 sm:min-h-8"
          >
            {showCosts ? "Slēpt I" : "Izmaksas"}
          </button>
          {prefs.budget == null ? (
            <span className="hidden font-semibold text-amber-900 sm:inline">Gala cena un maks. solījums katrā rindā pēc pasūtījuma budžeta. Šis lauks ir ignorēšana.</span>
          ) : (
            <span className="-mx-2.5 flex w-[calc(100%+1.25rem)] snap-x snap-mandatory gap-3 overflow-x-auto px-2.5 pb-0.5 tabular-nums [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
              <span className="snap-start shrink-0"><TaxBadge tax={{ kind: "net", rate: null, raw: "NETO", rateFrom: "" }} /> maks. <b>{fmtEur(maxNet)}</b></span>
              <span className="snap-start shrink-0"><TaxBadge tax={{ kind: "margin", rate: null, raw: "MARŽA", rateFrom: "" }} /> maks. <b>{fmtEur(maxMargin)}</b></span>
              <span className="snap-start shrink-0"><TaxBadge tax={{ kind: "gross", rate: 19, raw: "AR PVN 19 %", rateFrom: "" }} /> maks. <b>{fmtEur(maxGross19)}</b></span>
              <span className="snap-start shrink-0"><TaxBadge tax={{ kind: "gross", rate: 21, raw: "AR PVN 21 %", rateFrom: "" }} /> maks. <b>{fmtEur(maxGross21)}</b></span>
            </span>
          )}
        </div>
        {showCosts ? (
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {([
              ["fee", "Izsoles komisija"],
              ["transport", "Transports"],
              ["commission", "Komisija"],
              ["unplanned", "Neplānotie"],
            ] as const).map(([k, l]) => (
              <label key={k} className="grid text-[10px] font-semibold text-slate-500">
                {l}
                <input type="number" inputMode="numeric" value={prefs.costs[k]} onChange={(e) => setGlobalCost(k, Number(e.target.value) || 0)} className="h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-2 text-base font-normal text-[var(--color-apple-text)] sm:h-8 sm:w-[88px] sm:px-1.5 sm:text-[12px]" />
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-2 shadow-sm sm:rounded-2xl sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-provin-muted)] sm:flex sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1 sm:text-[13px] sm:whitespace-normal">
            <span>
              <span className="sm:hidden">Nolasīts </span>
              <span className="hidden sm:inline">Pēdējā nolasīšana: </span>
              <span className="font-semibold text-[var(--color-apple-text)]">
                {latest?.summary.finishedAt ? fmtDateTime(latest.summary.finishedAt) : "nav veikta"}
              </span>
            </span>
            <span className="hidden sm:inline">Avoti OK: {latest?.summary.okCount ?? 0}/{latest?.summary.totalSources ?? 0}</span>
            <span className="hidden sm:inline">Auto: {counts.all}</span>
            <span className="hidden sm:inline">Jauni: {counts.fresh}</span>
            <span className="hidden sm:inline">Cenu izmaiņas: {counts.price}</span>
          </div>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncBusy}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--color-provin-accent)] bg-white px-3.5 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent)]/8 disabled:opacity-55 sm:min-h-10"
          >
            {syncBusy ? "Nolasa..." : "Nolasīt"}
          </button>
        </div>
        {syncMsg ? <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">{syncMsg}</p> : null}
        <div className="-mx-2.5 mt-2 flex snap-x gap-1.5 overflow-x-auto px-2.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {(health?.items ?? IRISS_LISTING_PLATFORMS.map((platform) => ({ platform, status: "not_run" as const, note: "", checkedAt: "" }))).map((item) => (
            <span key={item.platform} className="inline-flex shrink-0 snap-start items-center gap-1">
              <span
                title={item.note}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${healthClass(item.status)}`}
              >
                {PLATFORM_LABEL_LONG[item.platform]}: {healthLabel(item.status)}
              </span>
              <IrissListingsLoginButton platform={item.platform} onDone={() => void loadHealth()} />
            </span>
          ))}
          {problemSources.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowSources((v) => !v)}
              className="ml-auto inline-flex h-11 shrink-0 items-center text-[11px] font-medium text-[var(--color-provin-accent)] hover:underline sm:h-auto"
            >
              {showSources ? "Slēpt avotu problēmas" : `Avotu problēmas (${problemSources.length})`}
            </button>
          ) : null}
        </div>
        {showSources && problemSources.length > 0 ? (
          <ul className="mt-2 space-y-1 border-t border-[#E5E7EB] pt-2 text-[11px] text-slate-600">
            {problemSources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold ${platformBadgeClass(s.platform)}`}>
                  {PLATFORM_LABEL[s.platform]}
                </span>
                <span className="font-medium text-[var(--color-apple-text)]">{s.orderBrandModel || s.orderId}</span>
                <span>{sourceStatusLabel(s.status)}</span>
                {s.note ? <span className="text-slate-500">{s.note}</span> : null}
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-provin-accent)] hover:underline">
                  avots
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:rounded-full sm:border sm:border-[#E5E7EB] sm:bg-white sm:p-1 sm:shadow-sm sm:px-1 [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition sm:min-h-8 ${
                tab === t.id ? "bg-[var(--color-apple-text)] text-white" : "border border-[#E5E7EB] bg-white text-[var(--color-provin-muted)] sm:border-0"
              }`}
            >
              {t.id === "price" ? <><span className="sm:hidden">Cenas</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
              <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-white/20" : "bg-slate-100"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Meklēt"
            className="h-11 min-w-0 flex-1 rounded-full border border-[#E5E7EB] bg-white px-4 text-base text-[var(--color-apple-text)] shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-400 sm:h-10 sm:min-w-[220px] sm:text-[13px]"
          />
          <label className="inline-flex h-11 min-w-0 items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-[var(--color-provin-muted)] shadow-sm sm:h-10 sm:gap-2 sm:px-3">
            <span className="hidden font-medium sm:inline">Kārtot pēc</span>
            <select
              aria-label="Kārtot pēc"
              value={sort}
              onChange={(e) => {
                const next = parseListingSort(e.target.value);
                if (next) writeListQuery({ sort: next });
              }}
              className="max-w-[42vw] bg-transparent text-base font-semibold text-[var(--color-apple-text)] outline-none sm:max-w-none sm:text-[13px]"
            >
              {LISTING_SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {SOURCE_CHIPS.map((s) => {
          const on = sources.length === 0 || sources.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleSource(s.id)}
              className={`inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold sm:h-8 ${
                on ? "border-[var(--color-apple-text)] bg-[var(--color-apple-text)] text-white" : "border-[#E5E7EB] bg-white text-[var(--color-provin-muted)]"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Cena no"
          placeholder="No €"
          defaultValue={searchParams.get("min") ?? ""}
          key={`min-${searchParams.get("min") ?? ""}`}
          onBlur={(e) => writeListQuery({ min: e.target.value.trim() })}
          className="h-11 w-[5.5rem] shrink-0 rounded-full border border-[#E5E7EB] bg-white px-3 text-base text-[var(--color-apple-text)] shadow-sm outline-none placeholder:text-slate-400 sm:h-8 sm:w-28 sm:text-[12px]"
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Cena līdz"
          placeholder="Līdz €"
          defaultValue={searchParams.get("max") ?? ""}
          key={`max-${searchParams.get("max") ?? ""}`}
          onBlur={(e) => writeListQuery({ max: e.target.value.trim() })}
          className="h-11 w-[5.5rem] shrink-0 rounded-full border border-[#E5E7EB] bg-white px-3 text-base text-[var(--color-apple-text)] shadow-sm outline-none placeholder:text-slate-400 sm:h-8 sm:w-28 sm:text-[12px]"
        />
        <label className="inline-flex h-11 min-w-0 items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-[var(--color-provin-muted)] shadow-sm sm:h-8 sm:gap-2 sm:px-3">
          <span className="hidden font-medium sm:inline">Klients/pasūtījums</span>
          <select
            aria-label="Klients/pasūtījums"
            value={orderFilter ?? ""}
            onChange={(e) => writeListQuery({ ord: e.target.value })}
            className="max-w-[52vw] bg-transparent text-base font-semibold text-[var(--color-apple-text)] outline-none sm:max-w-[280px] sm:text-[13px]"
          >
            <option value="">Visi</option>
            {orderFilterOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {([
          ["all", `Visi ${counts.all - hiddenCount}`],
          ["fav", `★ ${favCount}`],
          ["hidden", `Paslēptie ${hiddenCount}`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setListScope(id)}
            className={`inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold sm:h-8 ${
              listScope === id ? "border-[var(--color-apple-text)] bg-[var(--color-apple-text)] text-white" : "border-[#E5E7EB] bg-white text-[var(--color-provin-muted)]"
            }`}
          >
            {id === "fav" ? <><span className="sm:hidden">{label}</span><span className="hidden sm:inline">★ Favorīti {favCount}</span></> : label}
          </button>
        ))}
        <label className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-[12px] font-semibold text-[var(--color-apple-text)] sm:h-8">
          <input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={hideTech} onChange={(e) => setHideTech(e.target.checked)} />
          <span className="sm:hidden">Bez motora/kārbas ({techCount})</span>
          <span className="hidden sm:inline">Slēpt ar motora/kārbas bojājumiem ({techCount})</span>
        </label>
      </section>

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
            ordersById={ordersById}
            onPrefs={setPrefs}
            onOpen={() => setDrawerId(v.id)}
            imageHidden={Boolean(hiddenImages[v.id])}
            onImageError={() => setHiddenImages((prev) => ({ ...prev, [v.id]: true }))}
          />
        ))}
      </div>

      {drawerVehicle ? (
        <>
          <button type="button" className="fixed inset-0 z-40 hidden bg-slate-900/20 sm:block" aria-label="Aizvērt atvilktni" onClick={() => setDrawerId(null)} />
          <IrissListDrawer v={drawerVehicle} prefs={prefs} orders={orders} ordersById={ordersById} onClose={() => setDrawerId(null)} onPrefs={setPrefs} />
        </>
      ) : null}
    </div>
  );
}

function ListingOrderMeta({
  v,
  prefs,
  ordersById,
}: {
  v: IrissListingVehicle;
  prefs: IrissListPrefs;
  ordersById: Record<string, IrissPasutijumsListRow>;
}) {
  const refs = listingOrderRefs(v, prefs, ordersById);
  if (refs.length === 0) {
    return <p className="truncate text-[11px] text-slate-500">Pasūtījums nav piesaistīts</p>;
  }
  return (
    <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
      {refs.map((r) => (
        <p key={r.id} className="truncate text-[11px] text-slate-600">
          <span className="font-semibold text-[var(--color-apple-text)]">{r.clientName || "Klients ?"}</span>
          {" · "}
          <Link href={`/admin/iriss/pasutijumi/${encodeURIComponent(r.id)}`} className="font-medium text-[var(--color-provin-accent)] hover:underline">
            {listingOrderNr(r.id)}
          </Link>
          {r.budget != null ? <span className="tabular-nums"> · {fmtEur(r.budget)}</span> : null}
          {r.brief ? <span className="text-slate-500"> · {r.brief}</span> : null}
        </p>
      ))}
    </div>
  );
}

function VehicleCard({
  v,
  nowMs,
  prefs,
  ordersById,
  onPrefs,
  onOpen,
  imageHidden,
  onImageError,
}: {
  v: IrissListingVehicle;
  nowMs: number;
  prefs: IrissListPrefs;
  ordersById: Record<string, IrissPasutijumsListRow>;
  onPrefs: (next: IrissListPrefs) => void;
  onOpen: () => void;
  imageHidden: boolean;
  onImageError: () => void;
}) {
  const fresh = isNew(v, nowMs);
  const changes = recentPriceChanges(v, nowMs);
  const gone = v.change === "gone";
  const tax = taxOf(v, prefs);
  const extras = extrasOf(v, prefs);
  const bid = listingBidPrice(v);
  const real = bid == null ? null : listingRealCost(tax.kind, tax.rate ?? 0, bid, extras);
  const budget = listingBudgetFor(v, prefs, ordersById);
  const mb = budget.amount != null ? listingMaxBid(tax.kind, tax.rate ?? 0, budget.amount, extras) : null;
  const room = mb != null && bid != null ? mb - bid : null;
  const dmg = classifyListingDamage(v.damageRaw);
  const fav = prefs.fav.includes(v.id);
  const hidden = prefs.hidden.includes(v.id);
  const customCost = Boolean(prefs.costOv[v.id]);
  const cd = countdown(v.auctionEndAt, nowMs);
  const year = listingDisplayYear(v);
  const specs = [fmtKm(v.mileageKm), v.fuel, v.transmission, v.powerKw ? `${v.powerKw} kW` : "", v.location].filter(Boolean);
  const left = real && budget.amount != null ? budget.amount - real.total : null;
  const sourceHref = listingSourceUrl(v);
  const border =
    gone ? "border-[#E5E7EB] opacity-70" : fav ? "border-amber-200" : fresh ? "border-emerald-200" : changes.length > 0 ? "border-sky-200" : "border-[#E5E7EB]";
  const accent = v.platform === "autobid" ? "border-l-violet-500" : v.platform === "openline" ? "border-l-indigo-600" : "border-l-amber-500";

  function toggle(list: "fav" | "hidden") {
    const cur = prefs[list];
    const next = cur.includes(v.id) ? cur.filter((x) => x !== v.id) : [...cur, v.id];
    onPrefs({ ...prefs, [list]: next });
  }

  const mobileSpecs = [fmtKm(v.mileageKm), v.transmission].filter(Boolean);

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
        {(() => {
          const thumb =
            v.imageUrl && !imageHidden ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.imageUrl}
                alt={v.title || "Auto foto"}
                loading="lazy"
                referrerPolicy={v.platform === "openline" || /images\.openlane\.eu/i.test(v.imageUrl) ? "no-referrer" : undefined}
                className="h-16 w-[4.5rem] rounded-md border border-slate-200/90 bg-slate-50 object-cover sm:h-[88px] sm:w-32 sm:rounded-lg"
                onError={onImageError}
              />
            ) : (
              <div className="flex h-16 w-[4.5rem] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 sm:h-[88px] sm:w-32 sm:rounded-lg sm:text-[10px]">
                Nav foto
              </div>
            );
          return sourceHref && v.imageUrl && !imageHidden ? (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Atvērt avotā" onClick={(e) => e.stopPropagation()}>
              {thumb}
            </a>
          ) : (
            <div className="shrink-0">{thumb}</div>
          );
        })()}

        <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Atvērt avotā"
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold hover:underline sm:px-2 sm:text-[10px] ${platformBadgeClass(v.platform)}`}
              >
                {PLATFORM_LABEL[v.platform]}
              </a>
            ) : (
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px] ${platformBadgeClass(v.platform)}`}>
                {PLATFORM_LABEL[v.platform]}
              </span>
            )}
            <CountryFlag code={v.countryCode} />
            <span className="hidden sm:inline">{daysInAuction(v, nowMs) ? <span className="inline-flex rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{daysInAuction(v, nowMs)}</span> : null}</span>
            {v.bidCount != null ? <span className="hidden rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline-flex">{v.bidCount} solījumi</span> : null}
            {v.auctionType ? <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 sm:inline-flex">{v.auctionType}</span> : null}
            {gone ? <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 sm:px-2 sm:text-[10px]">PAZUDIS</span> : null}
            {!gone && fresh ? <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 sm:px-2 sm:text-[10px]">JAUNS</span> : null}
            {customCost ? <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 sm:inline-flex" title="Izmaksas šim auto mainītas">I {fmtEur(extras)}</span> : null}
          </div>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <div className="truncate text-[13px] font-semibold leading-tight text-[var(--color-apple-text)] sm:text-[15px]" title={v.title}>
              {v.title || v.orderBrandModels[0] || "-"}
            </div>
            <span className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--color-apple-text)] sm:text-[13px]">{year}</span>
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
          <ListingOrderMeta v={v} prefs={prefs} ordersById={ordersById} />
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
            <TaxBadge tax={tax} />
          </div>
          {v.priceBuyNow != null && v.priceBuyNow !== bid ? <div className="hidden text-[11px] text-slate-500 sm:block">pirkt uzreiz {fmtEur(v.priceBuyNow)}</div> : null}
          {changes.length > 0 ? (
            <p className="hidden text-[11px] text-sky-900 sm:block">
              {changes.map((c) => `${priceFieldLabel(c.field)}: ${c.from === null ? "-" : fmtEur(c.from)} -> ${c.to === null ? "-" : fmtEur(c.to)}`).join("; ")}
            </p>
          ) : null}
          <div className={`text-[11px] font-extrabold tabular-nums sm:text-[12px] ${cd.k}`}>{cd.t}</div>
          {v.auctionStage ? <div className="hidden text-[11px] text-slate-500 sm:block">{stageLabel(v.auctionStage)}</div> : null}
        </div>

        <div className="grid gap-0.5 sm:min-w-[175px] sm:border-l sm:border-dashed sm:border-[#E5E7EB] sm:pl-3">
          {budget.amount == null ? (
            <div className="text-[11px] font-bold text-amber-900">Budžets nav</div>
          ) : bid == null || !real ? (
            <div className="text-[11px] tabular-nums"><span className="text-slate-500">Budžets </span><b>{fmtEur(budget.amount)}</b><div className="text-slate-500">Cenas nav</div></div>
          ) : (
            <>
              <div className="hidden justify-between text-[11px] tabular-nums sm:flex"><span>Budžets</span><b>{fmtEur(budget.amount)}</b></div>
              <div className="flex justify-between text-[11px] tabular-nums"><span>Gala</span><b>{fmtEur(real.total)}</b></div>
              <div>
                {left != null && left >= 0 ? (
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 sm:text-[11px]">+{fmtEur(left)}</span>
                ) : (
                  <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-extrabold text-red-800 sm:text-[11px]">-{fmtEur(-(left ?? 0))}</span>
                )}
              </div>
              <div className="flex justify-between text-[11px] tabular-nums text-slate-500"><span>Maks.</span><b className="text-[var(--color-apple-text)]">{fmtEur(mb)}</b></div>
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

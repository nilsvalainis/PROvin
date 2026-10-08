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
import { defaultIrissListPrefs, IRISS_LIST_PREFS_KEY, listingCostsFor, parseIrissListPrefs, type IrissListPrefs } from "@/lib/iriss-listings-operator-prefs";
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

function roomOf(v: IrissListingVehicle, prefs: IrissListPrefs): number | null {
  if (prefs.budget == null) return null;
  const bid = listingBidPrice(v);
  if (bid == null) return null;
  const tax = taxOf(v, prefs);
  return listingMaxBid(tax.kind, tax.rate ?? 0, prefs.budget, extrasOf(v, prefs)) - bid;
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
};

const SOURCE_CHIPS: ReadonlyArray<{ id: IrissListingPlatform; label: string }> = [
  { id: "autobid", label: "Autobid" },
  { id: "openline", label: "Openlane" },
  { id: "auto1", label: "Auto1" },
];

export function IrissSludinajumiListClient({ latest }: Props) {
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
  const sort = parseListingSort(searchParams.get("sort")) ?? "ending";
  const sources = parseListingSources(searchParams.get("src"));
  const priceMin = parsePriceBound(searchParams.get("min"));
  const priceMax = parsePriceBound(searchParams.get("max"));

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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  function writeListQuery(next: { sort?: ListingSort; sources?: IrissListingPlatform[]; min?: string | null; max?: string | null }) {
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
      if (!q) return true;
      const hay = `${v.title} ${v.manufacturer} ${v.year} ${v.location} ${v.orderBrandModels.join(" ")} ${PLATFORM_LABEL_LONG[v.platform]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, tab, query, nowMs, sources, priceMin, priceMax, listScope, prefs.fav, prefs.hidden, hideTech]);

  const sorted = useMemo(() => {
    const withRoom = visible.map((v) => ({ ...v, _room: roomOf(v, prefs) }));
    return sortListingVehicles(withRoom, sort, nowMs).sort((a, b) => Number(prefs.fav.includes(b.id)) - Number(prefs.fav.includes(a.id)));
  }, [visible, sort, nowMs, prefs]);

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
    <div className="mt-3 space-y-3">
      <section className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-[12px] shadow-sm">
        <label className="inline-flex items-center gap-2 font-semibold text-orange-900">
          Klienta budžets €
          <input
            type="number"
            min={0}
            value={prefs.budget ?? ""}
            placeholder="nav norādīts"
            onChange={(e) => {
              const n = Number(e.target.value);
              setPrefs((p) => ({ ...p, budget: Number.isFinite(n) && n > 0 ? n : null }));
            }}
            className={`w-[130px] rounded-lg border bg-white px-2 py-1 text-[14px] font-bold tabular-nums outline-none ${prefs.budget == null ? "border-amber-400 shadow-[0_0_0_3px_#fde68a]" : "border-orange-300"}`}
          />
        </label>
        {prefs.budget == null ? (
          <span className="font-semibold text-amber-900">Ievadi budžetu, lai redzētu gala cenu un maks. solījumu.</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
            <span>I = <b>{fmtEur(I)}</b></span>
            <span><TaxBadge tax={{ kind: "net", rate: null, raw: "NETO", rateFrom: "" }} /> maks. <b>{fmtEur(maxNet)}</b></span>
            <span><TaxBadge tax={{ kind: "margin", rate: null, raw: "MARŽA", rateFrom: "" }} /> maks. <b>{fmtEur(maxMargin)}</b></span>
            <span><TaxBadge tax={{ kind: "gross", rate: 19, raw: "AR PVN 19 %", rateFrom: "" }} /> maks. <b>{fmtEur(maxGross19)}</b></span>
            <span><TaxBadge tax={{ kind: "gross", rate: 21, raw: "AR PVN 21 %", rateFrom: "" }} /> maks. <b>{fmtEur(maxGross21)}</b></span>
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          {([
            ["fee", "Izsoles komisija"],
            ["transport", "Transports"],
            ["commission", "Komisija"],
            ["unplanned", "Neplānotie"],
          ] as const).map(([k, l]) => (
            <label key={k} className="grid text-[10px] font-semibold text-slate-500">
              {l}
              <input type="number" value={prefs.costs[k]} onChange={(e) => setGlobalCost(k, Number(e.target.value) || 0)} className="w-[88px] rounded-md border border-[#E5E7EB] bg-white px-1.5 py-0.5 text-[12px] font-normal text-[var(--color-apple-text)]" />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-provin-muted)] sm:text-[13px]">
            <span>
              Pēdējā nolasīšana:{" "}
              <span className="font-semibold text-[var(--color-apple-text)]">
                {latest?.summary.finishedAt ? fmtDateTime(latest.summary.finishedAt) : "nav veikta"}
              </span>
            </span>
            <span>Avoti OK: {latest?.summary.okCount ?? 0}/{latest?.summary.totalSources ?? 0}</span>
            <span>Auto: {counts.all}</span>
            <span>Jauni: {counts.fresh}</span>
            <span>Cenu izmaiņas: {counts.price}</span>
          </div>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncBusy}
            className="inline-flex min-h-10 items-center rounded-full border border-[var(--color-provin-accent)] bg-white px-3.5 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent)]/8 disabled:opacity-55"
          >
            {syncBusy ? "Nolasa..." : "Nolasīt tagad"}
          </button>
        </div>
        {syncMsg ? <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">{syncMsg}</p> : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {(health?.items ?? IRISS_LISTING_PLATFORMS.map((platform) => ({ platform, status: "not_run" as const, note: "", checkedAt: "" }))).map((item) => (
            <span key={item.platform} className="inline-flex items-center gap-1">
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
              className="ml-auto text-[11px] font-medium text-[var(--color-provin-accent)] hover:underline"
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

      <section className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full border border-[#E5E7EB] bg-white p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition ${
                tab === t.id ? "bg-[var(--color-apple-text)] text-white" : "text-[var(--color-provin-muted)] hover:bg-slate-50"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-white/20" : "bg-slate-100"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Meklēt: marka, modelis, gads, vieta"
          className="min-h-10 min-w-[220px] flex-1 rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] text-[var(--color-apple-text)] shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
        />
        <label className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-[12px] text-[var(--color-provin-muted)] shadow-sm">
          <span className="font-medium">Kārtot pēc</span>
          <select
            aria-label="Kārtot pēc"
            value={sort}
            onChange={(e) => {
              const next = parseListingSort(e.target.value);
              if (next) writeListQuery({ sort: next });
            }}
            className="bg-transparent text-[13px] font-semibold text-[var(--color-apple-text)] outline-none"
          >
            {LISTING_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {SOURCE_CHIPS.map((s) => {
            const on = sources.length === 0 || sources.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSource(s.id)}
                className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${
                  on ? "border-[var(--color-apple-text)] bg-[var(--color-apple-text)] text-white" : "border-[#E5E7EB] bg-white text-[var(--color-provin-muted)]"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Cena no"
          placeholder="Cena no"
          defaultValue={searchParams.get("min") ?? ""}
          key={`min-${searchParams.get("min") ?? ""}`}
          onBlur={(e) => writeListQuery({ min: e.target.value.trim() })}
          className="min-h-8 w-28 rounded-full border border-[#E5E7EB] bg-white px-3 text-[12px] text-[var(--color-apple-text)] shadow-sm outline-none placeholder:text-slate-400"
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Cena līdz"
          placeholder="Cena līdz"
          defaultValue={searchParams.get("max") ?? ""}
          key={`max-${searchParams.get("max") ?? ""}`}
          onBlur={(e) => writeListQuery({ max: e.target.value.trim() })}
          className="min-h-8 w-28 rounded-full border border-[#E5E7EB] bg-white px-3 text-[12px] text-[var(--color-apple-text)] shadow-sm outline-none placeholder:text-slate-400"
        />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {([
          ["all", `Visi ${counts.all - hiddenCount}`],
          ["fav", `★ Favorīti ${favCount}`],
          ["hidden", `Paslēptie ${hiddenCount}`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setListScope(id)}
            className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${
              listScope === id ? "border-[var(--color-apple-text)] bg-[var(--color-apple-text)] text-white" : "border-[#E5E7EB] bg-white text-[var(--color-provin-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-[12px] font-semibold text-[var(--color-apple-text)]">
          <input type="checkbox" checked={hideTech} onChange={(e) => setHideTech(e.target.checked)} />
          Slēpt ar motora/kārbas bojājumiem ({techCount})
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

      <div className="space-y-2">
        {sorted.map((v) => (
          <VehicleCard
            key={v.id}
            v={v}
            nowMs={nowMs}
            prefs={prefs}
            onPrefs={setPrefs}
            onOpen={() => setDrawerId(v.id)}
            imageHidden={Boolean(hiddenImages[v.id])}
            onImageError={() => setHiddenImages((prev) => ({ ...prev, [v.id]: true }))}
          />
        ))}
      </div>

      {drawerVehicle ? (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-slate-900/20" aria-label="Aizvērt atvilktni" onClick={() => setDrawerId(null)} />
          <IrissListDrawer v={drawerVehicle} prefs={prefs} onClose={() => setDrawerId(null)} onPrefs={setPrefs} />
        </>
      ) : null}
    </div>
  );
}

function VehicleCard({
  v,
  nowMs,
  prefs,
  onPrefs,
  onOpen,
  imageHidden,
  onImageError,
}: {
  v: IrissListingVehicle;
  nowMs: number;
  prefs: IrissListPrefs;
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
  const mb = prefs.budget != null ? listingMaxBid(tax.kind, tax.rate ?? 0, prefs.budget, extras) : null;
  const room = mb != null && bid != null ? mb - bid : null;
  const dmg = classifyListingDamage(v.damageRaw);
  const fav = prefs.fav.includes(v.id);
  const hidden = prefs.hidden.includes(v.id);
  const customCost = Boolean(prefs.costOv[v.id]);
  const cd = countdown(v.auctionEndAt, nowMs);
  const specs = [v.year, fmtKm(v.mileageKm), v.fuel, v.transmission, v.powerKw ? `${v.powerKw} kW` : "", v.location].filter(Boolean);
  const left = real && prefs.budget != null ? prefs.budget - real.total : null;
  const border =
    gone ? "border-[#E5E7EB] opacity-70" : fav ? "border-amber-200" : fresh ? "border-emerald-200" : changes.length > 0 ? "border-sky-200" : "border-[#E5E7EB]";
  const accent = v.platform === "autobid" ? "border-l-violet-500" : v.platform === "openline" ? "border-l-indigo-600" : "border-l-amber-500";

  function toggle(list: "fav" | "hidden") {
    const cur = prefs[list];
    const next = cur.includes(v.id) ? cur.filter((x) => x !== v.id) : [...cur, v.id];
    onPrefs({ ...prefs, [list]: next });
  }

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
      className={`flex cursor-pointer flex-wrap items-start gap-3 rounded-2xl border border-l-[5px] bg-white p-3 shadow-sm transition hover:border-slate-300 sm:flex-nowrap sm:p-3.5 ${border} ${accent} ${fav ? "shadow-[0_0_0_2px_#fde68a]" : ""} ${hidden ? "opacity-50" : ""}`}
    >
      <div className="shrink-0">
        {v.imageUrl && !imageHidden ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.imageUrl}
            alt={v.title || "Auto foto"}
            loading="lazy"
            referrerPolicy={v.platform === "openline" || /images\.openlane\.eu/i.test(v.imageUrl) ? "no-referrer" : undefined}
            className="h-[88px] w-32 rounded-lg border border-slate-200/90 bg-slate-50 object-cover"
            onError={onImageError}
          />
        ) : (
          <div className="flex h-[88px] w-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Nav foto
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${platformBadgeClass(v.platform)}`}>
            {PLATFORM_LABEL[v.platform]}
          </span>
          <CountryFlag code={v.countryCode} />
          {daysInAuction(v, nowMs) ? <span className="inline-flex rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{daysInAuction(v, nowMs)}</span> : null}
          {v.bidCount != null ? <span className="inline-flex rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{v.bidCount} solījumi</span> : null}
          {v.auctionType ? <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{v.auctionType}</span> : null}
          {gone ? <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">PAZUDIS</span> : null}
          {!gone && fresh ? <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">JAUNS</span> : null}
          {customCost ? <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900" title="Izmaksas šim auto mainītas">I {fmtEur(extras)}</span> : null}
        </div>
        <div className="truncate text-[14px] font-semibold text-[var(--color-apple-text)] sm:text-[15px]" title={v.title}>
          {v.title || v.orderBrandModels[0] || "-"}
        </div>
        <p className="truncate text-[12px] text-[var(--color-provin-muted)]">{specs.join(" · ")}</p>
        <div className="flex flex-wrap gap-1">
          {dmg.status === "nodata" ? <span className="rounded-md border border-[#E5E7EB] bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Nav datu</span> : null}
          {dmg.status === "none" ? <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">Tehn. bojājumi nav norādīti</span> : null}
          {dmg.cats.map((c) => (
            <span key={c.name} className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              ⚠ {c.name}
            </span>
          ))}
        </div>
        {v.orderIds.length > 0 ? (
          <p className="truncate text-[11px] text-slate-500" onClick={(e) => e.stopPropagation()}>
            {v.orderIds.map((orderId, idx) => (
              <span key={orderId}>
                {idx > 0 ? ", " : null}
                <Link href={`/admin/iriss/pasutijumi/${encodeURIComponent(orderId)}`} className="font-medium text-[var(--color-apple-text)] hover:underline">
                  {v.orderBrandModels[idx] ?? v.orderBrandModels[0] ?? orderId}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
        <input
          className={`mt-1 w-full rounded-md border border-dashed px-2 py-1 text-[12px] outline-none ${prefs.notes[v.id] ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}
          placeholder="✎ Pierakstīt piezīmi"
          value={prefs.notes[v.id] ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPrefs({ ...prefs, notes: { ...prefs.notes, [v.id]: e.target.value } })}
        />
      </div>

      <div className="grid min-w-[165px] justify-items-end gap-0.5 text-right">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pašreizējā cena</div>
        <div className="flex items-center gap-1.5">
          <span className="text-[22px] font-extrabold tabular-nums leading-none">{bid == null ? "-" : fmtEur(bid)}</span>
          <TaxBadge tax={tax} />
        </div>
        {v.priceBuyNow != null && v.priceBuyNow !== bid ? <div className="text-[11px] text-slate-500">pirkt uzreiz {fmtEur(v.priceBuyNow)}</div> : null}
        {changes.length > 0 ? (
          <p className="text-[11px] text-sky-900">
            {changes.map((c) => `${priceFieldLabel(c.field)}: ${c.from === null ? "-" : fmtEur(c.from)} -> ${c.to === null ? "-" : fmtEur(c.to)}`).join("; ")}
          </p>
        ) : null}
        <div className={`text-[12px] font-extrabold tabular-nums ${cd.k}`}>{cd.t}</div>
        {v.auctionStage ? <div className="text-[11px] text-slate-500">{stageLabel(v.auctionStage)}</div> : null}
      </div>

      <div className="grid min-w-[175px] gap-0.5 border-t border-dashed border-[#E5E7EB] pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
        {prefs.budget == null ? (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Klienta budžets</div>
            <div className="text-[12px] font-bold text-amber-900">Budžets nav norādīts</div>
          </>
        ) : bid == null || !real ? (
          <>
            <div className="flex justify-between text-[11px] tabular-nums"><span>Budžets</span><b>{fmtEur(prefs.budget)}</b></div>
            <div className="text-[11px] text-slate-500">Cenas nav, gala cenu nevar izrēķināt.</div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-[11px] tabular-nums"><span>Budžets</span><b>{fmtEur(prefs.budget)}</b></div>
            <div className="flex justify-between text-[11px] tabular-nums"><span>Gala cena</span><b>{fmtEur(real.total)}</b></div>
            <div>
              {left != null && left >= 0 ? (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-extrabold text-emerald-800">+{fmtEur(left)} zem budžeta</span>
              ) : (
                <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-extrabold text-red-800">-{fmtEur(-(left ?? 0))} pārsniegts</span>
              )}
            </div>
            <div className="flex justify-between text-[11px] tabular-nums text-slate-500"><span>Maks. solījums</span><b className="text-[var(--color-apple-text)]">{fmtEur(mb)}</b></div>
            {room != null ? (
              <div className="flex justify-between text-[11px] tabular-nums text-slate-500">
                <span>{room >= 0 ? "var solīt vēl" : "virs maks."}</span>
                <span>{fmtEur(Math.abs(room))}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" title={fav ? "Noņemt no favorītiem" : "Favorīts"} onClick={() => toggle("fav")} className={`grid h-[30px] w-[30px] place-items-center rounded-lg border ${fav ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[#E5E7EB] bg-white"}`}>
          {fav ? "★" : "☆"}
        </button>
        <button type="button" title={hidden ? "Rādīt atkal" : "Nav interesanti"} onClick={() => toggle("hidden")} className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-[#E5E7EB] bg-white">
          {hidden ? "↺" : "✕"}
        </button>
      </div>
    </article>
  );
}

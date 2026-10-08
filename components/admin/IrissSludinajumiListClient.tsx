"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  IrissListingPlatform,
  IrissListingPriceChange,
  IrissListingSourceRun,
  IrissListingVehicle,
  IrissListingsLatestView,
  IrissPlatformHealthItem,
  IrissPlatformHealthReport,
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

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso || "";
  return new Intl.DateTimeFormat("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(t));
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

type Props = {
  latest: IrissListingsLatestView | null;
};

export function IrissSludinajumiListClient({ latest }: Props) {
  const router = useRouter();
  const [hiddenImages, setHiddenImages] = useState<Record<string, true>>({});
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<IrissPlatformHealthReport | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
  }, [latest?.generatedAt]);

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
      if (!q) return true;
      const hay = `${v.title} ${v.manufacturer} ${v.year} ${v.location} ${v.orderBrandModels.join(" ")} ${PLATFORM_LABEL_LONG[v.platform]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, tab, query, nowMs]);

  /** Grupas pēc pasūtījuma; auto ar vairākiem pasūtījumiem parādās katrā grupā. */
  const groups = useMemo(() => {
    const map = new Map<string, { orderId: string; label: string; vehicles: IrissListingVehicle[] }>();
    for (const v of visible) {
      v.orderIds.forEach((orderId, idx) => {
        const label = v.orderBrandModels[idx] ?? v.orderBrandModels[0] ?? "Pasūtījums";
        const g = map.get(orderId) ?? { orderId, label, vehicles: [] };
        g.vehicles.push(v);
        map.set(orderId, g);
      });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "lv"));
  }, [visible]);

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

  return (
    <div className="mt-3 space-y-3">
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
          {(health?.items ?? []).map((item) => (
            <span
              key={item.platform}
              title={item.note}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${healthClass(item.status)}`}
            >
              {PLATFORM_LABEL_LONG[item.platform]}: {healthLabel(item.status)}
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
      </section>

      {visible.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-black">
            {vehicles.length === 0 ? "Nav nolasītu auto" : "Šajā filtrā nav auto"}
          </p>
          <p className="mt-1.5 text-[12px] text-[var(--color-provin-muted)]">
            {vehicles.length === 0
              ? "Spied „Nolasīt tagad”, lai ievāktu datus uzreiz, vai sagaidi ikdienas nolasīšanu. Lasa tikai aktīvo pasūtījumu izsoļu saites."
              : "Izvēlies citu cilni vai notīri meklēšanu."}
          </p>
        </section>
      ) : null}

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.orderId} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 px-1">
              <Link
                href={`/admin/iriss/pasutijumi/${encodeURIComponent(g.orderId)}`}
                className="text-[13px] font-semibold text-[var(--color-apple-text)] hover:underline"
              >
                {g.label}
              </Link>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{g.vehicles.length}</span>
            </div>
            <div className="space-y-2">
              {g.vehicles.map((v) => (
                <VehicleCard
                  key={`${g.orderId}:${v.id}`}
                  v={v}
                  nowMs={nowMs}
                  imageHidden={Boolean(hiddenImages[v.id])}
                  onImageError={() => setHiddenImages((prev) => ({ ...prev, [v.id]: true }))}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Auto1 sarakstā VIN nav. Identifikators ir stockNumber detaļu saitē (`/car/BW03512`). */
function auto1StockLabel(v: IrissListingVehicle): string {
  if (v.platform !== "auto1" || !v.detailUrl) return "";
  try {
    return decodeURIComponent(new URL(v.detailUrl).pathname.split("/").filter(Boolean).pop() ?? "");
  } catch {
    return "";
  }
}

function VehicleCard({
  v,
  nowMs,
  imageHidden,
  onImageError,
}: {
  v: IrissListingVehicle;
  nowMs: number;
  imageHidden: boolean;
  onImageError: () => void;
}) {
  const fresh = isNew(v, nowMs);
  const changes = recentPriceChanges(v, nowMs);
  const gone = v.change === "gone";
  const place =
    v.location && v.countryCode && (v.location === v.countryCode || v.location.endsWith(`, ${v.countryCode}`) || v.location.endsWith(` ${v.countryCode}`))
      ? v.location
      : [v.location, v.countryCode].filter(Boolean).join(", ");
  const specs = [auto1StockLabel(v), v.year, fmtKm(v.mileageKm), v.fuel, v.transmission, v.powerKw ? `${v.powerKw} kW` : "", place].filter(Boolean);

  return (
    <article
      className={`rounded-2xl border bg-white p-3 shadow-sm transition hover:border-slate-300 sm:p-3.5 ${
        gone ? "border-[#E5E7EB] opacity-70" : fresh ? "border-emerald-200" : changes.length > 0 ? "border-sky-200" : "border-[#E5E7EB]"
      }`}
    >
      <div className="flex min-w-0 gap-3">
        <div className="shrink-0">
          {v.imageUrl && !imageHidden ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.imageUrl}
              alt={v.title || "Auto foto"}
              loading="lazy"
              referrerPolicy={v.platform === "openline" || /images\.openlane\.eu/i.test(v.imageUrl) ? "no-referrer" : undefined}
              className="h-20 w-28 rounded-lg border border-slate-200/90 bg-slate-50 object-cover"
              onError={onImageError}
            />
          ) : (
            <div className="flex h-20 w-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Nav foto
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-start gap-1.5">
            <a
              href={v.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--color-apple-text)] hover:underline sm:text-[15px]"
              title={v.title}
            >
              {v.title || v.orderBrandModels[0] || "-"}
            </a>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${platformBadgeClass(v.platform)}`}>
              {PLATFORM_LABEL[v.platform]}
            </span>
            {gone ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                PAZUDIS
              </span>
            ) : null}
            {!gone && fresh ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                JAUNS
              </span>
            ) : null}
            {!gone && changes.length > 0 ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-sky-200/80 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
                CENA MAINĪTA
              </span>
            ) : null}
          </div>

          <p className="truncate text-[12px] text-[var(--color-provin-muted)]">{specs.join(" · ")}</p>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]">
            {v.priceStart !== null ? (
              <span>
                <span className="text-[var(--color-provin-muted)]">Sākuma</span>{" "}
                <span className="font-semibold text-[var(--color-apple-text)]">{fmtEur(v.priceStart)}</span>
              </span>
            ) : null}
            {v.priceMinimal !== null ? (
              <span>
                <span className="text-[var(--color-provin-muted)]">Min.</span>{" "}
                <span className="font-semibold text-[var(--color-apple-text)]">{fmtEur(v.priceMinimal)}</span>
              </span>
            ) : null}
            {v.priceCurrent !== null ? (
              <span>
                <span className="text-[var(--color-provin-muted)]">Pašreizējā</span>{" "}
                <span className="font-semibold text-[var(--color-apple-text)]">{fmtEur(v.priceCurrent)}</span>
              </span>
            ) : null}
            {v.priceBuyNow !== null ? (
              <span>
                <span className="text-[var(--color-provin-muted)]">Pirkt tūlīt</span>{" "}
                <span className="font-semibold text-[var(--color-apple-text)]">{fmtEur(v.priceBuyNow)}</span>
              </span>
            ) : null}
            {v.priceStart === null && v.priceMinimal === null && v.priceCurrent === null && v.priceBuyNow === null ? (
              <span className="text-[var(--color-provin-muted)]">Cena nav norādīta</span>
            ) : null}
            {v.vatNote ? <span className="text-[11px] text-slate-500">{v.vatNote}</span> : null}
          </div>

          {changes.length > 0 ? (
            <p className="text-[11px] text-sky-900">
              {changes
                .map((c) => `${priceFieldLabel(c.field)}: ${c.from === null ? "-" : fmtEur(c.from)} -> ${c.to === null ? "-" : fmtEur(c.to)}`)
                .join("; ")}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            {v.auctionStartAt ? <span>Izsole: {fmtDateTime(v.auctionStartAt)}</span> : null}
            {v.auctionEndAt ? <span>Beidzas: {fmtDateTime(v.auctionEndAt)}</span> : null}
            {v.auctionStage ? <span>{stageLabel(v.auctionStage)}</span> : null}
            <span>Pirmo reizi: {fmtDate(v.firstSeenAt)}</span>
            {gone ? <span>Pēdējo reizi: {fmtDate(v.lastSeenAt)}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

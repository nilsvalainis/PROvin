import "server-only";

import {
  isIrissListingsRawStoreEnabled,
  readIrissListingsLatestView,
  writeIrissListingsRawBundle,
  writeIrissListingsRun,
} from "@/lib/iriss-listings-aggregate-store";
import { fetchAutobidSource, randomPauseMs } from "@/lib/iriss-listings-autobid-fetch";
import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import { reconcileVehicles, sourceKey, type IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import { fetchViaIrissRelay, readIrissRelayConfig } from "@/lib/iriss-listings-relay";
import { buildIrissListingSources, groupIrissListingSources, irissListingVehicleId, type IrissListingSource, type IrissListingSourceGroup } from "@/lib/iriss-listings-sources";
import {
  canStartListingJob,
  DIRECT_FETCH_HEADROOM_MS,
  fanOutFetchedVehicles,
  IRISS_LISTINGS_ROUTE_MAX_DURATION_MS,
  mergeListingSourceRuns,
  RELAY_FETCH_HEADROOM_MS,
  runBounded,
  selectListingSyncQueue,
} from "@/lib/iriss-listings-sync-plan";
import type {
  IrissListingSourceRun,
  IrissListingSourceStatus,
  IrissListingSyncRunSummary,
  IrissListingsLatestView,
  IrissListingsRawBundle,
} from "@/lib/iriss-listings-types";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

export type IrissListingsSyncResult = {
  ok: boolean;
  warnings: string[];
  summary: IrissListingSyncRunSummary;
  view: IrissListingsLatestView;
};

function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Autobid pēc noklusējuma lasa Vercel publiski; `IRISS_LISTINGS_AUTOBID_VIA_RELAY=1` lasa caur releju ar ielogotu profilu. */
function autobidViaRelay(): boolean {
  return /^(1|true|yes)$/i.test(process.env.IRISS_LISTINGS_AUTOBID_VIA_RELAY ?? "");
}

type SourceFetch = {
  status: IrissListingSourceStatus;
  note: string;
  vehicles: IrissFetchedVehicle[];
  rawPages: string[];
  pagesFetched: number;
  pageCount: number;
};

async function fetchSource(src: IrissListingSource): Promise<SourceFetch> {
  const relay = readIrissRelayConfig();
  const useRelay = src.platform !== "autobid" || autobidViaRelay();

  if (useRelay) {
    if (!relay) {
      if (src.platform === "autobid") {
        /** Relejs pieprasīts, bet nav konfigurēts: Autobid tomēr nolasām publiski. */
      } else {
        return {
          status: "relay_not_configured",
          note: "Lasīšana caur releju vēl nav pieslēgta (IRISS_LISTINGS_RELAY_URL / _TOKEN).",
          vehicles: [],
          rawPages: [],
          pagesFetched: 0,
          pageCount: 0,
        };
      }
    } else {
      const r = await fetchViaIrissRelay(relay, src, { maxPages: envInt("IRISS_LISTINGS_RELAY_MAX_PAGES", 5, 1, 25) });
      return { status: r.status, note: r.note, vehicles: r.vehicles, rawPages: r.rawPages, pagesFetched: r.pagesFetched, pageCount: r.pageCount };
    }
  }

  if (src.platform === "autobid") {
    const r = await fetchAutobidSource(src.sourceUrl, {
      maxPages: envInt("IRISS_LISTINGS_AUTOBID_MAX_PAGES", 5, 1, 25),
      timeoutMs: envInt("IRISS_LISTINGS_FETCH_TIMEOUT_MS", 18_000, 8_000, 60_000),
      pauseMinMs: 700,
      pauseMaxMs: 1_800,
    });
    return {
      status: r.status,
      note: r.note,
      pagesFetched: r.pagesFetched,
      pageCount: r.pageCount,
      rawPages: r.rawPages,
      vehicles: r.vehicles.map((v) => ({
        id: irissListingVehicleId("autobid", v.externalId),
        platform: "autobid",
        externalId: v.externalId,
        detailUrl: v.detailUrl,
        orderId: src.orderId,
        orderBrandModel: src.orderBrandModel,
        title: v.title,
        manufacturer: v.manufacturer,
        year: v.year,
        firstRegistration: v.firstRegistration,
        mileageKm: v.mileageKm,
        fuel: v.fuel,
        transmission: v.transmission,
        powerKw: v.powerKw,
        location: v.location,
        countryCode: v.countryCode,
        imageUrl: v.imageUrl,
        currency: "EUR",
        priceStart: v.priceStart,
        priceMinimal: v.priceMinimal,
        priceCurrent: v.priceCurrent,
        priceBuyNow: null,
        vatNote: v.vatNote,
        auctionId: v.auctionId,
        auctionStartAt: v.auctionStartAt,
        auctionEndAt: v.auctionEndAt,
        auctionStage: v.auctionStage,
      })),
    };
  }
  /** Nesasniedzams: visas pārējās platformas iet caur releju augstāk. */
  return { status: "fetch_failed", note: "Platformai nav lasītāja.", vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0 };
}

function summarize(
  sources: IrissListingSourceRun[],
  rec: { vehicleCount: number; newCount: number; priceChangedCount: number; goneCount: number },
  startedAt: string,
  finishedAt: string,
  runId: string,
): IrissListingSyncRunSummary {
  const n = (s: IrissListingSourceStatus) => sources.filter((x) => x.status === s).length;
  return {
    startedAt,
    finishedAt,
    runId,
    totalSources: sources.length,
    okCount: n("ok"),
    loginRequiredCount: n("login_required"),
    blockedByWafCount: n("blocked_by_waf"),
    parseFailedCount: n("parse_failed"),
    fetchFailedCount: n("fetch_failed"),
    relayNotConfiguredCount: n("relay_not_configured"),
    skippedCount: n("skipped"),
    ...rec,
  };
}

function isDirectAutobid(group: IrissListingSourceGroup, autobidRelay: boolean): boolean {
  return group.platform === "autobid" && !autobidRelay;
}

/**
 * Dienas nolasīšana: aktīvo IRISS pasūtījumu izsoļu meklējumi -> konkrēti auto -> salīdzinājums ar iepriekšējo dienu.
 * Vienāds meklēšanas URL tiek lasīts vienreiz un piesaistīts visiem pasūtījumiem.
 * `restart` (poga „Nolasīt tagad”) sāk dienas ciklu no jauna; cron turpina kursora atlikušos.
 * Laika budžets: `IRISS_LISTINGS_TIME_BUDGET_MS` (noklusējums 240 s pie maršruta 300 s).
 */
export async function runIrissListingsDailySync(opts: { restart?: boolean } = {}): Promise<IrissListingsSyncResult> {
  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();
  const today = startedAt.slice(0, 10);
  const runId = `run-${startedAt.replace(/[:.]/g, "-")}`;
  const warnings: string[] = [];
  const timeBudgetMs = envInt("IRISS_LISTINGS_TIME_BUDGET_MS", 240_000, 30_000, 280_000);
  const concurrency = envInt("IRISS_LISTINGS_FETCH_CONCURRENCY", 3, 1, 3);

  const previous = await readIrissListingsLatestView();
  const rows = await listIrissPasutijumi();
  const activeOrderIds = new Set(rows.filter((r) => r.listStatus === "active").map((r) => r.id));
  const allSources = buildIrissListingSources(rows);
  const maxSources = envInt("IRISS_LISTINGS_MAX_SOURCES_PER_RUN", 200, 1, 2000);
  const sources = allSources.slice(0, maxSources);
  if (allSources.length > sources.length) warnings.push(`Avotu skaits ierobežots: ${sources.length}/${allSources.length}.`);

  const groups = groupIrissListingSources(sources);
  const picked = selectListingSyncQueue(groups, previous?.cursor, today, opts.restart === true);
  const sameDay = previous?.cursor?.day === today;

  if (picked.alreadyDone && previous) {
    warnings.push(`Šodienas nolasīšana jau pabeigta (${groups.length} unikālie meklējumi).`);
    return { ok: true, warnings, summary: previous.summary, view: previous };
  }

  const relayOn = Boolean(readIrissRelayConfig());
  const autobidRelay = autobidViaRelay() && relayOn;
  /** Tiešie Autobid vispirms (ātri, paralēli). Relejs aizņem Chrome pa vienam, tāpēc pēc tam. */
  const ordered = [
    ...picked.queue.filter((g) => isDirectAutobid(g, autobidRelay)),
    ...picked.queue.filter((g) => !isDirectAutobid(g, autobidRelay)),
  ];

  const results = new Map<string, { at: string; fetch: SourceFetch }>();
  const { started } = await runBounded(
    ordered,
    concurrency,
    (g) => {
      const headroom = !isDirectAutobid(g, autobidRelay) && relayOn ? RELAY_FETCH_HEADROOM_MS : DIRECT_FETCH_HEADROOM_MS;
      return canStartListingJob(Date.now() - startedMs, timeBudgetMs, headroom);
    },
    async (g) => {
      const direct = isDirectAutobid(g, autobidRelay);
      if (direct && concurrency > 1) await sleep(randomPauseMs(400, 900));
      else if (direct && results.size > 0) await sleep(randomPauseMs(1_500, 4_000));
      const lead = g.orders[0]!;
      let fetchResult: SourceFetch;
      try {
        fetchResult = await fetchSource(lead);
      } catch (e) {
        fetchResult = { status: "fetch_failed", note: formatFetchError(e, "fetch failed"), vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0 };
      }
      results.set(g.key, { at: new Date().toISOString(), fetch: fetchResult });
    },
  );

  const fetched: IrissFetchedVehicle[] = [];
  const okSourceKeys = new Set<string>();
  const currentRuns: IrissListingSourceRun[] = [];
  const completedKeys: string[] = [];
  const raw: IrissListingsRawBundle = { version: 1, runId, generatedAt: startedAt, sources: [] };

  for (const g of ordered) {
    const hit = results.get(g.key);
    if (!hit) continue;
    completedKeys.push(g.key);
    const shared = g.orders.length > 1 ? `Kopīgs meklējums (${g.orders.length} pasūtījumi), lasīts vienreiz.` : "";
    const note = [hit.fetch.note, shared].filter(Boolean).join(" ");
    for (const src of g.orders) {
      currentRuns.push({
        id: src.id,
        orderId: src.orderId,
        orderBrandModel: src.orderBrandModel,
        platform: src.platform,
        sourceUrl: src.sourceUrl,
        status: hit.fetch.status,
        note,
        vehicleCount: hit.fetch.vehicles.length,
        pagesFetched: hit.fetch.pagesFetched,
        pageCount: hit.fetch.pageCount,
        fetchedAt: hit.at,
      });
      if (hit.fetch.status === "ok") okSourceKeys.add(sourceKey(src.platform, src.orderId));
    }
    if (hit.fetch.status === "ok") fetched.push(...fanOutFetchedVehicles(hit.fetch.vehicles, g.orders));
    if (hit.fetch.rawPages.length > 0) raw.sources.push({ platform: g.platform, sourceUrl: g.sourceUrl, pages: hit.fetch.rawPages });
  }

  const deferred = ordered.length - started;
  if (deferred > 0) {
    warnings.push(
      `Laika budžets ${Math.round(timeBudgetMs / 1000)} s (maršruts ${Math.round(IRISS_LISTINGS_ROUTE_MAX_DURATION_MS / 1000)} s): šajā partijā ${started}/${ordered.length} unikālie meklējumi. Atlikušie turpinās nākamajā palaišanā.`,
    );
  }

  const finishedAt = new Date().toISOString();
  const mergedRuns = mergeListingSourceRuns(sources, sameDay ? (previous?.sources ?? []) : [], currentRuns, finishedAt);
  const rec = reconcileVehicles({
    previous: previous?.vehicles ?? [],
    fetched,
    okSourceKeys,
    activeOrderIds,
    now: finishedAt,
    goneAfterMissingRuns: 2,
  });
  const summary = summarize(
    mergedRuns,
    { vehicleCount: rec.vehicles.length, newCount: rec.newCount, priceChangedCount: rec.priceChangedCount, goneCount: rec.goneCount },
    startedAt,
    finishedAt,
    runId,
  );
  const doneKeys = [...new Set([...picked.carriedDone, ...completedKeys])].sort((a, b) => a.localeCompare(b));
  const view: IrissListingsLatestView = {
    version: 2,
    generatedAt: finishedAt,
    summary,
    sources: mergedRuns,
    vehicles: rec.vehicles,
    cursor: { day: today, doneKeys },
  };

  const write = await writeIrissListingsRun(view);
  if (!write.ok) warnings.push(`Saglabāšana neizdevās: ${write.error}`);
  if (write.ok && isIrissListingsRawStoreEnabled() && raw.sources.length > 0) {
    const rawWrite = await writeIrissListingsRawBundle(raw);
    if (!rawWrite.ok) warnings.push(`Raw datu saglabāšana neizdevās: ${rawWrite.error}`);
  }

  return { ok: write.ok, warnings, summary, view };
}

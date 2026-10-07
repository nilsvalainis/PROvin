import "server-only";

import {
  isIrissListingsRawStoreEnabled,
  readIrissListingsLatestView,
  writeIrissListingsRawBundle,
  writeIrissListingsRun,
} from "@/lib/iriss-listings-aggregate-store";
import { fetchAutobidSource, randomPauseMs } from "@/lib/iriss-listings-autobid-fetch";
import { reconcileVehicles, sourceKey, type IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import { fetchViaIrissRelay, readIrissRelayConfig } from "@/lib/iriss-listings-relay";
import { buildIrissListingSources, irissListingVehicleId, type IrissListingSource } from "@/lib/iriss-listings-sources";
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
        auctionEndAt: "",
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

/**
 * Dienas nolasīšana: aktīvo IRISS pasūtījumu izsoļu meklējumi -> konkrēti auto -> salīdzinājums ar iepriekšējo dienu.
 * Avotus lasa pēc kārtas ar nejaušām pauzēm. Laika budžets: `IRISS_LISTINGS_TIME_BUDGET_MS` (noklusējums 240 s pie 300 s funkcijas).
 */
export async function runIrissListingsDailySync(): Promise<IrissListingsSyncResult> {
  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();
  const runId = `run-${startedAt.replace(/[:.]/g, "-")}`;
  const warnings: string[] = [];
  const timeBudgetMs = envInt("IRISS_LISTINGS_TIME_BUDGET_MS", 240_000, 30_000, 280_000);

  const previous = await readIrissListingsLatestView();
  const rows = await listIrissPasutijumi();
  const activeOrderIds = new Set(rows.filter((r) => r.listStatus === "active").map((r) => r.id));
  const allSources = buildIrissListingSources(rows);
  const maxSources = envInt("IRISS_LISTINGS_MAX_SOURCES_PER_RUN", 200, 1, 2000);
  const sources = allSources.slice(0, maxSources);
  if (allSources.length > sources.length) warnings.push(`Avotu skaits ierobežots: ${sources.length}/${allSources.length}.`);

  const sourceRuns: IrissListingSourceRun[] = [];
  const fetched: IrissFetchedVehicle[] = [];
  const okSourceKeys = new Set<string>();
  const raw: IrissListingsRawBundle = { version: 1, runId, generatedAt: startedAt, sources: [] };

  let readCount = 0;
  for (const src of sources) {
    const fetchedAt = new Date().toISOString();
    const outOfTime = Date.now() - startedMs > timeBudgetMs;
    let r: SourceFetch;
    if (outOfTime) {
      r = { status: "skipped", note: "Laika budžets beidzās; avots tiks lasīts nākamajā reizē.", vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0 };
    } else {
      /** Pauze starp tiešajiem Autobid lasījumiem; releja lasījumi ir rindā ar savām pauzēm serverī. */
      if (readCount > 0 && src.platform === "autobid") await sleep(randomPauseMs(1_500, 4_000));
      r = await fetchSource(src);
      if (src.platform === "autobid") readCount += 1;
    }
    sourceRuns.push({
      id: src.id,
      orderId: src.orderId,
      orderBrandModel: src.orderBrandModel,
      platform: src.platform,
      sourceUrl: src.sourceUrl,
      status: r.status,
      note: r.note,
      vehicleCount: r.vehicles.length,
      pagesFetched: r.pagesFetched,
      pageCount: r.pageCount,
      fetchedAt,
    });
    if (r.status === "ok") okSourceKeys.add(sourceKey(src.platform, src.orderId));
    fetched.push(...r.vehicles);
    if (r.rawPages.length > 0) raw.sources.push({ platform: src.platform, sourceUrl: src.sourceUrl, pages: r.rawPages });
  }

  const finishedAt = new Date().toISOString();
  const rec = reconcileVehicles({
    previous: previous?.vehicles ?? [],
    fetched,
    okSourceKeys,
    activeOrderIds,
    now: finishedAt,
    goneAfterMissingRuns: 2,
  });
  const summary = summarize(
    sourceRuns,
    { vehicleCount: rec.vehicles.length, newCount: rec.newCount, priceChangedCount: rec.priceChangedCount, goneCount: rec.goneCount },
    startedAt,
    finishedAt,
    runId,
  );
  const view: IrissListingsLatestView = { version: 2, generatedAt: finishedAt, summary, sources: sourceRuns, vehicles: rec.vehicles };

  const write = await writeIrissListingsRun(view);
  if (!write.ok) warnings.push(`Saglabāšana neizdevās: ${write.error}`);
  if (write.ok && isIrissListingsRawStoreEnabled()) {
    const rawWrite = await writeIrissListingsRawBundle(raw);
    if (!rawWrite.ok) warnings.push(`Raw datu saglabāšana neizdevās: ${rawWrite.error}`);
  }

  return { ok: write.ok, warnings, summary, view };
}

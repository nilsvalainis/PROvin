import "server-only";

import {
  isIrissListingsRawStoreEnabled,
  readIrissListingsLatestView,
  readIrissListingsOperatorState,
  writeIrissListingsRawBundle,
  writeIrissListingsRun,
} from "@/lib/iriss-listings-aggregate-store";
import { fetchAutobidSource, randomPauseMs } from "@/lib/iriss-listings-autobid-fetch";
import { sendIrissNewListingsNotificationEmail } from "@/lib/email/send-transactional";
import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import {
  activeListingSearchKeys,
  listingSearchReadComplete,
} from "@/lib/iriss-listings-membership";
import { formatIrissNewListingsEmail, newMatchingListings } from "@/lib/iriss-listings-new-notify";
import { operatorRejectedIds } from "@/lib/iriss-listings-operator-state";
import { reconcileVehicles, type IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import { fetchViaIrissRelay, readIrissRelayConfig } from "@/lib/iriss-listings-relay";
import { isIrissListingsAutomaticSlot, isIrissListingsContinuationWindow } from "@/lib/iriss-listings-schedule";
import { buildIrissListingSources, groupIrissListingSources, irissListingVehicleId, type IrissListingSource, type IrissListingSourceGroup } from "@/lib/iriss-listings-sources";
import {
  canStartListingJob,
  DIRECT_FETCH_HEADROOM_MS,
  fanOutFetchedVehicles,
  IRISS_LISTINGS_ROUTE_MAX_DURATION_MS,
  listingSyncProgress,
  mergeListingSourceRuns,
  orderListingSyncGroups,
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
  IrissListingsSyncProgress,
} from "@/lib/iriss-listings-types";
import { computeListingVatHealth, logListingVatHealth } from "@/lib/iriss-listings-vat";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

export type IrissListingsSyncResult = {
  ok: boolean;
  skipped?: "already_ran_this_hour" | "already_done" | "continuation_not_allowed";
  warnings: string[];
  summary: IrissListingSyncRunSummary;
  view: IrissListingsLatestView;
  progress: IrissListingsSyncProgress;
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
  complete: boolean;
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
          complete: false,
        };
      }
    } else {
      const maxPages = envInt("IRISS_LISTINGS_RELAY_MAX_PAGES", 5, 1, 25);
      const r = await fetchViaIrissRelay(relay, src, { maxPages });
      return {
        status: r.status,
        note: r.note,
        vehicles: r.vehicles,
        rawPages: r.rawPages,
        pagesFetched: r.pagesFetched,
        pageCount: r.pageCount,
        complete: listingSearchReadComplete({
          status: r.status,
          pagesFetched: r.pagesFetched,
          pageCount: r.pageCount,
          maxPages,
          pageError: /\d+\. lapa/.test(r.note),
        }),
      };
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
      complete: r.complete,
      rawPages: r.rawPages,
      vehicles: r.vehicles.map((v) => ({
        id: irissListingVehicleId("autobid", v.externalId),
        platform: "autobid",
        externalId: v.externalId,
        detailUrl: v.detailUrl,
        orderId: src.orderId,
        orderBrandModel: src.orderBrandModel,
        sourceKey: "",
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
        imageUrls: v.imageUrls,
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
  return { status: "fetch_failed", note: "Platformai nav lasītāja.", vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0, complete: false };
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

function emptySyncSummary(startedAt: string, runId: string): IrissListingSyncRunSummary {
  return {
    startedAt,
    finishedAt: startedAt,
    runId,
    totalSources: 0,
    okCount: 0,
    loginRequiredCount: 0,
    blockedByWafCount: 0,
    parseFailedCount: 0,
    fetchFailedCount: 0,
    relayNotConfiguredCount: 0,
    skippedCount: 0,
    vehicleCount: 0,
    newCount: 0,
    priceChangedCount: 0,
    goneCount: 0,
  };
}

/**
 * Nolasīšana: aktīvo IRISS pasūtījumu izsoļu meklējumi -> konkrēti auto -> reconcile ar iepriekšējo snapshot.
 * Vienāds meklēšanas URL tiek lasīts vienreiz un piesaistīts visiem pasūtījumiem.
 * Slota sākums (08/10/12/14/16/18/20 Rīgā) un poga „Nolasīt” (`restart`) sāk ciklu no jauna.
 * Turpinājums (`restart: false` / cron pēc slota) iet no kursora, līdz visi unikālie meklējumi ir nolasīti.
 * Laika budžets: `IRISS_LISTINGS_TIME_BUDGET_MS` (noklusējums 240 s pie maršruta 300 s).
 */
export async function runIrissListingsDailySync(
  opts: { restart?: boolean; automaticSlot?: string; continuation?: boolean; onlyOrderIds?: string[] } = {},
): Promise<IrissListingsSyncResult> {
  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();
  const today = startedAt.slice(0, 10);
  const runId = `run-${startedAt.replace(/[:.]/g, "-")}`;
  const warnings: string[] = [];
  const timeBudgetMs = envInt("IRISS_LISTINGS_TIME_BUDGET_MS", 240_000, 30_000, 280_000);
  const concurrency = envInt("IRISS_LISTINGS_FETCH_CONCURRENCY", 3, 1, 3);
  const automaticSlot = isIrissListingsAutomaticSlot(opts.automaticSlot) ? opts.automaticSlot : "";

  const previous = await readIrissListingsLatestView();
  const onlyOrderIds = new Set((opts.onlyOrderIds ?? []).filter(Boolean));
  const orderScoped = onlyOrderIds.size > 0;
  const slotAlreadyStarted = Boolean(automaticSlot && previous?.lastAutomaticSlot === automaticSlot);
  const restart = orderScoped
    ? true
    : opts.continuation === true || slotAlreadyStarted
      ? false
      : opts.restart === true || Boolean(automaticSlot);

  if (!orderScoped && opts.continuation === true && !isIrissListingsContinuationWindow(new Date(startedMs), previous?.lastAutomaticSlot)) {
    warnings.push("Turpinājums ārpus slota loga (~60 min pēc 08/10/12/14/16/18/20).");
    const summary = previous?.summary ?? emptySyncSummary(startedAt, runId);
    const view = previous ?? { version: 2 as const, generatedAt: startedAt, summary, sources: [], vehicles: [] };
    return {
      ok: true,
      skipped: "continuation_not_allowed",
      warnings,
      summary,
      view,
      progress: listingSyncProgress(0, previous?.cursor?.doneKeys ?? []),
    };
  }

  if (!orderScoped && automaticSlot && !slotAlreadyStarted && previous) {
    await writeIrissListingsRun({ ...previous, lastAutomaticSlot: automaticSlot });
  }
  const rows = await listIrissPasutijumi();
  const allSources = buildIrissListingSources(rows);
  const maxSources = envInt("IRISS_LISTINGS_MAX_SOURCES_PER_RUN", 200, 1, 2000);
  const sources = allSources.slice(0, maxSources);
  if (allSources.length > sources.length) warnings.push(`Avotu skaits ierobežots: ${sources.length}/${allSources.length}.`);

  let groups = orderListingSyncGroups(groupIrissListingSources(sources), previous?.sources ?? []);
  if (orderScoped) {
    groups = groups.filter((g) => g.orders.some((o) => onlyOrderIds.has(o.orderId)));
  }
  const picked = orderScoped
    ? { queue: groups, carriedDone: [] as string[], alreadyDone: false }
    : selectListingSyncQueue(groups, previous?.cursor, today, restart);
  const sameDay = previous?.cursor?.day === today;
  const progressTotal = groups.length;

  if (!orderScoped && picked.alreadyDone && previous) {
    warnings.push(`Šodienas nolasīšana jau pabeigta (${groups.length} unikālie meklējumi).`);
    return {
      ok: true,
      skipped: "already_done",
      warnings,
      summary: previous.summary,
      view: previous,
      progress: listingSyncProgress(progressTotal, picked.carriedDone),
    };
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
        fetchResult = { status: "fetch_failed", note: formatFetchError(e, "fetch failed"), vehicles: [], rawPages: [], pagesFetched: 0, pageCount: 0, complete: false };
      }
      results.set(g.key, { at: new Date().toISOString(), fetch: fetchResult });
    },
  );

  const fetched: IrissFetchedVehicle[] = [];
  const okCompleteSourceKeys = new Set<string>();
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
        complete: hit.fetch.complete,
      });
    }
    if (hit.fetch.status === "ok" && hit.fetch.complete) okCompleteSourceKeys.add(g.key);
    if (hit.fetch.status === "ok") {
      const tagged = hit.fetch.vehicles.map((v) => ({ ...v, sourceKey: g.key }));
      fetched.push(...fanOutFetchedVehicles(tagged, g.orders));
    }
    if (hit.fetch.rawPages.length > 0) raw.sources.push({ platform: g.platform, sourceUrl: g.sourceUrl, pages: hit.fetch.rawPages });
  }

  const deferred = ordered.length - started;
  if (deferred > 0) {
    warnings.push(
      `Laika budžets ${Math.round(timeBudgetMs / 1000)} s (maršruts ${Math.round(IRISS_LISTINGS_ROUTE_MAX_DURATION_MS / 1000)} s): šajā partijā ${started}/${ordered.length} unikālie meklējumi. Atlikušie turpinās nākamajā palaišanā.`,
    );
  }

  const finishedAt = new Date().toISOString();
  const keepPreviousRuns = orderScoped || (sameDay && !restart);
  const mergedRuns = mergeListingSourceRuns(sources, keepPreviousRuns ? (previous?.sources ?? []) : [], currentRuns, finishedAt);
  const operator = await readIrissListingsOperatorState();
  const rejectedIds = operatorRejectedIds(operator);
  const rec = reconcileVehicles({
    previous: previous?.vehicles ?? [],
    fetched,
    okCompleteSourceKeys,
    activeSourceKeys: activeListingSearchKeys(sources),
    activeSources: sources,
    rejectedIds,
    now: finishedAt,
    nowMs: Date.parse(finishedAt),
  });
  const summary = summarize(
    mergedRuns,
    { vehicleCount: rec.vehicles.length, newCount: rec.newCount, priceChangedCount: rec.priceChangedCount, goneCount: rec.goneCount },
    startedAt,
    finishedAt,
    runId,
  );
  const doneKeys = orderScoped
    ? (previous?.cursor?.doneKeys ?? [])
    : [...new Set([...picked.carriedDone, ...completedKeys])].sort((a, b) => a.localeCompare(b));
  const lastAutomaticSlot = orderScoped ? previous?.lastAutomaticSlot : automaticSlot || previous?.lastAutomaticSlot;
  const vatHealth = computeListingVatHealth(rec.vehicles);
  const view: IrissListingsLatestView = {
    version: 2,
    generatedAt: finishedAt,
    summary,
    sources: mergedRuns,
    vehicles: rec.vehicles,
    cursor: orderScoped ? previous?.cursor ?? { day: today, doneKeys } : { day: today, doneKeys },
    ...(lastAutomaticSlot ? { lastAutomaticSlot } : {}),
    vatHealth,
  };
  logListingVatHealth(vatHealth);

  const write = await writeIrissListingsRun(view);
  if (!write.ok) warnings.push(`Saglabāšana neizdevās: ${write.error}`);
  if (write.ok && isIrissListingsRawStoreEnabled() && raw.sources.length > 0) {
    const rawWrite = await writeIrissListingsRawBundle(raw);
    if (!rawWrite.ok) warnings.push(`Raw datu saglabāšana neizdevās: ${rawWrite.error}`);
  }
  if (write.ok) {
    const fresh = newMatchingListings(rec.vehicles, rejectedIds);
    const mail = formatIrissNewListingsEmail({
      vehicles: fresh,
      orders: rows.map((r) => ({
        id: r.id,
        clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ").trim(),
        brandModel: r.brandModel.trim(),
      })),
    });
    if (mail) await sendIrissNewListingsNotificationEmail(mail);
  }

  return { ok: write.ok, warnings, summary, view, progress: listingSyncProgress(progressTotal, doneKeys) };
}

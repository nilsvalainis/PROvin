import "server-only";

import { fetchAutobidSource } from "@/lib/iriss-listings-autobid-fetch";
import { fetchViaIrissRelay, readIrissRelayConfig } from "@/lib/iriss-listings-relay";
import type { IrissListingSourceStatus } from "@/lib/iriss-listings-types";
import { addVinObservations, isVinMemoryStoreDurable } from "@/lib/vin-memory-store";
import {
  AUCTION_INGEST_LIMITS,
  applyIngestStep,
  ingestProgress,
  observationsFromAuctionLots,
  pickIngestStep,
  rigaDay,
  stateForTick,
  type AuctionIngestSource,
  type AuctionIngestState,
  type AuctionLotForMemory,
  type AuctionSourceProgress,
  type AuctionStepFetch,
} from "@/lib/vin-memory-auction";
import { auctionIngestStoreDurable, readAuctionIngestState, writeAuctionIngestState } from "@/lib/vin-memory-auction-store";

/**
 * Viens masveida solis: vai nu dažas Autobid lapas (publisks HTTP, bez login),
 * vai viena Openlane marka caur esošo sludinājumu releju.
 * Nakts `vin-memory-sync` (IRISS ielase + pasūtījumi) šis neaiztiek.
 */

export type AuctionIngestTick = {
  ok: boolean;
  idle: "pass_complete" | "hold" | null;
  source: AuctionIngestSource | null;
  sliceId: string;
  pagesFetched: number;
  pageCount: number;
  vins: number;
  skippedNoVin: number;
  endedWithVin: number;
  added: number;
  updated: number;
  failedShards: string[];
  note: string;
  passDay: string;
  completedDay: string | null;
  progress: Record<AuctionIngestSource, AuctionSourceProgress>;
};

function limitsFromEnv() {
  const n = (key: string, fallback: number, min: number, max: number) => {
    const v = Number.parseInt(process.env[key] ?? "", 10);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  return {
    ...AUCTION_INGEST_LIMITS,
    autobidPagesPerTick: n("VIN_MEMORY_AUCTION_AUTOBID_PAGES", AUCTION_INGEST_LIMITS.autobidPagesPerTick, 1, 8),
    openlanePagesPerTick: n("VIN_MEMORY_AUCTION_OPENLANE_PAGES", AUCTION_INGEST_LIMITS.openlanePagesPerTick, 1, 5),
  };
}

function emptyTick(state: AuctionIngestState, idle: AuctionIngestTick["idle"], note: string, ok = true): AuctionIngestTick {
  return {
    ok,
    idle,
    source: null,
    sliceId: "",
    pagesFetched: 0,
    pageCount: 0,
    vins: 0,
    skippedNoVin: 0,
    endedWithVin: 0,
    added: 0,
    updated: 0,
    failedShards: [],
    note,
    passDay: state.passDay,
    completedDay: state.completedDay,
    progress: ingestProgress(state),
  };
}

function autobidLots(vehicles: Awaited<ReturnType<typeof fetchAutobidSource>>["vehicles"]): AuctionLotForMemory[] {
  return vehicles.map((v) => ({
    platform: "autobid",
    vin: v.vin,
    title: v.title,
    manufacturer: v.manufacturer,
    mileageKm: v.mileageKm,
    firstRegistration: v.firstRegistration,
    year: v.year,
    countryCode: v.countryCode,
    auctionStage: v.auctionStage,
  }));
}

async function fetchStep(
  step: { source: AuctionIngestSource; url: string; startPage: number; maxPages: number },
): Promise<AuctionStepFetch> {
  if (step.source === "autobid") {
    const r = await fetchAutobidSource(step.url, {
      maxPages: step.maxPages,
      startPage: step.startPage,
      timeoutMs: 15_000,
      pauseMinMs: 1_200,
      pauseMaxMs: 2_200,
    });
    const status: AuctionStepFetch["status"] =
      r.status === "ok" || r.status === "login_required" || r.status === "blocked_by_waf" || r.status === "parse_failed"
        ? r.status === "parse_failed"
          ? "parse_failed"
          : r.status
        : "fetch_failed";
    return {
      status,
      note: r.note,
      pagesFetched: r.pagesFetched,
      pageCount: r.pageCount,
      vehicles: autobidLots(r.vehicles),
    };
  }
  const cfg = readIrissRelayConfig();
  if (!cfg) {
    return {
      status: "fetch_failed",
      note: "Openlane relejs nav konfigurēts (IRISS_LISTINGS_RELAY_URL / IRISS_LISTINGS_RELAY_TOKEN).",
      pagesFetched: 0,
      pageCount: 0,
      vehicles: [],
    };
  }
  const timeoutMs = Math.min(70_000, cfg.timeoutMs);
  const r = await fetchViaIrissRelay(
    { ...cfg, timeoutMs },
    { platform: "openline", sourceUrl: step.url, orderId: "vin-memory-archive", orderBrandModel: "VIN atmiņa" },
    { maxPages: step.maxPages, timeoutMs },
  );
  const status = relayStatus(r.status);
  return {
    status,
    note: r.note,
    pagesFetched: r.pagesFetched,
    pageCount: r.pageCount,
    vehicles: r.vehicles.map((v) => ({
      platform: "openline",
      vin: v.vin,
      vinSource: v.vinSource,
      title: v.title,
      manufacturer: v.manufacturer,
      mileageKm: v.mileageKm,
      firstRegistration: v.firstRegistration,
      year: v.year,
      countryCode: v.countryCode,
      auctionStage: v.auctionStage,
    })),
  };
}

function relayStatus(status: IrissListingSourceStatus): AuctionStepFetch["status"] {
  if (status === "ok" || status === "login_required" || status === "blocked_by_waf" || status === "parse_failed") return status;
  return "fetch_failed";
}

export async function runVinMemoryAuctionIngest(now: Date = new Date()): Promise<AuctionIngestTick> {
  if (!isVinMemoryStoreDurable() || !auctionIngestStoreDurable()) {
    const blank = stateForTick(null, now);
    return emptyTick(blank, null, "VIN atmiņas krātuve nav pieejama.", false);
  }
  const prev = await readAuctionIngestState();
  const state = stateForTick(prev, now);
  const step = pickIngestStep(state, now, limitsFromEnv());
  if (!step) {
    if (state !== prev && state.passDay !== prev?.passDay) await writeAuctionIngestState(state);
    const idle = state.completedDay ? "pass_complete" : "hold";
    const note = idle === "pass_complete" ? "Gājiens šai Rīgas dienai pabeigts." : "Abi avoti pauzē (login, WAF vai releja limits).";
    return emptyTick(state, idle, note);
  }
  const fetched = await fetchStep(step);
  const mapped = observationsFromAuctionLots(fetched.vehicles, rigaDay(now));
  const next = applyIngestStep(
    state,
    step,
    { ...fetched, vehicles: [] },
    { vins: mapped.inputs.length, skippedNoVin: mapped.skippedNoVin, endedWithVin: mapped.endedWithVin },
    now,
    limitsFromEnv(),
  );
  if (mapped.inputs.length) {
    const wrote = await addVinObservations(mapped.inputs, now);
    if (!wrote.ok) {
      return {
        ...emptyTick(state, null, "Novērojumu šķembu rakstīšana neizdevās. Kursors nav bīdīts.", false),
        source: step.source,
        sliceId: step.sliceId,
        pagesFetched: fetched.pagesFetched,
        pageCount: fetched.pageCount,
        vins: mapped.inputs.length,
        skippedNoVin: mapped.skippedNoVin,
        endedWithVin: mapped.endedWithVin,
        failedShards: wrote.failedShards,
      };
    }
    const saved = await writeAuctionIngestState(next);
    return {
      ok: saved,
      idle: null,
      source: step.source,
      sliceId: step.sliceId,
      pagesFetched: fetched.pagesFetched,
      pageCount: fetched.pageCount,
      vins: mapped.inputs.length,
      skippedNoVin: mapped.skippedNoVin,
      endedWithVin: mapped.endedWithVin,
      added: wrote.added,
      updated: wrote.updated,
      failedShards: wrote.failedShards,
      note: saved ? fetched.note : "Kursoru neizdevās saglabāt.",
      passDay: next.passDay,
      completedDay: next.completedDay,
      progress: ingestProgress(next),
    };
  }
  const saved = await writeAuctionIngestState(next);
  return {
    ok: saved && fetched.status === "ok",
    idle: null,
    source: step.source,
    sliceId: step.sliceId,
    pagesFetched: fetched.pagesFetched,
    pageCount: fetched.pageCount,
    vins: 0,
    skippedNoVin: mapped.skippedNoVin,
    endedWithVin: 0,
    added: 0,
    updated: 0,
    failedShards: [],
    note: saved ? fetched.note : "Kursoru neizdevās saglabāt.",
    passDay: next.passDay,
    completedDay: next.completedDay,
    progress: ingestProgress(saved ? next : state),
  };
}

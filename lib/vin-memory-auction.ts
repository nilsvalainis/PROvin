/**
 * Autobid + Openlane masveida gājiens uz VIN atmiņu.
 * Tīrās funkcijas: šķēles, kursors, kartēšana, dedupe ievade, kopsavilkums.
 * Krātuve un tīkls: `lib/vin-memory-auction-ingest.ts`.
 *
 * Pārdoto arhīva šeit nav. Meklēšana dod aktīvo katalogu; `AFTER_AUCTION` paliek tikai tad,
 * ja tā pati lapa auto vēl rāda. Apify un Auto1 nav šajā ceļā.
 */

import { observationsFromListings } from "@/lib/vin-memory-feed";
import {
  latestKm,
  VIN_MEMORY_SOURCES,
  type VinMemoryEntry,
  type VinMemorySource,
  type VinObservationInput,
} from "@/lib/vin-memory";

export const AUTOBID_CATALOG_URL = "https://autobid.de/en/search-results";
export const OPENLANE_FIND_URL = "https://www.openlane.eu/en/findcar";

/** Markas, ko Openlane findcar iztur pa vienai (tukšs findcar noildz). */
export const OPENLANE_MASS_MAKES = [
  "audi",
  "bmw",
  "citroen",
  "cupra",
  "dacia",
  "fiat",
  "ford",
  "honda",
  "hyundai",
  "jaguar",
  "kia",
  "land rover",
  "mazda",
  "mercedes",
  "mini",
  "mitsubishi",
  "nissan",
  "opel",
  "peugeot",
  "porsche",
  "renault",
  "seat",
  "skoda",
  "suzuki",
  "tesla",
  "toyota",
  "volkswagen",
  "volvo",
] as const;

/** Ja markas meklējums ir garāks par releja lapu limitu, dalām pa gadiem (viens līmenis). */
export const OPENLANE_YEAR_BANDS = [
  [2010, 2014],
  [2015, 2017],
  [2018, 2020],
  [2021, 2023],
  [2024, 2026],
] as const;

export type AuctionIngestLimits = {
  autobidPagesPerTick: number;
  openlanePagesPerTick: number;
  maxAttempts: number;
  holdMs: number;
  autobidStreakBeforeOpenlane: number;
};

export const AUCTION_INGEST_LIMITS: AuctionIngestLimits = {
  autobidPagesPerTick: 3,
  openlanePagesPerTick: 2,
  maxAttempts: 3,
  holdMs: 6 * 60 * 60 * 1000,
  autobidStreakBeforeOpenlane: 2,
};

export type AuctionIngestSource = "autobid" | "openline";

export type AuctionSliceKind = "catalog" | "make" | "years";

export type AuctionSliceState = {
  id: string;
  source: AuctionIngestSource;
  url: string;
  kind: AuctionSliceKind;
  nextPage: number;
  pageCount: number | null;
  status: "pending" | "active" | "done" | "partial" | "error";
  attempts: number;
  note: string;
  vins: number;
  skippedNoVin: number;
  endedWithVin: number;
};

export type AuctionIngestState = {
  version: 1;
  passDay: string;
  completedDay: string | null;
  lastSource: AuctionIngestSource | "";
  autobidStreak: number;
  holdUntil: Partial<Record<AuctionIngestSource, string>>;
  slices: AuctionSliceState[];
  updatedAt: string;
};

export type AuctionIngestStep = {
  source: AuctionIngestSource;
  sliceId: string;
  url: string;
  startPage: number;
  maxPages: number;
};

export type AuctionLotForMemory = {
  platform: "autobid" | "openline";
  vin?: string;
  vinSource?: string;
  title?: string;
  manufacturer?: string;
  mileageKm?: number | null;
  firstRegistration?: string;
  year?: string;
  countryCode?: string;
  auctionStage?: string;
};

export type AuctionStepFetch = {
  status: "ok" | "login_required" | "blocked_by_waf" | "fetch_failed" | "parse_failed";
  note: string;
  pagesFetched: number;
  pageCount: number;
  vehicles: AuctionLotForMemory[];
};

const TERMINAL = new Set<AuctionSliceState["status"]>(["done", "partial", "error"]);

export function rigaDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function openlaneMakeUrl(make: string, years?: { from: number; to: number }): string {
  const u = new URL(OPENLANE_FIND_URL);
  u.searchParams.set("makes", make);
  if (years) {
    u.searchParams.set("yearFrom", String(years.from));
    u.searchParams.set("yearTo", String(years.to));
  }
  return u.toString();
}

function sliceIdForMake(make: string): string {
  return `openline:${make.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

export function buildAuctionSlices(): AuctionSliceState[] {
  const openlane = OPENLANE_MASS_MAKES.map((make) => ({
    id: sliceIdForMake(make),
    source: "openline" as const,
    url: openlaneMakeUrl(make),
    kind: "make" as const,
    nextPage: 1,
    pageCount: null,
    status: "pending" as const,
    attempts: 0,
    note: "",
    vins: 0,
    skippedNoVin: 0,
    endedWithVin: 0,
  }));
  return [
    {
      id: "autobid:catalog",
      source: "autobid",
      url: AUTOBID_CATALOG_URL,
      kind: "catalog",
      nextPage: 1,
      pageCount: null,
      status: "pending",
      attempts: 0,
      note: "",
      vins: 0,
      skippedNoVin: 0,
      endedWithVin: 0,
    },
    ...openlane,
  ];
}

export function freshAuctionIngestState(now: Date, slices: AuctionSliceState[] = buildAuctionSlices()): AuctionIngestState {
  return {
    version: 1,
    passDay: rigaDay(now),
    completedDay: null,
    lastSource: "",
    autobidStreak: 0,
    holdUntil: {},
    slices,
    updatedAt: now.toISOString(),
  };
}

export function parseAuctionIngestState(raw: unknown): AuctionIngestState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AuctionIngestState>;
  if (r.version !== 1 || typeof r.passDay !== "string" || !Array.isArray(r.slices)) return null;
  const slices: AuctionSliceState[] = [];
  for (const s of r.slices) {
    if (!s || typeof s !== "object") continue;
    const row = s as Partial<AuctionSliceState>;
    if (row.source !== "autobid" && row.source !== "openline") continue;
    if (typeof row.id !== "string" || typeof row.url !== "string") continue;
    const status = row.status;
    if (status !== "pending" && status !== "active" && status !== "done" && status !== "partial" && status !== "error") continue;
    slices.push({
      id: row.id,
      source: row.source,
      url: row.url,
      kind: row.kind === "years" || row.kind === "make" || row.kind === "catalog" ? row.kind : "make",
      nextPage: typeof row.nextPage === "number" && row.nextPage >= 1 ? Math.floor(row.nextPage) : 1,
      pageCount: typeof row.pageCount === "number" ? row.pageCount : null,
      status,
      attempts: typeof row.attempts === "number" ? row.attempts : 0,
      note: typeof row.note === "string" ? row.note.slice(0, 240) : "",
      vins: typeof row.vins === "number" ? row.vins : 0,
      skippedNoVin: typeof row.skippedNoVin === "number" ? row.skippedNoVin : 0,
      endedWithVin: typeof row.endedWithVin === "number" ? row.endedWithVin : 0,
    });
  }
  if (!slices.length) return null;
  const hold: AuctionIngestState["holdUntil"] = {};
  if (r.holdUntil && typeof r.holdUntil === "object") {
    for (const key of ["autobid", "openline"] as const) {
      const v = r.holdUntil[key];
      if (typeof v === "string") hold[key] = v;
    }
  }
  return {
    version: 1,
    passDay: r.passDay,
    completedDay: typeof r.completedDay === "string" ? r.completedDay : null,
    lastSource: r.lastSource === "autobid" || r.lastSource === "openline" ? r.lastSource : "",
    autobidStreak: typeof r.autobidStreak === "number" ? r.autobidStreak : 0,
    holdUntil: hold,
    slices,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(0).toISOString(),
  };
}

/** Jaunā Rīgas dienā pabeigtu gājienu sāk no jauna. Nepabeigtu turpina. */
export function stateForTick(prev: AuctionIngestState | null, now: Date): AuctionIngestState {
  const day = rigaDay(now);
  if (!prev) return freshAuctionIngestState(now);
  if (prev.completedDay && day > prev.completedDay) return freshAuctionIngestState(now);
  return prev;
}

function sourceHeld(state: AuctionIngestState, source: AuctionIngestSource, now: Date): boolean {
  const until = state.holdUntil[source];
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > now.getTime();
}

function openSlices(state: AuctionIngestState, source: AuctionIngestSource): AuctionSliceState[] {
  return state.slices.filter((s) => s.source === source && !TERMINAL.has(s.status));
}

export function pickIngestStep(state: AuctionIngestState, now: Date, limits: AuctionIngestLimits = AUCTION_INGEST_LIMITS): AuctionIngestStep | null {
  if (state.completedDay) return null;
  const wantOpenlane =
    state.lastSource === "autobid" && state.autobidStreak >= limits.autobidStreakBeforeOpenlane;
  const order: AuctionIngestSource[] = wantOpenlane ? ["openline", "autobid"] : ["autobid", "openline"];
  for (const source of order) {
    if (sourceHeld(state, source, now)) continue;
    const slice = openSlices(state, source)[0];
    if (!slice) continue;
    return {
      source,
      sliceId: slice.id,
      url: slice.url,
      startPage: slice.source === "autobid" ? slice.nextPage : 1,
      maxPages: source === "autobid" ? limits.autobidPagesPerTick : limits.openlanePagesPerTick,
    };
  }
  return null;
}

export function lotLooksEnded(stage: string | undefined): boolean {
  return (stage ?? "").trim().toUpperCase() === "AFTER_AUCTION";
}

export function observationsFromAuctionLots(
  lots: readonly AuctionLotForMemory[],
  seenOn: string,
): { inputs: VinObservationInput[]; skippedNoVin: number; endedWithVin: number } {
  const mapped = observationsFromListings(
    lots.map((lot) => ({
      platform: lot.platform,
      vin: lot.vin,
      vinSource: lot.vinSource,
      title: lot.title,
      manufacturer: lot.manufacturer,
      mileageKm: lot.mileageKm,
      firstRegistration: lot.firstRegistration,
      year: lot.year,
      countryCode: lot.countryCode,
      lastSeenAt: seenOn,
    })),
  );
  const endedIds = new Set(
    lots
      .filter((lot) => lotLooksEnded(lot.auctionStage) && lot.vin)
      .map((lot) => (lot.vin ?? "").replace(/\s+/g, "").toUpperCase()),
  );
  const endedWithVin = mapped.inputs.filter((row) => endedIds.has(row.vin.replace(/\s+/g, "").toUpperCase())).length;
  return { inputs: mapped.inputs, skippedNoVin: mapped.skippedNoVin, endedWithVin };
}

function makeFromOpenlaneUrl(url: string): string {
  try {
    return new URL(url).searchParams.get("makes")?.trim() ?? "";
  } catch {
    return "";
  }
}

function yearFollowUps(parent: AuctionSliceState): AuctionSliceState[] {
  if (parent.kind !== "make") return [];
  const make = makeFromOpenlaneUrl(parent.url);
  if (!make) return [];
  return OPENLANE_YEAR_BANDS.map(([from, to]) => ({
    id: `${parent.id}:${from}-${to}`,
    source: "openline" as const,
    url: openlaneMakeUrl(make, { from, to }),
    kind: "years" as const,
    nextPage: 1,
    pageCount: null,
    status: "pending" as const,
    attempts: 0,
    note: "",
    vins: 0,
    skippedNoVin: 0,
    endedWithVin: 0,
  }));
}

function shouldHold(result: AuctionStepFetch): boolean {
  if (result.status === "login_required" || result.status === "blocked_by_waf") return true;
  return /limits|429|rinda|aizņemts|nav konfigur/i.test(result.note);
}

function passFinished(slices: AuctionSliceState[]): boolean {
  return slices.every((s) => TERMINAL.has(s.status));
}

/**
 * Pieliek soļa iznākumu. Kursoru bīda tikai pēc veiksmīgas nolasīšanas.
 * `login_required` / WAF / releja limits netērē mēģinājumus: avots pauzē `holdMs`.
 */
export function applyIngestStep(
  state: AuctionIngestState,
  step: AuctionIngestStep,
  result: AuctionStepFetch,
  mapped: { vins: number; skippedNoVin: number; endedWithVin: number },
  now: Date,
  limits: AuctionIngestLimits = AUCTION_INGEST_LIMITS,
): AuctionIngestState {
  const slices = state.slices.map((s) => ({ ...s }));
  const idx = slices.findIndex((s) => s.id === step.sliceId);
  const holdUntil = { ...state.holdUntil };
  let lastSource = state.lastSource;
  let autobidStreak = state.autobidStreak;
  if (idx < 0) {
    return { ...state, updatedAt: now.toISOString() };
  }
  const slice = slices[idx]!;
  lastSource = step.source;
  autobidStreak = step.source === "autobid" ? state.autobidStreak + 1 : 0;

  if (result.status !== "ok") {
    if (shouldHold(result)) {
      holdUntil[step.source] = new Date(now.getTime() + limits.holdMs).toISOString();
      slice.status = slice.status === "pending" ? "pending" : slice.status;
      slice.note = result.note.slice(0, 240);
    } else {
      slice.attempts += 1;
      slice.note = result.note.slice(0, 240);
      slice.status = slice.attempts >= limits.maxAttempts ? "error" : "active";
    }
  } else if (step.source === "openline") {
    const truncated = result.pageCount > result.pagesFetched;
    slice.pageCount = result.pageCount;
    slice.vins += mapped.vins;
    slice.skippedNoVin += mapped.skippedNoVin;
    slice.endedWithVin += mapped.endedWithVin;
    slice.attempts = 0;
    slice.note = truncated
      ? `Nolasītas ${result.pagesFetched}/${result.pageCount} lapas (releja limits).`
      : result.note.slice(0, 240);
    slice.status = truncated ? "partial" : "done";
    if (truncated && slice.kind === "make") {
      const extra = yearFollowUps(slice).filter((child) => !slices.some((s) => s.id === child.id));
      slices.push(...extra);
    }
  } else {
    const fetched = Math.max(0, result.pagesFetched);
    slice.pageCount = result.pageCount > 0 ? result.pageCount : slice.pageCount;
    slice.vins += mapped.vins;
    slice.skippedNoVin += mapped.skippedNoVin;
    slice.endedWithVin += mapped.endedWithVin;
    slice.attempts = 0;
    slice.note = result.note.slice(0, 240);
    if (fetched === 0) {
      slice.status = "done";
      slice.note = slice.note || "Tukša lapa, kataloga gājiens beidzas.";
    } else {
      slice.nextPage += fetched;
      const knownEnd = slice.pageCount != null && slice.pageCount > 0 && slice.nextPage > slice.pageCount;
      slice.status = knownEnd ? "done" : "active";
    }
  }

  const completedDay = passFinished(slices) ? rigaDay(now) : null;
  return {
    ...state,
    lastSource,
    autobidStreak,
    holdUntil,
    slices,
    completedDay,
    updatedAt: now.toISOString(),
  };
}

export type AuctionSourceProgress = {
  pending: number;
  active: number;
  done: number;
  partial: number;
  error: number;
  vins: number;
  skippedNoVin: number;
  endedWithVin: number;
};

export function ingestProgress(state: AuctionIngestState): Record<AuctionIngestSource, AuctionSourceProgress> {
  const blank = (): AuctionSourceProgress => ({
    pending: 0,
    active: 0,
    done: 0,
    partial: 0,
    error: 0,
    vins: 0,
    skippedNoVin: 0,
    endedWithVin: 0,
  });
  const out = { autobid: blank(), openline: blank() };
  for (const s of state.slices) {
    const row = out[s.source];
    row[s.status] += 1;
    row.vins += s.vins;
    row.skippedNoVin += s.skippedNoVin;
    row.endedWithVin += s.endedWithVin;
  }
  return out;
}

export type VinMemoryArchiveCounts = {
  vins: number;
  observations: number;
  bySource: Record<VinMemorySource, { vins: number; observations: number }>;
};

export function emptyArchiveCounts(): VinMemoryArchiveCounts {
  const bySource = {} as VinMemoryArchiveCounts["bySource"];
  for (const source of VIN_MEMORY_SOURCES) bySource[source] = { vins: 0, observations: 0 };
  return { vins: 0, observations: 0, bySource };
}

export type VinMemoryBrowseRow = {
  vin: string;
  updatedAt: string;
  model: string;
  km: number | null;
  date: string;
  firstRegistration: string;
  sources: VinMemorySource[];
  observations: number;
};

/** Jaunākie VIN pārlūkošanai. Nav atsevišķa reģistra: rindas nāk no tām pašām šķembām. */
export function recentVinBrowse(entries: Iterable<VinMemoryEntry>, limit = 40): VinMemoryBrowseRow[] {
  const rows: VinMemoryBrowseRow[] = [];
  for (const entry of entries) {
    const latest = latestKm(entry);
    const newest = [...entry.observations].reverse();
    const sources: VinMemorySource[] = [];
    for (const obs of entry.observations) if (!sources.includes(obs.source)) sources.push(obs.source);
    rows.push({
      vin: entry.vin,
      updatedAt: entry.updatedAt,
      model: newest.find((o) => o.model)?.model ?? "",
      km: latest?.km ?? null,
      date: latest?.date ?? newest[0]?.date ?? "",
      firstRegistration: newest.find((o) => o.firstRegistration)?.firstRegistration ?? "",
      sources,
      observations: entry.observations.length,
    });
  }
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.vin.localeCompare(b.vin)));
  return rows.slice(0, Math.max(0, limit));
}

export function summarizeVinMemory(entries: Iterable<VinMemoryEntry>): VinMemoryArchiveCounts {
  const counts = emptyArchiveCounts();
  const seenVin = new Set<string>();
  const seenBySource: Record<string, Set<string>> = {};
  for (const source of VIN_MEMORY_SOURCES) seenBySource[source] = new Set();
  for (const entry of entries) {
    if (seenVin.has(entry.vin)) continue;
    seenVin.add(entry.vin);
    counts.vins += 1;
    for (const obs of entry.observations) {
      counts.observations += 1;
      const bucket = counts.bySource[obs.source];
      if (!bucket) continue;
      bucket.observations += 1;
      seenBySource[obs.source]!.add(entry.vin);
    }
  }
  for (const source of VIN_MEMORY_SOURCES) counts.bySource[source].vins = seenBySource[source]!.size;
  return counts;
}

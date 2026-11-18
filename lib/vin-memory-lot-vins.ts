/**
 * VIN atmiņa: lotu VIN no ielogotām lotes lapām (Nils 17.11.2026).
 *
 * Autobid un Openlane sarakstos VIN nav, bet ielogotā lotes lapā ir. Masveida gājiens
 * (`vin-memory-auction-ingest`) lotes bez VIN ieliek rindā; atsevišķs cron pa mazām
 * partijām prasa relejam `/lot-vins` un atrastos VIN ieraksta VIN atmiņā.
 * Tīra loģika bez tīkla un krātuves, lai testi strādā bez mock.
 */

import { isMemoryVin, type VinObservationInput } from "@/lib/vin-memory";
import { normalizeFirstRegistration } from "@/lib/vin-memory-feed";

export type LotVinPlatform = "autobid" | "openline";

export const LOT_VIN_PLATFORMS: readonly LotVinPlatform[] = ["openline", "autobid"];

export const LOT_VIN_LIMITS = {
  /** Rindas griesti: vecākās lotes krīt ārā, jo izsoles beidzas pāris dienās. */
  maxPending: 3000,
  /** Cik pabeigto lotu atslēgas atceramies, lai tās nerindotu otrreiz. */
  maxDone: 30000,
  maxAttempts: 3,
  batch: 8,
  maxBatch: 12,
} as const;

export type LotVinQueueItem = {
  key: string;
  platform: LotVinPlatform;
  url: string;
  title: string;
  mileageKm: number | null;
  firstRegistration: string;
  country: string;
  addedDay: string;
  attempts: number;
};

export type LotVinQueue = {
  version: 1;
  pending: LotVinQueueItem[];
  done: string[];
  holdUntil: Partial<Record<LotVinPlatform, string>>;
  lastPlatform: LotVinPlatform | "";
  totals: { asked: number; vins: number; noVin: number; gone: number; errors: number };
  lastNote: string;
  updatedAt: string;
};

export type LotForQueue = {
  platform: LotVinPlatform;
  externalId?: string;
  detailUrl?: string;
  vin?: string;
  title?: string;
  manufacturer?: string;
  mileageKm?: number | null;
  firstRegistration?: string;
  year?: string;
  countryCode?: string;
};

export type LotVinRelayRow = {
  url: string;
  status: "ok" | "no_vin" | "gone" | "error";
  vin: string;
  mileageKm: number | null;
  firstRegistration: string;
  title: string;
};

export type LotVinRelayResult = {
  status: "ok" | "login_required" | "blocked_by_waf" | "fetch_failed" | "daily_limit";
  note: string;
  results: LotVinRelayRow[];
};

export function emptyLotVinQueue(now: Date = new Date()): LotVinQueue {
  return {
    version: 1,
    pending: [],
    done: [],
    holdUntil: {},
    lastPlatform: "",
    totals: { asked: 0, vins: 0, noVin: 0, gone: 0, errors: 0 },
    lastNote: "",
    updatedAt: now.toISOString(),
  };
}

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function isPlatform(v: unknown): v is LotVinPlatform {
  return v === "autobid" || v === "openline";
}

const HOSTS: Record<LotVinPlatform, RegExp> = {
  autobid: /(^|\.)autobid\.de$/i,
  openline: /(^|\.)openlane\.(eu|com)$/i,
};

/** Tikai https lotes lapa uz pareizā hosta. Citu neliekam rindā un nesūtām relejam. */
export function lotVinUrlAllowed(platform: LotVinPlatform, url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !HOSTS[platform].test(u.hostname)) return false;
    if (platform === "autobid") return /\/item\/[^/]+/.test(u.pathname);
    return /\/car\/(info|\d{4,})/.test(u.pathname);
  } catch {
    return false;
  }
}

export function parseLotVinQueue(raw: unknown, now: Date = new Date()): LotVinQueue {
  const base = emptyLotVinQueue(now);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const pending: LotVinQueueItem[] = [];
  const seen = new Set<string>();
  for (const row of Array.isArray(o.pending) ? o.pending : []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const key = str(r.key, 120);
    const url = str(r.url, 500);
    if (!key || seen.has(key) || !isPlatform(r.platform) || !lotVinUrlAllowed(r.platform, url)) continue;
    seen.add(key);
    pending.push({
      key,
      platform: r.platform,
      url,
      title: str(r.title, 160),
      mileageKm: typeof r.mileageKm === "number" && Number.isFinite(r.mileageKm) ? r.mileageKm : null,
      firstRegistration: str(r.firstRegistration, 20),
      country: str(r.country, 8),
      addedDay: str(r.addedDay, 10),
      attempts: num(r.attempts),
    });
  }
  const done = (Array.isArray(o.done) ? o.done : []).filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 120);
  const hold: LotVinQueue["holdUntil"] = {};
  if (o.holdUntil && typeof o.holdUntil === "object") {
    for (const p of LOT_VIN_PLATFORMS) {
      const v = str((o.holdUntil as Record<string, unknown>)[p], 40);
      if (v && Number.isFinite(Date.parse(v))) hold[p] = v;
    }
  }
  const t = (o.totals && typeof o.totals === "object" ? o.totals : {}) as Record<string, unknown>;
  return {
    version: 1,
    pending: pending.slice(-LOT_VIN_LIMITS.maxPending),
    done: done.slice(-LOT_VIN_LIMITS.maxDone),
    holdUntil: hold,
    lastPlatform: isPlatform(o.lastPlatform) ? o.lastPlatform : "",
    totals: { asked: num(t.asked), vins: num(t.vins), noVin: num(t.noVin), gone: num(t.gone), errors: num(t.errors) },
    lastNote: str(o.lastNote, 240),
    updatedAt: str(o.updatedAt, 40) || base.updatedAt,
  };
}

/** Lotes bez derīga VIN, kam ir lotes lapa, nonāk rindas galā. Jaunākās tiek prasītas pirmās. */
export function enqueueLotsWithoutVin(queue: LotVinQueue, lots: readonly LotForQueue[], day: string, now: Date = new Date()): { queue: LotVinQueue; added: number } {
  const known = new Set<string>([...queue.done, ...queue.pending.map((p) => p.key)]);
  const pending = [...queue.pending];
  let added = 0;
  for (const lot of lots) {
    const vin = (lot.vin ?? "").trim();
    if (vin && isMemoryVin(vin)) continue;
    const id = (lot.externalId ?? "").trim();
    const url = (lot.detailUrl ?? "").trim();
    if (!id || !url || !lotVinUrlAllowed(lot.platform, url)) continue;
    const key = `${lot.platform}:${id}`.slice(0, 120);
    if (known.has(key)) continue;
    known.add(key);
    added += 1;
    pending.push({
      key,
      platform: lot.platform,
      url,
      title: (lot.title || lot.manufacturer || "").slice(0, 160),
      mileageKm: typeof lot.mileageKm === "number" && Number.isFinite(lot.mileageKm) ? lot.mileageKm : null,
      firstRegistration: (lot.firstRegistration || lot.year || "").slice(0, 20),
      country: (lot.countryCode || "").slice(0, 8),
      addedDay: day,
      attempts: 0,
    });
  }
  if (added === 0) return { queue, added };
  return { queue: { ...queue, pending: pending.slice(-LOT_VIN_LIMITS.maxPending), updatedAt: now.toISOString() }, added };
}

/** Nākamā partija: platformas mijas, pauzē esošās izlaiž, jaunākās lotes pa priekšu. */
export function pickLotVinBatch(queue: LotVinQueue, now: Date, batch: number = LOT_VIN_LIMITS.batch): { platform: LotVinPlatform; items: LotVinQueueItem[] } | null {
  const size = Math.min(LOT_VIN_LIMITS.maxBatch, Math.max(1, Math.floor(batch)));
  const free = LOT_VIN_PLATFORMS.filter((p) => {
    const hold = queue.holdUntil[p];
    return !(hold && Date.parse(hold) > now.getTime()) && queue.pending.some((item) => item.platform === p);
  });
  if (free.length === 0) return null;
  const platform = free.find((p) => p !== queue.lastPlatform) ?? free[0]!;
  const items = queue.pending.filter((item) => item.platform === platform).slice(-size).reverse();
  return { platform, items };
}

function nextRigaMidnight(now: Date): string {
  return new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString();
}

/**
 * Releja atbilde -> novērojumi un jauna rinda.
 * VIN atrasts vai lapā nav: lote ir pabeigta. Kļūda: vēl līdz `maxAttempts` mēģinājumiem.
 * Login, WAF un dienas limits: platforma pauzē līdz nākamajai naktij, lotes paliek rindā.
 */
export function applyLotVinResult(
  queue: LotVinQueue,
  picked: { platform: LotVinPlatform; items: readonly LotVinQueueItem[] },
  result: LotVinRelayResult,
  day: string,
  now: Date = new Date(),
): { queue: LotVinQueue; inputs: VinObservationInput[] } {
  const inputs: VinObservationInput[] = [];
  const byUrl = new Map(result.results.map((row) => [row.url, row] as const));
  const finished = new Set<string>();
  const retry = new Map<string, number>();
  const totals = { ...queue.totals };
  const interrupted = result.status !== "ok" || /limits/i.test(result.note);
  const sameOrder = result.results.length === picked.items.length;
  for (const [i, item] of picked.items.entries()) {
    /* Relejs var normalizēt saiti (piem. /en/), tad sakrīt secība, ne teksts. */
    const row = byUrl.get(item.url) ?? (sameOrder ? result.results[i] : undefined);
    if (!row) continue;
    totals.asked += 1;
    const vin = row.vin.trim().toUpperCase();
    if (row.status === "ok" && isMemoryVin(vin)) {
      totals.vins += 1;
      finished.add(item.key);
      const firstRegistration = normalizeFirstRegistration(row.firstRegistration) ?? normalizeFirstRegistration(item.firstRegistration) ?? undefined;
      inputs.push({
        vin,
        date: day,
        source: picked.platform,
        km: row.mileageKm ?? item.mileageKm,
        model: row.title || item.title,
        firstRegistration,
        country: item.country || undefined,
      });
    } else if (row.status === "no_vin" || row.status === "ok") {
      totals.noVin += 1;
      finished.add(item.key);
    } else if (row.status === "gone") {
      totals.gone += 1;
      finished.add(item.key);
    } else if (interrupted) {
      /* Partija pārtraukta (limits, login, WAF): lote nav vainīga, mēģinājumu neskaitām. */
      totals.asked -= 1;
    } else {
      totals.errors += 1;
      if (item.attempts + 1 >= LOT_VIN_LIMITS.maxAttempts) finished.add(item.key);
      else retry.set(item.key, item.attempts + 1);
    }
  }
  const holdUntil = { ...queue.holdUntil };
  if (result.status !== "ok") holdUntil[picked.platform] = nextRigaMidnight(now);
  else delete holdUntil[picked.platform];
  const pending = queue.pending
    .filter((item) => !finished.has(item.key))
    .map((item) => (retry.has(item.key) ? { ...item, attempts: retry.get(item.key)! } : item));
  return {
    inputs,
    queue: {
      ...queue,
      pending,
      done: [...queue.done, ...finished].slice(-LOT_VIN_LIMITS.maxDone),
      holdUntil,
      lastPlatform: picked.platform,
      totals,
      lastNote: result.note.slice(0, 240),
      updatedAt: now.toISOString(),
    },
  };
}

export type LotVinProgress = {
  pending: Record<LotVinPlatform, number>;
  done: number;
  totals: LotVinQueue["totals"];
  holdUntil: LotVinQueue["holdUntil"];
  lastNote: string;
  updatedAt: string;
};

export function lotVinProgress(queue: LotVinQueue): LotVinProgress {
  const pending: Record<LotVinPlatform, number> = { autobid: 0, openline: 0 };
  for (const item of queue.pending) pending[item.platform] += 1;
  return { pending, done: queue.done.length, totals: queue.totals, holdUntil: queue.holdUntil, lastNote: queue.lastNote, updatedAt: queue.updatedAt };
}

/** Releja `/lot-vins` atbilde -> tipizēts rezultāts. Nezināma forma ir `fetch_failed`, nevis izdomāti dati. */
export function mapLotVinRelayResponse(httpStatus: number, body: unknown): LotVinRelayResult {
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (httpStatus === 429) return { status: "daily_limit", note: str(o.error, 200) || "Releja dienas limits lotu VIN.", results: [] };
  if (httpStatus !== 200 || o.ok !== true) {
    return { status: "fetch_failed", note: str(o.error, 200) || str(o.note, 200) || `Relejs HTTP ${httpStatus}`, results: [] };
  }
  const results: LotVinRelayRow[] = [];
  for (const row of Array.isArray(o.results) ? o.results : []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const url = str(r.url, 500);
    if (!url) continue;
    const s = str(r.status, 20);
    const vin = str(r.vin, 20).toUpperCase();
    results.push({
      url,
      status: s === "ok" || s === "no_vin" || s === "gone" ? s : "error",
      vin: isMemoryVin(vin) ? vin : "",
      mileageKm: typeof r.mileageKm === "number" && Number.isFinite(r.mileageKm) && r.mileageKm >= 0 ? Math.round(r.mileageKm) : null,
      firstRegistration: str(r.firstRegistration, 20),
      title: str(r.title, 160),
    });
  }
  const s = str(o.status, 20);
  const status: LotVinRelayResult["status"] = s === "ok" ? "ok" : s === "login_required" ? "login_required" : s === "blocked" ? "blocked_by_waf" : "fetch_failed";
  return { status, note: str(o.note, 200), results };
}

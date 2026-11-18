import "server-only";

import { readIrissRelayConfig, type IrissRelayConfig } from "@/lib/iriss-listings-relay";
import { rigaDay } from "@/lib/vin-memory-auction";
import { auctionIngestStoreDurable, forgetArchiveCountsCache, readLotVinQueue, writeLotVinQueue } from "@/lib/vin-memory-auction-store";
import {
  LOT_VIN_LIMITS,
  applyLotVinResult,
  lotVinProgress,
  mapLotVinRelayResponse,
  pickLotVinBatch,
  type LotVinPlatform,
  type LotVinProgress,
  type LotVinRelayResult,
} from "@/lib/vin-memory-lot-vins";
import { addVinObservations, isVinMemoryStoreDurable } from "@/lib/vin-memory-store";

/**
 * Viens lotu VIN solis: dažas lotes no rindas -> releja `/lot-vins` (ielogots profils) -> VIN atmiņa.
 * Mazas partijas un releja dienas limits (`LISTINGS_LOTVIN_MAX_PER_DAY`), lai konts neizskatās pēc robota.
 */

export type LotVinTick = {
  ok: boolean;
  idle: boolean;
  platform: LotVinPlatform | null;
  asked: number;
  vins: number;
  added: number;
  updated: number;
  note: string;
  progress: LotVinProgress;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function batchFromEnv(): number {
  const v = Number.parseInt(process.env.VIN_MEMORY_LOT_VIN_BATCH ?? "", 10);
  return Number.isFinite(v) ? Math.min(LOT_VIN_LIMITS.maxBatch, Math.max(1, v)) : LOT_VIN_LIMITS.batch;
}

export async function fetchLotVinsViaRelay(
  cfg: IrissRelayConfig,
  platform: LotVinPlatform,
  urls: readonly string[],
  opts: { timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<LotVinRelayResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 270_000);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/lot-vins`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ platform: platform === "openline" ? "openlane" : "autobid", urls }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    return mapLotVinRelayResponse(res.status, body);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { status: "fetch_failed", note: aborted ? "Relejs neatbildēja laikā." : "Relejs nav sasniedzams.", results: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function runVinMemoryLotVins(now: Date = new Date(), deps: { fetchImpl?: FetchLike } = {}): Promise<LotVinTick> {
  const queue = await readLotVinQueue(now);
  const idle = (note: string, ok = true): LotVinTick => ({
    ok,
    idle: true,
    platform: null,
    asked: 0,
    vins: 0,
    added: 0,
    updated: 0,
    note,
    progress: lotVinProgress(queue),
  });
  if (!isVinMemoryStoreDurable() || !auctionIngestStoreDurable()) return idle("VIN atmiņas krātuve nav pieejama.", false);
  const cfg = readIrissRelayConfig();
  if (!cfg) return idle("Relejs nav konfigurēts (IRISS_LISTINGS_RELAY_URL / IRISS_LISTINGS_RELAY_TOKEN).", false);
  const picked = pickLotVinBatch(queue, now, batchFromEnv());
  if (!picked) return idle(queue.pending.length ? "Abas platformas pauzē (login, WAF vai dienas limits)." : "Rinda ir tukša.");

  const result = await fetchLotVinsViaRelay(cfg, picked.platform, picked.items.map((item) => item.url), { fetchImpl: deps.fetchImpl });
  const applied = applyLotVinResult(queue, picked, result, rigaDay(now), now);
  let added = 0;
  let updated = 0;
  if (applied.inputs.length) {
    const wrote = await addVinObservations(applied.inputs, now);
    if (!wrote.ok) {
      /* Rindu nebīdām: tās pašas lotes prasīs nākamais solis. */
      return { ...idle("Novērojumu rakstīšana neizdevās. Rinda nav bīdīta.", false), idle: false, platform: picked.platform };
    }
    added = wrote.added;
    updated = wrote.updated;
    await forgetArchiveCountsCache().catch(() => undefined);
  }
  const saved = await writeLotVinQueue(applied.queue);
  return {
    ok: saved && result.status === "ok",
    idle: false,
    platform: picked.platform,
    asked: result.results.length,
    vins: applied.inputs.length,
    added,
    updated,
    note: saved ? result.note : "Rindu neizdevās saglabāt.",
    progress: lotVinProgress(saved ? applied.queue : queue),
  };
}

import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import { fetchFreeVinDetails } from "@/lib/free-vin-details";
import { isValidPlateNumber, normalizePlateNumber } from "@/lib/order-field-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { decodeVin } from "@/lib/vin-decode";
import { VIN_CHECK_SOURCES, type VinCheckModel, type VinCheckOutcome, type VinCheckSource } from "@/lib/vin-check-stats";
import { csddUsage, recordVinCheckEvent } from "@/lib/vin-check-stats-store";
import { decoderCsddBlocked, toPublicPlateView, type PublicPlateView } from "@/lib/vin-dekoders-plate";
import { readVinMemory } from "@/lib/vin-memory-store";
import { decodeLearnedFrom, decodeVinModel } from "@/lib/vin-model-codes";
import { readLearnedTable } from "@/lib/vin-model-learn-store";

export const runtime = "nodejs";
export const maxDuration = 25;

/**
 * VIN (bez maksas, CSDD netiek zvanīts): 40 / 10 min un 300 / dienā no IP. Numurzīme: 10 / 10 min un 100 / dienā no IP (mobilajiem operatoriem
 * viens IP daudziem). Īstā CSDD līguma aizsardzība ir `decoderCsddBlocked`: 200 dienā un mēneša griesti.
 */
const LIMITS = {
  vin: { burst: 40, day: 300 },
  plate: { burst: 10, day: 100 },
};
const BURST_WINDOW_MS = 10 * 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const PLATE_TIMEOUT_MS = 12_000;

/** Viena numurzīme 6 h laikā iet uz CSDD vienreiz (instances atmiņā). */
const plateCache = new Map<string, { at: number; view: PublicPlateView | null; vin: string }>();
const PLATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PLATE_CACHE_MAX = 500;

function sourceOf(raw: string | null): VinCheckSource {
  return (VIN_CHECK_SOURCES as readonly string[]).includes(raw ?? "") ? (raw as VinCheckSource) : "direct";
}

async function limited(ip: string, kind: "vin" | "plate"): Promise<number | null> {
  const l = LIMITS[kind];
  for (const [key, max, win] of [
    [`vin-dekoders-${kind}-burst:${ip}`, l.burst, BURST_WINDOW_MS],
    [`vin-dekoders-${kind}-day:${ip}`, l.day, DAY_WINDOW_MS],
  ] as const) {
    const rl = await checkRateLimit(key, max, win);
    if (!rl.ok) return rl.retryAfterSec;
  }
  return null;
}

/** Cik ierakstu mūsu VIN atmiņā (tikai skaitlis, bez datiem un avotiem). */
async function memoryCount(vin: string): Promise<number> {
  try {
    return (await readVinMemory(vin))?.observations.length ?? 0;
  } catch {
    return 0;
  }
}

function json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, { status: init?.status, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

/**
 * Publisks bezmaksas dekods. `?q=` (VIN vai LV numurzīme) vai `?vin=`; `&src=home|decoder`.
 * VIN: lokālā WMI daļa, modelis no ražotāja koda, NHTSA vPIC tikai Ziemeļamerikas VIN.
 * Numurzīme: CSDD tehniskie dati (VIN maskēts). Katrs pieprasījums tiek uzskaitīts (bez VIN un numurzīmes).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const raw = (params.get("q") ?? params.get("vin") ?? params.get("plate") ?? "").slice(0, 40);
  const source = sourceOf(params.get("src"));
  const ip = getClientIpFromRequest(req);
  const record = (kind: "vin" | "plate", outcome: VinCheckOutcome, extra: { region?: string; model?: VinCheckModel; memoryHit?: boolean } = {}) =>
    recordVinCheckEvent({ type: "check", kind, outcome, source, ...extra });

  const plate = normalizePlateNumber(raw);
  if (isValidPlateNumber(plate)) {
    const retry = await limited(ip, "plate");
    if (retry !== null) {
      await record("plate", "rate_limited");
      return json({ error: "rate_limited", retryAfterSec: retry }, { status: 429, headers: { "Retry-After": String(retry) } });
    }
    let entry = plateCache.get(plate);
    if (!entry || Date.now() - entry.at >= PLATE_CACHE_TTL_MS) {
      if (decoderCsddBlocked(await csddUsage())) {
        await record("plate", "quota");
        return json({ error: "quota" }, { status: 503 });
      }
      const result = await fetchCsddTechDataCounted(plate, "decoder", { timeoutMs: PLATE_TIMEOUT_MS });
      if (!result.found && !/netika atrasts/i.test(result.message)) {
        await record("plate", "csdd_error");
        return json({ error: "csdd_unavailable" }, { status: 502 });
      }
      entry = { at: Date.now(), view: result.found ? toPublicPlateView(plate, result.data) : null, vin: result.found ? result.data.vin : "" };
      if (plateCache.size >= PLATE_CACHE_MAX) {
        const oldest = plateCache.keys().next().value;
        if (oldest !== undefined) plateCache.delete(oldest);
      }
      plateCache.set(plate, entry);
    }
    if (!entry.view) {
      await record("plate", "not_found");
      return json({ kind: "plate", plate, found: false });
    }
    const local = entry.vin ? decodeVin(entry.vin) : null;
    const memory = entry.vin ? await memoryCount(entry.vin) : 0;
    await record("plate", "ok", { region: local?.ok ? local.region : undefined, model: "csdd", memoryHit: memory > 0 });
    return json({ kind: "plate", plate, found: true, csdd: entry.view, memoryRecords: memory });
  }

  const local = decodeVin(raw);
  if (!local.ok) {
    const looksPlate = raw.replace(/[\s-]/g, "").length <= 7;
    await record(looksPlate ? "plate" : "vin", looksPlate ? "invalid_plate" : local.error === "length" ? "invalid_length" : "invalid_chars");
    return json({ error: looksPlate ? "invalid_plate" : `invalid_vin_${local.error}` }, { status: 400 });
  }
  const retry = await limited(ip, "vin");
  if (retry !== null) {
    await record("vin", "rate_limited");
    return json({ error: "rate_limited", retryAfterSec: retry }, { status: 429, headers: { "Retry-After": String(retry) } });
  }
  const model = decodeVinModel(local) ?? decodeLearnedFrom(await readLearnedTable().catch(() => ({})), local.vin);
  const [details, memory] = await Promise.all([fetchFreeVinDetails(local), memoryCount(local.vin)]);
  const modelKind: VinCheckModel = model ? model.scheme : details.vpic ? "vpic" : "none";
  await record("vin", "ok", { region: local.region, model: modelKind, memoryHit: memory > 0 });
  return json({ kind: "vin", vin: local.vin, local, model, memoryRecords: memory, ...details });
}

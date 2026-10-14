/**
 * Speckr Customer API — POST /vehicle-specs (1 kredīts par veiksmīgu pieprasījumu).
 * OpenAPI: https://speckr.com/api/v1/openapi.json
 */
import "server-only";

import type { VinScanParse } from "@/lib/vin-scan/types";

export const SPECKR_API_BASE = "https://speckr.com/api/v1";
export const SPECKR_NOT_CONFIGURED = "nav konfigurēts";
const FETCH_TIMEOUT_MS = 22_000;

export type SpeckrApiEnv = Record<string, string | undefined>;

export function speckrApiKey(env: SpeckrApiEnv = process.env): string {
  return String(env.SPECKR_API_KEY ?? "").trim();
}

export function speckrApiConfigured(env: SpeckrApiEnv = process.env): boolean {
  return Boolean(speckrApiKey(env));
}

export function speckrNotConfiguredParse(): VinScanParse {
  return { status: "skipped", summary: SPECKR_NOT_CONFIGURED };
}

type SpeckrRow = { key?: string; label?: string; value?: string | string[] };
type SpeckrSection = { key?: string; title?: string; rows?: SpeckrRow[] };

export type SpeckrVehicleSpecsPayload = {
  object?: string;
  version?: string;
  vin?: string;
  title?: string;
  vehicle?: { year?: string | null; make?: string | null; model?: string | null; trim?: string | null };
  summary?: {
    production_date?: string | null;
    factory?: string | null;
    wheels?: string | null;
    paint?: string | null;
    interior?: string | null;
    supercharging?: string | null;
  };
  battery?: {
    state_of_health_percent?: number | null;
    usable_capacity?: string | null;
    original_capacity_kwh?: number | null;
    capacity_summary?: string | null;
    last_measured?: string | null;
  };
  range_and_charging?: { rows?: SpeckrRow[]; wheel_rows?: unknown[] };
  sections?: SpeckrSection[];
};

function formatSpeckrValue(value: string | string[] | null | undefined): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(", ");
  return String(value).trim();
}

function pushDetailLine(lines: string[], label: string, value: string | string[] | null | undefined): void {
  const text = formatSpeckrValue(value);
  if (!text) return;
  lines.push(`${label}: ${text}`);
}

function pushRows(lines: string[], rows: SpeckrRow[] | undefined, heading?: string): void {
  if (!rows?.length) return;
  if (heading) lines.push(heading);
  for (const row of rows) {
    const label = String(row.label ?? row.key ?? "").trim();
    const value = formatSpeckrValue(row.value);
    if (!label || !value) continue;
    lines.push(`${label}: ${value}`);
  }
}

export function parseSpeckrVehicleSpecs(json: SpeckrVehicleSpecsPayload): VinScanParse {
  const vehicle = json.vehicle ?? {};
  const year = formatSpeckrValue(vehicle.year);
  const make = formatSpeckrValue(vehicle.make);
  const model = formatSpeckrValue(vehicle.model);
  const trim = formatSpeckrValue(vehicle.trim);
  const title = formatSpeckrValue(json.title);
  const ymm = [year, make, model, trim].filter(Boolean).join(" ");
  const summary = title || ymm || "Speckr specifikācija";

  const detailLines: string[] = [];
  const sum = json.summary ?? {};
  pushDetailLine(detailLines, "Ražošanas datums", sum.production_date);
  pushDetailLine(detailLines, "Rūpnīca", sum.factory);
  pushDetailLine(detailLines, "Riteņi", sum.wheels);
  pushDetailLine(detailLines, "Krāsa", sum.paint);
  pushDetailLine(detailLines, "Interjers", sum.interior);
  pushDetailLine(detailLines, "Supercharging", sum.supercharging);

  const bat = json.battery ?? {};
  if (bat.state_of_health_percent != null && !Number.isNaN(bat.state_of_health_percent)) {
    pushDetailLine(detailLines, "Baterijas SOH", `${bat.state_of_health_percent}%`);
  }
  pushDetailLine(detailLines, "Lietojamā kapacitāte", bat.usable_capacity);
  if (bat.original_capacity_kwh != null && !Number.isNaN(bat.original_capacity_kwh)) {
    pushDetailLine(detailLines, "Oriģinālā kapacitāte", `${bat.original_capacity_kwh} kWh`);
  }
  pushDetailLine(detailLines, "Kapacitātes kopsavilkums", bat.capacity_summary);
  pushDetailLine(detailLines, "Pēdējais mērījums", bat.last_measured);

  pushRows(detailLines, json.range_and_charging?.rows, "Diapazons un uzlāde");
  for (const section of json.sections ?? []) {
    const heading = String(section.title ?? section.key ?? "").trim();
    pushRows(detailLines, section.rows, heading || undefined);
  }

  const hasVehicle = Boolean(make || model || year || trim);
  const hasDetail = detailLines.length > 0;
  if (!hasVehicle && !hasDetail && !title) {
    return { status: "none", summary: "Speckr šim VIN neatgrieza specifikāciju" };
  }

  const vehicleOut = hasVehicle
    ? { year, make, model: [model, trim].filter(Boolean).join(" ").trim() || model }
    : undefined;

  return {
    status: "found",
    summary,
    detail: detailLines.join("\n"),
    vehicle: vehicleOut,
    openUrl: json.vin ? `https://speckr.com/?vin=${encodeURIComponent(json.vin)}` : undefined,
  };
}

function speckrErrorMessage(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const err = (json as { error?: { message?: string; code?: string } }).error;
  const msg = String(err?.message ?? "").trim();
  const code = String(err?.code ?? "").trim();
  if (msg && code) return `${msg} (${code})`;
  return msg || code;
}

export function parseSpeckrHttpFailure(status: number, json: unknown): VinScanParse {
  const msg = speckrErrorMessage(json);
  if (status === 402) {
    return { status: "manual", summary: msg || "Nav pietiekami Speckr kredītu" };
  }
  if (status === 401) {
    return { status: "unknown", summary: msg || "Speckr API: nederīga atslēga" };
  }
  if (status === 404 || status === 422) {
    return { status: "none", summary: msg || "Speckr šo VIN neatbalsta vai neatpazīst" };
  }
  if (status === 503) {
    return { status: "unknown", summary: msg || "Speckr pagaidām nav pieejams" };
  }
  if (status >= 500) {
    return { status: "unknown", summary: msg || `Speckr servera kļūda HTTP ${status}` };
  }
  if (status === 429) {
    return { status: "unknown", summary: msg || "Speckr: pārāk daudz pieprasījumu" };
  }
  return { status: "unknown", summary: msg || `Speckr HTTP ${status}` };
}

export type FetchSpeckrVehicleSpecsDeps = {
  env?: SpeckrApiEnv;
  fetchImpl?: typeof fetch;
};

export function speckrIdempotencyKey(vin: string): string {
  const v = vin.trim().toUpperCase();
  return `provin-vin-scan-${v}`.slice(0, 200);
}

export async function fetchSpeckrVehicleSpecs(
  vin: string,
  deps: FetchSpeckrVehicleSpecsDeps = {},
): Promise<VinScanParse> {
  const env = deps.env ?? process.env;
  if (!speckrApiConfigured(env)) return speckrNotConfiguredParse();

  const normalized = vin.trim().toUpperCase();
  if (normalized.length !== 17) {
    return { status: "needs_input", summary: "Vajag pilnu 17 zīmju VIN" };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${SPECKR_API_BASE}/vehicle-specs`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${speckrApiKey(env)}`,
        "idempotency-key": speckrIdempotencyKey(normalized),
      },
      body: JSON.stringify({ vin: normalized }),
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      json = null;
    }

    if (res.ok) {
      return parseSpeckrVehicleSpecs((json ?? {}) as SpeckrVehicleSpecsPayload);
    }
    return parseSpeckrHttpFailure(res.status, json);
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.message === "timeout")) {
      return { status: "unknown", summary: "Speckr neatbildēja laikā" };
    }
    return { status: "unknown", summary: "Speckr pieprasījumu neizdevās nosūtīt" };
  }
}

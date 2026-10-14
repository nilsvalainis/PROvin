/**
 * Speckr Customer API — POST /vehicle-specs (1 kredīts par veiksmīgu pieprasījumu).
 * OpenAPI: https://speckr.com/api/v1/openapi.json
 */
import "server-only";

export const SPECKR_API_BASE = "https://speckr.com/api/v1";
export const SPECKR_NOT_CONFIGURED = "nav konfigurēts";

export type SpeckrApiEnv = Record<string, string | undefined>;

export type SpeckrLoadOutcome = "ok" | "no_data" | "needs_payment" | "not_configured" | "error";

export type SpeckrCompactLine = { label: string; value: string };

export type SpeckrLoadResult = {
  outcome: SpeckrLoadOutcome;
  summary: string;
  lines: SpeckrCompactLine[];
  openUrl?: string;
  vehicle?: { year: string; make: string; model: string };
  errorCode?: string;
};

export function speckrApiKey(env: SpeckrApiEnv = process.env): string {
  return String(env.SPECKR_API_KEY ?? "").trim();
}

export function speckrApiConfigured(env: SpeckrApiEnv = process.env): boolean {
  return Boolean(speckrApiKey(env));
}

type SpeckrRow = { key?: string; label?: string; value?: string | string[] };
type SpeckrSection = { key?: string; title?: string; rows?: SpeckrRow[] };

export type SpeckrVehicleSpecsPayload = {
  object?: string;
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
  range_and_charging?: { rows?: SpeckrRow[] };
  sections?: SpeckrSection[];
};

function formatSpeckrValue(value: string | string[] | null | undefined): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(", ");
  return String(value).trim();
}

function pushLine(lines: SpeckrCompactLine[], label: string, value: string | string[] | null | undefined): void {
  const text = formatSpeckrValue(value);
  if (!text) return;
  lines.push({ label, value: text });
}

function pushRows(lines: SpeckrCompactLine[], rows: SpeckrRow[] | undefined, limit = 24): void {
  if (!rows?.length) return;
  for (const row of rows) {
    if (lines.length >= limit) break;
    const label = String(row.label ?? row.key ?? "").trim();
    const value = formatSpeckrValue(row.value);
    if (!label || !value) continue;
    lines.push({ label, value });
  }
}

export function parseSpeckrVehicleSpecs(json: SpeckrVehicleSpecsPayload): SpeckrLoadResult {
  const vehicle = json.vehicle ?? {};
  const year = formatSpeckrValue(vehicle.year);
  const make = formatSpeckrValue(vehicle.make);
  const modelCore = formatSpeckrValue(vehicle.model);
  const trim = formatSpeckrValue(vehicle.trim);
  const model = [modelCore, trim].filter(Boolean).join(" ").trim() || modelCore;
  const title = formatSpeckrValue(json.title);
  const ymm = [year, make, model].filter(Boolean).join(" ");
  const summary = title || ymm || "Speckr specifikācija";

  const lines: SpeckrCompactLine[] = [];
  const sum = json.summary ?? {};
  pushLine(lines, "Ražošanas datums", sum.production_date);
  pushLine(lines, "Rūpnīca", sum.factory);
  pushLine(lines, "Riteņi", sum.wheels);
  pushLine(lines, "Krāsa", sum.paint);
  pushLine(lines, "Interjers", sum.interior);
  pushLine(lines, "Supercharging", sum.supercharging);

  const bat = json.battery ?? {};
  if (bat.state_of_health_percent != null && !Number.isNaN(bat.state_of_health_percent)) {
    pushLine(lines, "Baterijas SOH", `${bat.state_of_health_percent}%`);
  }
  pushLine(lines, "Lietojamā kapacitāte", bat.usable_capacity);
  if (bat.original_capacity_kwh != null && !Number.isNaN(bat.original_capacity_kwh)) {
    pushLine(lines, "Oriģinālā kapacitāte", `${bat.original_capacity_kwh} kWh`);
  }
  pushLine(lines, "Kapacitātes kopsavilkums", bat.capacity_summary);

  pushRows(lines, json.range_and_charging?.rows, 8);
  for (const section of json.sections ?? []) {
    if (lines.length >= 20) break;
    for (const row of section.rows ?? []) {
      if (lines.length >= 20) break;
      const label = String(row.label ?? row.key ?? "").trim();
      const value = formatSpeckrValue(row.value);
      if (!label || !value) continue;
      lines.push({ label, value });
    }
  }

  const hasVehicle = Boolean(make || model || year);
  const hasDetail = lines.length > 0;
  if (!hasVehicle && !hasDetail && !title) {
    return { outcome: "no_data", summary: "Speckr šim VIN neatgrieza specifikāciju", lines: [] };
  }

  return {
    outcome: "ok",
    summary,
    lines,
    vehicle: hasVehicle ? { year, make, model } : undefined,
    openUrl: json.vin ? `https://speckr.com/?vin=${encodeURIComponent(json.vin)}` : undefined,
  };
}

function speckrErrorMessage(json: unknown): { message: string; code: string } {
  if (!json || typeof json !== "object") return { message: "", code: "" };
  const err = (json as { error?: { message?: string; code?: string } }).error;
  return {
    message: String(err?.message ?? "").trim(),
    code: String(err?.code ?? "").trim(),
  };
}

export function parseSpeckrHttpFailure(status: number, json: unknown): SpeckrLoadResult {
  const { message, code } = speckrErrorMessage(json);
  const summary = message || code || `Speckr HTTP ${status}`;
  if (status === 402) {
    return { outcome: "needs_payment", summary: message || "Nav pietiekami Speckr kredītu", lines: [], errorCode: code || "insufficient_credits" };
  }
  if (status === 404 || status === 422) {
    return { outcome: "no_data", summary: message || "Speckr šo VIN neatbalsta vai neatpazīst", lines: [], errorCode: code };
  }
  if (status === 401) {
    return { outcome: "error", summary: message || "Speckr API: nederīga atslēga", lines: [], errorCode: code || "unauthorized" };
  }
  return { outcome: "error", summary, lines: [], errorCode: code };
}

export type FetchSpeckrVehicleSpecsDeps = {
  env?: SpeckrApiEnv;
  fetchImpl?: typeof fetch;
};

export function speckrIdempotencyKey(vin: string): string {
  const v = vin.trim().toUpperCase();
  return `provin-order-speckr-${v}`.slice(0, 200);
}

export async function fetchSpeckrVehicleSpecs(
  vin: string,
  deps: FetchSpeckrVehicleSpecsDeps = {},
): Promise<SpeckrLoadResult> {
  const env = deps.env ?? process.env;
  if (!speckrApiConfigured(env)) {
    return { outcome: "not_configured", summary: SPECKR_NOT_CONFIGURED, lines: [] };
  }

  const normalized = vin.trim().toUpperCase();
  if (normalized.length !== 17) {
    return { outcome: "error", summary: "Vajag pilnu 17 zīmju VIN", lines: [], errorCode: "invalid_vin" };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${SPECKR_API_BASE}/vehicle-specs`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(22_000),
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
      return { outcome: "error", summary: "Speckr neatbildēja laikā", lines: [], errorCode: "timeout" };
    }
    return { outcome: "error", summary: "Speckr pieprasījumu neizdevās nosūtīt", lines: [], errorCode: "network" };
  }
}

import "server-only";

import {
  historyPayloadHasMileageEvents,
  mapOutvinHistoryPayloadToServiceRows,
  mergeOutvinServiceRows,
} from "@/lib/outvin-history-map";
import { buildOutvinDealerReport } from "@/lib/outvin-dealer-map";
import type { OutvinDealerReport } from "@/lib/outvin-dealer-types";
import { rebuildOutvinBundleFromPurchases } from "@/lib/outvin-purchase-map";
import { applyOutvinPrecheckMetadata } from "@/lib/outvin-precheck";
import { buildOutvinCapabilitySlots } from "@/lib/outvin-precheck";
import type { OutvinDataBundle } from "@/lib/outvin-data-bundle";
import { getOutvinHistoryTypesToProbe } from "@/lib/outvin-official-types";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { isOutvinApiVin, normalizeVin } from "@/lib/order-field-validation";

export type OutvinConfig = {
  baseUrl: string;
  email: string;
  password: string;
};

export function getOutvinConfig(): OutvinConfig | null {
  const email = process.env.OUTVIN_EMAIL?.trim();
  const password = process.env.OUTVIN_PASSWORD?.trim();
  const baseRaw = process.env.OUTVIN_BASE_URL?.trim() || "https://www.outvin.com/api/v1/";
  if (!email || !password) return null;
  const baseUrl = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  return { baseUrl, email, password };
}

function basicAuthHeader(email: string, password: string): string {
  return `Basic ${Buffer.from(`${email}:${password}`, "utf8").toString("base64")}`;
}

/** Outvin history `type` — Swagger 1.0.3: tikai 1 (serviss), 2 (carfax). */
export type OutvinHistoryType = number;

export type OutvinHistoryFetchResult = {
  type: number;
  ok: boolean;
  status: number;
  body: unknown | null;
  /** Kļūda, ja ok === false (nav globāla auth/maksājuma kļūda). */
  skipReason?: string;
  /** Īss atbildes fragments diagnostikai (logiem). */
  rawBodyPreview?: string;
};

function parseHistoryResponse(
  res: Response,
  text: string,
): { body: unknown | null; fatalError?: string; skipReason?: string } {
  let body: unknown = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
  }

  if (res.status === 401) return { body: null, fatalError: "outvin_unauthorized" };
  /** Tikai īsts HTTP 402 — ne 429/503 utt. */
  if (res.status === 402) return { body: null, skipReason: "payment_required" };
  if (res.status === 404) return { body: null, skipReason: "not_found" };
  if (res.status === 429) return { body: null, skipReason: "rate_limited" };
  if (res.status === 400 || res.status === 422) return { body: null, skipReason: "invalid_or_unsupported" };
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${res.status}`;
    if (res.status >= 500) return { body: null, skipReason: `server_${res.status}` };
    return { body: null, skipReason: detail };
  }

  return { body: body ?? {} };
}

/**
 * Viena history `type` pieprasījums — neizmanto throw 404/422 (tipam nav datu).
 */
export async function fetchOutvinHistoryResult(
  vin: string,
  type: number,
  options?: { refresh?: boolean },
): Promise<OutvinHistoryFetchResult> {
  const cfg = getOutvinConfig();
  if (!cfg) throw new Error("missing_outvin_credentials");

  const normalized = normalizeVin(vin);
  if (!isOutvinApiVin(normalized)) throw new Error("invalid_vin");

  const url = new URL(`history/${encodeURIComponent(normalized)}/${type}`, cfg.baseUrl);
  if (options?.refresh) url.searchParams.set("refresh", "true");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(cfg.email, cfg.password),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = parseHistoryResponse(res, text);

  if (parsed.fatalError) throw new Error(parsed.fatalError);

  const rawBodyPreview = text.trim().slice(0, 1200) || "(empty body)";

  return {
    type,
    ok: parsed.skipReason == null,
    status: res.status,
    body: parsed.body,
    skipReason: parsed.skipReason,
    rawBodyPreview,
  };
}

/** @throws globālās kļūdas (auth, maksājums, VIN) */
export async function fetchOutvinHistoryJson(
  vin: string,
  type: number,
  options?: { refresh?: boolean },
): Promise<unknown> {
  const result = await fetchOutvinHistoryResult(vin, type, options);
  if (!result.ok) {
    if (result.skipReason === "not_found") throw new Error("outvin_not_found");
    if (result.skipReason === "invalid_or_unsupported") throw new Error("invalid_vin");
    throw new Error(`outvin_fetch_failed:${result.skipReason ?? result.status}`);
  }
  return result.body;
}

export type OutvinHistoryProbeSummary = {
  typesProbed: number[];
  typesFetched: number[];
  typesWithMileage: number[];
  historyPayloads: unknown[];
  /** True, ja kāds pieprasījums atgrieza HTTP 402 (kontā nav kredītu). */
  paymentRequired: boolean;
};

async function fetchOutvinHistoryBatchSequential(
  vin: string,
  types: number[],
): Promise<{ results: OutvinHistoryFetchResult[]; paymentRequired: boolean }> {
  const results: OutvinHistoryFetchResult[] = [];
  let paymentRequired = false;

  for (const type of types) {
    if (paymentRequired) break;
    const r = await fetchOutvinHistoryResult(vin, type);
    results.push(r);
    if (r.skipReason === "payment_required") paymentRequired = true;
  }

  return { results, paymentRequired };
}

/** @deprecated Automātiska probe patērē kredītus — izmanto Check & Buy (tikai type 1 un 2). */
export async function probeOutvinHistoryTypes(vin: string): Promise<OutvinHistoryProbeSummary> {
  const allTypes = getOutvinHistoryTypesToProbe();

  const absorb = (
    acc: OutvinHistoryProbeSummary,
    batch: OutvinHistoryFetchResult[],
  ): OutvinHistoryProbeSummary => {
    for (const r of batch) {
      if (!r.ok || r.body == null) continue;
      if (!acc.typesFetched.includes(r.type)) acc.typesFetched.push(r.type);
      acc.historyPayloads.push(r.body);
      if (historyPayloadHasMileageEvents(r.body) && !acc.typesWithMileage.includes(r.type)) {
        acc.typesWithMileage.push(r.type);
      }
    }
    return acc;
  };

  const batch = await fetchOutvinHistoryBatchSequential(vin, allTypes);
  return absorb(
    {
      typesProbed: allTypes,
      typesFetched: [],
      typesWithMileage: [],
      historyPayloads: [],
      paymentRequired: batch.paymentRequired,
    },
    batch.results,
  );
}

export type OutvinVehicleOrderResult = {
  ok: boolean;
  status: number;
  body: unknown | null;
  skipReason?: string;
  rawBodyPreview?: string;
  uuid?: string;
};

export function logOutvinApiFailure(
  context: string,
  vin: string,
  method: string,
  path: string,
  httpStatus: number,
  skipReason: string | undefined,
  rawBody: string | undefined,
): void {
  console.error(`[${context}] Outvin API failed`, {
    vin,
    method,
    path,
    httpStatus,
    skipReason: skipReason ?? "(none)",
    rawBody: rawBody ?? "(empty)",
  });
}

function parseVehicleResponse(
  res: Response,
  text: string,
): { body: unknown | null; fatalError?: string; skipReason?: string } {
  let body: unknown = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
  }

  if (res.status === 401) return { body: null, fatalError: "outvin_unauthorized" };
  if (res.status === 402) return { body: null, skipReason: "payment_required" };
  if (res.status === 404) return { body: null, skipReason: "not_found" };
  if (res.status === 429) return { body: null, skipReason: "rate_limited" };
  if (res.status === 400 || res.status === 422) return { body: null, skipReason: "invalid_or_unsupported" };
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${res.status}`;
    if (res.status >= 500) return { body: null, skipReason: `server_${res.status}` };
    return { body: null, skipReason: detail };
  }

  return { body: body ?? {} };
}

function extractOutvinUuid(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const o = payload as Record<string, unknown>;
  if (typeof o.uuid === "string" && o.uuid.trim()) return o.uuid.trim();
  const data = o.data;
  if (data && typeof data === "object" && typeof (data as Record<string, unknown>).uuid === "string") {
    return String((data as Record<string, unknown>).uuid).trim();
  }
  return undefined;
}

/**
 * Swagger solis 1 — GET /vehicle/{VIN} (B2B transporta pasūtījums / atbloķēšana).
 * Nav atsevišķa POST /order publiskajā spec.
 */
export async function fetchOutvinVehicleOrderResult(vin: string): Promise<OutvinVehicleOrderResult> {
  const cfg = getOutvinConfig();
  if (!cfg) throw new Error("missing_outvin_credentials");

  const normalized = normalizeVin(vin);
  if (!isOutvinApiVin(normalized)) throw new Error("invalid_vin");

  const url = new URL(`vehicle/${encodeURIComponent(normalized)}`, cfg.baseUrl);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(cfg.email, cfg.password),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = parseVehicleResponse(res, text);
  if (parsed.fatalError) throw new Error(parsed.fatalError);

  const rawBodyPreview = text.trim().slice(0, 1200) || "(empty body)";
  const body = parsed.body;
  const uuid = body ? extractOutvinUuid(body) : undefined;

  return {
    ok: parsed.skipReason == null,
    status: res.status,
    body,
    skipReason: parsed.skipReason,
    rawBodyPreview,
    ...(uuid ? { uuid } : {}),
  };
}

/** @throws — vecais API; jaunajā plūsmā izmanto fetchOutvinVehicleOrderResult */
export async function fetchOutvinVehicleJson(vin: string): Promise<unknown> {
  const r = await fetchOutvinVehicleOrderResult(vin);
  if (!r.ok) {
    if (r.skipReason === "payment_required") throw new Error("outvin_payment_required");
    if (r.skipReason === "not_found") throw new Error("outvin_not_found");
    if (r.skipReason === "invalid_or_unsupported") throw new Error("invalid_vin");
    throw new Error(`outvin_fetch_failed:${r.skipReason ?? r.status}`);
  }
  return r.body ?? {};
}

/** `/status` — zīmolu saraksts (Swagger: type 0=ident, 1=history); neatgriež history type ID. */
export async function fetchOutvinStatusJson(historySource = 1): Promise<unknown> {
  const cfg = getOutvinConfig();
  if (!cfg) throw new Error("missing_outvin_credentials");

  const url = new URL("status", cfg.baseUrl);
  url.searchParams.set("type", String(historySource));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(cfg.email, cfg.password),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`outvin_status_failed:HTTP ${res.status}:${text.slice(0, 200)}`);
  }
  return text.trim() ? (JSON.parse(text) as unknown) : {};
}

export type OutvinDealerImportResult = {
  rows: AutoRecordsServiceRow[];
  report: OutvinDealerReport;
  typesProbed: number[];
  typesFetched: number[];
  typesWithMileage: number[];
  /** Brīdinājums, ja daļa pieprasījumu apturēta 402 (kredīti beigušies). */
  paymentWarning?: string;
};

/** @deprecated Izmanto executeOutvinB2bPurchase. */
export async function fetchOutvinDealerImport(vin: string): Promise<OutvinDealerImportResult> {
  const { executeOutvinB2bPurchase } = await import("@/lib/outvin-history-probe");
  const { bundle, results, paymentRequired } = await executeOutvinB2bPurchase(
    vin,
    getOutvinHistoryTypesToProbe(),
    null,
  );

  const vehiclePayload = bundle.vehicleOrder?.payload ?? {};
  const vehiclePaymentRequired = !bundle.vehicleOrder?.ok && paymentRequired;

  const probe = {
    typesProbed: getOutvinHistoryTypesToProbe(),
    typesFetched: bundle.purchases.map((p) => p.historyType),
    typesWithMileage: bundle.purchases
      .filter((p) => historyPayloadHasMileageEvents(p.payload))
      .map((p) => p.historyType),
    historyPayloads: bundle.purchases.map((p) => p.payload),
    paymentRequired: paymentRequired || vehiclePaymentRequired,
  };

  void results;

  const batches: AutoRecordsServiceRow[][] = [];
  for (const payload of probe.historyPayloads) {
    const rows = mapOutvinHistoryPayloadToServiceRows(payload);
    if (rows.length > 0) batches.push(rows);
  }

  const rows = mergeOutvinServiceRows(batches);
  const report = buildOutvinDealerReport({
    vehiclePayload,
    historyPayloads: probe.historyPayloads,
    vin: normalizeVin(vin),
  });

  const hasReport =
    report.equipment.length > 0 ||
    report.accidentCheck.trim().length > 0 ||
    report.stolenCheck.trim().length > 0 ||
    Object.values(report.vehicleInfo).some((v) => v.trim().length > 0);

  const paymentHit = vehiclePaymentRequired || probe.paymentRequired;

  if (rows.length === 0 && !hasReport) {
    if (paymentHit) throw new Error("outvin_payment_required");
    throw new Error("empty_outvin_data");
  }

  const paymentWarning = paymentHit
    ? "Outvin kontā beidzās kredīti — daļa datu var būt ielādēta. Papildini bilanci Outvin kontā (outvin.com) un mēģini vēlreiz."
    : undefined;

  return {
    rows,
    report,
    typesProbed: probe.typesProbed,
    typesFetched: probe.typesFetched,
    typesWithMileage: probe.typesWithMileage,
    ...(paymentWarning ? { paymentWarning } : {}),
  };
}

export type { OutvinPurchaseResult } from "@/lib/outvin-purchase-map";

/** Atjauno capabilitySlots bez API izmaksas. */
export function refreshOutvinBundleSlots(vin: string, bundle: OutvinDataBundle): OutvinDataBundle {
  const normalized = normalizeVin(vin);
  return {
    ...bundle,
    vin: normalized,
    capabilitySlots: buildOutvinCapabilitySlots(normalized, bundle),
  };
}

export async function runOutvinCapabilitiesPrecheck(
  vin: string,
  existingBundle?: OutvinDataBundle | null,
): Promise<OutvinDataBundle> {
  const normalized = normalizeVin(vin);
  try {
    await fetchOutvinStatusJson(1);
  } catch {
    /* status nav obligāts */
  }
  const base = existingBundle?.purchases.length
    ? rebuildOutvinBundleFromPurchases({ ...existingBundle, vin: normalized })
    : (existingBundle ?? null);
  return applyOutvinPrecheckMetadata(normalized, base);
}

/**
 * @deprecated Izmanto purchaseOutvinHistoryTypes — automātiska probe patērē kredītus.
 */
export async function fetchOutvinMileageServiceRows(vin: string): Promise<{
  rows: AutoRecordsServiceRow[];
  typesFetched: number[];
}> {
  const { rows, typesFetched } = await fetchOutvinDealerImport(vin);
  return { rows, typesFetched };
}

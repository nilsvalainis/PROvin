import "server-only";

import {
  historyPayloadHasMileageEvents,
  mapOutvinHistoryPayloadToServiceRows,
  mergeOutvinServiceRows,
} from "@/lib/outvin-history-map";
import { buildOutvinDealerReport } from "@/lib/outvin-dealer-map";
import type { OutvinDealerReport } from "@/lib/outvin-dealer-types";
import { getOutvinHistoryTypesToProbe } from "@/lib/outvin-history-probe";
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

/** Outvin history `type` — Swagger: 1, 2; produkcijā bieži arī 3, 5, 7 u.c. */
export type OutvinHistoryType = number;

export type OutvinHistoryFetchResult = {
  type: number;
  ok: boolean;
  status: number;
  body: unknown | null;
  /** Kļūda, ja ok === false (nav globāla auth/maksājuma kļūda). */
  skipReason?: string;
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
  if (res.status === 402) return { body: null, skipReason: "payment_required" };
  if (res.status === 404) return { body: null, skipReason: "not_found" };
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

  return {
    type,
    ok: parsed.skipReason == null,
    status: res.status,
    body: parsed.body,
    skipReason: parsed.skipReason,
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

/**
 * Paralēli probē history tipus: vispirms 1–2, pēc tam pārējie (3…max),
 * ja nevienā nav nobraukuma notikumu vai OUTVIN_HISTORY_PROBE_ALL=1.
 */
export async function probeOutvinHistoryTypes(vin: string): Promise<OutvinHistoryProbeSummary> {
  const allTypes = getOutvinHistoryTypesToProbe();
  const primaryTypes = allTypes.filter((t) => t <= 2);
  const extendedTypes = allTypes.filter((t) => t > 2);
  const probeAll = process.env.OUTVIN_HISTORY_PROBE_ALL === "1";

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

  let summary: OutvinHistoryProbeSummary = {
    typesProbed: allTypes,
    typesFetched: [],
    typesWithMileage: [],
    historyPayloads: [],
    paymentRequired: false,
  };

  if (primaryTypes.length > 0) {
    const primary = await fetchOutvinHistoryBatchSequential(vin, primaryTypes);
    summary = absorb(summary, primary.results);
    summary.paymentRequired = primary.paymentRequired;
  }

  const needExtended =
    !summary.paymentRequired &&
    (probeAll || (extendedTypes.length > 0 && summary.typesWithMileage.length === 0));

  if (needExtended) {
    const extended = await fetchOutvinHistoryBatchSequential(vin, extendedTypes);
    summary = absorb(summary, extended.results);
    summary.paymentRequired = summary.paymentRequired || extended.paymentRequired;
  }

  return summary;
}

export async function fetchOutvinVehicleJson(vin: string): Promise<unknown> {
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
  let body: unknown = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
  }

  if (res.status === 401) throw new Error("outvin_unauthorized");
  if (res.status === 402) throw new Error("outvin_payment_required");
  if (res.status === 404) throw new Error("outvin_not_found");
  if (res.status === 400 || res.status === 422) throw new Error("invalid_vin");
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${res.status}`;
    throw new Error(`outvin_fetch_failed:${detail}`);
  }

  return body ?? {};
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

/** Pilns Outvin imports — probē history tipus secīgi (aptur, ja beidzās kredīti). */
export async function fetchOutvinDealerImport(vin: string): Promise<OutvinDealerImportResult> {
  let vehiclePayload: unknown = {};
  let vehiclePaymentRequired = false;
  try {
    vehiclePayload = await fetchOutvinVehicleJson(vin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "outvin_payment_required") {
      vehiclePaymentRequired = true;
    } else if (msg !== "outvin_not_found") {
      throw e;
    }
  }

  const probe = await probeOutvinHistoryTypes(vin);

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

/**
 * @deprecated Izmanto fetchOutvinDealerImport
 */
export async function fetchOutvinMileageServiceRows(vin: string): Promise<{
  rows: AutoRecordsServiceRow[];
  typesFetched: number[];
}> {
  const { rows, typesFetched } = await fetchOutvinDealerImport(vin);
  return { rows, typesFetched };
}

import "server-only";

import {
  mapOutvinHistoryPayloadToServiceRows,
  mergeOutvinServiceRows,
} from "@/lib/outvin-history-map";
import { buildOutvinDealerReport } from "@/lib/outvin-dealer-map";
import type { OutvinDealerReport } from "@/lib/outvin-dealer-types";
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

export type OutvinHistoryType = 1 | 2;

export async function fetchOutvinHistoryJson(
  vin: string,
  type: OutvinHistoryType,
  options?: { refresh?: boolean },
): Promise<unknown> {
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

  return body;
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

export type OutvinDealerImportResult = {
  rows: AutoRecordsServiceRow[];
  report: OutvinDealerReport;
  typesFetched: OutvinHistoryType[];
};

/** Pilns Outvin imports — nobraukums (admin tabula) + dīlera atskaite (bez km PDF dublēšanas). */
export async function fetchOutvinDealerImport(vin: string): Promise<OutvinDealerImportResult> {
  const types: OutvinHistoryType[] = [1, 2];
  const historyPayloads: unknown[] = [];
  const batches: AutoRecordsServiceRow[][] = [];

  let vehiclePayload: unknown = {};
  try {
    vehiclePayload = await fetchOutvinVehicleJson(vin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg !== "outvin_not_found") throw e;
  }

  for (const type of types) {
    try {
      const json = await fetchOutvinHistoryJson(vin, type);
      historyPayloads.push(json);
      const rows = mapOutvinHistoryPayloadToServiceRows(json);
      if (rows.length > 0) batches.push(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "outvin_not_found" && type === 2) continue;
      if (msg === "outvin_not_found" && type === 1 && historyPayloads.length === 0) continue;
      throw e;
    }
  }

  const rows = mergeOutvinServiceRows(batches);
  const report = buildOutvinDealerReport({ vehiclePayload, historyPayloads, vin: normalizeVin(vin) });

  const hasReport =
    report.equipment.length > 0 ||
    report.accidentCheck.trim().length > 0 ||
    report.stolenCheck.trim().length > 0 ||
    Object.values(report.vehicleInfo).some((v) => v.trim().length > 0);

  if (rows.length === 0 && !hasReport) {
    throw new Error("empty_outvin_data");
  }

  return { rows, report, typesFetched: types };
}

/**
 * @deprecated Izmanto fetchOutvinDealerImport
 */
export async function fetchOutvinMileageServiceRows(vin: string): Promise<{
  rows: AutoRecordsServiceRow[];
  typesFetched: OutvinHistoryType[];
}> {
  const { rows, typesFetched } = await fetchOutvinDealerImport(vin);
  return { rows, typesFetched };
}

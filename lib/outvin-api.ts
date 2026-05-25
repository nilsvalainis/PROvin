import "server-only";

import {
  mapOutvinHistoryPayloadToServiceRows,
  mergeOutvinServiceRows,
} from "@/lib/outvin-history-map";
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

/**
 * Nobraukuma vēsture — Outvin type 1 (servisa vēsture) + type 2 (carfax), apvienots.
 * Swagger nav `/all`; abu tipu dati tiek sapulcēti kā „visi” pieejamie notikumi ar km.
 */
export async function fetchOutvinMileageServiceRows(vin: string): Promise<{
  rows: AutoRecordsServiceRow[];
  typesFetched: OutvinHistoryType[];
}> {
  const types: OutvinHistoryType[] = [1, 2];
  const batches: AutoRecordsServiceRow[][] = [];

  for (const type of types) {
    try {
      const json = await fetchOutvinHistoryJson(vin, type);
      const rows = mapOutvinHistoryPayloadToServiceRows(json);
      if (rows.length > 0) batches.push(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "outvin_not_found" && type === 2) continue;
      throw e;
    }
  }

  const rows = mergeOutvinServiceRows(batches);
  if (rows.length === 0) throw new Error("empty_mileage_history");
  return { rows, typesFetched: types };
}

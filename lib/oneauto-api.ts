import "server-only";

import {
  ONEAUTO_PRODUCTS,
  ONEAUTO_SOURCE_TAG,
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoPayloadIsNoData,
  oneautoPayloadIsPending,
  oneautoProductsCostCents,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import type { OneautoProductResult } from "@/lib/oneauto-block";

const DEFAULT_BASE_URL = "https://api.oneautoapi.com";

export type OneautoApiConfig = {
  apiKey: string;
  baseUrl: string;
};

export function getOneautoApiConfig(): OneautoApiConfig | null {
  const apiKey = process.env.ONEAUTO_API_KEY?.trim() ?? "";
  if (!apiKey) return null;
  const baseUrl = (process.env.ONEAUTO_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  return { apiKey, baseUrl };
}

function classifyError(status: number, bodyText: string): string {
  const t = bodyText.toLowerCase();
  if (oneautoPayloadIsNoData(null, bodyText)) return "no_data";
  if (status === 402 || /insufficient|balance|credit|quota/.test(t)) return "insufficient_balance";
  if (status === 400 || /invalid.?vin|vin/.test(t)) return "invalid_vin";
  if (status === 401 || status === 403) return "unauthorized_upstream";
  if (status >= 500) return "upstream_error";
  return bodyText.trim().slice(0, 240) || `http_${status}`;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

function requestIdFrom(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const o = payload as Record<string, unknown>;
  for (const key of ["request_id", "requestId", "job_id", "jobId", "id"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function payloadLooksPending(httpStatus: number, payload: unknown): boolean {
  return oneautoPayloadIsPending(httpStatus, payload);
}

async function fetchOneautoPath(
  config: OneautoApiConfig,
  path: string,
  vin: string,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const url = new URL(path.startsWith("http") ? path : `${config.baseUrl}${path}`);
  url.searchParams.set("vehicle_identification_number", vin);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-api-key": config.apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const payload = await readJson(res);
  return { ok: res.ok, status: res.status, payload };
}

async function fetchWithPoll(
  config: OneautoApiConfig,
  path: string,
  vin: string,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  let last = await fetchOneautoPath(config, path, vin);
  if (!payloadLooksPending(last.status, last.payload)) return last;
  const requestId = requestIdFrom(last.payload);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollPath = requestId ? `${path}?request_id=${encodeURIComponent(requestId)}` : path;
    last = await fetchOneautoPath(config, pollPath.includes("?") ? pollPath : path, vin);
    if (!payloadLooksPending(last.status, last.payload)) return last;
  }
  return last;
}

export async function fetchOneautoProducts(opts: {
  vin: string;
  products: readonly OneautoProductId[];
}): Promise<{
  source: typeof ONEAUTO_SOURCE_TAG;
  vin: string;
  costEur: string;
  costCents: number;
  results: Partial<Record<OneautoProductId, OneautoProductResult>>;
  display: ReturnType<typeof buildOneautoDisplay>;
}> {
  const config = getOneautoApiConfig();
  if (!config) throw new Error("missing_oneauto_credentials");

  const results: Partial<Record<OneautoProductId, OneautoProductResult>> = {};
  const rawForDisplay: Partial<Record<OneautoProductId, unknown>> = {};

  for (const id of opts.products) {
    const product = ONEAUTO_PRODUCTS.find((p) => p.id === id);
    if (!product) continue;
    try {
      const fetched = await fetchWithPoll(config, product.path, opts.vin);
      if (payloadLooksPending(fetched.status, fetched.payload)) {
        results[id] = { ok: false, error: "pending", payload: fetched.payload };
        continue;
      }
      if (!fetched.ok) {
        const errText =
          fetched.payload && typeof fetched.payload === "object"
            ? JSON.stringify(fetched.payload).slice(0, 400)
            : "";
        if (oneautoPayloadIsNoData(fetched.payload, errText)) {
          results[id] = { ok: true, payload: fetched.payload };
          continue;
        }
        const code = classifyError(fetched.status, errText);
        results[id] = { ok: false, error: code, payload: fetched.payload };
        continue;
      }
      const body = fetched.payload;
      if (body && typeof body === "object" && (body as { success?: unknown }).success === false) {
        const err =
          typeof (body as { error?: unknown }).error === "string"
            ? String((body as { error: string }).error)
            : "upstream_error";
        if (oneautoPayloadIsNoData(body, err)) {
          results[id] = { ok: true, payload: body };
          continue;
        }
        results[id] = { ok: false, error: classifyError(fetched.status, err), payload: body };
        continue;
      }
      results[id] = { ok: true, payload: body };
      rawForDisplay[id] = body;
    } catch (e) {
      results[id] = {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 240) : "network_error",
        payload: null,
      };
    }
  }

  const costCents = oneautoProductsCostCents(opts.products);
  return {
    source: ONEAUTO_SOURCE_TAG,
    vin: opts.vin,
    costEur: formatOneautoCostEur(costCents),
    costCents,
    results,
    display: buildOneautoDisplay(rawForDisplay),
  };
}

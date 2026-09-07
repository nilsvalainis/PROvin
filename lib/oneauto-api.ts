import "server-only";

import {
  ONEAUTO_PRODUCTS,
  ONEAUTO_SOURCE_TAG,
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoPayloadIsApiUnavailable,
  oneautoPayloadIsNoData,
  oneautoPayloadIsPending,
  oneautoProductsCostCents,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import type { OneautoProductResult } from "@/lib/oneauto-block";
import {
  ONEAUTO_IMAGE_FROM_ID_PATH,
  ONEAUTO_IMAGE_SEARCH_BY_VIN_PATH,
  formatOneautoImageCostEur,
  oneautoImageFetchCostCents,
  parseOneautoImageFromIdUrl,
  parseOneautoImageSearchPayload,
} from "@/lib/oneauto-images";
import {
  AUTO_RECORDS_PHOTO_MAX_BYTES,
  makeAutoRecordsPhotoId,
  writeAutoRecordsPhotoJpeg,
} from "@/lib/admin-auto-records-photo-store";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";

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
  if (oneautoPayloadIsApiUnavailable(null, bodyText)) return "api_unavailable";
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
  const result = o.result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["request_id", "requestId", "job_id", "jobId", "id"]) {
      const v = r[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

function payloadLooksPending(httpStatus: number, payload: unknown): boolean {
  return oneautoPayloadIsPending(httpStatus, payload);
}

async function fetchOneautoQuery(
  config: OneautoApiConfig,
  path: string,
  query: Record<string, string>,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const url = new URL(path.startsWith("http") ? path : `${config.baseUrl}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v) url.searchParams.set(k, v);
  }
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

async function fetchOneautoPath(
  config: OneautoApiConfig,
  path: string,
  vin: string,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const basePath = path.split("?")[0] ?? path;
  const query: Record<string, string> = {
    vehicle_identification_number: vin,
  };
  if (path.includes("?")) {
    const existing = new URL(`https://x.invalid${path.startsWith("/") ? path : `/${path}`}`);
    for (const [k, v] of existing.searchParams.entries()) {
      if (k !== "vehicle_identification_number") query[k] = v;
    }
  }
  return fetchOneautoQuery(config, basePath, query);
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
    const clean = path.split("?")[0] ?? path;
    const pollPath = requestId ? `${clean}?request_id=${encodeURIComponent(requestId)}` : clean;
    last = await fetchOneautoPath(config, pollPath, vin);
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
        if (oneautoPayloadIsApiUnavailable(fetched.payload, errText)) {
          results[id] = { ok: false, error: "api_unavailable", payload: fetched.payload };
          continue;
        }
        const code = classifyError(fetched.status, errText);
        results[id] = { ok: false, error: code, payload: fetched.payload };
        continue;
      }
      const body = fetched.payload;
      if (body && typeof body === "object" && (body as { success?: unknown }).success === false) {
        const errText = JSON.stringify(body).slice(0, 400);
        if (oneautoPayloadIsNoData(body, errText)) {
          results[id] = { ok: true, payload: body };
          continue;
        }
        if (oneautoPayloadIsApiUnavailable(body, errText)) {
          results[id] = { ok: false, error: "api_unavailable", payload: body };
          continue;
        }
        results[id] = { ok: false, error: classifyError(fetched.status, errText), payload: body };
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

async function downloadImageToJpeg(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  const normalized = await jpegFromAdminPhotoUpload(Buffer.from(ab), AUTO_RECORDS_PHOTO_MAX_BYTES);
  return normalized.ok ? normalized.jpeg : null;
}

export type OneautoVehicleImagesResult = {
  vin: string;
  photoIds: string[];
  views: string[];
  label: string;
  costEur: string;
  costCents: number;
  error?: string;
};

/** Image Search by VIN + Image from ID → saglabā JPEG oficiālā dīlera foto veikalā. */
export async function fetchAndStoreOneautoVehicleImages(opts: {
  vin: string;
  sessionId: string;
}): Promise<OneautoVehicleImagesResult> {
  const config = getOneautoApiConfig();
  if (!config) throw new Error("missing_oneauto_credentials");

  const search = await fetchOneautoQuery(config, ONEAUTO_IMAGE_SEARCH_BY_VIN_PATH, {
    vehicle_identification_number: opts.vin,
  });
  if (!search.ok) {
    const errText =
      search.payload && typeof search.payload === "object"
        ? JSON.stringify(search.payload).slice(0, 400)
        : "";
    if (oneautoPayloadIsApiUnavailable(search.payload, errText)) {
      return {
        vin: opts.vin,
        photoIds: [],
        views: [],
        label: "",
        costEur: formatOneautoImageCostEur(0),
        costCents: oneautoImageFetchCostCents(0),
        error: "api_unavailable",
      };
    }
    return {
      vin: opts.vin,
      photoIds: [],
      views: [],
      label: "",
      costEur: formatOneautoImageCostEur(0),
      costCents: oneautoImageFetchCostCents(0),
      error: classifyError(search.status, errText),
    };
  }

  const match = parseOneautoImageSearchPayload(search.payload);
  if (!match) {
    return {
      vin: opts.vin,
      photoIds: [],
      views: [],
      label: "",
      costEur: formatOneautoImageCostEur(0),
      costCents: oneautoImageFetchCostCents(0),
      error: "no_images",
    };
  }

  const colourHint = match.colourHints[0]?.trim() ?? "";
  const photoIds: string[] = [];
  const views: string[] = [];

  for (const row of match.views) {
    const query: Record<string, string> = { image_id: row.imageId };
    if (colourHint) query.generic_colour_desc = colourHint;
    const imgRes = await fetchOneautoQuery(config, ONEAUTO_IMAGE_FROM_ID_PATH, query);
    let imageUrl = parseOneautoImageFromIdUrl(imgRes.payload);
    if (!imageUrl && colourHint) {
      const retry = await fetchOneautoQuery(config, ONEAUTO_IMAGE_FROM_ID_PATH, {
        image_id: row.imageId,
      });
      imageUrl = parseOneautoImageFromIdUrl(retry.payload);
    }
    if (!imageUrl) continue;
    const jpeg = await downloadImageToJpeg(imageUrl);
    if (!jpeg) continue;
    const photoId = makeAutoRecordsPhotoId();
    await writeAutoRecordsPhotoJpeg(opts.sessionId, photoId, jpeg);
    photoIds.push(photoId);
    views.push(row.view);
  }

  const labelParts = [
    match.manufacturer,
    match.modelRange,
    match.manufacturedYear ? String(match.manufacturedYear) : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    vin: opts.vin,
    photoIds,
    views,
    label: labelParts.join(" ").slice(0, 80),
    costEur: formatOneautoImageCostEur(photoIds.length),
    costCents: oneautoImageFetchCostCents(photoIds.length),
    error: photoIds.length === 0 ? "no_images" : undefined,
  };
}

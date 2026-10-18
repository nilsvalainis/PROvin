import "server-only";

import {
  ONEAUTO_PRODUCTS,
  ONEAUTO_SOURCE_TAG,
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoChargedCostCents,
  oneautoPayloadIsApiUnavailable,
  oneautoPayloadIsPending,
  oneautoResultIsNoData,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import type { OneautoProductResult } from "@/lib/oneauto-block";
import {
  buildOneautoProductResult,
  classifyOneautoError,
  oneautoResponsePreview,
} from "@/lib/oneauto-product-result";
import {
  mergeVinDecodeFallbackPowertrain,
  oneautoPowertrainFromLocalVin,
  oneautoPowertrainFromVinScanParse,
} from "@/lib/oneauto-vin-fallback";
import { decodeVinLocal, mergeVinDecodeWithVpic } from "@/lib/vin-scan/vin-decode";
import { parseNhtsaDecode } from "@/lib/vin-scan/parse";
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

const VIN_DECODER_PRODUCT_IDS: readonly OneautoProductId[] = ["vin_decoder", "oe_vin_lookup"];

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
  return classifyOneautoError(status, bodyText);
}

function logOneautoProduct(vin: string, product: string, status: number, payload: unknown): void {
  console.info("[oneauto]", vin, product, status, oneautoResponsePreview(payload, 300));
}

async function fetchVinDecoderFallbackRows(vin: string) {
  const local = decodeVinLocal(vin);
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    const text = await res.text();
    const vpic = parseNhtsaDecode(res.status, text);
    return oneautoPowertrainFromVinScanParse(mergeVinDecodeWithVpic(local, vpic));
  } catch {
    return oneautoPowertrainFromLocalVin(vin);
  }
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

const REQUEST_ID_KEYS = ["request_id", "requestId", "job_id", "jobId", "report_id", "reportId", "id"] as const;

function requestIdFrom(payload: unknown): string {
  const pick = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const o = node as Record<string, unknown>;
    for (const key of REQUEST_ID_KEYS) {
      const v = o[key];
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (!t || /^[A-HJ-NPR-Z0-9]{17}$/i.test(t)) continue;
      return t;
    }
    return "";
  };
  const o = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!o) return "";
  return (
    pick(o) ||
    pick(o.result) ||
    pick(o.result && typeof o.result === "object" ? (o.result as Record<string, unknown>).vehicle_data : null)
  );
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
    const pollPath = requestId
      ? `${clean}?request_id=${encodeURIComponent(requestId)}&report_id=${encodeURIComponent(requestId)}`
      : clean;
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
      logOneautoProduct(opts.vin, id, fetched.status, fetched.payload);
      const classified = buildOneautoProductResult(fetched);
      results[id] = classified;
      if (classified.ok) rawForDisplay[id] = fetched.payload;
    } catch (e) {
      logOneautoProduct(opts.vin, id, 0, e instanceof Error ? e.message : "network_error");
      results[id] = {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 240) : "network_error",
        payload: null,
      };
    }
  }

  let display = buildOneautoDisplay(rawForDisplay);
  const decoderIds = VIN_DECODER_PRODUCT_IDS.filter((id) => results[id] != null);
  const noDataDecoders = decoderIds.filter((id) => oneautoResultIsNoData(results[id]!));
  const anyDecoderOk = decoderIds.some((id) => results[id]?.ok === true);
  if (noDataDecoders.length > 0 && !anyDecoderOk) {
    const fallbackRows = await fetchVinDecoderFallbackRows(opts.vin);
    if (fallbackRows.length > 0) {
      for (const id of noDataDecoders) results[id] = { ...results[id]!, fallback: "vin_scan" };
      display = {
        ...display,
        powertrain: mergeVinDecodeFallbackPowertrain(display.powertrain, fallbackRows),
      };
    }
  }

  const costCents = oneautoChargedCostCents(opts.products, results);
  return {
    source: ONEAUTO_SOURCE_TAG,
    vin: opts.vin,
    costEur: formatOneautoCostEur(costCents),
    costCents,
    results,
    display,
  };
}

export async function fetchOneautoVinPath(
  path: string,
  vin: string,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const config = getOneautoApiConfig();
  if (!config) throw new Error("missing_oneauto_credentials");
  return fetchWithPoll(config, path, vin);
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

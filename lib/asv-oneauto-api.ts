import "server-only";

import {
  ASV_PRODUCTS,
  ASV_SOURCE_TAG,
  asvProductPaths,
  asvProductsCostUsdCents,
  formatAsvCostUsd,
  type AsvProductId,
} from "@/lib/asv-catalog";
import { parseVinauditPayload, vinauditPayloadLooksEmpty, type AsvImageHint } from "@/lib/asv-vinaudit-parse";
import { ASV_MAX_PHOTOS, makeAsvPhotoGroupId } from "@/lib/asv-photo-types";
import {
  ASV_PHOTO_MAX_BYTES,
  makeAsvPhotoId,
  writeAsvPhotoJpeg,
} from "@/lib/admin-asv-photo-store";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";
import {
  getOneautoApiConfig,
  fetchOneautoVinPath,
} from "@/lib/oneauto-api";
import {
  oneautoPayloadIsApiUnavailable,
  oneautoPayloadIsNoData,
  oneautoPayloadIsPending,
  oneautoPayloadIsServiceNotEnabled,
} from "@/lib/oneauto-catalog";
import { emptyAsvBlock, normalizeAsvBlock, type AsvBlockState } from "@/lib/asv-report";

export type AsvProductResult = {
  ok: boolean;
  error?: string;
  path?: string;
  payload?: unknown;
};

function envPathFor(id: AsvProductId): string | undefined {
  if (id === "vhr_full") return process.env.ONEAUTO_ASV_VHR_PATH;
  if (id === "vhr_lite") return process.env.ONEAUTO_ASV_VHR_LITE_PATH;
  return undefined;
}

function classifyError(status: number, bodyText: string): string {
  const t = bodyText.toLowerCase();
  if (oneautoPayloadIsNoData(null, bodyText)) return "no_data";
  if (oneautoPayloadIsServiceNotEnabled(null, bodyText)) return "service_not_enabled";
  if (oneautoPayloadIsApiUnavailable(null, bodyText)) return "api_unavailable";
  if (status === 402 || /insufficient|balance|credit|quota/.test(t)) return "insufficient_balance";
  if (status === 400 || /invalid.?vin/.test(t)) return "invalid_vin";
  if (status === 401 || status === 403) return "unauthorized_upstream";
  if (status >= 500) return "upstream_error";
  return bodyText.trim().slice(0, 240) || `http_${status}`;
}

function errText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  try {
    return JSON.stringify(payload).slice(0, 400);
  } catch {
    return "";
  }
}

async function fetchProductWithFallback(
  vin: string,
  id: AsvProductId,
): Promise<AsvProductResult> {
  const product = ASV_PRODUCTS.find((p) => p.id === id);
  if (!product) return { ok: false, error: "unknown_product" };
  const paths = asvProductPaths(product, envPathFor(id));
  let last: AsvProductResult = { ok: false, error: "upstream_error" };
  for (const path of paths) {
    try {
      const fetched = await fetchOneautoVinPath(path, vin);
      if (oneautoPayloadIsPending(fetched.status, fetched.payload)) {
        last = { ok: false, error: "pending", path, payload: fetched.payload };
        continue;
      }
      const text = errText(fetched.payload);
      if (!fetched.ok) {
        if (oneautoPayloadIsNoData(fetched.payload, text)) {
          return { ok: true, path, payload: fetched.payload };
        }
        if (oneautoPayloadIsServiceNotEnabled(fetched.payload, text)) {
          last = { ok: false, error: "service_not_enabled", path, payload: fetched.payload };
          continue;
        }
        if (oneautoPayloadIsApiUnavailable(fetched.payload, text)) {
          last = { ok: false, error: "api_unavailable", path, payload: fetched.payload };
          continue;
        }
        last = { ok: false, error: classifyError(fetched.status, text), path, payload: fetched.payload };
        continue;
      }
      const body = fetched.payload;
      if (body && typeof body === "object" && (body as { success?: unknown }).success === false) {
        if (oneautoPayloadIsServiceNotEnabled(body, text)) {
          last = { ok: false, error: "service_not_enabled", path, payload: body };
          continue;
        }
        if (oneautoPayloadIsApiUnavailable(body, text)) {
          last = { ok: false, error: "api_unavailable", path, payload: body };
          continue;
        }
        if (oneautoPayloadIsNoData(body, text)) {
          return { ok: true, path, payload: body };
        }
        last = { ok: false, error: classifyError(fetched.status, text), path, payload: body };
        continue;
      }
      return { ok: true, path, payload: body };
    } catch (e) {
      last = {
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 240) : "network_error",
        path,
      };
    }
  }
  return last;
}

async function downloadHintJpeg(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const normalized = await jpegFromAdminPhotoUpload(Buffer.from(ab), ASV_PHOTO_MAX_BYTES);
    return normalized.ok ? normalized.jpeg : null;
  } catch {
    return null;
  }
}

export async function fetchAsvProducts(opts: {
  vin: string;
  products: readonly AsvProductId[];
  sessionId?: string;
}): Promise<{
  source: typeof ASV_SOURCE_TAG;
  vin: string;
  costUsd: string;
  costUsdCents: number;
  results: Partial<Record<AsvProductId, AsvProductResult>>;
  block: AsvBlockState;
  imageHints: AsvImageHint[];
  storedPhotoGroups: AsvBlockState["photoGroups"];
}> {
  if (!getOneautoApiConfig()) throw new Error("missing_oneauto_credentials");

  const results: Partial<Record<AsvProductId, AsvProductResult>> = {};
  for (const id of opts.products) {
    results[id] = await fetchProductWithFallback(opts.vin, id);
  }

  const preferred: AsvProductId[] = opts.products.includes("vhr_full")
    ? ["vhr_full", "vhr_lite"]
    : [...opts.products];
  let parsedPayload: unknown = null;
  let productUsed = preferred.join("+");
  for (const id of preferred) {
    const r = results[id];
    if (r?.ok && r.payload && !vinauditPayloadLooksEmpty(r.payload)) {
      parsedPayload = r.payload;
      productUsed = id;
      break;
    }
  }
  if (!parsedPayload) {
    for (const id of preferred) {
      if (results[id]?.payload) {
        parsedPayload = results[id]?.payload;
        productUsed = id;
        break;
      }
    }
  }

  const costUsdCents = asvProductsCostUsdCents(opts.products);
  const costUsd = formatAsvCostUsd(costUsdCents);
  const parsed = parsedPayload
    ? parseVinauditPayload(parsedPayload, { productUsed, costUsd, vin: opts.vin })
    : { block: emptyAsvBlock(), imageHints: [] as AsvImageHint[] };

  const storedPhotoGroups: AsvBlockState["photoGroups"] = [];
  if (opts.sessionId && parsed.imageHints.length > 0) {
    const byTitle = new Map<string, string[]>();
    for (const hint of parsed.imageHints.slice(0, ASV_MAX_PHOTOS)) {
      const title = hint.title.trim() || "Negadījumu / izsoļu foto";
      const list = byTitle.get(title) ?? [];
      if (list.length >= 12) continue;
      const jpeg = await downloadHintJpeg(hint.url);
      if (!jpeg) continue;
      const photoId = makeAsvPhotoId();
      try {
        await writeAsvPhotoJpeg(opts.sessionId, photoId, jpeg);
        list.push(photoId);
        byTitle.set(title, list);
      } catch {
        /* foto paliek kā URL RAW, ja glabātuve neizdevās */
      }
    }
    for (const [title, ids] of byTitle) {
      if (ids.length === 0) continue;
      storedPhotoGroups.push({
        id: makeAsvPhotoGroupId(),
        title: title.slice(0, 120),
        photos: ids.map((id) => ({ id })),
      });
    }
  }

  const block = normalizeAsvBlock({
    ...parsed.block,
    photoGroups: storedPhotoGroups.length > 0 ? storedPhotoGroups : parsed.block.photoGroups,
  });

  return {
    source: ASV_SOURCE_TAG,
    vin: opts.vin,
    costUsd,
    costUsdCents,
    results,
    block,
    imageHints: parsed.imageHints,
    storedPhotoGroups,
  };
}

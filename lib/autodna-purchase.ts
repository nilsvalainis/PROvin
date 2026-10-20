import "server-only";

import type {
  AutodnaApiFailure,
  AutodnaBinarySuccess,
  AutodnaConfig,
  AutodnaGetReportParams,
  AutodnaJsonSuccess,
} from "@/lib/autodna-api";
import { autodnaGetReport } from "@/lib/autodna-api";
import {
  claimAutodnaReportPurchase,
  completeAutodnaReportPurchase,
  releaseAutodnaReportPurchase,
  resetAutodnaReportPurchase,
} from "@/lib/vendor-purchase-lock-store";

export function extractAutodnaOrderId(data: unknown): string | null {
  if (typeof data === "string") {
    const t = data.trim();
    return /^[A-Za-z0-9_-]{6,80}$/.test(t) ? t : null;
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  for (const key of ["orderId", "order_id", "id"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim() && /^[A-Za-z0-9_-]{6,80}$/.test(v.trim())) {
      return v.trim();
    }
  }
  if (o.data && o.data !== data) return extractAutodnaOrderId(o.data);
  if (o.result && o.result !== data) return extractAutodnaOrderId(o.result);
  return null;
}

function autodnaInProgressFailure(): AutodnaApiFailure {
  return {
    ok: false,
    status: 409,
    code: "autodna_in_progress",
    message: "autoDNA pirkums šim VIN jau notiek. Uzgaidi un pārbaudi orderStatus.",
  };
}

function replayFromPayload(
  payload: unknown,
): AutodnaJsonSuccess | AutodnaBinarySuccess | AutodnaApiFailure | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  if (o.ok === true && "data" in o) {
    return { ok: true, status: typeof o.status === "number" ? o.status : 200, data: o.data };
  }
  if (o.ok === true && typeof o.binaryBase64 === "string" && typeof o.contentType === "string") {
    return {
      ok: true,
      status: typeof o.status === "number" ? o.status : 200,
      contentType: o.contentType,
      binaryBase64: o.binaryBase64,
    };
  }
  const orderId = extractAutodnaOrderId(payload);
  if (orderId) {
    return { ok: true, status: 200, data: payload };
  }
  return null;
}

/** getReport tērē kredītus. Atkārtojums ar to pašu VIN atgriež iepriekšējo rezultātu. */
export async function autodnaGetReportIdempotent(
  params: AutodnaGetReportParams,
  config?: AutodnaConfig,
  opts?: { force?: boolean },
): Promise<AutodnaJsonSuccess | AutodnaBinarySuccess | AutodnaApiFailure> {
  const vin = params.vin.trim().toUpperCase();
  if (!opts?.force) {
    const claim = await claimAutodnaReportPurchase(vin);
    if (claim.action === "in_progress") return autodnaInProgressFailure();
    if (claim.action === "replay") {
      const replayed = replayFromPayload(claim.entry.payload);
      if (replayed) return replayed;
    }
  } else {
    await resetAutodnaReportPurchase(vin);
    const claim = await claimAutodnaReportPurchase(vin);
    if (claim.action === "in_progress") return autodnaInProgressFailure();
  }

  try {
    const result = await autodnaGetReport(params, config);
    if (!result.ok) {
      await releaseAutodnaReportPurchase(vin);
      return result;
    }
    await completeAutodnaReportPurchase(vin, {
      ok: true,
      httpStatus: result.status,
      payload: result,
    });
    const { persistPaidSourceCost } = await import("@/lib/admin-costs-persist");
    persistPaidSourceCost({ source: "autodna", units: 1, ref: vin });
    return result;
  } catch (err) {
    await releaseAutodnaReportPurchase(vin);
    throw err;
  }
}

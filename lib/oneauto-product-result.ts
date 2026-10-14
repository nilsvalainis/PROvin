import {
  oneautoPayloadIsApiUnavailable,
  oneautoPayloadIsNoData,
  oneautoPayloadIsPending,
  oneautoPayloadPrimaryMessage,
} from "@/lib/oneauto-catalog";
import type { OneautoProductResult } from "@/lib/oneauto-block";

function payloadErrText(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.slice(0, 400);
  try {
    return JSON.stringify(payload).slice(0, 400);
  } catch {
    return "";
  }
}

export function classifyOneautoError(status: number, bodyText: string): string {
  const t = bodyText.toLowerCase();
  if (oneautoPayloadIsNoData(null, bodyText)) return "no_data";
  if (oneautoPayloadIsApiUnavailable(null, bodyText)) return "api_unavailable";
  if (status === 402 || /insufficient|balance|credit|quota/.test(t)) return "insufficient_balance";
  if (status === 400 || /invalid.?vin|vin/.test(t)) return "invalid_vin";
  if (status === 401 || status === 403) return "unauthorized_upstream";
  if (status >= 500) return "upstream_error";
  return bodyText.trim().slice(0, 240) || `http_${status}`;
}

function successFlag(payload: unknown): boolean | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const flag = (payload as { success?: unknown }).success;
  return typeof flag === "boolean" ? flag : undefined;
}

/** Vienota OneAuto produkta iznākuma klasifikācija. no_data / kļūda = ok:false. */
export function buildOneautoProductResult(fetched: {
  ok: boolean;
  status: number;
  payload: unknown;
}): OneautoProductResult {
  const errText = payloadErrText(fetched.payload);
  const message = oneautoPayloadPrimaryMessage(fetched.payload, errText);
  const httpStatus = fetched.status;
  const base = {
    payload: fetched.payload,
    httpStatus,
    ...(message ? { message } : {}),
  };

  if (oneautoPayloadIsPending(fetched.status, fetched.payload)) {
    return { ok: false, error: "pending", ...base };
  }
  if (oneautoPayloadIsNoData(fetched.payload, errText)) {
    return { ok: false, error: "no_data", ...base };
  }
  if (oneautoPayloadIsApiUnavailable(fetched.payload, errText)) {
    return { ok: false, error: "api_unavailable", ...base };
  }
  if (!fetched.ok || successFlag(fetched.payload) === false) {
    return { ok: false, error: classifyOneautoError(fetched.status, errText), ...base };
  }
  return { ok: true, ...base };
}

export function oneautoResponsePreview(payload: unknown, max = 300): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.slice(0, max);
  try {
    return JSON.stringify(payload).slice(0, max);
  } catch {
    return "";
  }
}

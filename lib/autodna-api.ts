import "server-only";

import { normalizeVin } from "@/lib/order-field-validation";
import { readAutodnaEnvConfig, type AutodnaConfig } from "@/lib/autodna-config";

export { readAutodnaEnvConfig as getAutodnaConfig, isAutodnaApiConfigured } from "@/lib/autodna-config";
export type { AutodnaConfig } from "@/lib/autodna-config";

/** Sandbox PL/LV: https://api-sandbox.autodna.pl/api/ | EN: https://api-sandbox.autodna.com/api/ */
export const AUTODNA_SANDBOX_BASE_URL_PL = "https://api-sandbox.autodna.pl/api/";
export const AUTODNA_SANDBOX_BASE_URL_EN = "https://api-sandbox.autodna.com/api/";

export type AutodnaApiEndpoint = "getReport" | "orderStatus" | "download";

export type AutodnaGetReportParams = {
  vin: string;
  /** Dokumentācija: `true` | `false` (noklusējums `false` — lejupielāde caur API). */
  deliveryByEmail?: boolean;
};

export type AutodnaOrderStatusParams = {
  orderId: string;
};

export type AutodnaDownloadParams = {
  orderId: string;
  /** Piem. `report_autodna_vhr`, `qr_code_manual`, `terms_and_conditions`. */
  fileCode: string;
};

export type AutodnaJsonSuccess = {
  ok: true;
  status: number;
  data: unknown;
};

export type AutodnaBinarySuccess = {
  ok: true;
  status: number;
  contentType: string;
  binaryBase64: string;
};

export type AutodnaApiFailure = {
  ok: false;
  status: number;
  code: AutodnaApiErrorCode;
  message: string;
  statusCode?: string;
  rawBody?: string;
};

export type AutodnaApiErrorCode =
  | "autodna_not_configured"
  | "autodna_ip_not_allowed"
  | "autodna_ip_blacklisted"
  | "autodna_unauthorized"
  | "autodna_not_enough_credits"
  | "autodna_business_error"
  | "autodna_bad_request"
  | "autodna_upstream_error"
  | "autodna_invalid_response";

function autodnaNotConfiguredFailure(): AutodnaApiFailure {
  return {
    ok: false,
    status: 503,
    code: "autodna_not_configured",
    message: "autoDNA API nav konfigurēts — trūkst AUTODNA_API_URL, AUTODNA_EMAIL vai AUTODNA_API_KEY.",
  };
}

function resolveAutodnaConfig(config?: AutodnaConfig): AutodnaConfig | null {
  if (config?.baseUrl && config.email && config.apiKey) return config;
  return readAutodnaEnvConfig();
}

export function autodnaEndpointUrl(config: AutodnaConfig, endpoint: AutodnaApiEndpoint): string {
  return new URL(endpoint, config.baseUrl).toString();
}

function basicAuthHeader(email: string, apiKey: string): string {
  return `Basic ${Buffer.from(`${email}:${apiKey}`, "utf8").toString("base64")}`;
}

function buildAutodnaRequestHeaders(config: AutodnaConfig): HeadersInit {
  return {
    Accept: "application/json, application/pdf, */*",
    Authorization: basicAuthHeader(config.email, config.apiKey),
    "x-api-key": config.apiKey,
  };
}

/** POST multipart/form-data — lauki `vin`, `deliveryByEmail` (autoDNA 3.5 / 3.6). */
function buildGetReportFormData(params: AutodnaGetReportParams): FormData {
  const form = new FormData();
  form.append("vin", normalizeVin(params.vin));
  form.append("deliveryByEmail", params.deliveryByEmail === true ? "true" : "false");
  return form;
}

function buildOrderStatusFormData(params: AutodnaOrderStatusParams): FormData {
  const form = new FormData();
  form.append("orderId", params.orderId.trim());
  return form;
}

function buildDownloadFormData(params: AutodnaDownloadParams): FormData {
  const form = new FormData();
  form.append("orderId", params.orderId.trim());
  form.append("fileCode", params.fileCode.trim());
  return form;
}

function extractErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const candidates = [o.statusCode, o.error, o.code, o.errorCode, o.message, o.description];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function extractBusinessStatusCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const sc = (body as { statusCode?: unknown }).statusCode;
  return typeof sc === "string" ? sc.trim() : null;
}

function mapAutodnaFailure(status: number, body: unknown, rawBody: string): AutodnaApiFailure {
  const codeRaw = extractErrorCode(body)?.toUpperCase() ?? "";
  const statusCode = extractBusinessStatusCode(body) ?? undefined;

  if (codeRaw.includes("IP_NOT_ALLOWED")) {
    return {
      ok: false,
      status,
      code: "autodna_ip_not_allowed",
      message: "autoDNA noraidīja pieprasījumu — egress IP nav allowlistā (IP_NOT_ALLOWED).",
      statusCode,
      rawBody: rawBody.slice(0, 500),
    };
  }
  if (codeRaw.includes("IP_BLACKLISTED")) {
    return {
      ok: false,
      status,
      code: "autodna_ip_blacklisted",
      message: "autoDNA noraidīja pieprasījumu — IP ir blacklistā (IP_BLACKLISTED).",
      statusCode,
      rawBody: rawBody.slice(0, 500),
    };
  }
  if (
    codeRaw.includes("NOT_ENOUGH_CREDITS") ||
    statusCode?.toUpperCase().includes("NOT_ENOUGH_CREDITS")
  ) {
    return {
      ok: false,
      status,
      code: "autodna_not_enough_credits",
      message: "autoDNA — nepietiek kredītu (NOT_ENOUGH_CREDITS).",
      statusCode,
      rawBody: rawBody.slice(0, 500),
    };
  }
  if (status === 401 || status === 403 || codeRaw.includes("UNAUTHORIZED")) {
    return {
      ok: false,
      status,
      code: "autodna_unauthorized",
      message: "autoDNA autentifikācija neizdevās — pārbaudi AUTODNA_EMAIL un AUTODNA_API_KEY.",
      statusCode,
      rawBody: rawBody.slice(0, 500),
    };
  }
  if (statusCode && statusCode.toUpperCase() !== "SUCCESS") {
    return {
      ok: false,
      status,
      code: "autodna_business_error",
      message: codeRaw || statusCode,
      statusCode,
      rawBody: rawBody.slice(0, 500),
    };
  }
  if (status >= 400 && status < 500) {
    return {
      ok: false,
      status,
      code: "autodna_bad_request",
      message: codeRaw || `autoDNA atgrieza HTTP ${status}.`,
      statusCode,
      rawBody: rawBody.slice(0, 500),
    };
  }
  return {
    ok: false,
    status,
    code: "autodna_upstream_error",
    message: codeRaw || `autoDNA atgrieza HTTP ${status}.`,
    statusCode,
    rawBody: rawBody.slice(0, 500),
  };
}

async function autodnaMultipartPost(
  endpoint: AutodnaApiEndpoint,
  form: FormData,
  config: AutodnaConfig,
): Promise<AutodnaJsonSuccess | AutodnaBinarySuccess | AutodnaApiFailure> {
  const url = autodnaEndpointUrl(config, endpoint);

  const res = await fetch(url, {
    method: "POST",
    headers: buildAutodnaRequestHeaders(config),
    body: form,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  const rawBody = buffer.toString("utf8");

  const looksJson =
    contentType.includes("application/json") ||
    rawBody.trim().startsWith("{") ||
    rawBody.trim().startsWith("[");

  if (looksJson) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawBody) as unknown;
    } catch {
      if (!res.ok) {
        return mapAutodnaFailure(res.status, null, rawBody);
      }
      return {
        ok: false,
        status: res.status,
        code: "autodna_invalid_response",
        message: "autoDNA atbilde nav derīgs JSON.",
        rawBody: rawBody.slice(0, 500),
      };
    }

    const businessCode = extractBusinessStatusCode(parsed)?.toUpperCase();
    if (!res.ok || (businessCode && businessCode !== "SUCCESS")) {
      return mapAutodnaFailure(res.status, parsed, rawBody);
    }

    return { ok: true, status: res.status, data: parsed };
  }

  if (!res.ok) {
    return mapAutodnaFailure(res.status, null, rawBody);
  }

  return {
    ok: true,
    status: res.status,
    contentType,
    binaryBase64: buffer.toString("base64"),
  };
}

/** POST /api/getReport — pasūta jaunu atskaiti. */
export async function autodnaGetReport(
  params: AutodnaGetReportParams,
  config?: AutodnaConfig,
): Promise<AutodnaJsonSuccess | AutodnaBinarySuccess | AutodnaApiFailure> {
  const cfg = resolveAutodnaConfig(config);
  if (!cfg) return autodnaNotConfiguredFailure();
  return autodnaMultipartPost("getReport", buildGetReportFormData(params), cfg);
}

/** POST /api/orderStatus — pārbauda, vai atskaite ir gatava. */
export async function autodnaOrderStatus(
  params: AutodnaOrderStatusParams,
  config?: AutodnaConfig,
): Promise<AutodnaJsonSuccess | AutodnaBinarySuccess | AutodnaApiFailure> {
  const cfg = resolveAutodnaConfig(config);
  if (!cfg) return autodnaNotConfiguredFailure();
  return autodnaMultipartPost("orderStatus", buildOrderStatusFormData(params), cfg);
}

/** POST /api/download — lejupielādē failu pēc orderId + fileCode. */
export async function autodnaDownload(
  params: AutodnaDownloadParams,
  config?: AutodnaConfig,
): Promise<AutodnaJsonSuccess | AutodnaBinarySuccess | AutodnaApiFailure> {
  const cfg = resolveAutodnaConfig(config);
  if (!cfg) return autodnaNotConfiguredFailure();
  return autodnaMultipartPost("download", buildDownloadFormData(params), cfg);
}

/** Mapē autoDNA kļūdu uz HTTP statusu admin API route. */
export function autodnaFailureHttpStatus(code: AutodnaApiErrorCode, upstreamStatus: number): number {
  if (code === "autodna_not_configured") return 503;
  if (code === "autodna_ip_not_allowed" || code === "autodna_ip_blacklisted") return 502;
  if (code === "autodna_unauthorized") return 502;
  if (code === "autodna_not_enough_credits") return 402;
  if (upstreamStatus >= 400 && upstreamStatus < 600) return upstreamStatus;
  return 502;
}

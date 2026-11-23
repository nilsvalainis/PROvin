import "server-only";

import { timingSafeEqual } from "node:crypto";

import { buildCsddLocalParseFromText } from "@/lib/csdd-pdf-ingest";
import { parseSession, readEcsddRelayConfig, relayFetch } from "@/lib/ecsdd-auto";
import type { EcsddPaidReportResult, EcsddPaidSmsLinkResult } from "@/lib/ecsdd-paid-logic";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { normalizePlateNumber } from "@/lib/order-field-validation";

/**
 * CSDD maksas izziņa (Vercel puse): relejs nolasa "Sagatavot īsziņu" saiti un vēlāk apmaksāto izziņu.
 * Releja pārlūka solis ilgst 10-40 s, tāpēc garāks gaidīšanas laiks nekā pārējiem e.csdd izsaukumiem.
 */

const RELAY_TIMEOUT_MS = 55_000;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function needsLogin(json: Record<string, unknown>) {
  const session = parseSession(json.session);
  return {
    status: "needs_login" as const,
    loginStarted: json.loginStarted === true,
    sessionState: session?.state,
    ...(session?.state === "awaiting_smartid" && /^\d{4}$/.test(session.verificationCode ?? "") ? { verificationCode: session.verificationCode } : {}),
  };
}

/** e.csdd "Sagatavot īsziņu" saite (SMS numurs + teksts). `login` = drīkst sākt Smart-ID (tikai Nila poga). */
export async function requestEcsddPaidSmsLink(query: string, opts: { login?: boolean } = {}): Promise<EcsddPaidSmsLinkResult> {
  const config = readEcsddRelayConfig();
  if (!config) return { status: "not_configured" };
  const q = String(query ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  try {
    const { res, json } = await relayFetch(config, "/paid/sms-link", {
      method: "POST",
      body: { query: q, login: opts.login === true },
      timeoutMs: RELAY_TIMEOUT_MS,
    });
    if (!res.ok) return { status: "error", code: str(json.error, 60) || `relay_${res.status}` };
    const status = str(json.status, 30);
    if (status === "ok" && str(json.number, 20) && str(json.body, 80)) {
      return {
        status: "ok",
        number: str(json.number, 20),
        body: str(json.body, 80),
        price: str(json.price, 12),
        vehicle: str(json.vehicle, 80),
        plate: str(json.plate, 12),
      };
    }
    if (status === "needs_login") return needsLogin(json);
    if (status === "not_found" || status === "no_button") return { status };
    return { status: "error", code: str(json.code, 60) || status || "error" };
  } catch {
    return { status: "unreachable" };
  }
}

/** Apmaksātā izziņa (jaunākā šim numuram, ne vecāka par `since`) -> teksts + CSDD lauki caur esošo CSDD parseri. */
export async function fetchEcsddPaidReport(plate: string, since?: string): Promise<EcsddPaidReportResult> {
  const config = readEcsddRelayConfig();
  if (!config) return { status: "not_configured" };
  try {
    const { res, json } = await relayFetch(config, "/paid/report", {
      method: "POST",
      body: { plate: normalizePlateNumber(plate), since: since ?? "" },
      timeoutMs: RELAY_TIMEOUT_MS,
    });
    if (!res.ok) return { status: "error", code: str(json.error, 60) || `relay_${res.status}` };
    const status = str(json.status, 30);
    if (status === "found") {
      const rawText = typeof json.rawText === "string" ? json.rawText.slice(0, 80_000) : "";
      if (!rawText.trim()) return { status: "error", code: "empty" };
      const parsed = buildCsddLocalParseFromText(rawText, "e.csdd maksas izziņa");
      return {
        status: "found",
        rawText: parsed.rawUnprocessedData || rawText,
        fields: parsed.fields,
        paidAt: str(json.paidAt, 40),
        plate: str(json.plate, 12),
      };
    }
    if (status === "needs_login") return { status: "needs_login", sessionState: parseSession(json.session)?.state };
    if (status === "pending" || status === "no_button") return { status };
    return { status: "error", code: str(json.code, 60) || status || "error" };
  } catch {
    return { status: "unreachable" };
  }
}

/**
 * Ārējs izsaucējs (piem. iPhone Īsceļi): `Authorization: Bearer <ECSDD_PAID_API_TOKEN>`.
 * Ja env nav iestatīts (>= 24 zīmes), galapunkts ir izslēgts.
 */
export function verifyEcsddPaidApiToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.ECSDD_PAID_API_TOKEN ?? "").trim();
  if (secret.length < 24) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * "Sūtīt automātiski" režīms: "email" (vajag `ECSDD_SMS_TRIGGER_EMAIL` + SMTP), "pull" (`ECSDD_SMS_TRIGGER_MODE=pull`
 * + `ECSDD_PAID_API_TOKEN`) vai null - poga nav redzama. Adrese nekad nav kodā (publisks repo).
 */
export function ecsddAutoSmsMode(env: Record<string, string | undefined> = process.env): "email" | "pull" | null {
  if ((env.ECSDD_SMS_TRIGGER_MODE ?? "").trim().toLowerCase() === "pull") {
    return (env.ECSDD_PAID_API_TOKEN ?? "").trim().length >= 24 ? "pull" : null;
  }
  const to = (env.ECSDD_SMS_TRIGGER_EMAIL ?? "").trim();
  const smtp = Boolean(env.SMTP_USER?.trim() && env.SMTP_PASS?.trim());
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) && smtp ? "email" : null;
}

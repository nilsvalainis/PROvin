import { NextResponse } from "next/server";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { handleTraficomFiRelayEvent, verifyTraficomFiRelayToken } from "@/lib/traficom-fi-auto";
import type { TraficomFiRelayEvent } from "@/lib/traficom-fi-auto-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** base64 no 3 MB PDF + dati + teksts. */
const MAX_BODY_CHARS = 4_600_000;
const STATES: readonly TraficomFiRelayEvent["state"][] = ["queued", "awaiting_eparaksts", "awaiting_browser_code", "searching", "result", "error"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Hetzner `relay/provin-traficom` -> PROVIN: uzdevuma stāvoklis (rindā / gaida eParaksts / meklē / rezultāts / kļūda).
 * Bearer `TRAFICOM_RELAY_TOKEN`. Atbildē tikai stāvoklis.
 */
export async function POST(req: Request) {
  if (!verifyTraficomFiRelayToken(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") throw new Error("not_object");
    raw = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const state = STATES.find((s) => s === raw.state);
  const ref = str(raw.ref, 120);
  if (!state || !isSafeOrderDraftSessionId(ref)) {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }
  const ev: TraficomFiRelayEvent = {
    state,
    ref,
    jobId: str(raw.jobId, 80),
    vin: str(raw.vin, 20).toUpperCase(),
    ...(str(raw.verificationCode, 8) ? { verificationCode: str(raw.verificationCode, 8) } : {}),
    ...(str(raw.codeExpiresAt, 40) && Number.isFinite(Date.parse(str(raw.codeExpiresAt, 40))) ? { codeExpiresAt: str(raw.codeExpiresAt, 40) } : {}),
    ...(raw.codeExpired === true ? { codeExpired: true } : {}),
    ...(typeof raw.browserCodeAttempt === "number" && Number.isInteger(raw.browserCodeAttempt) && raw.browserCodeAttempt > 0 && raw.browserCodeAttempt < 10
      ? { browserCodeAttempt: raw.browserCodeAttempt }
      : {}),
    ...(raw.browserCodeRejected === true ? { browserCodeRejected: true } : {}),
    ...(typeof raw.found === "boolean" ? { found: raw.found } : {}),
    ...(typeof raw.rawText === "string" && raw.rawText ? { rawText: raw.rawText.slice(0, 60_000) } : {}),
    ...(raw.data && typeof raw.data === "object" ? { data: raw.data as TraficomFiRelayEvent["data"] } : {}),
    ...(typeof raw.pdfBase64 === "string" && raw.pdfBase64 ? { pdfBase64: raw.pdfBase64 } : {}),
    ...(raw.cached === true ? { cached: true } : {}),
    ...(str(raw.code, 40) ? { code: str(raw.code, 40) } : {}),
    ...(str(raw.message, 200) ? { message: str(raw.message, 200) } : {}),
    ...(str(raw.at, 40) ? { at: str(raw.at, 40) } : {}),
  };
  const out = await handleTraficomFiRelayEvent(ev);
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.httpStatus });
  return NextResponse.json({ ok: true, state: out.status.state });
}

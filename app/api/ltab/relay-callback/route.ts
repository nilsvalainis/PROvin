import { NextResponse } from "next/server";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { handleLtabRelayEvent, verifyLtabRelayToken } from "@/lib/ltab-auto";
import type { LtabRelayEvent } from "@/lib/ltab-auto-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** base64 no 3 MB PDF + JSON. */
const MAX_BODY_CHARS = 4_400_000;
const STATES: readonly LtabRelayEvent["state"][] = ["queued", "awaiting_smartid", "searching", "result", "error"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Hetzner `relay/provin-ltab` -> PROVIN: uzdevuma stāvoklis (rindā / Smart-ID kods / meklē / rezultāts / kļūda).
 * Bearer `LTAB_RELAY_TOKEN`. Atbildē tikai stāvoklis, bez izziņas satura.
 */
export async function POST(req: Request) {
  if (!verifyLtabRelayToken(req.headers.get("authorization"))) {
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
  const ev: LtabRelayEvent = {
    state,
    ref,
    jobId: str(raw.jobId, 80),
    plate: str(raw.plate, 12).toUpperCase(),
    ...(str(raw.verificationCode, 8) ? { verificationCode: str(raw.verificationCode, 8) } : {}),
    ...(typeof raw.found === "boolean" ? { found: raw.found } : {}),
    ...(typeof raw.pdfBase64 === "string" && raw.pdfBase64 ? { pdfBase64: raw.pdfBase64 } : {}),
    ...(str(raw.code, 40) ? { code: str(raw.code, 40) } : {}),
    ...(str(raw.message, 200) ? { message: str(raw.message, 200) } : {}),
    ...(str(raw.at, 40) ? { at: str(raw.at, 40) } : {}),
  };
  const out = await handleLtabRelayEvent(ev);
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.httpStatus });
  return NextResponse.json({ ok: true, state: out.status.state });
}

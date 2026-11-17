import { NextResponse } from "next/server";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { handleEcsddJobEvent, handleEcsddSessionEvent, verifyEcsddRelayToken } from "@/lib/ecsdd-auto";
import type { EcsddRelayJobEvent } from "@/lib/ecsdd-auto-logic";
import type { EcsddRelaySession } from "@/lib/ecsdd-auto-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** e.csdd teksts (līdz 60k zīmēm) + JSON. */
const MAX_BODY_CHARS = 200_000;
const JOB_STATES: readonly EcsddRelayJobEvent["state"][] = ["queued", "awaiting_login", "awaiting_smartid", "searching", "result", "error"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Hetzner `relay/provin-ecsdd` -> PROVIN: sesijas stāvoklis (push ar Smart-ID kodu) un uzdevuma stāvoklis / e.csdd teksts.
 * Bearer `ECSDD_RELAY_TOKEN`. Atbildē tikai stāvoklis, bez auto datiem.
 */
export async function POST(req: Request) {
  if (!verifyEcsddRelayToken(req.headers.get("authorization"))) {
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

  if (raw.kind === "session") {
    const s = raw.session && typeof raw.session === "object" ? (raw.session as Record<string, unknown>) : null;
    if (!s || typeof s.state !== "string") return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    const code = str(s.verificationCode, 8);
    await handleEcsddSessionEvent({ state: s.state as EcsddRelaySession["state"], ...(code ? { verificationCode: code } : {}) });
    return NextResponse.json({ ok: true });
  }

  const state = JOB_STATES.find((x) => x === raw.state);
  const ref = str(raw.ref, 120);
  if (raw.kind !== "job" || !state || !isSafeOrderDraftSessionId(ref)) {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }
  const ev: EcsddRelayJobEvent = {
    kind: "job",
    state,
    ref,
    jobId: str(raw.jobId, 80),
    query: str(raw.query, 20).toUpperCase(),
    ...(str(raw.verificationCode, 8) ? { verificationCode: str(raw.verificationCode, 8) } : {}),
    ...(str(raw.reason, 20) ? { reason: str(raw.reason, 20) } : {}),
    ...(typeof raw.found === "boolean" ? { found: raw.found } : {}),
    ...(typeof raw.rawText === "string" && raw.rawText.trim() ? { rawText: raw.rawText.slice(0, 60_000) } : {}),
    ...(str(raw.code, 40) ? { code: str(raw.code, 40) } : {}),
    ...(str(raw.message, 200) ? { message: str(raw.message, 200) } : {}),
    ...(str(raw.at, 40) ? { at: str(raw.at, 40) } : {}),
  };
  const out = await handleEcsddJobEvent(ev);
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.httpStatus });
  return NextResponse.json({ ok: true, state: out.status.state });
}

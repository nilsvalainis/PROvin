import { NextResponse } from "next/server";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { handleCarverticalRelayEvent, verifyCarverticalRelayToken, type CarverticalRelayEvent } from "@/lib/carvertical-auto";
import type { CarverticalRelayJobState } from "@/lib/carvertical-auto-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** PDF atzvanā nenāk (to paņem no releja), tikai stāvoklis. */
const MAX_BODY_CHARS = 64_000;
const JOB_STATES: readonly CarverticalRelayJobState[] = [
  "queued",
  "running",
  "awaiting_login",
  "checking",
  "purchasing",
  "waiting_report",
  "downloading",
  "result",
  "error",
];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Hetzner `relay/provin-carvertical` -> PROVIN: uzdevuma stāvoklis / rezultāts (PDF), sesija (kods e-pastā), atlikums.
 * Bearer `CARVERTICAL_RELAY_TOKEN`. Atbildē tikai stāvoklis.
 */
export async function POST(req: Request) {
  if (!verifyCarverticalRelayToken(req.headers.get("authorization"))) {
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

  let ev: CarverticalRelayEvent;
  if (raw.kind === "balance") {
    if (typeof raw.credits !== "number" || !Number.isFinite(raw.credits)) return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    ev = { kind: "balance", credits: Math.max(0, Math.floor(raw.credits)), at: str(raw.at, 40) };
  } else if (raw.kind === "session") {
    if (raw.state !== "awaiting_code" && raw.state !== "needs_human") return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    ev = { kind: "session", state: raw.state, code: str(raw.code, 40), at: str(raw.at, 40) };
  } else {
    const state = JOB_STATES.find((s) => s === raw.state);
    const ref = str(raw.ref, 120);
    if (raw.kind !== "job" || !state || !isSafeOrderDraftSessionId(ref)) {
      return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    }
    ev = {
      kind: "job",
      state,
      ref,
      jobId: str(raw.jobId, 80),
      vin: str(raw.vin, 17).toUpperCase(),
      jobKind: raw.jobKind === "report" ? "report" : "purchase",
      ...(str(raw.code, 60) ? { code: str(raw.code, 60) } : {}),
      ...(str(raw.message, 200) ? { message: str(raw.message, 200) } : {}),
      ...(str(raw.reportId, 80) ? { reportId: str(raw.reportId, 80) } : {}),
      ...(typeof raw.existing === "boolean" ? { existing: raw.existing } : {}),
      ...(typeof raw.credits === "number" && Number.isFinite(raw.credits) ? { credits: Math.max(0, Math.floor(raw.credits)) } : {}),
      ...(typeof raw.pdfSize === "number" && Number.isFinite(raw.pdfSize) ? { pdfSize: raw.pdfSize } : {}),
      ...(str(raw.at, 40) ? { at: str(raw.at, 40) } : {}),
    };
  }
  const out = await handleCarverticalRelayEvent(ev);
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.httpStatus });
  return NextResponse.json({ ok: true, ...(out.state ? { state: out.state } : {}) });
}

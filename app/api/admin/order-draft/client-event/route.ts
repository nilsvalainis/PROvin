/**
 * Klienta drošības signāli (`navigator.sendBeacon`): lokālas izmaiņas, kas nav nonākušas serverī.
 * Tikai žurnāls - sid, iemesls, skaitļi. Saturu nepieņem un nelogo.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";

export const runtime = "nodejs";

const EVENTS = new Set([
  "unsaved_not_sent",
  "conflict_auto_merged",
  "conflict_merge_failed",
  "local_restore",
  "flash_max_job_failed",
]);
const REASONS = new Set([
  "persistence_off",
  "not_hydrated",
  "revision_conflict",
  "save_error",
  "pending",
  "network",
  "client_exception",
  "",
]);
/** FLASH MAX darba id (piem. `dealer_oil`, `citi_avoti:2`) - tikai identifikators, ne saturs. */
const JOB_RE = /^[a-z0-9_:]{1,48}$/;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1_000_000, Math.floor(v))) : null;
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return new NextResponse(null, { status: 204 });
  const text = await req.text().catch(() => "");
  if (text.length > 2000) return new NextResponse(null, { status: 204 });
  let b: Record<string, unknown> | null = null;
  try {
    b = JSON.parse(text) as Record<string, unknown>;
  } catch {
    b = null;
  }
  const sessionId = typeof b?.sessionId === "string" ? b.sessionId.trim() : "";
  const event = typeof b?.event === "string" ? b.event : "";
  const reason = typeof b?.reason === "string" ? b.reason : "";
  if (!b || !isSafeOrderDraftSessionId(sessionId) || !EVENTS.has(event) || !REASONS.has(reason)) {
    return new NextResponse(null, { status: 204 });
  }
  const job = typeof b.job === "string" && JOB_RE.test(b.job) ? b.job : undefined;
  console.warn(`[workspace:client_${event}]`, {
    sessionId,
    reason: reason || undefined,
    ...(job ? { job } : {}),
    fields: num(b.fields),
    blocks: num(b.blocks),
    unsavedMs: num(b.unsavedMs),
    revision: num(b.revision),
  });
  return new NextResponse(null, { status: 204 });
}

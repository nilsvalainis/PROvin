/**
 * Ātrā vērtējuma darba zona: bezmaksas avotu kopsavilkums, atjaunošana, eksports uz pasūtījumu,
 * iepriekš nopirkto datu atkārtota izmantošana pēc VIN.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getListingPeekById } from "@/lib/listing-peek-store";
import {
  exportQuickEvalToOrder,
  listQuickEvalExportCandidates,
  quickEvalBlockSummaries,
  seedQuickEval,
  setQuickEvalCcVin,
  setQuickEvalLtabMark,
} from "@/lib/quick-eval-service";
import { readQuickEval } from "@/lib/quick-eval-store";
import { findVinHistory, reuseVehicleData } from "@/lib/vin-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SAFE_SESSION = /^[A-Za-z0-9_]{6,200}$/;

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const peekId = (url.searchParams.get("peekId") ?? "").trim();
  const peek = await getListingPeekById(peekId);
  if (!peek) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const doc = await readQuickEval(peek.id);
  const [candidates, vinHistory] = await Promise.all([
    listQuickEvalExportCandidates(peek.id).catch(() => []),
    findVinHistory(
      [peek.vin, doc?.vin, doc?.sourceBlocks.csdd.registrationNumber, doc?.sourceBlocks.csdd.vin],
      { peekId: peek.id },
    ).catch(() => []),
  ]);
  return NextResponse.json({
    ok: true,
    vin: doc?.vin || peek.vin || "",
    seed: doc?.seed ?? null,
    blocks: quickEvalBlockSummaries(doc),
    exports: doc?.exports ?? [],
    reusedFrom: doc?.reusedFrom ?? [],
    candidates,
    vinHistory,
  });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const peekId = String(b.peekId ?? "").trim();
  const peek = await getListingPeekById(peekId);
  if (!peek) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const action = String(b.action ?? "");

  if (action === "refresh") {
    const only = String(b.only ?? "").trim();
    const doc = await seedQuickEval(peek.id, only ? { only } : { refresh: true });
    return NextResponse.json({ ok: Boolean(doc), parts: doc?.seed?.parts ?? null });
  }
  if (action === "ltab") {
    const mark = b.mark === "clean" || b.mark === "claims" ? b.mark : null;
    const doc = await setQuickEvalLtabMark(peek.id, mark);
    return NextResponse.json({ ok: Boolean(doc), ltab: doc?.ltab ?? null });
  }
  if (action === "ccvin") {
    const count = typeof b.count === "number" && Number.isFinite(b.count) ? Math.max(0, Math.trunc(b.count)) : null;
    const doc = await setQuickEvalCcVin(peek.id, count, typeof b.error === "string" ? b.error.slice(0, 160) : undefined);
    return NextResponse.json({ ok: Boolean(doc) });
  }
  if (action === "export") {
    const sessionId = String(b.sessionId ?? "").trim();
    if (!SAFE_SESSION.test(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    const r = await exportQuickEvalToOrder(peek.id, sessionId, "manual");
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }
  if (action === "reuse") {
    const fromId = String(b.fromId ?? "").trim();
    if (!fromId) return NextResponse.json({ error: "missing_from" }, { status: 400 });
    const r = await reuseVehicleData(fromId, { kind: "quick", peekId: peek.id });
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

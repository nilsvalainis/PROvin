import { NextResponse } from "next/server";
import { adminActorLabel, getAdminSession } from "@/lib/admin-auth";
import {
  applyIrissOrderSnapshot,
  isAdminChangeHistoryKind,
  isSafeAdminChangeEntryId,
  isSafeAdminChangeRecordId,
  parseListingHistoryRecordId,
  type AdminChangeHistoryKind,
} from "@/lib/admin-change-history";
import { listAdminChangeHistory, loadAdminChangeSnapshot } from "@/lib/admin-change-history-store";
import { isIrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import { patchIrissListingMatchStatus } from "@/lib/iriss-listing-match-store";
import { readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { IRISS_STALE_REVISION } from "@/lib/iriss-pasutijumi-save-safety";
import { restoreIrissPavadzimeSnapshot } from "@/lib/iriss-pavadzimes-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = { kind: "operator" } as const;

function operatorKind(value: unknown): AdminChangeHistoryKind | null {
  if (!isAdminChangeHistoryKind(value) || value === "b2b-order") return null;
  return value;
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind = operatorKind(url.searchParams.get("kind"));
  const id = url.searchParams.get("id") ?? "";
  if (!kind || !isSafeAdminChangeRecordId(kind, id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const entries = await listAdminChangeHistory(kind, id, SCOPE);
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { kind?: unknown; recordId?: unknown; entryId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const kind = operatorKind(body.kind);
  const recordId = typeof body.recordId === "string" ? body.recordId : "";
  const entryId = typeof body.entryId === "string" ? body.entryId : "";
  if (!kind || !isSafeAdminChangeRecordId(kind, recordId) || !isSafeAdminChangeEntryId(entryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const snapshot = await loadAdminChangeSnapshot(kind, recordId, entryId, SCOPE);
  if (!snapshot) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const by = adminActorLabel();

  if (kind === "iriss-order") {
    const current = await readIrissPasutijums(recordId);
    if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const next = applyIrissOrderSnapshot(current, snapshot);
    const saved = await writeIrissPasutijums(next, {
      expectedWorkspaceRevision: current.workspaceRevision,
      historyBy: by,
      historyAction: "restore",
    });
    if (!saved.ok) {
      const status = saved.error === IRISS_STALE_REVISION ? 409 : 500;
      return NextResponse.json({ error: saved.error }, { status });
    }
    return NextResponse.json({ ok: true, record: saved.record });
  }

  if (kind === "iriss-waybill") {
    const record = await restoreIrissPavadzimeSnapshot(recordId, snapshot, by);
    if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, record });
  }

  const parsed = parseListingHistoryRecordId(recordId);
  const status = snapshot.status ?? "";
  if (!parsed || !isIrissListingHitStatus(status)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const next = await patchIrissListingMatchStatus(
    [{ orderId: parsed.orderId, listingId: parsed.listingId, status }],
    new Date().toISOString(),
    { by, action: "restore" },
  );
  if (!next) return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  return NextResponse.json({
    ok: true,
    record: { status, orderId: parsed.orderId, listingId: parsed.listingId },
  });
}

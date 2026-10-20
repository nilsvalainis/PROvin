import { NextResponse } from "next/server";
import { adminActorLabel } from "@/lib/admin-auth";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import { staffHasSection, type IrissSection } from "@/lib/staff-roles";
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

function sectionForHistoryKind(kind: AdminChangeHistoryKind): IrissSection {
  if (kind === "iriss-waybill") return "pavadzimes";
  if (kind === "iriss-order") return "pasutijumi";
  return "sludinajumi";
}

async function requireHistoryAccess(kind: AdminChangeHistoryKind | null) {
  const actor = await getAdminOrStaffActor();
  if (actor?.kind === "admin") return { ok: true as const, actor };
  if (actor?.kind === "staff") {
    if (kind && staffHasSection(actor.user, sectionForHistoryKind(kind))) return { ok: true as const, actor };
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: false as const, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
}

function historyActorLabel(actor: { kind: "admin"; name: string } | { kind: "staff"; user: { name: string } }): string {
  return actor.kind === "admin" ? adminActorLabel() : actor.user.name.slice(0, 80);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = operatorKind(url.searchParams.get("kind"));
  const gate = await requireHistoryAccess(kind);
  if (!gate.ok) return gate.response;
  const id = url.searchParams.get("id") ?? "";
  if (!kind || !isSafeAdminChangeRecordId(kind, id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const entries = await listAdminChangeHistory(kind, id, SCOPE);
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  let body: { kind?: unknown; recordId?: unknown; entryId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const kind = operatorKind(body.kind);
  const gate = await requireHistoryAccess(kind);
  if (!gate.ok) return gate.response;
  const recordId = typeof body.recordId === "string" ? body.recordId : "";
  const entryId = typeof body.entryId === "string" ? body.entryId : "";
  if (!kind || !isSafeAdminChangeRecordId(kind, recordId) || !isSafeAdminChangeEntryId(entryId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const snapshot = await loadAdminChangeSnapshot(kind, recordId, entryId, SCOPE);
  if (!snapshot) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const by = historyActorLabel(gate.actor);

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

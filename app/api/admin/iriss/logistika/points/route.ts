import { NextResponse } from "next/server";
import { requireLogisticsApi } from "@/lib/staff-auth";
import { appendStaffAudit } from "@/lib/staff-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { toLogisticsPointView, type LogisticsPointView } from "@/lib/staff-data-filter";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vietējais punkts, kamēr paralēlais karšu PR pievieno pastāvīgo krātuvi. */
type PointRecord = LogisticsPointView & { updatedAt: string };

const memory = new Map<string, PointRecord>();

function actorId(actor: { kind: "admin"; name: string } | { kind: "staff"; user: { id: string } }): string {
  return actor.kind === "admin" ? ENV_ADMIN_USER_ID : actor.user.id;
}

export async function GET(req: Request) {
  const gate = await requireLogisticsApi();
  if (!gate.ok) return gate.response;
  const ip = getClientIpFromRequest(req);
  await appendStaffAudit({
    userId: actorId(gate.actor),
    action: "point_viewed",
    target: "points",
    ip,
    userAgent: req.headers.get("user-agent") ?? "",
  });
  const points = [...memory.values()].map((p) => toLogisticsPointView(p));
  return NextResponse.json({ ok: true, points }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const gate = await requireLogisticsApi();
  if (!gate.ok) return gate.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
  const view = toLogisticsPointView({
    ...body,
    id: typeof body.id === "string" && body.id.trim() ? body.id.trim() : `pt_${Date.now().toString(36)}`,
  });
  if (!view.name.trim()) return NextResponse.json({ error: "Norādi punkta nosaukumu." }, { status: 400 });
  const record: PointRecord = { ...view, updatedAt: new Date().toISOString() };
  memory.set(record.id, record);
  await appendStaffAudit({
    userId: actorId(gate.actor),
    action: "point_edited",
    target: record.id,
    meta: { name: record.name },
    ip: getClientIpFromRequest(req),
    userAgent: req.headers.get("user-agent") ?? "",
  });
  return NextResponse.json({ ok: true, point: toLogisticsPointView(record) });
}

import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { driverLinkPath, type DriverLinkBucket } from "@/lib/iriss-logistics-driver-link";
import { createDriverLink, revokeDriverLinks } from "@/lib/iriss-logistics-driver-link-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bucketOf(body: unknown): DriverLinkBucket | null {
  const b = body && typeof body === "object" ? (body as { bucket?: unknown }).bucket : null;
  return b === "next" || b === "after" ? b : null;
}

/** Jauna saite šoferim šai kravai. */
export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const forbidden = logisticsCabinetWriteForbidden(gate.actor);
  if (forbidden) return forbidden;
  const bucket = bucketOf(await req.json().catch(() => null));
  if (!bucket) return NextResponse.json({ error: "invalid_bucket" }, { status: 400, headers: irissLogisticsScopeHeader() });
  const rec = await createDriverLink(bucket);
  return NextResponse.json({ ok: true, path: driverLinkPath(rec.token), expiresAt: rec.expiresAt }, { headers: irissLogisticsScopeHeader() });
}

/** Atsauc visas šīs kravas šofera saites. */
export async function DELETE(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const forbidden = logisticsCabinetWriteForbidden(gate.actor);
  if (forbidden) return forbidden;
  const bucket = bucketOf(await req.json().catch(() => null));
  if (!bucket) return NextResponse.json({ error: "invalid_bucket" }, { status: 400, headers: irissLogisticsScopeHeader() });
  const removed = await revokeDriverLinks(bucket);
  return NextResponse.json({ ok: true, removed }, { headers: irissLogisticsScopeHeader() });
}

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteIrissScan, isSafeIrissScanId, readIrissScan, writeIrissScan } from "@/lib/iriss-scan-store";
import { coerceIrissListingLinkList } from "@/lib/iriss-listing-link-lists";
import { IRISS_STALE_REVISION, parseExpectedIrissRevision } from "@/lib/iriss-scan-save-safety";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";
import { isMarketplaceVehicleCategory } from "@/lib/marketplace/types";

export const runtime = "nodejs";

function links(o: Record<string, unknown>, k: string): string[] {
  return coerceIrissListingLinkList(o[k]);
}

function parseBodyRecord(id: string, body: unknown): IrissScanRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    id,
    createdAt: str("createdAt"),
    updatedAt: str("updatedAt"),
    pinnedAt: str("pinnedAt"),
    workspaceRevision: parseExpectedIrissRevision(o.workspaceRevision) ?? 0,
    brandModel: str("brandModel"),
    vin: str("vin"),
    productionYears: str("productionYears"),
    engineType: str("engineType"),
    transmission: str("transmission"),
    bodyType: str("bodyType"),
    vehicleCategory: (() => {
      const category = str("vehicleCategory");
      return isMarketplaceVehicleCategory(category) ? category : "";
    })(),
    apifyMobiledeEnabled: o.apifyMobiledeEnabled === true,
    apifyAutoscout24Enabled: o.apifyAutoscout24Enabled === true,
    listingLinkMobile: links(o, "listingLinkMobile"),
    listingLinkAutobid: links(o, "listingLinkAutobid"),
    listingLinkOpenline: links(o, "listingLinkOpenline"),
    listingLinkAuto1: links(o, "listingLinkAuto1"),
    listingLinkEcarstrade: links(o, "listingLinkEcarstrade"),
    listingLinksOther: links(o, "listingLinksOther"),
    ...(o.ecarstradeLinksManual === true ? { ecarstradeLinksManual: true } : {}),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissScan(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ record: rec });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rec = parseBodyRecord(id, body);
  if (!rec) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const expected =
    parseExpectedIrissRevision(bodyObj.expectedWorkspaceRevision) ??
    parseExpectedIrissRevision(bodyObj.workspaceRevision);
  const w = await writeIrissScan(rec, { expectedWorkspaceRevision: expected });
  if (!w.ok) {
    if (w.stale || w.error === IRISS_STALE_REVISION) {
      return NextResponse.json(
        { error: IRISS_STALE_REVISION, record: w.record, workspaceRevision: w.record?.workspaceRevision ?? 0 },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: w.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, record: w.record, workspaceRevision: w.record.workspaceRevision });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const d = await deleteIrissScan(id);
  if (!d.ok) return NextResponse.json({ error: d.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

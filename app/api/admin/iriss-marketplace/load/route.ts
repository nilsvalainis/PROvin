import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { parseMarketplacePlatforms, resolveMarketplaceAdminTarget } from "@/lib/marketplace/admin-target";
import { loadMarketplaceForOrder } from "@/lib/marketplace/load";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("radars");
  if (!gate.ok) return gate.response;
  let body: { orderId?: unknown; scanId?: unknown; platforms?: unknown; explicit?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.explicit !== true) {
    return NextResponse.json({ error: "explicit_required", blocked: true }, { status: 400 });
  }
  const target = await resolveMarketplaceAdminTarget({
    orderId: typeof body.orderId === "string" ? body.orderId : "",
    scanId: typeof body.scanId === "string" ? body.scanId : "",
    platforms: parseMarketplacePlatforms(body.platforms),
  });
  if (!target.ok) return NextResponse.json({ error: target.error, blocked: target.status === 409 }, { status: target.status });
  const out = await loadMarketplaceForOrder({
    orderId: target.orderId,
    order: target.order,
    ownerKind: target.ownerKind,
    explicit: true,
    trigger: "manual",
    ...(target.ownerKind === "radar" ? { scan: target.scan } : {}),
    ...(target.platforms?.length ? { platforms: target.platforms } : {}),
  });
  return NextResponse.json(out, { status: out.ok ? 200 : out.blocked ? 409 : 400 });
}

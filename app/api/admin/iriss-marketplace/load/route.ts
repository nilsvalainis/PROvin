import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { loadMarketplaceForOrder } from "@/lib/marketplace/load";
import { isMarketplacePlatform } from "@/lib/marketplace/types";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { orderId?: unknown; platforms?: unknown; explicit?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!isSafeIrissPasutijumsId(orderId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (body.explicit !== true) {
    return NextResponse.json({ error: "explicit_required", blocked: true }, { status: 400 });
  }
  const rec = await readIrissPasutijums(orderId);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p): p is string => typeof p === "string").filter(isMarketplacePlatform)
    : undefined;
  const out = await loadMarketplaceForOrder({
    orderId,
    order: rec,
    explicit: true,
    trigger: "manual",
    ...(platforms?.length ? { platforms } : {}),
  });
  return NextResponse.json(out, { status: out.ok ? 200 : out.blocked ? 409 : 400 });
}

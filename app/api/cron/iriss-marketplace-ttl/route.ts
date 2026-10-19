import { NextResponse } from "next/server";
import { purgeExpiredMarketplaceListings } from "@/lib/marketplace/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const candidates = [
    process.env.ADMIN_IRISS_LISTINGS_CRON_SECRET?.trim() ?? "",
    process.env.CRON_SECRET?.trim() ?? "",
  ].filter(Boolean);
  if (candidates.length === 0) return false;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  return candidates.some((s) => auth === `Bearer ${s}`);
}

/** Tikai TTL tīrīšana. Jaunu maksas ielādi nekad nesāk. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const out = await purgeExpiredMarketplaceListings();
  return NextResponse.json({ ok: true, removed: out.removed });
}

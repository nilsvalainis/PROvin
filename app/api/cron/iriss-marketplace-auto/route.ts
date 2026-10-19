import { NextResponse } from "next/server";
import { runMarketplaceAutoLoadNow } from "@/lib/marketplace/auto-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const candidates = [
    process.env.ADMIN_IRISS_LISTINGS_CRON_SECRET?.trim() ?? "",
    process.env.CRON_SECRET?.trim() ?? "",
  ].filter(Boolean);
  if (candidates.length === 0) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (!candidates.some((s) => auth === `Bearer ${s}`)) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true };
}

/** Tirgus auto ielāde. Izsoļu sync nesauc. Bez APIFY_TOKEN / actor ID: skip, bez kļūdas. */
export async function GET(req: Request) {
  const gate = isAuthorized(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const out = await runMarketplaceAutoLoadNow();
    return NextResponse.json(out);
  } catch (e) {
    console.error("[cron/iriss-marketplace-auto] failed", e);
    return NextResponse.json(
      { ok: false, error: "auto_load_failed", detail: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}

/**
 * Nekonvertēto ātro vērtējumu avotu datu dzēšana pēc 30 dienām (eksportētie paliek).
 * Pats pieprasījums (kontakti, vēstule) paliek konversijas statistikai; dzēš tikai darba zonu.
 *
 * Env: `CRON_SECRET` (Vercel Cron sūta `Authorization: Bearer …`).
 */
import { NextResponse } from "next/server";

import { cleanupExpiredQuickEvals } from "@/lib/quick-eval-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secrets = [
    process.env.CRON_SECRET,
    process.env.ADMIN_DEALER_DATA_CRON_SECRET,
    process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET,
  ]
    .map((s) => s?.trim() ?? "")
    .filter(Boolean);
  if (secrets.length === 0) return NextResponse.json({ error: "missing_cron_secret" }, { status: 503 });
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!secrets.some((s) => auth === `Bearer ${s}`)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const r = await cleanupExpiredQuickEvals();
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error("[cron quick-eval-cleanup]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

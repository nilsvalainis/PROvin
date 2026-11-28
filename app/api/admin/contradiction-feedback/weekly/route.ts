/**
 * 28.11 (Nils 5): «Nav pretruna» / «Pareizi» nedēļas kopsavilkums noteikumu labošanai (admin sesija).
 * GET ?days=7 (1-31) - noraidītās atzīmes pa noteikumu / veidu / faktu ar līdz 3 piemēra teikumiem.
 * Izvadē nav VIN, pasūtījuma id, vārdu, tālruņu (teikumi tīrīti ar `sanitizeFeedbackSample`).
 * `?format=text` - teksts. Plānotajam izsaukumam: `/api/cron/contradiction-dismissed-digest` (CRON_SECRET).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { formatDismissedFeedbackDigest } from "@/lib/contradiction-feedback";
import { loadDismissedFeedbackDigest } from "@/lib/contradiction-feedback-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  try {
    const digest = await loadDismissedFeedbackDigest(Number(url.searchParams.get("days") ?? "7"));
    if (url.searchParams.get("format") === "text") {
      return new NextResponse(formatDismissedFeedbackDigest(digest), {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return NextResponse.json({ ok: true, ...digest }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[contradiction-feedback/weekly] failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "weekly_failed" }, { status: 500 });
  }
}

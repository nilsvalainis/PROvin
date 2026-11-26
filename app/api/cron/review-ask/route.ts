/**
 * Google atsauksmes lūgums klientam nākamajā darba dienā pēc atskaites (10:00-18:00 Rīgā).
 * Auth: `Authorization: Bearer CRON_SECRET` (Vercel Cron). Ārkārtas apturēšana: `REVIEW_ASK_AUTO_DISABLED=1`.
 */
import { NextResponse } from "next/server";

import { cronSecretGate } from "@/lib/cron-bearer";
import { runReviewAskCron } from "@/lib/review-ask-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const result = await runReviewAskCron();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    console.error("[cron/review-ask] failed", e);
    return NextResponse.json({ error: "review_ask_failed" }, { status: 500 });
  }
}

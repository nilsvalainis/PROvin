/**
 * Pretrunu nedēļas atskaite (pirmdienās): top 5 noraidītie noteikumi + automātiski pazeminātie.
 * Neko necommito (Vercel būves) - push galvenajam/Nilam ar saiti uz «Pretrunu statistika».
 * Auth: `Authorization: Bearer CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { cronSecretGate } from "@/lib/cron-bearer";
import { sendAdminPush, isAdminPushConfigured } from "@/lib/admin-push";
import { contradictionWeeklyPushBody } from "@/lib/contradiction-feedback";
import { loadContradictionFeedbackSummary } from "@/lib/contradiction-feedback-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const week = await loadContradictionFeedbackSummary(7);
    const body = contradictionWeeklyPushBody(week.stats, week.downgraded);
    if (!body) return NextResponse.json({ ok: true, sent: 0, reason: "no_feedback" });
    if (!isAdminPushConfigured()) return NextResponse.json({ ok: true, sent: 0, reason: "push_not_configured", body });
    const res = await sendAdminPush({
      title: "Pretrunu nedēļa",
      body,
      url: "/admin/pretrunu-statistika",
      tag: "contradiction-weekly",
      audience: "pro",
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error("[cron/contradiction-feedback-weekly] failed", e);
    return NextResponse.json({ error: "weekly_failed" }, { status: 500 });
  }
}

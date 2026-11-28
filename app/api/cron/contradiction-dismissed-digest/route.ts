/**
 * 28.11 (Nils 5): «Nav pretruna» nedēļas kopsavilkums plānotajam izsaukumam (galvenais labo noteikumus).
 * GET ?days=7&format=text|json. Auth: `Authorization: Bearer CRON_SECRET`. Neko neraksta, nesūta un necommito.
 * Izvadē nav VIN, pasūtījuma id un personas datu.
 */
import { NextResponse } from "next/server";

import { formatDismissedFeedbackDigest } from "@/lib/contradiction-feedback";
import { loadDismissedFeedbackDigest } from "@/lib/contradiction-feedback-store";
import { cronSecretGate } from "@/lib/cron-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
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
    console.error("[cron/contradiction-dismissed-digest] failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "digest_failed" }, { status: 500 });
  }
}

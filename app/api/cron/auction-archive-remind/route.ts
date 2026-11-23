/**
 * Izsoļu arhīva piedāvājums: klients 3 dienas nav izvēlējies → vienreiz katram piedāvājumam
 * (Nila lēmums 23.11, 3 = A+B): Nilam push + e-pasts UN e-pasta piedāvājumam automātisks atgādinājums
 * klientam ar tām pašām 2 pogām. WhatsApp piedāvājumam klientam neko - Nilam gatavs WhatsApp teksts.
 * Auth: `Authorization: Bearer CRON_SECRET` (Vercel Cron).
 */
import { NextResponse } from "next/server";

import { runAuctionArchiveReminders } from "@/lib/auction-archive-offer-service";
import { cronSecretGate } from "@/lib/cron-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json(await runAuctionArchiveReminders());
  } catch (e) {
    console.error("[cron/auction-archive-remind] failed", e instanceof Error ? e.message.slice(0, 160) : "error");
    return NextResponse.json({ error: "auction_archive_remind_failed" }, { status: 500 });
  }
}

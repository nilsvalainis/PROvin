/**
 * PVN/CSDD termiņu atgādinājumi Nilam (push) 7, 3 un 1 dienu pirms termiņa.
 * Kalendārs: `data/termini-kalendars.json`. Auth: `Authorization: Bearer CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { cronSecretGate } from "@/lib/cron-bearer";
import { runTerminiReminders } from "@/lib/termini/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json(await runTerminiReminders());
  } catch (e) {
    console.error("[cron/termini-atgadinajumi] failed", e);
    return NextResponse.json({ error: "termini_failed" }, { status: 500 });
  }
}

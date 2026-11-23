/**
 * Automātiskā CSDD maksas izziņa: atvērtie darbi (SMS no rīta / pēc e.csdd pieslēgšanās, izziņas aptauja ik 30 s līdz 30 min).
 * Ik 5 min dienā. Bez darbiem beidz uzreiz. Ar `CSDD_PAID_AUTO_ENABLED` neieslēgtu nekā nedara.
 * Env: `CRON_SECRET` (Vercel Cron).
 */
import { NextResponse } from "next/server";

import { bearerMatchesAnySecret } from "@/lib/cron-bearer";
import { runCsddPaidAutoSweep } from "@/lib/csdd-paid-auto";
import { csddPaidAutoEnabled } from "@/lib/csdd-paid-auto-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const started = Date.now();
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return NextResponse.json({ error: "missing_cron_secret" }, { status: 503 });
  if (!bearerMatchesAnySecret(req.headers.get("authorization"), [secret])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Izslēgts slēdzis aptur arī jau rindā esošos darbus (jauna SMS netiek sūtīta).
  if (!csddPaidAutoEnabled()) return NextResponse.json({ ok: true, disabled: true });
  try {
    const out = await runCsddPaidAutoSweep(started + 280_000);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    console.error("[cron/csdd-paid-auto] failed", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "sweep_failed" }, { status: 500 });
  }
}

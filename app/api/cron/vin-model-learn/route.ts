/**
 * Iknedēļas VIN kodu pašmācība (svētdienās): VIN atmiņa + pasūtījumi -> `vin_memory/_learned.json`.
 * Sk. `lib/vin-model-learn.ts` (2+ sakritības, bez konfliktiem).
 *
 * Env: `CRON_SECRET` (Vercel Cron sūta `Authorization: Bearer …`).
 */
import { NextResponse } from "next/server";

import { bearerMatchesAnySecret } from "@/lib/cron-bearer";
import { runVinModelLearn } from "@/lib/vin-model-learn-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET].map((s) => s?.trim() ?? "").filter(Boolean);
  if (secrets.length === 0) return NextResponse.json({ error: "missing_cron_secret" }, { status: 503 });
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!bearerMatchesAnySecret(auth, secrets)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await runVinModelLearn());
  } catch (err) {
    console.error("[cron vin-model-learn]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

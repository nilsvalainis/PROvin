/**
 * VIN atmiņas papildināšana reizi dienā: izsoļu ielases auto ar īstu VIN (datums + km + avots + modelis)
 * un pasūtījumi ar CSDD modeli. Bez bildēm, bez personas datiem. Sk. `lib/vin-memory.ts`.
 *
 * Env: `CRON_SECRET` (Vercel Cron sūta `Authorization: Bearer …`).
 */
import { NextResponse } from "next/server";

import { bearerMatchesAnySecret } from "@/lib/cron-bearer";
import { runVinMemorySync } from "@/lib/vin-memory-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET].map((s) => s?.trim() ?? "").filter(Boolean);
  if (secrets.length === 0) return NextResponse.json({ error: "missing_cron_secret" }, { status: 503 });
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!bearerMatchesAnySecret(auth, secrets)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const r = await runVinMemorySync();
    return NextResponse.json(r);
  } catch (err) {
    console.error("[cron vin-memory-sync]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

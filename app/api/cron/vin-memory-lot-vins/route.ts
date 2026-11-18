/**
 * Lotu VIN no ielogotām Autobid / Openlane lotes lapām -> VIN atmiņa. Brālis `vin-memory-auction-ingest`:
 * tas saraksta lotes bez VIN ieliek rindā, šis pa mazām partijām prasa relejam `/lot-vins`.
 * Grafiks vercel.json: ik pēc 5 minūtēm, stundās 0-4 UTC. Releja dienas limits: `LISTINGS_LOTVIN_MAX_PER_DAY`.
 *
 * Env: `CRON_SECRET`. Neobligāti `VIN_MEMORY_LOT_VIN_BATCH` (1-12, noklusējums 8).
 */
import { NextResponse } from "next/server";

import { bearerMatchesAnySecret } from "@/lib/cron-bearer";
import { runVinMemoryLotVins } from "@/lib/vin-memory-lot-vins-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET].map((s) => s?.trim() ?? "").filter(Boolean);
  if (secrets.length === 0) return NextResponse.json({ error: "missing_cron_secret" }, { status: 503 });
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!bearerMatchesAnySecret(auth, secrets)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const r = await runVinMemoryLotVins();
    return NextResponse.json(r);
  } catch (err) {
    console.error("[cron vin-memory-lot-vins]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

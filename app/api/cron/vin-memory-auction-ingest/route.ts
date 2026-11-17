/**
 * Masveida Autobid + Openlane -> VIN atmiņa. Brālis `vin-memory-sync`, to neaizstāj.
 *
 * Autobid: publisks GET `https://autobid.de/en/search-results` (bez login), pa dažām lapām.
 * Openlane: esošais sludinājumu relejs (`IRISS_LISTINGS_RELAY_URL` + tokens), pa vienai markai.
 * Grafiks vercel.json: ik pēc 10 minūtēm, stundās 0-4 UTC (ziema aptuveni 02:10-06:50 Europe/Riga),
 * ārpus IRISS sludinājumu sync loga. Kopīgs Openlane dienas limits ar sludinājumiem.
 *
 * Env: `CRON_SECRET`. Neobligāti `VIN_MEMORY_AUCTION_AUTOBID_PAGES` (1-8, noklusējums 3)
 * un `VIN_MEMORY_AUCTION_OPENLANE_PAGES` (1-5, noklusējums 2).
 */
import { NextResponse } from "next/server";

import { bearerMatchesAnySecret } from "@/lib/cron-bearer";
import { runVinMemoryAuctionIngest } from "@/lib/vin-memory-auction-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET].map((s) => s?.trim() ?? "").filter(Boolean);
  if (secrets.length === 0) return NextResponse.json({ error: "missing_cron_secret" }, { status: 503 });
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!bearerMatchesAnySecret(auth, secrets)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const r = await runVinMemoryAuctionIngest();
    return NextResponse.json(r);
  } catch (err) {
    console.error("[cron vin-memory-auction-ingest]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

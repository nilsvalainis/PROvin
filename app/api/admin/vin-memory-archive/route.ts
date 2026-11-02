import { NextResponse } from "next/server";

import { requireAdminOnlyApi } from "@/lib/staff-auth";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { kmRollback, latestKm, isMemoryVin } from "@/lib/vin-memory";
import { deleteVinMemory, readVinMemory } from "@/lib/vin-memory-store";
import { ingestProgress, stateForTick } from "@/lib/vin-memory-auction";
import { deleteAuctionIngestLedger, forgetArchiveCountsCache, readAuctionIngestState, readVinMemoryArchiveCounts } from "@/lib/vin-memory-auction-store";
import { runVinMemoryAuctionIngest } from "@/lib/vin-memory-auction-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Tikai administrators. Darbinieks: 403. */
export async function GET(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const vinRaw = new URL(req.url).searchParams.get("vin") ?? "";
  const vin = normalizeVin(vinRaw);
  if (vinRaw.trim() && !isValidVin(vin)) {
    return NextResponse.json({ error: "Nederīgs VIN." }, { status: 400 });
  }
  if (vin && !isMemoryVin(vin)) {
    return NextResponse.json({ error: "Šādu VIN atmiņā neliek (nav īsts VIN)." }, { status: 400 });
  }
  const now = new Date();
  const [counts, stored] = await Promise.all([readVinMemoryArchiveCounts({ now }), readAuctionIngestState()]);
  const state = stateForTick(stored, now);
  const entry = vin ? await readVinMemory(vin) : null;
  const observations = entry?.observations ?? [];
  return NextResponse.json(
    {
      counts,
      recent: counts?.recent ?? [],
      progress: ingestProgress(state),
      passDay: state.passDay,
      completedDay: state.completedDay,
      updatedAt: stored?.updatedAt ?? null,
      vin,
      observations,
      latest: latestKm(entry ?? undefined),
      rollback: kmRollback(entry ?? undefined),
      vinNote: vin ? (observations.length ? "" : "Mūsu arhīvā par šo VIN ierakstu vēl nav.") : "",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Dzēš vai nu vienu VIN no šķembas (`?vin=`), vai gājiena kursoru un skaitītāju kešu (`?ledger=cursor`). */
export async function DELETE(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  if (url.searchParams.get("ledger") === "cursor") {
    const removed = await deleteAuctionIngestLedger();
    return NextResponse.json(removed, { headers: { "Cache-Control": "no-store" } });
  }
  const vin = normalizeVin(url.searchParams.get("vin") ?? "");
  if (!isMemoryVin(vin)) return NextResponse.json({ error: "Nederīgs VIN." }, { status: 400 });
  const removed = await deleteVinMemory(vin);
  if (removed.removed) await forgetArchiveCountsCache();
  return NextResponse.json(removed, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  try {
    const tick = await runVinMemoryAuctionIngest();
    return NextResponse.json(tick, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin vin-memory-archive]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

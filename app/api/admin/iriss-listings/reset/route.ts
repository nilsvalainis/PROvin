import { NextResponse } from "next/server";
import { readIrissListingsLatestView, saveIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import { requireAdminOnlyApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * Nils 30.10: «Visus vecos sludinājumus, kurus ielasījām no izsolēm pēc vecajiem filtriem, varam dzēst».
 * Notīra tikai ielasīto izsoļu sludinājumu sarakstu (latest.json: Sludinājumi + Pazuduši).
 * Pasūtījumi, saites, piezīmes / favorīti, paslēptie un iepriekšējo nolasījumu momentuzņēmumi paliek.
 * Nākamā nolasīšana ielasa no jauna pēc pašreizējām saitēm.
 */
export async function POST(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  let body: { confirm?: unknown } = {};
  try {
    body = (await req.json()) as { confirm?: unknown };
  } catch {
    /* tukšs */
  }
  if (body.confirm !== "NOTĪRĪT") return NextResponse.json({ error: "confirm_required" }, { status: 400, headers: noStore });
  const view = await readIrissListingsLatestView();
  if (!view) return NextResponse.json({ ok: true, removed: 0 }, { headers: noStore });
  const removed = view.vehicles.length;
  const saved = await saveIrissListingsLatestView({ ...view, vehicles: [] });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500, headers: noStore });
  console.info("[iriss-listings/reset]", { by: gate.actor.name, removed, runId: view.summary.runId });
  return NextResponse.json({ ok: true, removed, keptSnapshot: view.summary.runId }, { headers: noStore });
}

import { NextResponse } from "next/server";
import { parseCreateWaybillInput } from "@/lib/iriss-waybill-create";
import { emptyWaybillRequestsDoc, waybillChatPayload } from "@/lib/iriss-waybill-requests";
import { createWaybillRequest, readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { listWaybillVehicleChips } from "@/lib/iriss-waybill-vehicles";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

async function loadVehiclesSafe() {
  try {
    return await listWaybillVehicleChips();
  } catch (err) {
    console.error("[iriss-waybill] vehicles_failed", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function GET() {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  try {
    const [doc, vehicles] = await Promise.all([readWaybillRequestsDoc(), loadVehiclesSafe()]);
    return NextResponse.json({ ok: true, ...waybillChatPayload(doc), vehicles }, NO_STORE);
  } catch (err) {
    console.error("[iriss-waybill] list_failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: "Neizdevās ielādēt pavadzīmju rindu.",
        ok: false,
        ...waybillChatPayload(emptyWaybillRequestsDoc()),
        vehicles: [],
      },
      { status: 500, ...NO_STORE },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400, ...NO_STORE });
  }
  const parsed = parseCreateWaybillInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, ...NO_STORE });
  }
  const actor = gate.actor;
  const createdBy = actor.kind === "admin" ? "env-admin" : actor.user.id;
  const createdByName = actor.kind === "admin" ? actor.name : actor.user.name;
  try {
    const request = await createWaybillRequest({
      createdBy,
      createdByName,
      payload: parsed.value,
    });
    const doc = await readWaybillRequestsDoc();
    return NextResponse.json(
      { ok: true, request, ...waybillChatPayload(doc) },
      NO_STORE,
    );
  } catch (err) {
    console.error("[iriss-waybill] create_failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Neizdevās nosūtīt pavadzīmes pieprasījumu." },
      { status: 500, ...NO_STORE },
    );
  }
}

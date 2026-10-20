import { NextResponse } from "next/server";
import { parseCreateWaybillInput } from "@/lib/iriss-waybill-create";
import { waybillChatTimeline } from "@/lib/iriss-waybill-requests";
import { createWaybillRequest, readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { listWaybillVehicleChips } from "@/lib/iriss-waybill-vehicles";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const [doc, vehicles] = await Promise.all([readWaybillRequestsDoc(), listWaybillVehicleChips()]);
  return NextResponse.json(
    {
      ok: true,
      requests: doc.requests,
      events: doc.events,
      timeline: waybillChatTimeline(doc),
      vehicles,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
  const parsed = parseCreateWaybillInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const actor = gate.actor;
  const createdBy = actor.kind === "admin" ? "env-admin" : actor.user.id;
  const createdByName = actor.kind === "admin" ? actor.name : actor.user.name;
  const request = await createWaybillRequest({
    createdBy,
    createdByName,
    payload: parsed.value,
  });
  const doc = await readWaybillRequestsDoc();
  return NextResponse.json(
    { ok: true, request, timeline: waybillChatTimeline(doc), requests: doc.requests, events: doc.events },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

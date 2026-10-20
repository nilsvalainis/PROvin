import { NextResponse } from "next/server";
import { waybillChatTimeline } from "@/lib/iriss-waybill-requests";
import { readWaybillRequestsDoc, retryWaybillRequest } from "@/lib/iriss-waybill-requests-store";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
  if (body.action !== "retry") {
    return NextResponse.json({ error: "Nederīga darbība" }, { status: 400 });
  }
  const actor = gate.actor;
  const actorId = actor.kind === "admin" ? "env-admin" : actor.user.id;
  const actorName = actor.kind === "admin" ? actor.name : actor.user.name;
  const request = await retryWaybillRequest({ id, actorId, actorName });
  if (!request) return NextResponse.json({ error: "Nevar atkārtot šo pieprasījumu." }, { status: 409 });
  const doc = await readWaybillRequestsDoc();
  return NextResponse.json({
    ok: true,
    request,
    timeline: waybillChatTimeline(doc),
    requests: doc.requests,
    events: doc.events,
  });
}

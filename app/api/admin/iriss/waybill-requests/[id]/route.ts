import { NextResponse } from "next/server";
import { waybillAivarsReply, waybillChatPayload } from "@/lib/iriss-waybill-requests";
import { readWaybillRequestsDoc, retryWaybillRequest } from "@/lib/iriss-waybill-requests-store";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  try {
    const doc = await readWaybillRequestsDoc();
    const request = doc.requests.find((row) => row.id === id);
    if (!request) return NextResponse.json({ error: "Nav atrasts." }, { status: 404, ...NO_STORE });
    const events = doc.events.filter((event) => event.requestId === id);
    return NextResponse.json(
      { ok: true, request, events, reply: waybillAivarsReply(request, events) },
      NO_STORE,
    );
  } catch (err) {
    console.error("[iriss-waybill] get_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Neizdevās ielādēt pieprasījumu." }, { status: 500, ...NO_STORE });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400, ...NO_STORE });
  }
  if (body.action !== "retry") {
    return NextResponse.json({ error: "Nederīga darbība" }, { status: 400, ...NO_STORE });
  }
  const actor = gate.actor;
  const actorId = actor.kind === "admin" ? "env-admin" : actor.user.id;
  const actorName = actor.kind === "admin" ? actor.name : actor.user.name;
  try {
    const request = await retryWaybillRequest({ id, actorId, actorName });
    if (!request) return NextResponse.json({ error: "Nevar atkārtot šo pieprasījumu." }, { status: 409, ...NO_STORE });
    const doc = await readWaybillRequestsDoc();
    return NextResponse.json({
      ok: true,
      request,
      reply: waybillAivarsReply(request, doc.events),
      ...waybillChatPayload(doc),
    }, NO_STORE);
  } catch (err) {
    console.error("[iriss-waybill] retry_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Neizdevās atkārtot pieprasījumu." }, { status: 500, ...NO_STORE });
  }
}

import { NextResponse, after } from "next/server";
import { wakeAivars } from "@/lib/iriss-aivars-wake";
import {
  waybillAivarsReply,
  waybillChatPayload,
  waybillDocWithoutOrders,
  waybillRequestDismissable,
  waybillRequestWithoutOrder,
} from "@/lib/iriss-waybill-requests";
import { dismissWaybillRequestForActor } from "@/lib/iriss-waybill-dismissed-store";
import { cancelWaybillRequest, readWaybillRequestsDoc, retryWaybillRequest } from "@/lib/iriss-waybill-requests-store";
import { waybillAutoContext } from "@/lib/iriss-waybill-auto-server";
import { canSeeWaybillOrders } from "@/lib/iriss-pavadzimes-list";
import { isWaybillOnlyActor, requireIrissSectionApi, waybillOnlyForbidden, waybillPdfViewer } from "@/lib/staff-auth";
import { withWaybillPdfAccess } from "@/lib/iriss-waybill-pdf";
import { ensureWaybillRequestInDropbox } from "@/lib/iriss-waybill-dropbox";

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
    if (!request) return NextResponse.json({ error: "Pieprasījums nav atrasts." }, { status: 404, ...NO_STORE });
    const events = doc.events.filter((event) => event.requestId === id);
    return NextResponse.json(
      {
        ok: true,
        request: canSeeWaybillOrders(gate.actor) ? request : waybillRequestWithoutOrder(request),
        events,
        reply: withWaybillPdfAccess({ requests: [request], replies: [waybillAivarsReply(request, events)] }, waybillPdfViewer(gate.actor))
          .replies[0],
      },
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
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400, ...NO_STORE });
  }
  if (body.action !== "retry" && body.action !== "cancel" && body.action !== "dropbox" && body.action !== "dismiss") {
    return NextResponse.json({ error: "Nederīga darbība." }, { status: 400, ...NO_STORE });
  }
  const actor = gate.actor;
  const viewer = waybillPdfViewer(actor);
  if (body.action === "dropbox") {
    // "Saglabāt Dropbox vēlreiz": tikai admins / darbinieks ar pilnu pavadzīmju piekļuvi (ne kolēģis).
    if (isWaybillOnlyActor(actor)) return waybillOnlyForbidden();
    try {
      const result = await ensureWaybillRequestInDropbox(id);
      if (!result) return NextResponse.json({ error: "Tikai izdotai pavadzīmei." }, { status: 409, ...NO_STORE });
      const doc = await readWaybillRequestsDoc();
      const auto = await waybillAutoContext(doc);
      const withOrders = canSeeWaybillOrders(actor);
      return NextResponse.json(
        {
          ok: result.ok,
          dropboxPath: result.ok ? result.path : "",
          error: result.ok ? "" : result.error,
          ...withWaybillPdfAccess(waybillChatPayload(withOrders ? doc : waybillDocWithoutOrders(doc), Date.now(), auto), viewer),
          autoMode: auto.mode,
        },
        { status: result.ok ? 200 : 502, ...NO_STORE },
      );
    } catch (err) {
      console.error("[iriss-waybill] dropbox_retry_failed", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Neizdevās saglabāt Dropbox." }, { status: 500, ...NO_STORE });
    }
  }
  const actorId = actor.kind === "admin" ? "env-admin" : actor.user.id;
  const actorName = actor.kind === "admin" ? actor.name : actor.user.name;
  if (body.action === "dismiss") {
    // "Dzēst" (j22): tikai paslēpj vecu ierakstu šī lietotāja sarakstā. Rindu, PDF, Dropbox un Arhīvu neaiztiek;
    // derīgu izdotu vai darbā esošu pavadzīmi nepaslēpj (un nekad neanulē).
    try {
      const doc = await readWaybillRequestsDoc();
      const request = doc.requests.find((row) => row.id === id);
      if (!request) return NextResponse.json({ error: "Pieprasījums nav atrasts." }, { status: 404, ...NO_STORE });
      if (!waybillRequestDismissable(request, doc.requests)) {
        return NextResponse.json(
          { error: "Dzēst var tikai vecu ierakstu. Derīga vai darbā esoša pavadzīme paliek sarakstā." },
          { status: 409, ...NO_STORE },
        );
      }
      const dismissedIds = await dismissWaybillRequestForActor(actorId, id);
      return NextResponse.json({ ok: true, dismissedIds }, NO_STORE);
    } catch (err) {
      console.error("[iriss-waybill] dismiss_failed", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Neizdevās noņemt ierakstu." }, { status: 500, ...NO_STORE });
    }
  }
  if (body.action === "cancel") {
    // Tikai Gaida un vēl nepaņemts; izdotas/aktīvas pavadzīmes un darbā esošus nekad neaiztiek (409).
    try {
      const result = await cancelWaybillRequest({ id, actorId, actorName });
      if (!result.ok) {
        return result.reason === "not_found"
          ? NextResponse.json({ error: "Pieprasījums nav atrasts." }, { status: 404, ...NO_STORE })
          : NextResponse.json(
              { error: "Atcelt var tikai pieprasījumu, ko vēl neviens nav sācis." },
              { status: 409, ...NO_STORE },
            );
      }
      const doc = await readWaybillRequestsDoc();
      const auto = await waybillAutoContext(doc);
      const withOrders = canSeeWaybillOrders(actor);
      return NextResponse.json(
        {
          ok: true,
          request: withOrders ? result.request : waybillRequestWithoutOrder(result.request),
          reply: waybillAivarsReply(result.request, doc.events),
          ...withWaybillPdfAccess(waybillChatPayload(withOrders ? doc : waybillDocWithoutOrders(doc), Date.now(), auto), viewer),
          autoMode: auto.mode,
        },
        NO_STORE,
      );
    } catch (err) {
      console.error("[iriss-waybill] cancel_failed", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Neizdevās atcelt pieprasījumu." }, { status: 500, ...NO_STORE });
    }
  }
  try {
    const request = await retryWaybillRequest({ id, actorId, actorName });
    if (!request) return NextResponse.json({ error: "Šo pieprasījumu nevar atkārtot." }, { status: 409, ...NO_STORE });
    after(() => wakeAivars(request.id));
    const doc = await readWaybillRequestsDoc();
    const withOrders = canSeeWaybillOrders(actor);
    return NextResponse.json({
      ok: true,
      request: withOrders ? request : waybillRequestWithoutOrder(request),
      reply: waybillAivarsReply(request, doc.events),
      ...withWaybillPdfAccess(waybillChatPayload(withOrders ? doc : waybillDocWithoutOrders(doc)), viewer),
    }, NO_STORE);
  } catch (err) {
    console.error("[iriss-waybill] retry_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Neizdevās atkārtot pieprasījumu." }, { status: 500, ...NO_STORE });
  }
}

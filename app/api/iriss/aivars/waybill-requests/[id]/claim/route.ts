import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import {
  AUTO_WAYBILL_WORKER,
  autoWaybillEnabled,
  autoWaybillReplaceEnabled,
  classifyWaybillForAuto,
  plateTakenByOtherRequest,
} from "@/lib/iriss-waybill-auto";
import { busyWaybillPlatesNow } from "@/lib/iriss-waybill-auto-server";
import { claimWaybillRequest } from "@/lib/iriss-waybill-requests-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function readWorker(req: Request): Promise<string> {
  try {
    const body = (await req.json()) as { worker?: unknown };
    return body?.worker === AUTO_WAYBILL_WORKER ? AUTO_WAYBILL_WORKER : "";
  } catch {
    return "";
  }
}

export async function POST(req: Request, ctx: Ctx) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const worker = await readWorker(req);
  let request;
  if (worker === AUTO_WAYBILL_WORKER) {
    // Automātika drīkst paņemt tikai standarta darbu (pārbaude zem slēdzenes, ar svaigu numuru aizņemtību
    // un citiem darbiem ar to pašu numuru - nekādu dublikātu).
    if (!autoWaybillEnabled()) return NextResponse.json({ error: "auto_disabled" }, { status: 409 });
    const isBusy = await busyWaybillPlatesNow();
    request = await claimWaybillRequest(
      id,
      AUTO_WAYBILL_WORKER,
      (current, doc) =>
        classifyWaybillForAuto(current, {
          plateBusyNow: isBusy(current.vehicle.plate),
          plateInOtherRequest: plateTakenByOtherRequest(doc.requests, current),
          replaceEnabled: autoWaybillReplaceEnabled(),
        }).standard,
    );
    if (!request) return NextResponse.json({ error: "not_standard_or_claimed" }, { status: 409 });
  } else {
    request = await claimWaybillRequest(id);
    if (!request) return NextResponse.json({ error: "already_claimed" }, { status: 409 });
  }
  return NextResponse.json(
    { ok: true, request: toAivarsCreateWaybillAction(request), status: request.status, pickedAt: request.pickedAt },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

import { NextResponse } from "next/server";
import { isAutoparksStage } from "@/lib/iriss-autoparks";
import { autoparksActor, autoparksHidesSums, autoparksRoomForActor } from "@/lib/iriss-autoparks-access";
import { parseAutoparksCarInput } from "@/lib/iriss-autoparks-input";
import {
  addAutoparksNote,
  deleteAutoparksCar,
  getAutoparksRoom,
  patchAutoparksCar,
  replaceAutoparksWork,
  setAutoparksArchived,
} from "@/lib/iriss-autoparks-store";
import { evaluateCabinetAccess } from "@/lib/iriss-logistics-cabinet-access";
import { listCabinetAccessRules, listLiveCabinetDocuments } from "@/lib/iriss-logistics-cabinet-store";
import { irissLogisticsScopeHeader, logisticsCabinetAccessQuery, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Loģistikas kabineta dokumenti (iegāde, pickup, CMR) redzami istabā tikai lasīšanai. */
async function logisticsDocs(actor: Parameters<typeof logisticsCabinetAccessQuery>[0], orderId: string) {
  if (!orderId) return [];
  const [docs, rules] = await Promise.all([listLiveCabinetDocuments(orderId), listCabinetAccessRules()]);
  const query = logisticsCabinetAccessQuery(actor, orderId);
  return docs
    .filter((d) => evaluateCabinetAccess({ ...query, section: d.section, docType: d.type }, rules))
    .map((d) => ({ id: d.id, title: d.title, section: d.section, typeLabel: d.typeLabel, hasFile: Boolean(d.blobPath), sourceUrl: d.sourceUrl, createdAt: d.createdAt }));
}

async function roomResponse(gate: { actor: Parameters<typeof logisticsCabinetAccessQuery>[0] }, id: string) {
  const room = await getAutoparksRoom(id);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const hide = autoparksHidesSums(gate.actor);
  return NextResponse.json(
    {
      ok: true,
      room: autoparksRoomForActor(room, hide),
      logisticsDocs: await logisticsDocs(gate.actor, room.car.orderId),
      hideSums: hide,
      canWrite: logisticsCabinetWriteForbidden(gate.actor) === null,
    },
    { headers: irissLogisticsScopeHeader() },
  );
}

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  return roomResponse(gate, id);
}

/** Vienā PATCH: auto lauki/statuss, jauna piezīme (`note`) vai visa tāme (`work`). Atbildē - visa istaba. */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const actor = autoparksActor(gate.actor);
  const hide = autoparksHidesSums(gate.actor);
  const room = await getAutoparksRoom(id);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });

  if (body.car && typeof body.car === "object") {
    const patch = parseAutoparksCarInput(body.car as Record<string, unknown>, hide);
    if (Object.keys(patch).length > 0) await patchAutoparksCar(id, patch, actor);
  }
  if (typeof body.archived === "boolean") await setAutoparksArchived(id, body.archived, actor);
  if (body.note && typeof body.note === "object") {
    const note = body.note as Record<string, unknown>;
    const text = typeof note.text === "string" ? note.text : "";
    if (text.trim()) await addAutoparksNote(id, isAutoparksStage(note.stage) ? note.stage : "service", text, actor);
  }
  if (Array.isArray(body.work)) {
    const prevPrice = new Map(room.work.map((w) => [w.id, w.priceEur]));
    const rows = body.work.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const r = raw as Record<string, unknown>;
      const price = typeof r.priceEur === "number" && Number.isFinite(r.priceEur) ? r.priceEur : null;
      const rid = typeof r.id === "string" ? r.id : "";
      return [
        {
          id: rid,
          title: typeof r.title === "string" ? r.title : "",
          qty: typeof r.qty === "number" ? r.qty : 1,
          // Kas neredz summas, tas tās arī nemaina.
          priceEur: hide ? (prevPrice.get(rid) ?? null) : price,
          done: r.done === true,
        },
      ];
    });
    await replaceAutoparksWork(id, rows);
  }
  return roomResponse(gate, id);
}

/** Dzēst auto ar visu istabu (piem. demo auto). Tikai ar rakstīšanas tiesībām. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
  const ok = await deleteAutoparksCar(id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true }, { headers: irissLogisticsScopeHeader() });
}

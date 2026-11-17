import { after, NextResponse } from "next/server";
import { snapshotIrissWaybill } from "@/lib/admin-change-history";
import { recordAdminChangeHistory } from "@/lib/admin-change-history-store";
import { ADMIN_SEARCH_OPERATOR_TENANT } from "@/lib/admin-global-search";
import { wakeAivars } from "@/lib/iriss-aivars-wake";
import { computeWaybillLifecycles } from "@/lib/iriss-pavadzimes-lifecycle";
import { isSafeIrissPavadzimeId } from "@/lib/iriss-pavadzimes-parse";
import { getIrissPavadzime } from "@/lib/iriss-pavadzimes-store";
import { readCsddPlatesDocSafe } from "@/lib/iriss-waybill-csdd-plates-store";
import { waybillWithdrawn } from "@/lib/iriss-waybill-plates";
import { pendingWaybillRequestForPlate } from "@/lib/iriss-waybill-requests";
import { queueWaybillStop, readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { decideWaybillStop, isWaybillCsddNo, normalizeWaybillCsddNo } from "@/lib/iriss-waybill-stop";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPavadzimeId(id)) return NextResponse.json({ error: "Nederīgs identifikators." }, { status: 400, ...NO_STORE });
  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400, ...NO_STORE });
  }
  if (body.action !== "stop") {
    return NextResponse.json({ error: "Nederīga darbība." }, { status: 400, ...NO_STORE });
  }

  try {
    const rec = await getIrissPavadzime(id);
    if (!rec) return NextResponse.json({ error: "Pavadzīme nav atrasta." }, { status: 404, ...NO_STORE });
    const number = normalizeWaybillCsddNo(rec.number);
    if (!isWaybillCsddNo(number)) {
      return NextResponse.json({ error: "Šo pavadzīmi nevar pārtraukt (nav CSDD numura)." }, { status: 409, ...NO_STORE });
    }

    const [csdd, doc] = await Promise.all([readCsddPlatesDocSafe(), readWaybillRequestsDoc()]);
    const lifecycle = computeWaybillLifecycles([rec], new Date(), csdd).get(rec)?.lifecycle;
    const pending = pendingWaybillRequestForPlate(doc.requests, rec.plate);
    const decision = decideWaybillStop({
      number,
      plate: rec.plate,
      lifecycle,
      withdrawn: waybillWithdrawn(rec, csdd),
      pending: pending
        ? { id: pending.id, kind: pending.kind, stopWaybillNo: pending.stopWaybillNo, plate: pending.vehicle.plate }
        : null,
    });

    if (decision.action === "already_stopped") {
      return NextResponse.json({ ok: true, already: true, id }, NO_STORE);
    }
    if (decision.action === "not_active" || decision.action === "invalid_number") {
      return NextResponse.json({ error: "Šo pavadzīmi nevar pārtraukt." }, { status: 409, ...NO_STORE });
    }
    if (decision.action === "conflict") {
      return NextResponse.json(
        { error: "Šim numuram jau ir pieprasījums, kas vēl tiek izrakstīts. Pagaidi vai atcel to.", pending: true, pendingId: decision.pendingId },
        { status: 409, ...NO_STORE },
      );
    }

    const actor = gate.actor;
    const createdBy = actor.kind === "admin" ? "env-admin" : actor.user.id;
    const createdByName = actor.kind === "admin" ? actor.name : actor.user.name;
    const queued = await queueWaybillStop({
      createdBy,
      createdByName,
      waybillNo: number,
      plate: rec.plate,
      brandModel: rec.brandModel,
      vin: rec.vin,
      validFrom: rec.issuedAt,
      validUntil: rec.validUntil,
    });
    if (!queued.ok) {
      if (queued.reason === "invalid_number") {
        return NextResponse.json({ error: "Šo pavadzīmi nevar pārtraukt (nav CSDD numura)." }, { status: 409, ...NO_STORE });
      }
      return NextResponse.json(
        {
          error: "Šim numuram jau ir pieprasījums, kas vēl tiek izrakstīts. Pagaidi vai atcel to.",
          pending: true,
          pendingId: queued.pending.id,
        },
        { status: 409, ...NO_STORE },
      );
    }

    if (!queued.alreadyQueued) {
      after(() => wakeAivars(queued.request.id));
      const snap = snapshotIrissWaybill(rec);
      await recordAdminChangeHistory({
        kind: "iriss-waybill",
        recordId: rec.id,
        tenantId: ADMIN_SEARCH_OPERATOR_TENANT,
        before: snap,
        after: { ...snap, stopRequested: number },
        by: createdByName || createdBy,
        action: "save",
      }).catch((err) => {
        console.error("[iriss-waybill] stop_history_failed", err instanceof Error ? err.message : err);
      });
    }

    return NextResponse.json(
      {
        ok: true,
        already: false,
        alreadyQueued: queued.alreadyQueued,
        id,
        requestId: queued.request.id,
        waybillNo: number,
      },
      NO_STORE,
    );
  } catch (err) {
    console.error("[iriss-waybill] stop_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Neizdevās pārtraukt pavadzīmi." }, { status: 500, ...NO_STORE });
  }
}

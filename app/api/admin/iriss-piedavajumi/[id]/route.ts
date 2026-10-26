import { NextResponse } from "next/server";
import {
  appendIrissPdHistory,
  applyIrissPdAction,
  applyIrissPdPatch,
  findIrissPdTakenConflict,
  irissPdConflictMessage,
  isIrissPdEditable,
  type IrissPdAction,
  type IrissPdPatch,
} from "@/lib/iriss-piedavajumi";
import { importIrissPdFromAutoparks, importIrissPdFromLink } from "@/lib/iriss-piedavajumi-create";
import { applyIrissPdImportData, type IrissPdImport } from "@/lib/iriss-piedavajumi-import";
import { irissPdLinkErrorLv } from "@/lib/iriss-piedavajumi-sources";
import { runIrissPdApprovalEffects } from "@/lib/iriss-piedavajumi-approve";
import { claimIrissPdDecision, deleteIrissPd, listIrissPdRows, newIrissPdToken, readIrissPd, readIrissPdFresh, writeIrissPd } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";
import { requireAdminOnlyApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// «import» ar izsoles saiti iet caur releju (līdz ~2,5 min).
export const maxDuration = 180;

const noStore = { "Cache-Control": "private, no-store" };

type Ctx = { params: Promise<{ id: string }> };

function fail(status: number, error: string, message = "") {
  return NextResponse.json({ ok: false, error, message }, { status, headers: noStore });
}

export async function GET(_req: Request, { params }: Ctx) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  const rec = await readIrissPdFresh(id, Date.now());
  if (!rec) return fail(404, "not_found");
  return NextResponse.json({ ok: true, record: rec }, { headers: noStore });
}

/** PATCH - lauku labojumi (auto dati, cena, termiņš, klients, iekšējais, foto secība, redzamība). */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  let patch: IrissPdPatch;
  try {
    patch = (await req.json()) as IrissPdPatch;
  } catch {
    return fail(400, "invalid_json");
  }
  const nowMs = Date.now();
  const rec = await readIrissPdFresh(id, nowMs);
  if (!rec) return fail(404, "not_found");
  const res = applyIrissPdPatch(rec, patch ?? {}, { by: gate.actor.name || "Admins", at: new Date(nowMs).toISOString(), nowMs });
  if (!res.ok) return fail(409, "rejected", res.error);
  if (res.record !== rec && !(await writeIrissPd(res.record))) return fail(500, "write_failed", "Neizdevās saglabāt.");
  return NextResponse.json({ ok: true, record: res.record }, { headers: noStore });
}

/**
 * POST { action } - send | revert | decline | approve (ar roku, piem. klients apstiprināja pa tālruni)
 * | create-order (apstiprinātam, ja pasūtījums automātiski neizveidojās).
 */
export async function POST(req: Request, { params }: Ctx) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  let body: { action?: unknown; kind?: unknown; carId?: unknown; url?: unknown; manual?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail(400, "invalid_json");
  }
  const action = String(body.action ?? "");
  const nowMs = Date.now();
  const at = new Date(nowMs).toISOString();
  const by = gate.actor.name || "Admins";
  const rec = await readIrissPdFresh(id, nowMs);
  if (!rec) return fail(404, "not_found");

  if (action === "create-order") {
    if (rec.status !== "approved" || rec.approvedOrderId) return fail(409, "rejected", "Pasūtījums jau ir vai piedāvājums nav apstiprināts.");
    const next = await runIrissPdApprovalEffects(rec, { at, by });
    if (!(await writeIrissPd({ ...next, updatedAt: at }))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: next }, { headers: noStore });
  }

  if (action === "import") {
    // «Aizpildīt» pieprasījumu: auto no Autoparka vai izsoles saites ielasa esošajā ierakstā.
    if (!isIrissPdEditable(rec.status)) return fail(409, "rejected", "Šo piedāvājumu vairs nevar labot.");
    let imp: IrissPdImport | null = null;
    if (body.kind === "autoparks") {
      const carId = typeof body.carId === "string" ? body.carId.trim() : "";
      if (!/^[\w-]{1,80}$/.test(carId)) return fail(400, "invalid");
      imp = await importIrissPdFromAutoparks(carId);
      if (!imp) return fail(404, "not_found", "Auto Autoparkā nav atrasts.");
    } else if (body.kind === "link") {
      const res = await importIrissPdFromLink(typeof body.url === "string" ? body.url : "", { manual: body.manual === true });
      if (!res.ok) return fail(res.error === "not_auction_link" ? 400 : 502, res.error, irissPdLinkErrorLv(res.error, res.note));
      imp = res.data;
    } else {
      return fail(400, "invalid_kind");
    }
    const conflict = findIrissPdTakenConflict(await listIrissPdRows(), { sourceRef: imp.sourceRef, source: imp.source, sourceKey: imp.sourceKey, vin: imp.vehicle.vin }, rec.id);
    if (conflict) return fail(409, "taken", irissPdConflictMessage(conflict));
    const next = appendIrissPdHistory({ ...applyIrissPdImportData(rec, imp, at), updatedAt: at }, { at, by, text: imp.historyText });
    if (!(await writeIrissPd(next))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: next, note: imp.note }, { headers: noStore });
  }

  if (!["send", "revert", "decline", "approve"].includes(action)) return fail(400, "invalid_action");
  const res = applyIrissPdAction(rec, action as IrissPdAction, { by, at, nowMs, newToken: newIrissPdToken });
  if (!res.ok) return fail(409, "rejected", res.error);
  let next = res.record;
  if (action === "approve") {
    const claim = await claimIrissPdDecision(id, { decision: "approve", decidedAt: at, contactName: "", contactPhone: "" });
    if (!claim) return fail(500, "write_failed", "Neizdevās saglabāt.");
    if (!claim.won) return fail(409, "rejected", "Klients jau atbildēja - pārlādē lapu.");
    next = await runIrissPdApprovalEffects(next, { at, by });
  }
  if (!(await writeIrissPd(next))) return fail(500, "write_failed", "Neizdevās saglabāt.");
  return NextResponse.json({ ok: true, record: next }, { headers: noStore });
}

/** Dzēš piedāvājumu no krātuves. Publiskā saite pēc tam nesatur saturu. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  const rec = await readIrissPd(id);
  if (!rec) return fail(404, "not_found");
  if (!(await deleteIrissPd(id))) return fail(500, "write_failed", "Neizdevās dzēst.");
  return NextResponse.json({ ok: true }, { headers: noStore });
}

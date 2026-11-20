import { NextResponse } from "next/server";
import {
  appendIrissPdHistory,
  applyIrissPdAction,
  applyIrissPdPatch,
  isIrissPdEditable,
  type IrissPdAction,
  type IrissPdPatch,
} from "@/lib/iriss-piedavajumi";
import { importIrissPdFromAutoparks, importIrissPdFromLink } from "@/lib/iriss-piedavajumi-create";
import { irissPdFactsFromAutoparks } from "@/lib/iriss-piedavajumi-facts";
import { irissPdFillEmpty, irissPdFillFromAutoparks, applyIrissPdImportData, type IrissPdImport } from "@/lib/iriss-piedavajumi-import";
import { irissPdLinkErrorLv } from "@/lib/iriss-piedavajumi-sources";
import { runIrissPdApprovalEffects } from "@/lib/iriss-piedavajumi-approve";
import { applyIrissPdAdminNote, setIrissPdNoteVisibility, setIrissPdQuestionAnswered } from "@/lib/iriss-piedavajumi-messages";
import {
  claimIrissPdDecision,
  clearIrissPdDecision,
  deleteIrissPd,
  newIrissPdToken,
  readIrissPd,
  readIrissPdFresh,
  writeIrissPd,
} from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";
import { IRISS_PD_EQ_SUMMARY_ERROR_LV } from "@/lib/iriss-pd-equipment-summary";
import {
  irissPdForViewer,
  irissPdViewerCanAct,
  irissPdViewerCanDelete,
  irissPdViewerCanEdit,
  irissPdViewerCanUseStock,
  irissPdViewerFromActor,
  sanitizeIrissPdPatchForStaff,
} from "@/lib/iriss-piedavajumi-staff";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// «import» ar izsoles saiti iet caur releju (līdz ~2,5 min).
export const maxDuration = 180;

const noStore = { "Cache-Control": "private, no-store" };

type Ctx = { params: Promise<{ id: string }> };

function fail(status: number, error: string, message = "") {
  return NextResponse.json({ ok: false, error, message }, { status, headers: noStore });
}

const READ_ONLY_LV = "Šo piedāvājumu veidoja cits - to var tikai skatīt.";

/** P4: darbinieks (Pasūtījumi) redz visus PD bez iekšējām summām un avota; labo tikai savus. */
export async function GET(_req: Request, { params }: Ctx) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const viewer = irissPdViewerFromActor(gate.actor);
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  const rec = await readIrissPdFresh(id, Date.now());
  if (!rec) return fail(404, "not_found");
  return NextResponse.json({ ok: true, record: irissPdForViewer(rec, viewer) }, { headers: noStore });
}

/** PATCH - lauku labojumi (auto dati, cena, termiņš, klients, iekšējais, foto secība, redzamība). */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const viewer = irissPdViewerFromActor(gate.actor);
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const nowMs = Date.now();
  const rec = await readIrissPdFresh(id, nowMs);
  if (!rec) return fail(404, "not_found");
  if (!irissPdViewerCanEdit(rec, viewer)) return fail(403, "forbidden", READ_ONLY_LV);
  // Darbinieks nevar mainīt slēptos laukus (iepirkums, izmaksas, komisija, piezīmes, avots) - tie tiek izmesti.
  const patch: IrissPdPatch = viewer.kind === "admin" ? ((raw ?? {}) as IrissPdPatch) : sanitizeIrissPdPatchForStaff(raw, rec);
  const res = applyIrissPdPatch(rec, patch, { by: viewer.name, at: new Date(nowMs).toISOString(), nowMs });
  if (!res.ok) return fail(409, "rejected", res.error);
  if (res.record !== rec && !(await writeIrissPd(res.record))) return fail(500, "write_failed", "Neizdevās saglabāt.");
  return NextResponse.json({ ok: true, record: irissPdForViewer(res.record, viewer) }, { headers: noStore });
}

/**
 * POST { action } - send | revert | decline | approve (ar roku, piem. klients apstiprināja pa tālruni)
 * | reopen (noraidīto atkal dara pieejamu klientam) | note { text } (iekšēja piezīme pie klienta ziņām)
 * | question-answered { messageId, answered } (klienta jautājums atbildēts / atkal neatbildēts)
 * | equipment-summary { force?, confirm? } (komplektācijas kopsavilkums ar AI)
 * | create-order (apstiprinātam, ja pasūtījums automātiski neizveidojās).
 * P4: darbinieks - tikai savam PD un tikai IRISS_PD_STAFF_ACTIONS + piezīmes, jautājumi, kopsavilkums, imports.
 */
const STAFF_EXTRA_ACTIONS = new Set(["import", "fill-from-stock", "note", "note-visibility", "question-answered", "equipment-summary"]);

export async function POST(req: Request, { params }: Ctx) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const viewer = irissPdViewerFromActor(gate.actor);
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  let body: {
    action?: unknown;
    kind?: unknown;
    carId?: unknown;
    url?: unknown;
    manual?: unknown;
    text?: unknown;
    public?: unknown;
    messageId?: unknown;
    answered?: unknown;
    force?: unknown;
    confirm?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail(400, "invalid_json");
  }
  const action = String(body.action ?? "");
  const nowMs = Date.now();
  const at = new Date(nowMs).toISOString();
  const by = viewer.name;
  const rec = await readIrissPdFresh(id, nowMs);
  if (!rec) return fail(404, "not_found");
  if (viewer.kind === "staff") {
    if (!irissPdViewerCanEdit(rec, viewer)) return fail(403, "forbidden", READ_ONLY_LV);
    if (!STAFF_EXTRA_ACTIONS.has(action) && !irissPdViewerCanAct(rec, viewer, action)) return fail(403, "forbidden", "Šo darbību veic administrators.");
  }
  const out = (r: typeof rec) => irissPdForViewer(r, viewer);

  if (action === "create-order") {
    if (rec.status !== "approved" || rec.approvedOrderId) return fail(409, "rejected", "Pasūtījums jau ir vai piedāvājums nav apstiprināts.");
    const next = await runIrissPdApprovalEffects(rec, { at, by });
    if (!(await writeIrissPd({ ...next, updatedAt: at }))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: out(next) }, { headers: noStore });
  }

  if (action === "import") {
    // «Aizpildīt» pieprasījumu: auto no Autoparka vai izsoles saites ielasa esošajā ierakstā.
    if (!isIrissPdEditable(rec.status)) return fail(409, "rejected", "Šo piedāvājumu vairs nevar labot.");
    let imp: IrissPdImport | null = null;
    if (body.kind === "autoparks") {
      if (!irissPdViewerCanUseStock(viewer, "autoparks")) return fail(403, "forbidden", "Nav Autoparka tiesību.");
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
    const applied = applyIrissPdImportData(rec, imp, at);
    // 20.11: no Autoparka - atslēgu skaits un otrais riteņu komplekts (tikai neaiztiktās šablona rindas).
    if (imp.stockFacts) applied.content = { ...applied.content, facts: irissPdFactsFromAutoparks(imp.stockFacts, applied.content.facts) };
    const next = appendIrissPdHistory({ ...applied, updatedAt: at }, { at, by, text: imp.historyText });
    if (!(await writeIrissPd(next))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: out(next), note: imp.note }, { headers: noStore });
  }

  if (action === "fill-from-stock") {
    // Nils 28.10: esošam piedāvājumam no Autoparka aizpilda tikai tukšos laukus (nobraukums, jauda, kārba...).
    if (!isIrissPdEditable(rec.status)) return fail(409, "rejected", "Šo piedāvājumu vairs nevar labot.");
    if (!irissPdViewerCanUseStock(viewer, "autoparks")) return fail(403, "forbidden", "Nav Autoparka tiesību.");
    const m = /^autoparks:([\w-]{1,80})$/.exec(rec.sourceRef);
    if (!m) return fail(400, "invalid_source", "Piedāvājums nav no Autoparka.");
    const imp = await importIrissPdFromAutoparks(m[1]!);
    if (!imp) return fail(404, "not_found", "Auto Autoparkā nav atrasts.");
    const vehicle = irissPdFillFromAutoparks(irissPdFillEmpty(rec.vehicle, imp.vehicle), {});
    const filled = (Object.keys(vehicle) as Array<keyof typeof vehicle>).filter((k) => vehicle[k] !== rec.vehicle[k]).length;
    const next = appendIrissPdHistory({ ...rec, vehicle, updatedAt: at }, { at, by, text: `Papildināts no Autoparka · ${filled} lauki` });
    if (!(await writeIrissPd(next))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: out(next) }, { headers: noStore });
  }

  if (action === "note") {
    // Nils 07.11: atbilde uz klienta jautājumu ir tikai iekšēja piezīme - klientam nekas netiek sūtīts.
    const res = applyIrissPdAdminNote(rec, body.text, { at, by, id: crypto.randomUUID(), public: body.public === true });
    if (!res.ok) return fail(400, "empty", "Ieraksti piezīmi.");
    if (!(await writeIrissPd(res.record))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: out(res.record) }, { headers: noStore });
  }

  if (action === "note-visibility") {
    // Nils 07.11: «Rādīt klientam saitē» esošai atbildei (ziņa klientam netiek sūtīta).
    const res = setIrissPdNoteVisibility(rec, body.messageId, body.public === true, { at, by });
    if (!res.ok) return fail(404, "not_found", "Atbilde nav atrasta.");
    if (res.record !== rec && !(await writeIrissPd(res.record))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: out(res.record) }, { headers: noStore });
  }

  if (action === "question-answered") {
    // Nils 14.11: «Atzīmēt kā atbildētu» / «Atjaunot kā neatbildētu» (klientam nekas netiek sūtīts).
    if (typeof body.answered !== "boolean") return fail(400, "invalid");
    const res = setIrissPdQuestionAnswered(rec, body.messageId, body.answered, { at, by });
    if (!res.ok) return fail(404, "not_found", "Jautājums nav atrasts.");
    if (res.record !== rec && !(await writeIrissPd(res.record))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: out(res.record) }, { headers: noStore });
  }

  if (action === "equipment-summary") {
    // Nils 20.11: komplektācijas kopsavilkums (AI). Bez force - tikai ja nav vai avots mainījies (labotu nekad nepārraksta).
    if (!isIrissPdEditable(rec.status)) return fail(409, "rejected", "Šo piedāvājumu vairs nevar labot.");
    // AI klients tiek ielādēts tikai šai darbībai (pārējās darbības paliek vieglas).
    const { generateIrissPdEquipmentSummary } = await import("@/lib/iriss-pd-equipment-summary-ai");
    const res = await generateIrissPdEquipmentSummary(rec, { force: body.force === true, confirm: body.confirm === true, at });
    if (!res.ok) return fail(res.error === "confirm_required" ? 409 : res.error === "no_source" ? 400 : 502, res.error, IRISS_PD_EQ_SUMMARY_ERROR_LV[res.error]);
    if (!res.generated) return NextResponse.json({ ok: true, record: out(rec) }, { headers: noStore });
    // AI ilgst ~10-40 s - ieraksta svaigāko versiju, maina tikai šo lauku.
    const fresh = (await readIrissPdFresh(id, Date.now())) ?? rec;
    if (fresh.equipmentSummaryLv?.editedByAdmin && body.confirm !== true) return fail(409, "confirm_required", IRISS_PD_EQ_SUMMARY_ERROR_LV.confirm_required);
    const next = appendIrissPdHistory(
      { ...fresh, equipmentSummaryLv: res.summary, updatedAt: at },
      { at, by, text: body.force === true ? "Komplektācijas kopsavilkums pārģenerēts" : "Komplektācijas kopsavilkums sagatavots" },
    );
    if (!(await writeIrissPd(next))) return fail(500, "write_failed", "Neizdevās saglabāt.");
    return NextResponse.json({ ok: true, record: out(next) }, { headers: noStore });
  }

  if (!["send", "revert", "decline", "approve", "reopen"].includes(action)) return fail(400, "invalid_action");
  const res = applyIrissPdAction(rec, action as IrissPdAction, { by, at, nowMs, newToken: newIrissPdToken });
  if (!res.ok) return fail(409, "rejected", res.error);
  let next = res.record;
  if (action === "approve") {
    const claim = await claimIrissPdDecision(id, { decision: "approve", decidedAt: at, contactName: "", contactPhone: "" });
    if (!claim) return fail(500, "write_failed", "Neizdevās saglabāt.");
    if (!claim.won) return fail(409, "rejected", "Klients jau atbildēja - pārlādē lapu.");
    next = await runIrissPdApprovalEffects(next, { at, by });
  }
  if (action === "reopen") {
    // Klienta (vai admina) noraidījums atcelts: lēmuma fails jānoņem, citādi klients nevarētu apstiprināt.
    await clearIrissPdDecision(id);
  }
  if (!(await writeIrissPd(next))) return fail(500, "write_failed", "Neizdevās saglabāt.");
  return NextResponse.json({ ok: true, record: out(next) }, { headers: noStore });
}

/** Dzēš piedāvājumu no krātuves. Publiskā saite pēc tam nesatur saturu. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const viewer = irissPdViewerFromActor(gate.actor);
  const { id } = await params;
  if (!isSafeIrissPdId(id)) return fail(400, "invalid");
  const rec = await readIrissPd(id);
  if (!rec) return fail(404, "not_found");
  if (!irissPdViewerCanDelete(rec, viewer)) return fail(403, "forbidden", "Dzēst var tikai savu piedāvājumu, kas nav apstiprināts.");
  if (!(await deleteIrissPd(id))) return fail(500, "write_failed", "Neizdevās dzēst.");
  return NextResponse.json({ ok: true }, { headers: noStore });
}

import { after, NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { irissOfferLinkRequestIsSameOrigin } from "@/lib/iriss-offer-client-link";
import { appendIrissPdHistory, applyIrissPdAction, buildIrissPdPublicView, IRISS_PD_CLIENT_ACTOR } from "@/lib/iriss-piedavajumi";
import { notifyIrissPdApproved, notifyIrissPdDeclined, notifyIrissPdQuestion, runIrissPdApprovalEffects } from "@/lib/iriss-piedavajumi-approve";
import { applyIrissPdClientDecline, applyIrissPdClientQuestion, irissPdPublicQuestions } from "@/lib/iriss-piedavajumi-messages";
import {
  claimIrissPdDecision,
  clearIrissPdDecision,
  hashIrissPdToken,
  newIrissPdToken,
  readIrissPdByToken,
  readIrissPdDecision,
  readIrissPdFresh,
  writeIrissPd,
} from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdToken, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headersNoStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function hidden() {
  return NextResponse.json({ ok: false }, { status: 404, headers: headersNoStore });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: headersNoStore });
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Pieprasījuma ķermeņa griesti (jautājums līdz 1000 zīmēm + rezerve). */
const MAX_BODY_BYTES = 8 * 1024;

type Action = "approve" | "decline" | "question";

/**
 * Klienta atbilde publiskajā saitē `/p/d/<token>`:
 * - approve: Pasūtījums «Rezervēts» + paziņojums Nilam (Q17: bez labošanas).
 * - decline (Nils 07.11): «Noraidīts», neobligāts iemesls; pēc tam apstiprināt nevar (admins var atjaunot).
 * - question (Nils 07.11): klienta ziņa pie piedāvājuma + paziņojums Nilam; statuss nemainās.
 * Apstiprināt/noraidīt: pirmais lēmums uzvar visās instancēs (`claimIrissPdDecision`).
 */
export async function POST(req: Request) {
  if (!irissOfferLinkRequestIsSameOrigin(req)) return hidden();
  const ipRl = await checkRateLimit(`iriss-pd-respond:${getClientIpFromRequest(req)}`, 20, 10 * 60 * 1000);
  if (!ipRl.ok) return json({ ok: false, error: "rate" }, 429);
  let body: { token?: unknown; action?: unknown; name?: unknown; phone?: unknown; text?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "too_long" }, 413);
    body = JSON.parse(raw) as typeof body;
  } catch {
    return hidden();
  }
  if (!body || typeof body !== "object") return hidden();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!isSafeIrissPdToken(token)) return hidden();
  // Bez `action` - apstiprināšana (vecā klienta forma).
  const action: Action | null = body.action === undefined ? "approve" : body.action === "approve" || body.action === "decline" || body.action === "question" ? body.action : null;
  if (!action) return hidden();
  const tokKey = hashIrissPdToken(token).slice(0, 16);
  const tokRl = await checkRateLimit(`iriss-pd-respond-t:${tokKey}`, 12, 10 * 60 * 1000);
  if (!tokRl.ok) return json({ ok: false, error: "rate" }, 429);
  const found = await readIrissPdByToken(token);
  if (!found) return hidden();
  const nowMs = Date.now();
  const rec = await readIrissPdFresh(found.id, nowMs);
  if (!rec) return hidden();
  const view = buildIrissPdPublicView(rec, "link", nowMs);
  if (view.state === "closed") return json({ ok: false, error: "closed" }, 410);
  const at = new Date(nowMs).toISOString();

  if (action === "question") {
    // Jautājumi: atsevišķs, stingrāks limits (mēstules / netīša atkārtošana).
    const qRl = await checkRateLimit(`iriss-pd-question-t:${tokKey}`, 5, 60 * 60 * 1000);
    if (!qRl.ok) return json({ ok: false, error: "rate" }, 429);
    const res = applyIrissPdClientQuestion(rec, body.text, { at, by: IRISS_PD_CLIENT_ACTOR, id: crypto.randomUUID(), nowMs });
    if (!res.ok) return json({ ok: false, error: res.error }, res.error === "duplicate" ? 409 : 400);
    if (!(await writeIrissPd(res.record))) return json({ ok: false, error: "retry" }, 503);
    const saved = res.record;
    after(() => notifyIrissPdQuestion(saved, res.text));
    return json({ ok: true, state: view.state, questions: irissPdPublicQuestions(saved.messages) });
  }

  if (view.state === "approved") return json({ ok: action === "approve", state: "approved", ...(action === "approve" ? {} : { error: "decided" }) }, action === "approve" ? 200 : 409);
  if (view.state === "declined") return json({ ok: action === "decline", state: "declined", ...(action === "decline" ? {} : { error: "decided" }) }, action === "decline" ? 200 : 409);

  if (action === "decline") return decline(rec, body.text, at);

  const name = clip(body.name, 120);
  const phone = clip(body.phone, 40);
  if (view.needsContact && (name.length < 2 || phone.replace(/\D/g, "").length < 6)) {
    return json({ ok: false, error: "contact" }, 400);
  }
  const claim = await claimIrissPdDecision(rec.id, { decision: "approve", decidedAt: at, contactName: name, contactPhone: phone });
  if (!claim) return json({ ok: false, error: "retry" }, 503);
  if (!claim.won) return lostRace(rec.id, "approve");
  const res = applyIrissPdAction(rec, "approve", { by: IRISS_PD_CLIENT_ACTOR, at, nowMs, newToken: newIrissPdToken });
  if (!res.ok) return json({ ok: false, error: "closed" }, 410);
  let next = res.record;
  if (view.needsContact) {
    // Piedāvājums bija bez klienta: apstiprinātāja kontakts kļūst par klientu (pasūtījumam un sarakstam).
    next = appendIrissPdHistory({ ...next, client: { ...next.client, name, phone } }, { at, by: IRISS_PD_CLIENT_ACTOR, text: `Kontakts: ${name}, ${phone}` });
  }
  next = await runIrissPdApprovalEffects(next, { at, by: IRISS_PD_CLIENT_ACTOR, contactName: name, contactPhone: phone });
  await writeIrissPd(next);
  // E-pasts un push Nilam pēc atbildes klientam (agrāk klients gaidīja ~7 s "Sūta...").
  const notified = next;
  after(() => notifyIrissPdApproved(notified, name));
  return json({ ok: true, state: "approved" });
}

async function decline(rec: IrissPiedavajums, reasonRaw: unknown, at: string) {
  const res = applyIrissPdClientDecline(rec, reasonRaw, { at, by: IRISS_PD_CLIENT_ACTOR, id: crypto.randomUUID() });
  if (!res.ok) return json({ ok: false, error: "closed" }, 410);
  const claim = await claimIrissPdDecision(rec.id, { decision: "decline", decidedAt: at, contactName: "", contactPhone: "" });
  if (!claim) return json({ ok: false, error: "retry" }, 503);
  if (!claim.won) return lostRace(rec.id, "decline");
  if (!(await writeIrissPd(res.record))) {
    // Lēmums nav saglabāts - atbrīvo, lai klients var mēģināt vēlreiz.
    await clearIrissPdDecision(rec.id);
    return json({ ok: false, error: "retry" }, 503);
  }
  const saved = res.record;
  const reason = saved.messages.at(-1)?.kind === "decline" ? saved.messages.at(-1)!.text : "";
  after(() => notifyIrissPdDeclined(saved, reason));
  return json({ ok: true, state: "declined" });
}

/** Cits pieprasījums (otra cilne / dubultklikšķis) jau izlēma: atgriež uzvarējušo stāvokli. */
async function lostRace(id: string, mine: "approve" | "decline") {
  const won = await readIrissPdDecision(id);
  if (!won) return json({ ok: false, error: "retry" }, 503);
  const state = won === "decline" ? "declined" : "approved";
  return won === mine ? json({ ok: true, state }) : json({ ok: false, state, error: "decided" }, 409);
}

import { after, NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { irissOfferLinkRequestIsSameOrigin } from "@/lib/iriss-offer-client-link";
import {
  appendIrissPdHistory,
  applyIrissPdAction,
  applyIrissPdClientDecline,
  applyIrissPdClientQuestion,
  buildIrissPdPublicView,
  IRISS_PD_CLIENT_ACTOR,
} from "@/lib/iriss-piedavajumi";
import {
  notifyIrissPdApproved,
  notifyIrissPdClientDeclined,
  notifyIrissPdClientQuestion,
  runIrissPdApprovalEffects,
} from "@/lib/iriss-piedavajumi-approve";
import {
  claimIrissPdDecision,
  hashIrissPdToken,
  newIrissPdToken,
  readIrissPdByToken,
  readIrissPdDecisionClaim,
  readIrissPdFresh,
  writeIrissPd,
} from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdToken } from "@/lib/iriss-piedavajumi-types";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headersNoStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function hidden() {
  return NextResponse.json({ ok: false }, { status: 404, headers: headersNoStore });
}

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: headersNoStore });
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

type Body = { token?: unknown; action?: unknown; text?: unknown; name?: unknown; phone?: unknown };

/**
 * Klienta atbilde publiskajā piedāvājuma saitē `/p/d/<token>`.
 * Autorizācija: tikai saites tokens (+ tā pati izcelsme, IP un tokena ātruma limits). Nekādu ziņu klientam.
 * - approve (noklusējums): pirmais lēmums uzvar; Pasūtījums «Rezervēts» + iekšējs paziņojums Nilam.
 * - decline: Nosūtīts -> Noraidīts (pirmais lēmums uzvar arī pret apstiprinājumu); iekšējs paziņojums Nilam.
 * - question: jautājums piedāvājuma vēsturē un pasūtījuma laika joslā; statuss nemainās; iekšējs paziņojums Nilam.
 */
export async function POST(req: Request) {
  if (!irissOfferLinkRequestIsSameOrigin(req)) return hidden();
  const ipRl = await checkRateLimit(`iriss-pd-respond:${getClientIpFromRequest(req)}`, 20, 10 * 60 * 1000);
  if (!ipRl.ok) return hidden();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return hidden();
  }
  if (!body || typeof body !== "object") return hidden();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!isSafeIrissPdToken(token)) return hidden();
  const action = body.action == null || body.action === "" ? "approve" : body.action;
  if (action !== "approve" && action !== "decline" && action !== "question") return hidden();
  const tokenKey = hashIrissPdToken(token).slice(0, 16);
  const tokRl = await checkRateLimit(`iriss-pd-respond-t:${tokenKey}`, 12, 10 * 60 * 1000);
  if (!tokRl.ok) return hidden();
  if (action === "question") {
    // Jautājumiem stingrāks limits: 5 stundā vienai saitei.
    const qRl = await checkRateLimit(`iriss-pd-question-t:${tokenKey}`, 5, 60 * 60 * 1000);
    if (!qRl.ok) return reply({ ok: false, error: "limit" }, 429);
  }
  const found = await readIrissPdByToken(token);
  if (!found) return hidden();
  const nowMs = Date.now();
  const rec = await readIrissPdFresh(found.id, nowMs);
  if (!rec) return hidden();
  const at = new Date(nowMs).toISOString();

  if (action === "question") {
    const res = applyIrissPdClientQuestion(rec, { at, nowMs, text: body.text });
    if (!res.ok) {
      if (res.error === "text") return reply({ ok: false, error: "question" }, 400);
      if (res.error === "limit") return reply({ ok: false, error: "limit" }, 429);
      return reply({ ok: false, error: "closed" }, 410);
    }
    if (!(await writeIrissPd(res.record))) return reply({ ok: false, error: "retry" }, 503);
    const saved = res.record;
    const question = saved.clientMessages[saved.clientMessages.length - 1]?.text ?? "";
    after(() => notifyIrissPdClientQuestion(saved, question));
    return reply({ ok: true, state: buildIrissPdPublicView(saved, "link", nowMs).state, question });
  }

  const view = buildIrissPdPublicView(rec, "link", nowMs);

  if (action === "decline") {
    if (view.state === "declined") return reply({ ok: true, state: "declined" });
    if (view.state === "approved") return reply({ ok: false, error: "approved", state: "approved" }, 409);
    if (view.state !== "open") return reply({ ok: false, error: "closed" }, 410);
    const res = applyIrissPdClientDecline(rec, { at, nowMs, reason: body.text });
    if (!res.ok) return reply({ ok: false, error: res.error === "approved" ? "approved" : "closed" }, res.error === "approved" ? 409 : 410);
    const claim = await claimIrissPdDecision(rec.id, { decision: "decline", decidedAt: at, contactName: "", contactPhone: "" });
    if (!claim) return reply({ ok: false, error: "retry" }, 503);
    if (!claim.won) {
      // Cits pieprasījums jau izlēma (piem. apstiprināja citā cilnē).
      const won = await readIrissPdDecisionClaim(rec.id);
      return won === "approve" ? reply({ ok: false, error: "approved", state: "approved" }, 409) : reply({ ok: true, state: "declined" });
    }
    if (!(await writeIrissPd(res.record))) return reply({ ok: false, error: "retry" }, 503);
    const saved = res.record;
    after(() => notifyIrissPdClientDeclined(saved));
    return reply({ ok: true, state: "declined" });
  }

  // approve
  if (view.state === "approved") return reply({ ok: true, state: "approved" });
  if (view.state === "declined") return reply({ ok: false, error: "declined", state: "declined" }, 409);
  if (view.state !== "open") return reply({ ok: false, error: "closed" }, 410);
  const name = clip(body.name, 120);
  const phone = clip(body.phone, 40);
  if (view.needsContact && (name.length < 2 || phone.replace(/\D/g, "").length < 6)) {
    return reply({ ok: false, error: "contact" }, 400);
  }
  const claim = await claimIrissPdDecision(rec.id, { decision: "approve", decidedAt: at, contactName: name, contactPhone: phone });
  if (!claim) return reply({ ok: false, error: "retry" }, 503);
  if (!claim.won) {
    const won = await readIrissPdDecisionClaim(rec.id);
    return won === "decline" ? reply({ ok: false, error: "declined", state: "declined" }, 409) : reply({ ok: true, state: "approved" });
  }
  const res = applyIrissPdAction(rec, "approve", { by: IRISS_PD_CLIENT_ACTOR, at, nowMs, newToken: newIrissPdToken });
  if (!res.ok) return reply({ ok: false, error: "closed" }, 410);
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
  return reply({ ok: true, state: "approved" });
}

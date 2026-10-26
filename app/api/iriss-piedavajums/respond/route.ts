import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { irissOfferLinkRequestIsSameOrigin } from "@/lib/iriss-offer-client-link";
import { appendIrissPdHistory, applyIrissPdAction, buildIrissPdPublicView, IRISS_PD_CLIENT_ACTOR } from "@/lib/iriss-piedavajumi";
import { notifyIrissPdApproved, runIrissPdApprovalEffects } from "@/lib/iriss-piedavajumi-approve";
import { claimIrissPdDecision, hashIrissPdToken, newIrissPdToken, readIrissPdByToken, readIrissPdFresh, writeIrissPd } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdToken } from "@/lib/iriss-piedavajumi-types";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headersNoStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function hidden() {
  return NextResponse.json({ ok: false }, { status: 404, headers: headersNoStore });
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Klients apstiprina piedāvājumu publiskajā saitē (Q17: tikai apstiprināšana, bez labošanas).
 * Pirmais lēmums uzvar; sekas: Pasūtījums «Rezervēts» + paziņojums Nilam.
 */
export async function POST(req: Request) {
  if (!irissOfferLinkRequestIsSameOrigin(req)) return hidden();
  const ipRl = await checkRateLimit(`iriss-pd-respond:${getClientIpFromRequest(req)}`, 20, 10 * 60 * 1000);
  if (!ipRl.ok) return hidden();
  let body: { token?: unknown; name?: unknown; phone?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return hidden();
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!isSafeIrissPdToken(token)) return hidden();
  const tokRl = await checkRateLimit(`iriss-pd-respond-t:${hashIrissPdToken(token).slice(0, 16)}`, 12, 10 * 60 * 1000);
  if (!tokRl.ok) return hidden();
  const found = await readIrissPdByToken(token);
  if (!found) return hidden();
  const nowMs = Date.now();
  const rec = await readIrissPdFresh(found.id, nowMs);
  if (!rec) return hidden();
  const view = buildIrissPdPublicView(rec, "link", nowMs);
  if (view.state === "approved") return NextResponse.json({ ok: true, state: "approved" }, { headers: headersNoStore });
  if (view.state !== "open") return NextResponse.json({ ok: false, error: "closed" }, { status: 410, headers: headersNoStore });
  const name = clip(body.name, 120);
  const phone = clip(body.phone, 40);
  if (view.needsContact && (name.length < 2 || phone.replace(/\D/g, "").length < 6)) {
    return NextResponse.json({ ok: false, error: "contact" }, { status: 400, headers: headersNoStore });
  }
  const at = new Date(nowMs).toISOString();
  const claim = await claimIrissPdDecision(rec.id, { decision: "approve", decidedAt: at, contactName: name, contactPhone: phone });
  if (!claim) return NextResponse.json({ ok: false, error: "retry" }, { status: 503, headers: headersNoStore });
  if (!claim.won) return NextResponse.json({ ok: true, state: "approved" }, { headers: headersNoStore });
  const res = applyIrissPdAction(rec, "approve", { by: IRISS_PD_CLIENT_ACTOR, at, nowMs, newToken: newIrissPdToken });
  if (!res.ok) return NextResponse.json({ ok: false, error: "closed" }, { status: 410, headers: headersNoStore });
  let next = res.record;
  if (view.needsContact) {
    // Piedāvājums bija bez klienta: apstiprinātāja kontakts kļūst par klientu (pasūtījumam un sarakstam).
    next = appendIrissPdHistory({ ...next, client: { ...next.client, name, phone } }, { at, by: IRISS_PD_CLIENT_ACTOR, text: `Kontakts: ${name}, ${phone}` });
  }
  next = await runIrissPdApprovalEffects(next, { at, by: IRISS_PD_CLIENT_ACTOR, contactName: name, contactPhone: phone });
  await writeIrissPd(next);
  await notifyIrissPdApproved(next, name);
  return NextResponse.json({ ok: true, state: "approved" }, { headers: headersNoStore });
}

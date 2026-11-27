/**
 * Klienta saziņas atzīmes: dīlera datu «Sūtīt klientam» žurnāls un Google atsauksmes lūgums.
 * GET ?sessionId= - atzīmes + automātiskā atsauksmes lūguma stāvoklis.
 * POST action: dealer_send | audit_send | review_request | review_queue | review_opt_out | review_settings.
 * Atsauksmes e-pastu automātiski sūta cron (`/api/cron/review-ask`) vai admina poga; WhatsApp tikai atzīmē
 * (ziņu atver admins). `review_opt_out` - «Nelūgt» / «Atcelt».
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getAuditCompletedAtMap } from "@/lib/admin-audit-complete-store";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { resolveOrderClientLang } from "@/lib/email/client-lang-email-copy";
import { decideClientLangForOrder } from "@/lib/client-lang-detect";
import { trySendReviewAskEmail } from "@/lib/email/send-transactional";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { orderCarFromCsdd } from "@/lib/ltab-auto";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import {
  auditSendRecordFromInput,
  isDealerSendChannel,
  isDealerSendSituation,
  withAuditSend,
  withDealerSend,
  withReviewOptOut,
  withReviewRequested,
} from "@/lib/order-client-marks";
import {
  buildReviewAskEmail,
  reviewAskPlannedAt,
  reviewAskPolicyFromDoc,
  reviewCarLabel,
  reviewEmailKey,
  withReviewAsked,
} from "@/lib/review-ask";
import { readReviewAskDoc, readReviewAskEntry, updateReviewAskDoc } from "@/lib/review-ask-store";
import { readOrderClientMarks, updateOrderClientMarks } from "@/lib/order-client-marks-store";
import { isValidOrderEmail } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUEUE_MAX_IDS = 200;

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const [marks, doc] = await Promise.all([readOrderClientMarks(sessionId), readReviewAskDoc().catch(() => null)]);
  const entry = doc?.entries[sessionId] ?? null;
  return NextResponse.json({
    marks,
    reviewSettings: { onlyGreen: reviewAskPolicyFromDoc(doc ?? { settings: {} }).onlyGreen },
    reviewAsk: entry
      ? {
          plannedAt: entry.askedAt ? null : reviewAskPlannedAt(entry.reportSentAt),
          skip: entry.skip ?? null,
          askedAt: entry.askedAt ?? null,
          car: entry.car ?? null,
          lang: entry.lang,
        }
      : null,
  });
}

async function customerEmailFor(
  sessionId: string,
): Promise<{ to: string; vin: string; car: string; lang: ReturnType<typeof resolveOrderClientLang> } | null> {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) return null;
  const draft = await readOrderDraft(sessionId);
  const to =
    [draft?.orderEdits?.customerEmail, order.customerEmail, order.customerDetailsEmail]
      .find((v) => typeof v === "string" && isValidOrderEmail(v.trim()))
      ?.trim() ?? "";
  const vin = [draft?.orderEdits?.vin, order.vin].find((v) => typeof v === "string" && v.trim())?.trim() ?? "";
  const entry = await readReviewAskEntry(sessionId);
  const csddCar = orderCarFromCsdd(mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd, "", vin);
  const car = entry?.car ?? reviewCarLabel(csddCar.make, csddCar.model);
  const lang = entry?.lang ?? decideClientLangForOrder(order, draft).lang;
  return { to, vin, car, lang };
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = String(body.action ?? "");

  if (action === "review_queue") {
    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .filter((v): v is string => typeof v === "string" && isSafeOrderDraftSessionId(v))
      .slice(0, QUEUE_MAX_IDS);
    const completed = await getAuditCompletedAtMap(ids);
    const items = await Promise.all(
      ids.map(async (id) => {
        const completedAt = completed.get(id) ?? null;
        const marks = completedAt ? await readOrderClientMarks(id) : {};
        return { id, completedAt, reviewRequestedAt: marks.reviewRequestedAt ?? null };
      }),
    );
    return NextResponse.json({ items });
  }

  if (action === "review_settings") {
    if (typeof body.onlyGreen !== "boolean") return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
    const onlyGreen = body.onlyGreen;
    try {
      await updateReviewAskDoc((doc) => ({
        value: null,
        next: { ...doc, settings: { ...doc.settings, onlyGreen, updatedAt: new Date().toISOString() } },
      }));
    } catch {
      return NextResponse.json({ error: "store_failed" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, reviewSettings: { onlyGreen } });
  }

  const sessionId = String(body.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  if (action === "review_opt_out") {
    const optOut = body.optOut === true;
    const marks = await updateOrderClientMarks(sessionId, (cur) => withReviewOptOut(cur, optOut, new Date().toISOString()));
    if (!marks) return NextResponse.json({ error: "store_failed" }, { status: 503 });
    return NextResponse.json({ ok: true, marks });
  }

  const channel = body.channel;
  if (!isDealerSendChannel(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  const nowIso = new Date().toISOString();

  if (action === "dealer_send") {
    if (!isDealerSendSituation(body.situation)) {
      return NextResponse.json({ error: "invalid_situation" }, { status: 400 });
    }
    const situation = body.situation;
    const offer = situation === "ready" && body.offer === true;
    const review = situation === "ready" && body.review === true;
    const marks = await updateOrderClientMarks(sessionId, (cur) =>
      withDealerSend(cur, { at: nowIso, channel, situation, offer, review }),
    );
    if (!marks) return NextResponse.json({ error: "store_failed" }, { status: 503 });
    return NextResponse.json({ ok: true, marks });
  }

  // AUDITS «Sūtīt atskaiti» ar WhatsApp: ziņu atver admins, šeit tikai žurnāla ieraksts (e-pastu ieraksta serveris).
  if (action === "audit_send") {
    const lang: ClientReportLang = (CLIENT_REPORT_LANGS as readonly string[]).includes(String(body.lang))
      ? (body.lang as ClientReportLang)
      : "lv";
    const rec = auditSendRecordFromInput(
      { situation: body.situation, consult: body.consult },
      { channel, atIso: nowIso, lang, b2b: body.b2b === true },
    );
    const marks = await updateOrderClientMarks(sessionId, (cur) => withAuditSend(cur, rec));
    if (!marks) return NextResponse.json({ error: "store_failed" }, { status: 503 });
    return NextResponse.json({ ok: true, marks });
  }

  if (action === "review_request") {
    const current = await readOrderClientMarks(sessionId);
    if (current.reviewRequestedAt) {
      return NextResponse.json({ error: "already_requested", marks: current }, { status: 409 });
    }
    if (channel === "email") {
      const who = await customerEmailFor(sessionId);
      if (!who) return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (!who.to) return NextResponse.json({ error: "no_customer_email" }, { status: 400 });
      // Tas pats e-pasts ar pogu «Novērtēt Google», ko sūta automātiski (klienta valodā, ar auto nosaukumu).
      const content = buildReviewAskEmail({ lang: who.lang, car: who.car, vin: who.vin });
      const sent = await trySendReviewAskEmail({ to: who.to, ...content, lang: who.lang });
      if (!sent) return NextResponse.json({ error: "email_failed" }, { status: 502 });
      // Automātiskā rinda: šo pasūtījumu vairs nesūtīt; 60 dienu noteikums skaita arī šo lūgumu.
      await updateReviewAskDoc((doc) => {
        const entry = doc.entries[sessionId];
        const key = reviewEmailKey(who.to);
        return {
          value: null,
          next: {
            ...doc,
            entries: entry ? { ...doc.entries, [sessionId]: withReviewAsked(entry, nowIso) } : doc.entries,
            lastAskByEmail: key ? { ...doc.lastAskByEmail, [key]: { at: nowIso, sessionId } } : doc.lastAskByEmail,
          },
        };
      }).catch(() => null);
    }
    const marks = await updateOrderClientMarks(sessionId, (cur) => withReviewRequested(cur, channel, nowIso));
    if (!marks) return NextResponse.json({ error: "store_failed" }, { status: 503 });
    return NextResponse.json({ ok: true, marks });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

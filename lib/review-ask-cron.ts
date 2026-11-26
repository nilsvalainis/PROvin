import "server-only";

import { getAuditResultColor } from "@/lib/admin-audit-result-color-store";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { readDealerDataJob } from "@/lib/dealer-data-job-store";
import { collectSourceBlockTexts, computeDealerReviewScore } from "@/lib/dealer-review-score";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { isB2bInternationalClientReport } from "@/lib/b2b-pdf-brand";
import { isSmtpConfigured, trySendReviewAskEmail } from "@/lib/email/send-transactional";
import { isOrderCancelledByClientMarks, withReviewRequested } from "@/lib/order-client-marks";
import { readOrderClientMarks, updateOrderClientMarks } from "@/lib/order-client-marks-store";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import {
  buildReviewAskEmail,
  decideReviewAsk,
  isReviewAskDayReached,
  isReviewAskSendWindow,
  pruneReviewAskDoc,
  reviewAskPolicyFromDoc,
  reviewEmailKey,
  reviewIndicatorGreen,
  withReviewAsked,
  withReviewHeld,
  withReviewSkipped,
  type ReviewAskDoc,
  type ReviewAskEntry,
  type ReviewAskOrderFacts,
  type ReviewAskPolicy,
} from "@/lib/review-ask";
import { readReviewAskDoc, updateReviewAskDoc } from "@/lib/review-ask-store";

/** Vienā palaišanā ne vairāk (cron ik stundu darba laikā). */
const MAX_SENDS_PER_RUN = 10;

export type ReviewAskCronResult = {
  ok: boolean;
  skipped?: "disabled" | "outside_window" | "smtp_not_configured";
  asked: number;
  skippedOrders: number;
  failed: number;
};

/** Pasūtījuma fakti sūtīšanas brīdī. `null` - pagaidām nevar nolasīt (mēģinās nākamajā reizē). */
async function loadFacts(entry: ReviewAskEntry, policy: ReviewAskPolicy): Promise<ReviewAskOrderFacts | null> {
  let order: Awaited<ReturnType<typeof getCheckoutSessionDetail>>;
  try {
    order = await getCheckoutSessionDetail(entry.sessionId);
  } catch {
    return null;
  }
  const [draft, marks, color, dealerJob] = await Promise.all([
    readOrderDraft(entry.sessionId).catch(() => null),
    readOrderClientMarks(entry.sessionId),
    policy.onlyGreen ? getAuditResultColor(entry.sessionId).catch(() => null) : Promise.resolve(null),
    policy.onlyGreen ? readDealerDataJob(entry.sessionId).catch(() => null) : Promise.resolve(null),
  ]);
  // Dīlera datiem - «Atsauksmes iespēja» (tas pats aprēķins, ko rāda dīlera kartīte adminā).
  let dealerReviewLevel: "high" | "medium" | "low" | "none" | null = null;
  if (dealerJob) {
    try {
      const blocks = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {});
      dealerReviewLevel = computeDealerReviewScore({
        autoRecords: blocks.auto_records,
        job: dealerJob,
        vin: entry.vin ?? null,
        context: { extraTexts: collectSourceBlockTexts(draft?.workspace?.sourceBlocks ?? {}) },
        nowMs: Date.now(),
      }).level;
    } catch {
      dealerReviewLevel = null;
    }
  }
  const notes = draft?.orderEdits?.notes || order?.notes || "";
  const email =
    [draft?.orderEdits?.customerEmail, order?.customerEmail, order?.customerDetailsEmail, entry.email]
      .find((v) => typeof v === "string" && isValidOrderEmail(v.trim()))
      ?.trim() ?? "";
  const b2b =
    !order ||
    order.isDemo === true ||
    order.auditPurpose === "internal" ||
    isB2bInternationalClientReport({ notes, partnerId: order.partnerId, partnerCompanyName: order.companyName });
  return {
    b2b,
    refunded: (order?.paymentAdjustment?.clawbackCents ?? 0) > 0,
    cancelled: !order || isOrderCancelledByClientMarks(marks),
    optOut: Boolean(marks.reviewOptOutAt),
    email,
    otherAskAt: marks.reviewRequestedAt ?? null,
    indicatorGreen: policy.onlyGreen ? reviewIndicatorGreen({ auditResultColor: color, dealerReviewLevel }) : null,
  };
}

/** Lēts priekšfiltrs pirms pasūtījuma ielasīšanas. */
function maybeDue(entry: ReviewAskEntry, nowMs: number): boolean {
  if (entry.doneAt || entry.askedAt) return false;
  return Boolean(entry.claimAt) || isReviewAskDayReached(entry.reportSentAt, nowMs);
}

async function recordAskOnOrder(sessionId: string, atIso: string): Promise<void> {
  await updateOrderClientMarks(sessionId, (cur) =>
    cur.reviewRequestedAt ? cur : withReviewRequested(cur, "email", atIso),
  ).catch(() => null);
}

function withLastAsk(doc: ReviewAskDoc, email: string, sessionId: string, atIso: string): ReviewAskDoc["lastAskByEmail"] {
  const key = reviewEmailKey(email);
  return key ? { ...doc.lastAskByEmail, [key]: { at: atIso, sessionId } } : doc.lastAskByEmail;
}

/**
 * Cron (ik stundu darba dienās): nākamajā dienā pēc atskaites - viens lūgums. Atgādinājuma nav.
 * Idempotents: pirms sūtīšanas ieraksts tiek «aizņemts» ar CAS; pēc sūtīšanas - pabeigts. Neskaidrs gadījums = nesūta.
 */
export async function runReviewAskCron(nowMs = Date.now()): Promise<ReviewAskCronResult> {
  const result: ReviewAskCronResult = { ok: true, asked: 0, skippedOrders: 0, failed: 0 };
  if (process.env.REVIEW_ASK_AUTO_DISABLED?.trim() === "1") return { ...result, skipped: "disabled" };
  if (!isReviewAskSendWindow(nowMs)) return { ...result, skipped: "outside_window" };
  if (!isSmtpConfigured()) return { ...result, skipped: "smtp_not_configured" };
  const doc = await readReviewAskDoc();
  const policy = reviewAskPolicyFromDoc(doc);
  const due = Object.values(doc.entries)
    .filter((e) => maybeDue(e, nowMs))
    .sort((a, b) => Date.parse(a.reportSentAt) - Date.parse(b.reportSentAt));

  let sends = 0;
  for (const snapshot of due) {
    if (sends >= MAX_SENDS_PER_RUN) break;
    const facts = await loadFacts(snapshot, policy);
    if (!facts) continue;
    const nowIso = new Date(nowMs).toISOString();

    // Lēmums un «aizņemšana» vienā CAS solī (svaigs dokuments - otrs cron to pašu nepaņems).
    const claimed = await updateReviewAskDoc<ReviewAskEntry | null>((cur) => {
      const entry = cur.entries[snapshot.sessionId];
      if (!entry) return { value: null };
      const decision = decideReviewAsk(entry, facts, cur, nowMs, policy);
      if (decision.kind === "skip") {
        const next = withReviewSkipped(entry, decision.reason, nowIso);
        const lastAskByEmail =
          decision.reason === "stale_claim" && entry.claimAt
            ? withLastAsk(cur, facts.email || entry.email, entry.sessionId, entry.claimAt)
            : cur.lastAskByEmail;
        result.skippedOrders += 1;
        return { value: null, next: { ...cur, entries: { ...cur.entries, [entry.sessionId]: next }, lastAskByEmail } };
      }
      if (decision.kind === "hold") {
        const held = withReviewHeld(entry, decision.reason);
        if (held === entry) return { value: null };
        return { value: null, next: { ...cur, entries: { ...cur.entries, [entry.sessionId]: held } } };
      }
      if (decision.kind !== "send") return { value: null };
      return {
        value: entry,
        next: { ...cur, entries: { ...cur.entries, [entry.sessionId]: { ...entry, claimAt: nowIso } } },
      };
    });
    if (!claimed) {
      if (snapshot.claimAt) await recordAskOnOrder(snapshot.sessionId, snapshot.claimAt);
      continue;
    }

    sends += 1;
    const content = buildReviewAskEmail({ lang: claimed.lang, car: claimed.car, vin: claimed.vin });
    const ok = await trySendReviewAskEmail({ to: facts.email, ...content, lang: claimed.lang });

    await updateReviewAskDoc((cur) => {
      const e = cur.entries[claimed.sessionId];
      if (!e) return { value: null };
      if (!ok) {
        const { claimAt: _c, ...released } = e;
        void _c;
        return { value: null, next: { ...cur, entries: { ...cur.entries, [e.sessionId]: released } } };
      }
      return {
        value: null,
        next: {
          ...cur,
          entries: { ...cur.entries, [e.sessionId]: withReviewAsked(e, nowIso) },
          lastAskByEmail: withLastAsk(cur, facts.email, e.sessionId, nowIso),
        },
      };
    }).catch((err) => console.error("[review-ask] mark failed", claimed.sessionId, err instanceof Error ? err.message : err));

    if (!ok) {
      result.failed += 1;
      continue;
    }
    await recordAskOnOrder(claimed.sessionId, nowIso);
    result.asked += 1;
  }

  await updateReviewAskDoc((cur) => {
    const pruned = pruneReviewAskDoc(cur, nowMs);
    const changed =
      Object.keys(pruned.entries).length !== Object.keys(cur.entries).length ||
      Object.keys(pruned.lastAskByEmail).length !== Object.keys(cur.lastAskByEmail).length;
    return changed ? { value: null, next: pruned } : { value: null };
  }).catch(() => null);

  if (result.failed > 0) result.ok = false;
  return result;
}

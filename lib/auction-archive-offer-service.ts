import "server-only";

import type { ClientReportLang } from "@/lib/client-report-i18n";
import { resolveOrderClientLang } from "@/lib/email/client-lang-email-copy";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { sendAdminPush } from "@/lib/admin-push";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  applyAuctionArchiveChoice,
  auctionArchiveAbsoluteUrl,
  auctionArchiveAdminNotice,
  auctionArchivePreviewPath,
  buildAuctionArchiveSummary,
  formatEurCents,
  isAuctionArchiveClientReminderAllowed,
  isAuctionArchiveReminderDue,
  markAuctionArchiveClientReminded,
  markAuctionArchiveRefunded,
  markAuctionArchiveReminded,
  type AuctionArchiveChannel,
  type AuctionArchiveChoice,
  type AuctionArchiveChoiceVia,
  type AuctionArchiveManualSource,
  type AuctionArchiveOfferDoc,
  type AuctionArchiveSummary,
} from "@/lib/auction-archive-offer";
import {
  collectAuctionArchivePhotoSources,
  defaultAuctionArchivePreviewIds,
  persistAuctionArchivePhotos,
  writeAuctionArchivePreviews,
} from "@/lib/auction-archive-offer-photos";
import {
  createAuctionArchiveOffer,
  issueAuctionArchiveReminder,
  listAuctionArchiveOfferSessionIds,
  readAuctionArchiveOffer,
  updateAuctionArchiveOffer,
} from "@/lib/auction-archive-offer-store";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { trySendAuctionArchiveClientEmail, trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import {
  auctionArchiveOfferEmailHtml,
  auctionArchiveOfferPlainText,
  auctionArchiveReminderSubject,
  auctionArchiveReminderText,
  auctionArchiveReminderWhatsappText,
} from "@/lib/email/auction-archive-email";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { getAdminOrderNotifyEmail } from "@/lib/notify";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { countryName } from "@/lib/thecarapi-i18n-lv";
import { resolveVehicleDisplayName } from "@/lib/vehicle-display-name";
import type { AppLocale } from "@/i18n/locales";

/** Pasūtījuma dati piedāvājumam (no servera ierakstiem, nekad no pieprasījuma). */
export type AuctionArchiveOrderContext = {
  sessionId: string;
  vin: string;
  title: string;
  paidCents: number | null;
  /** Stripe atmaksa jau ir (atmaksa veikta - izvēle slēgta). */
  refunded: boolean;
  block: CcVinBlockState | null;
  /** Klienta valoda «Sūtīt klientam» tekstiem (B2B atskaites valoda / vietnes valoda pasūtot / LV). */
  lang?: ClientReportLang;
};

function thecarapiTitle(block: CcVinBlockState | null): string {
  for (const r of block?.thecarapiRecords ?? []) {
    const get = (keys: string[]) => keys.map((k) => r.fields.find((f) => f.key === k)?.value?.trim() ?? "").find(Boolean) ?? "";
    const t = [get(["make", "brand", "clean_make"]), get(["model_display", "model", "clean_model"])].filter(Boolean).join(" ");
    if (t) return t;
  }
  return "";
}

export async function loadAuctionArchiveOrderContext(sessionId: string): Promise<AuctionArchiveOrderContext | null> {
  const [order, draft] = await Promise.all([
    getCheckoutSessionDetail(sessionId).catch(() => null),
    readOrderDraft(sessionId).catch(() => null),
  ]);
  if (!order && !draft) return null;
  const vinRaw = (draft?.orderEdits?.vin ?? "").trim() || (order?.vin ?? "").trim();
  const vin = vinRaw && isValidVin(vinRaw) ? normalizeVin(vinRaw) : "";
  const sb = draft?.workspace?.sourceBlocks as WorkspaceSourceBlocks | undefined;
  const blocks = sb ? mergeSourceBlocksWithDefaults(sb) : null;
  const block = blocks?.cc_vin ?? null;
  let title = "";
  try {
    title = sb ? resolveVehicleDisplayName(sb, { fallbacks: [thecarapiTitle(block)] }) : thecarapiTitle(block);
  } catch {
    title = thecarapiTitle(block);
  }
  const paid = order?.amountTotal;
  return {
    sessionId,
    vin,
    title,
    paidCents: typeof paid === "number" && paid > 0 ? paid : null,
    refunded: (order?.paymentAdjustment?.clawbackCents ?? 0) > 0,
    block,
    lang: resolveOrderClientLang({ notes: draft?.orderEdits?.notes || order?.notes, locale: order?.locale }),
  };
}

export function auctionArchiveSummaryFor(
  ctx: AuctionArchiveOrderContext,
  manualSources: readonly AuctionArchiveManualSource[] = [],
): AuctionArchiveSummary {
  return buildAuctionArchiveSummary({ vin: ctx.vin, title: ctx.title, block: ctx.block, manualSources, countryName });
}

export type PrepareOfferResult =
  | {
      ok: true;
      token: string;
      choiceUrl: string;
      previewUrls: string[];
      doc: AuctionArchiveOfferDoc;
    }
  | { ok: false; error: string };

/**
 * Nils sūta piedāvājumu: nokopē VISAS bildes pie mums, izveido 2 izplūdinātas bildes, jaunu tokenu.
 * Klientam šeit NEKO nesūta - e-pastu/WhatsApp sūta izsaucējs (PR2) ar atgriezto saiti.
 */
export async function prepareAuctionArchiveOffer(args: {
  sessionId: string;
  channel: AuctionArchiveChannel;
  locale: AppLocale;
  previewIds?: readonly string[];
  manualSources?: readonly AuctionArchiveManualSource[];
  deadline?: number;
  origin?: string;
  showPrices?: boolean;
}): Promise<PrepareOfferResult> {
  const ctx = await loadAuctionArchiveOrderContext(args.sessionId);
  if (!ctx) return { ok: false, error: "not_found" };
  if (!ctx.vin) return { ok: false, error: "no_vin" };
  if (ctx.refunded) return { ok: false, error: "already_refunded" };
  const prev = await readAuctionArchiveOffer(args.sessionId);
  if (prev && prev.status !== "pending" && prev.status !== "withdrawn") {
    return { ok: false, error: prev.status === "chose_archive" || prev.status === "chose_refund" ? "already_chosen" : "closed" };
  }
  const manual = [...(args.manualSources ?? [])];
  const summary = auctionArchiveSummaryFor(ctx, manual);
  if (summary.auctions.length === 0 && summary.photoCount === 0 && manual.length === 0) {
    return { ok: false, error: "no_archive_data" };
  }
  const sources = collectAuctionArchivePhotoSources({ vin: ctx.vin, sessionId: args.sessionId, block: ctx.block });
  // Atkārtots piedāvājums: jau nokopētās bildes (tie paši ID) nelasa vēlreiz (persist pārbauda kopiju).
  const persisted = await persistAuctionArchivePhotos({ sessionId: args.sessionId, sources, deadline: args.deadline });
  const wanted = (args.previewIds ?? []).filter((id) => persisted.photos.some((p) => p.id === id));
  const previewIds = await writeAuctionArchivePreviews({
    sessionId: args.sessionId,
    previewIds: wanted.length > 0 ? wanted : defaultAuctionArchivePreviewIds(persisted.photos),
  });
  const created = await createAuctionArchiveOffer({
    sessionId: args.sessionId,
    locale: args.locale,
    channel: args.channel,
    paidCents: ctx.paidCents,
    summary: { ...summary, photoCount: Math.max(summary.photoCount, persisted.photos.length) },
    photos: persisted.photos,
    photosMissing: persisted.missing,
    previewIds,
    showPrices: args.showPrices === true,
  });
  if (!created.ok) return { ok: false, error: created.error };
  const origin = (args.origin || getPublicSiteOrigin()).replace(/\/+$/, "");
  return {
    ok: true,
    token: created.token,
    choiceUrl: auctionArchiveAbsoluteUrl(origin, args.locale, created.token),
    previewUrls: created.doc.previewIds.map((_, n) => `${origin}${auctionArchivePreviewPath(created.token, n)}`),
    doc: created.doc,
  };
}

/* ---------- Paziņojumi TIKAI Nilam ---------- */

function adminOrderPath(sessionId: string): string {
  return `/admin/orders/${encodeURIComponent(sessionId)}`;
}

/** Push (telefons) + e-pasts Nilam. Kļūda nekad neaptur klienta izvēles saglabāšanu. */
export async function notifyAdminAuctionArchive(args: {
  kind: "choice" | "reminder";
  doc: AuctionArchiveOfferDoc;
  client?: "email_sent" | "email_failed" | "whatsapp";
  /** WhatsApp piedāvājumam: gatavs atgādinājuma teksts ar saiti (Nils kopē un sūta pats). */
  whatsappText?: string;
}): Promise<{ push: number; email: boolean }> {
  const notice = auctionArchiveAdminNotice({
    client: args.client,
    kind: args.kind,
    choice: args.doc.choice,
    title: args.doc.summary.title,
    vin: args.doc.summary.vin,
    refundLabel: formatEurCents(args.doc.paidCents),
  });
  const url = adminOrderPath(args.doc.sessionId);
  const push = await sendAdminPush({
    title: notice.title,
    body: notice.body,
    url,
    tag: `auction-archive-${args.doc.sessionId}`.slice(0, 64),
    audience: "pro",
  })
    .then((r) => r.sent)
    .catch(() => 0);
  let email = false;
  const to = getAdminOrderNotifyEmail();
  if (to) {
    email = await trySendDealerDataOperatorEmail({
      to,
      subject: `PROVIN: ${notice.title}`,
      text: `${notice.title}\n\n${notice.body}\n\nPasūtījums: ${getSiteOrigin().replace(/\/+$/, "")}${url}${
        args.whatsappText ? `\n\nWhatsApp teksts kopēšanai:\n\n${args.whatsappText}` : ""
      }`,
    }).catch(() => false);
  }
  return { push, email };
}

export type ClientChoiceOutcome =
  | { ok: true; doc: AuctionArchiveOfferDoc; changed: boolean }
  | { ok: false; error: "closed" | "expired" | "not_found" | "store_failed" };

/**
 * Izvēle no saites (klients) vai manuāli (Nils atzīmē «1/2»). Ja Stripe atmaksa jau veikta - slēgts
 * (atzīmē «Atmaksāts»). Paziņojums Nilam tikai klienta izvēlei, kas kaut ko maina.
 */
export async function recordAuctionArchiveChoice(args: {
  sessionId: string;
  choice: AuctionArchiveChoice;
  via: AuctionArchiveChoiceVia;
  nowMs?: number;
}): Promise<ClientChoiceOutcome> {
  const nowMs = args.nowMs ?? Date.now();
  const ctx = await loadAuctionArchiveOrderContext(args.sessionId).catch(() => null);
  let outcome: ClientChoiceOutcome;
  try {
    outcome = await updateAuctionArchiveOffer<ClientChoiceOutcome>(args.sessionId, (cur) => {
      if (!cur) return { result: { ok: false, error: "not_found" } };
      if (ctx?.refunded && cur.status !== "refunded" && cur.status !== "archive_sent") {
        const next = markAuctionArchiveRefunded(cur, nowMs);
        return { next, result: { ok: false, error: "closed" } };
      }
      const r = applyAuctionArchiveChoice(cur, args.choice, args.via, nowMs);
      if (!r.ok) return { result: { ok: false, error: r.error } };
      if (!r.changed) return { result: { ok: true, doc: r.doc, changed: false } };
      return { next: r.doc, result: { ok: true, doc: r.doc, changed: true } };
    });
  } catch {
    return { ok: false, error: "store_failed" };
  }
  if (outcome.ok && outcome.changed && args.via === "link") {
    await notifyAdminAuctionArchive({ kind: "choice", doc: outcome.doc }).catch(() => undefined);
  }
  return outcome;
}

export type AuctionArchiveReminderResult = {
  ok: true;
  scanned: number;
  reminded: number;
  pushSent: number;
  /** Klientam automātiski nosūtīti atgādinājumi (e-pasts). */
  clientEmails: number;
};

/** Klienta e-pasts atgādinājumam: tas pats, uz kuru aizgāja piedāvājums; rezerve - pasūtījuma e-pasts. */
async function reminderRecipient(doc: AuctionArchiveOfferDoc): Promise<string | null> {
  const [order, draft] = await Promise.all([
    getCheckoutSessionDetail(doc.sessionId).catch(() => null),
    readOrderDraft(doc.sessionId).catch(() => null),
  ]);
  if (!order) return null;
  if ((order.paymentAdjustment?.clawbackCents ?? 0) > 0) return null;
  const to = (doc.sentTo || draft?.orderEdits?.customerEmail?.trim() || order.customerEmail || order.customerDetailsEmail || "").trim();
  return to && canNotifyClientOrder(order, to) ? to : null;
}

type ReminderDeps = {
  sendClientEmail?: typeof trySendAuctionArchiveClientEmail;
  origin?: string;
};

/**
 * Cron: klients 3 dienas nav izvēlējies (Nils 23.11, lēmums 3 = A+B), vienreiz katram piedāvājumam:
 * - Nilam push + e-pasts (kā līdz šim);
 * - e-pasta piedāvājumam - automātisks atgādinājums klientam ar tām pašām 2 pogām (otra saite, pirmā arī derīga);
 * - WhatsApp piedāvājumam - klientam neko; Nila e-pastā gatavs WhatsApp teksts ar saiti kopēšanai.
 * Nesūta, ja izvēle jau izdarīta, piedāvājums atsaukts / noslēgts vai saite beigusies.
 */
export async function runAuctionArchiveReminders(nowMs = Date.now(), deps: ReminderDeps = {}): Promise<AuctionArchiveReminderResult> {
  const sendClientEmail = deps.sendClientEmail ?? trySendAuctionArchiveClientEmail;
  const origin = (deps.origin || getPublicSiteOrigin()).replace(/\/+$/, "");
  const ids = await listAuctionArchiveOfferSessionIds();
  let reminded = 0;
  let pushSent = 0;
  let clientEmails = 0;
  for (const id of ids) {
    const doc = await readAuctionArchiveOffer(id).catch(() => null);
    if (!doc || !isAuctionArchiveReminderDue(doc, nowMs)) continue;
    const issued = await issueAuctionArchiveReminder(
      id,
      (cur) => isAuctionArchiveReminderDue(cur, nowMs),
      (cur, hash) => markAuctionArchiveReminded(cur, nowMs, { reminderTokenHash: hash }),
    ).catch(() => null);
    if (!issued) continue;
    let marked = issued.doc;
    const choiceUrl = auctionArchiveAbsoluteUrl(origin, marked.locale, issued.token);
    let client: "email_sent" | "email_failed" | "whatsapp" | undefined;
    let whatsappText = "";
    if (marked.channel === "whatsapp") {
      client = "whatsapp";
      whatsappText = auctionArchiveReminderWhatsappText(marked.summary, marked.paidCents, choiceUrl);
    } else if (isAuctionArchiveClientReminderAllowed(marked, nowMs)) {
      const to = await reminderRecipient(marked);
      let ok = false;
      if (to) {
        const text = auctionArchiveReminderText(marked.summary, marked.paidCents, marked.showPrices === true);
        ok = await sendClientEmail({
          to,
          subject: auctionArchiveReminderSubject(marked.summary),
          text: auctionArchiveOfferPlainText(text, choiceUrl),
          html: auctionArchiveOfferEmailHtml({
            summary: marked.summary,
            paidCents: marked.paidCents,
            text,
            choiceUrl,
            // Izplūdinātās bildes caur jauno (atgādinājuma) tokenu - tās pašas kopijas.
            previews: marked.previewIds.map((_, n) => ({ url: `${origin}${auctionArchivePreviewPath(issued.token, n)}`, caption: "" })),
            showPrices: marked.showPrices === true,
            reminder: true,
            date: new Date(nowMs),
          }),
        }).catch(() => false);
      }
      client = ok ? "email_sent" : "email_failed";
      if (ok) {
        clientEmails += 1;
        const after = await updateAuctionArchiveOffer<AuctionArchiveOfferDoc | null>(id, (cur) =>
          cur && !cur.clientRemindedAt ? { next: markAuctionArchiveClientReminded(cur, nowMs), result: markAuctionArchiveClientReminded(cur, nowMs) } : { result: cur },
        ).catch(() => null);
        if (after) marked = after;
      }
    }
    const sent = await notifyAdminAuctionArchive({ kind: "reminder", doc: marked, client, whatsappText }).catch(() => ({ push: 0, email: false }));
    reminded += 1;
    pushSent += sent.push;
  }
  return { ok: true, scanned: ids.length, reminded, pushSent, clientEmails };
}

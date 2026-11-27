import "server-only";

import { after } from "next/server";
import { notifyAdminB2bCreditOrders } from "@/lib/b2b-order-notify";
import type { B2bCreditOrderNotice } from "@/lib/b2b-order-notify-shared";
import { patchOrderDraft } from "@/lib/admin-order-draft-store";
import { seedPaidOrderAutoSources } from "@/lib/admin-paid-order-source-seed";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { buildPartnerOrderNotes, type B2bPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import { createOperatorOrderWithFields } from "@/lib/create-operator-order";
import { enqueueCsddPaidAutoForOrder } from "@/lib/csdd-paid-auto";
import { enqueueDealerDataJob, runDealerDataJob } from "@/lib/dealer-data-job";
import { ensureOrderDropboxFolderSafe, notePartnerOrderDropbox } from "@/lib/order-dropbox";
import { runOrderFreeVinScan } from "@/lib/order-vin-scan-run";

export type PartnerPlaceContact = {
  id: string;
  email: string;
  phone: string;
  contactName: string;
  companyName: string;
};

export async function createPartnerCreditVinOrder(args: {
  partner: PartnerPlaceContact;
  vin: string;
  plan: B2bPartnerPlanId;
  listingUrl: string;
  auditPurpose?: B2bPartnerAuditPurpose | null;
  lotId: string;
  extraNoteParts?: readonly string[];
}): Promise<{ ok: true; orderId: string; dealerQueued: boolean } | { ok: false }> {
  const notes = buildPartnerOrderNotes({
    plan: args.plan,
    partnerId: args.partner.id,
    lotId: args.lotId,
    companyName: args.partner.companyName,
    auditPurpose: args.auditPurpose ?? null,
    extraParts: args.extraNoteParts,
  });
  const created = await createOperatorOrderWithFields({
    vin: args.vin,
    email: args.partner.email,
    phone: args.partner.phone,
    name: args.partner.contactName,
    notes,
    partnerId: args.partner.id,
    companyName: args.partner.companyName,
    checkoutLine: args.plan,
    ...(args.auditPurpose ? { auditPurpose: args.auditPurpose } : {}),
    ...(args.listingUrl ? { listingUrl: args.listingUrl } : {}),
  });
  if (!created.ok) return { ok: false };
  await patchOrderDraft(created.orderId, {
    orderEdits: { notes },
  });
  // Dropbox (Nils 27.11): partnera pasūtījumu mape `PARTNERI/<partneris>/` - tikai ieraksts, mapi veido vēlāk.
  await notePartnerOrderDropbox(created.orderId, {
    category: args.plan === "dealer" ? "dealer" : "business",
    partnerId: args.partner.id,
    partnerName: args.partner.companyName,
    createdMs: Date.now(),
    vin: args.vin,
  }).catch(() => undefined);
  const dealerQueued =
    args.plan === "dealer"
      ? await enqueueDealerDataJob({ sessionId: created.orderId, vin: args.vin }).catch(() => false)
      : false;
  return { ok: true, orderId: created.orderId, dealerQueued };
}

export type PartnerVinOrderFollowup = {
  orderId: string;
  /** Partnera plāns: "business" (PROVIN Business) vai "dealer" (dīlera dati). */
  plan: B2bPartnerPlanId;
  vin: string;
  listingUrl: string;
  dealerQueued: boolean;
  /**
   * RAW dīlera dati: OEM oriģinālvalodā (bez tulkojuma). Fona avoti (CSDD API, VIN SCAN EU izsoles)
   * tiek ielasīti tāpat kā dealer_pro, bet dīlera PDF tos nerāda (DEALER_ONLY_PDF_VISIBILITY).
   */
  dealerOnlyRaw?: boolean;
};

async function runPaidOrderBackgroundSources(args: PartnerVinOrderFollowup): Promise<void> {
  try {
    const [seedRes, scanRes] = await Promise.allSettled([
      seedPaidOrderAutoSources(args.orderId, {
        vin: args.vin,
        listingUrl: args.listingUrl || null,
      }),
      runOrderFreeVinScan(args.orderId, { vin: args.vin, listingUrl: args.listingUrl || null }),
    ]);
    if (seedRes.status === "fulfilled") {
      console.info("[partner/orders] paid order auto sources", { orderId: args.orderId, ...seedRes.value });
    } else {
      console.error("[partner/orders] auto sources:", seedRes.reason);
    }
    if (scanRes.status === "fulfilled") {
      console.info("[partner/orders] free VIN SCAN", { orderId: args.orderId, ...scanRes.value });
    } else {
      console.error("[partner/orders] free VIN SCAN:", scanRes.reason);
    }
  } catch (err) {
    console.error("[partner/orders] auto sources:", err);
  }
}

/**
 * PROVIN Business no partnera konta (Nils 24.11 "B2B atskaitēm arī"): pēc CSDD API sēklas - Dropbox mape BUSINESS
 * un automātiskā CSDD maksas izziņa tāpat kā AUDITS (tikai ar LV numuru, viens darbs uz pasūtījumu, tas pats slēdzis).
 * Dīlera dati (RAW/PRO) - nē: dīlera PDF CSDD sadaļas nav.
 */
async function runPartnerBusinessCsddFollowup(args: PartnerVinOrderFollowup): Promise<void> {
  if (args.plan !== "business") return;
  await ensureOrderDropboxFolderSafe(args.orderId, { category: "business", vin: args.vin });
  try {
    const job = await enqueueCsddPaidAutoForOrder(args.orderId, {
      checkoutLine: args.plan,
      channel: "b2b_partner",
      orderVinOrPlate: args.vin,
    });
    if (job) console.info("[partner/orders] csdd paid auto", { orderId: args.orderId, state: job.state });
  } catch (err) {
    console.error("[partner/orders] csdd paid auto:", err);
  }
}

export async function runPartnerCreditVinOrderFollowup(args: PartnerVinOrderFollowup): Promise<void> {
  await runPaidOrderBackgroundSources(args);
  await runPartnerBusinessCsddFollowup(args);
  if (!args.dealerQueued) return;
  try {
    await runDealerDataJob({
      sessionId: args.orderId,
      vin: args.vin,
      trigger: "webhook",
      ...(args.dealerOnlyRaw ? { skipTranslate: true } : {}),
    });
  } catch (err) {
    console.error(args.dealerOnlyRaw ? "[partner/orders] dealer raw job:" : "[partner/orders] dealer data job:", err);
  }
}

/**
 * notice: kam paziņot (push, Telegram, e-pasts). Obligāts, lai neviens jauns ceļš nepaliek bez ziņas:
 * pasūtījumi no konta neiet caur Stripe, un bez šī admin tos neredz līdz termiņam.
 */
export function schedulePartnerCreditVinOrderFollowups(
  jobs: readonly PartnerVinOrderFollowup[],
  notice: Omit<B2bCreditOrderNotice, "orders">,
): void {
  if (jobs.length === 0) return;
  after(async () => {
    await notifyAdminB2bCreditOrders({ ...notice, orders: jobs.map((j) => ({ orderId: j.orderId, vin: j.vin })) }).catch((err) =>
      console.error("[partner/orders] notify:", err),
    );
    for (const job of jobs) {
      await runPartnerCreditVinOrderFollowup(job);
    }
  });
}

import "server-only";

import { after } from "next/server";
import { patchOrderDraft } from "@/lib/admin-order-draft-store";
import { seedPaidOrderAutoSources } from "@/lib/admin-paid-order-source-seed";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { buildPartnerOrderNotes, type B2bPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import { createOperatorOrderWithFields } from "@/lib/create-operator-order";
import { enqueueDealerDataJob, runDealerDataJob } from "@/lib/dealer-data-job";
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
  auditPurpose: B2bPartnerAuditPurpose;
  lotId: string;
}): Promise<{ ok: true; orderId: string; dealerQueued: boolean } | { ok: false }> {
  const notes = buildPartnerOrderNotes({
    plan: args.plan,
    partnerId: args.partner.id,
    lotId: args.lotId,
    companyName: args.partner.companyName,
    auditPurpose: args.auditPurpose,
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
    auditPurpose: args.auditPurpose,
    ...(args.listingUrl ? { listingUrl: args.listingUrl } : {}),
  });
  if (!created.ok) return { ok: false };
  await patchOrderDraft(created.orderId, {
    orderEdits: { notes },
  });
  const dealerQueued =
    args.plan === "dealer"
      ? await enqueueDealerDataJob({ sessionId: created.orderId, vin: args.vin }).catch(() => false)
      : false;
  return { ok: true, orderId: created.orderId, dealerQueued };
}

export async function runPartnerCreditVinOrderFollowup(args: {
  orderId: string;
  vin: string;
  listingUrl: string;
  dealerQueued: boolean;
}): Promise<void> {
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
  if (!args.dealerQueued) return;
  try {
    await runDealerDataJob({ sessionId: args.orderId, vin: args.vin, trigger: "webhook" });
  } catch (err) {
    console.error("[partner/orders] dealer data job:", err);
  }
}

export function schedulePartnerCreditVinOrderFollowups(
  jobs: readonly {
    orderId: string;
    vin: string;
    listingUrl: string;
    dealerQueued: boolean;
  }[],
): void {
  if (jobs.length === 0) return;
  after(async () => {
    for (const job of jobs) {
      await runPartnerCreditVinOrderFollowup(job);
    }
  });
}

import { NextResponse } from "next/server";
import { after } from "next/server";
import { patchOrderDraft } from "@/lib/admin-order-draft-store";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { debitB2bCredit, remainingB2bCredits, restoreB2bCredit } from "@/lib/b2b-partner-credits";
import { resolvePartnerCreditRemaining, seedLotsFromRemaining } from "@/lib/b2b-partner-credit-seed";
import { readB2bCreditWallet, withB2bCreditLock, writeB2bCreditWallet } from "@/lib/b2b-partner-credit-store";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { buildPartnerOrderNotes, isPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import { findRecentPartnerVinOrder } from "@/lib/b2b-partner-vin-dedup";
import { createOperatorOrderWithFields } from "@/lib/create-operator-order";
import { enqueueDealerDataJob, runDealerDataJob } from "@/lib/dealer-data-job";
import {
  canonicalizeListingUrl,
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPartnerPlan(value: string): value is B2bPartnerPlanId {
  return value === "business" || value === "dealer";
}

export async function POST(req: Request) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: { vin?: unknown; plan?: unknown; listingUrl?: unknown; auditPurpose?: unknown };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  const planRaw = typeof raw.plan === "string" ? raw.plan.trim() : "";
  const listingRaw =
    typeof raw.listingUrl === "string" && raw.listingUrl.trim()
      ? canonicalizeListingUrl(raw.listingUrl.trim())
      : "";
  if (!vin || !isValidVin(vin)) {
    return NextResponse.json({ error: "vin" }, { status: 400 });
  }
  if (listingRaw && !isPlausibleListingUrl(listingRaw)) {
    return NextResponse.json({ error: "listing" }, { status: 400 });
  }
  const purposeRaw = typeof raw.auditPurpose === "string" ? raw.auditPurpose.trim() : "";
  if (!isPartnerAuditPurpose(purposeRaw)) {
    return NextResponse.json({ error: "audit_purpose" }, { status: 400 });
  }
  if (!isPartnerPlan(planRaw)) {
    return NextResponse.json({ error: "service" }, { status: 400 });
  }
  if (planRaw === "dealer" && partner.dealerEnabled !== true) {
    return NextResponse.json({ error: "dealer_disabled" }, { status: 403 });
  }

  const consumed = await withB2bCreditLock(partner.id, async () => {
    const existing = await findRecentPartnerVinOrder({ partnerId: partner.id, vin });
    if (existing) {
      return { ok: true as const, duplicate: true as const, orderId: existing.id, lotId: "" };
    }
    let wallet = await readB2bCreditWallet(partner.id);
    if (wallet.lots.length === 0) {
      const seed = resolvePartnerCreditRemaining([]);
      if (seed.business > 0 || seed.dealer > 0) {
        wallet = {
          version: 1,
          updatedAt: new Date().toISOString(),
          lots: seedLotsFromRemaining(seed),
        };
      }
    }
    const remaining = remainingB2bCredits(wallet.lots, new Date());
    if (remaining[planRaw] < 1) return { ok: false as const };
    const debit = debitB2bCredit(wallet, planRaw);
    if (!debit.ok) return { ok: false as const };
    await writeB2bCreditWallet(partner.id, debit.wallet);
    return { ok: true as const, duplicate: false as const, lotId: debit.lotId };
  });

  if (!consumed.ok) {
    return NextResponse.json({ error: "no_credits" }, { status: 402 });
  }
  if (consumed.duplicate) {
    return NextResponse.json({
      ok: true,
      vin,
      plan: planRaw,
      queued: true,
      duplicate: true,
      orderId: consumed.orderId,
    });
  }

  const notes = buildPartnerOrderNotes({
    plan: planRaw,
    partnerId: partner.id,
    lotId: consumed.lotId,
    companyName: partner.companyName,
    auditPurpose: purposeRaw,
  });

  const created = await createOperatorOrderWithFields({
    vin,
    email: partner.email,
    phone: partner.phone,
    name: partner.contactName,
    notes,
    ...(listingRaw ? { listingUrl: listingRaw } : {}),
  });
  if (!created.ok) {
    await withB2bCreditLock(partner.id, async () => {
      const wallet = await readB2bCreditWallet(partner.id);
      await writeB2bCreditWallet(partner.id, restoreB2bCredit(wallet, planRaw, consumed.lotId));
    });
    return NextResponse.json({ error: "queue_failed" }, { status: 500 });
  }

  await patchOrderDraft(created.orderId, {
    orderEdits: {
      notes,
    },
  });

  if (planRaw === "dealer") {
    const queued = await enqueueDealerDataJob({ sessionId: created.orderId, vin }).catch(() => false);
    if (queued) {
      after(async () => {
        try {
          await runDealerDataJob({ sessionId: created.orderId, vin, trigger: "webhook" });
        } catch (err) {
          console.error("[partner/orders] dealer data job:", err);
        }
      });
    }
  }

  return NextResponse.json({
    ok: true,
    vin,
    plan: planRaw,
    queued: true,
    orderId: created.orderId,
  });
}

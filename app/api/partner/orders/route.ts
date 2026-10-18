import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import {
  buildSubmittedPartnerArchiveRow,
  partnerArchiveReportHref,
  partnerVinReorderLockKey,
  partnerVinSpendKey,
} from "@/lib/b2b-partner-archive-rows";
import {
  debitB2bCredit,
  forgetB2bDebitKeys,
  remainingB2bCredits,
  rememberB2bDebitKey,
  restoreB2bCredit,
  walletHasDebitKey,
} from "@/lib/b2b-partner-credits";
import { resolvePartnerCreditRemaining, seedLotsFromRemaining } from "@/lib/b2b-partner-credit-seed";
import { updateB2bCreditWallet } from "@/lib/b2b-partner-credit-store";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { isPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import {
  createPartnerCreditVinOrder,
  schedulePartnerCreditVinOrderFollowups,
} from "@/lib/b2b-partner-place-vin-order";
import { findRecentPartnerVinOrder } from "@/lib/b2b-partner-vin-dedup";
import {
  canonicalizeListingUrl,
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isPartnerPlan(value: string): value is B2bPartnerPlanId {
  return value === "business" || value === "dealer";
}

export async function POST(req: Request) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: { vin?: unknown; plan?: unknown; listingUrl?: unknown; auditPurpose?: unknown; reorder?: unknown };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const reorder = raw.reorder === true;

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

  const idempotencyKey = (req.headers.get("idempotency-key") ?? "").trim().slice(0, 80);
  const nowMs = Date.now();
  const spendKey = partnerVinSpendKey(vin, planRaw, nowMs);
  const reorderKey = partnerVinReorderLockKey(vin, planRaw, nowMs);
  type ExistingVin = { id: string; created: number; reportReady: boolean } | null;
  type PartnerSpend =
    | { ok: true; duplicate: true; existing: ExistingVin }
    | { ok: false }
    | { ok: true; duplicate: false; lotId: string };
  const consumed = await updateB2bCreditWallet<PartnerSpend>(partner.id, async (wallet) => {
    const duplicateFromKey =
      (idempotencyKey && walletHasDebitKey(wallet, idempotencyKey)) ||
      (!reorder && walletHasDebitKey(wallet, spendKey)) ||
      (reorder && walletHasDebitKey(wallet, reorderKey));
    if (duplicateFromKey || !reorder) {
      const existing = await findRecentPartnerVinOrder({ partnerId: partner.id, vin });
      if (duplicateFromKey || existing) {
        return { value: { ok: true as const, duplicate: true as const, existing: existing ?? null } };
      }
    }
    let next = wallet;
    if (next.lots.length === 0) {
      const seed = resolvePartnerCreditRemaining([]);
      if (seed.business > 0 || seed.dealer > 0) {
        next = {
          ...next,
          version: 1,
          updatedAt: new Date().toISOString(),
          lots: seedLotsFromRemaining(seed),
        };
      }
    }
    const remaining = remainingB2bCredits(next.lots, new Date());
    if (remaining[planRaw] < 1) return { value: { ok: false as const } };
    const debit = debitB2bCredit(next, planRaw);
    if (!debit.ok) return { value: { ok: false as const } };
    let saved = rememberB2bDebitKey(debit.wallet, spendKey);
    if (idempotencyKey) saved = rememberB2bDebitKey(saved, idempotencyKey);
    if (reorder) saved = rememberB2bDebitKey(saved, reorderKey);
    return { wallet: saved, value: { ok: true as const, duplicate: false as const, lotId: debit.lotId } };
  });

  if (!consumed.ok) {
    return NextResponse.json({ error: "no_credits" }, { status: 402 });
  }
  if (consumed.duplicate) {
    const existing =
      consumed.existing ?? (await findRecentPartnerVinOrder({ partnerId: partner.id, vin }));
    const orderId = existing?.id ?? "";
    const orderedAt = existing ? new Date(existing.created * 1000).toISOString() : "";
    return NextResponse.json({
      ok: true,
      vin,
      plan: planRaw,
      queued: false,
      duplicate: true,
      ...(orderId ? { orderId } : {}),
      ...(orderedAt ? { orderedAt } : {}),
      reportHref: orderId ? partnerArchiveReportHref(orderId, existing?.reportReady === true) : null,
    });
  }

  const created = await createPartnerCreditVinOrder({
    partner: {
      id: partner.id,
      email: partner.email,
      phone: partner.phone,
      contactName: partner.contactName,
      companyName: partner.companyName,
    },
    vin,
    plan: planRaw,
    listingUrl: listingRaw,
    auditPurpose: purposeRaw,
    lotId: consumed.lotId,
  });
  if (!created.ok) {
    await updateB2bCreditWallet(partner.id, (wallet) => ({
      wallet: forgetB2bDebitKeys(restoreB2bCredit(wallet, planRaw, consumed.lotId), [
        spendKey,
        idempotencyKey,
        reorderKey,
      ]),
      value: true,
    }));
    return NextResponse.json({ error: "queue_failed" }, { status: 500 });
  }

  schedulePartnerCreditVinOrderFollowups([
    {
      orderId: created.orderId,
      vin,
      listingUrl: listingRaw,
      dealerQueued: created.dealerQueued,
    },
  ]);

  const order = buildSubmittedPartnerArchiveRow({
    id: created.orderId,
    vin,
    plan: planRaw,
  });
  return NextResponse.json({
    ok: true,
    vin,
    plan: planRaw,
    queued: true,
    duplicate: false,
    orderId: created.orderId,
    order,
  });
}

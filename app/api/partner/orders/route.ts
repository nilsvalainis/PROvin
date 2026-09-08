import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { resolvePartnerCreditRemaining } from "@/lib/b2b-partner-credit-seed";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

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

  let raw: { vin?: unknown; plan?: unknown };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  const planRaw = typeof raw.plan === "string" ? raw.plan.trim() : "";
  if (!vin || !isValidVin(vin)) {
    return NextResponse.json({ error: "vin" }, { status: 400 });
  }
  if (!isPartnerPlan(planRaw)) {
    return NextResponse.json({ error: "service" }, { status: 400 });
  }

  // Real credit lots arrive with pack Stripe fulfillment. Until then remaining is empty
  // unless B2B_PARTNER_SEED_CREDITS is set explicitly for QA.
  const remaining = resolvePartnerCreditRemaining([]);
  if (remaining[planRaw] < 1) {
    return NextResponse.json({ error: "no_credits" }, { status: 402 });
  }

  // Credit debit + operator order queue lands with pack fulfillment.
  return NextResponse.json({
    ok: true,
    vin,
    plan: planRaw,
    queued: true,
  });
}

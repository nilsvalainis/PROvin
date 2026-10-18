import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import {
  buildSubmittedPartnerArchiveRow,
  partnerArchiveReportHref,
} from "@/lib/b2b-partner-archive-rows";
import {
  BULK_VIN_MAX,
  isBulkVinFormatValid,
  uniqueNormalizedVins,
} from "@/lib/b2b-partner-bulk-vin";
import {
  prepareBulkVinDebit,
  type BulkVinChargeItem,
  type BulkVinDebitPrep,
} from "@/lib/b2b-partner-bulk-vin-debit";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import {
  forgetB2bDebitKeys,
  restoreB2bCredit,
} from "@/lib/b2b-partner-credits";
import { updateB2bCreditWallet } from "@/lib/b2b-partner-credit-store";
import { isPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import {
  createPartnerCreditVinOrder,
  schedulePartnerCreditVinOrderFollowups,
} from "@/lib/b2b-partner-place-vin-order";
import { findPartnerVinOrdersMap } from "@/lib/b2b-partner-vin-dedup";
import {
  canonicalizeListingUrl,
  isPlausibleListingUrl,
  normalizeVin,
} from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isPartnerPlan(value: string): value is B2bPartnerPlanId {
  return value === "business" || value === "dealer";
}

type RawItem = {
  vin?: unknown;
  auditPurpose?: unknown;
  listingUrl?: unknown;
  reorder?: unknown;
};

function parseItems(raw: unknown): BulkVinChargeItem[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > BULK_VIN_MAX) return null;
  const items: BulkVinChargeItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw as RawItem[]) {
    const vin = typeof entry?.vin === "string" ? normalizeVin(entry.vin) : "";
    if (!vin || !isBulkVinFormatValid(vin) || seen.has(vin)) return null;
    seen.add(vin);
    const purposeRaw = typeof entry?.auditPurpose === "string" ? entry.auditPurpose.trim() : "";
    if (!isPartnerAuditPurpose(purposeRaw)) return null;
    const listingRaw =
      typeof entry?.listingUrl === "string" && entry.listingUrl.trim()
        ? canonicalizeListingUrl(entry.listingUrl.trim())
        : "";
    if (listingRaw && !isPlausibleListingUrl(listingRaw)) return null;
    items.push({
      vin,
      auditPurpose: purposeRaw,
      listingUrl: listingRaw,
      reorder: entry?.reorder === true,
    });
  }
  return items;
}

export async function POST(req: Request) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: { plan?: unknown; items?: unknown };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const planRaw = typeof raw.plan === "string" ? raw.plan.trim() : "";
  if (!isPartnerPlan(planRaw)) {
    return NextResponse.json({ error: "service" }, { status: 400 });
  }
  if (planRaw === "dealer" && partner.dealerEnabled !== true) {
    return NextResponse.json({ error: "dealer_disabled" }, { status: 403 });
  }
  const items = parseItems(raw.items);
  if (!items) {
    return NextResponse.json({ error: "items" }, { status: 400 });
  }

  const bulkKey = (req.headers.get("idempotency-key") ?? "").trim().slice(0, 80);
  const nowMs = Date.now();
  const already = await findPartnerVinOrdersMap({
    partnerId: partner.id,
    vins: uniqueNormalizedVins(items),
  });

  const consumed = await updateB2bCreditWallet<BulkVinDebitPrep>(partner.id, async (wallet) => {
    const prep = prepareBulkVinDebit({
      wallet,
      plan: planRaw,
      items,
      already,
      nowMs,
      bulkKey: bulkKey || undefined,
    });
    if (!prep.ok || prep.replay) return { value: prep };
    return { wallet: prep.wallet, value: prep };
  });

  if (!consumed.ok) {
    return NextResponse.json(
      { error: "no_credits", have: consumed.have, need: consumed.need },
      { status: 402 },
    );
  }

  if (consumed.replay) {
    const map = await findPartnerVinOrdersMap({
      partnerId: partner.id,
      vins: uniqueNormalizedVins(items),
    });
    const accepted = items.flatMap((item) => {
      const hit = map.get(item.vin);
      if (!hit) return [];
      const order = buildSubmittedPartnerArchiveRow({
        id: hit.id,
        vin: item.vin,
        plan: planRaw,
        createdAt: new Date(hit.created * 1000).toISOString(),
      });
      return [
        {
          vin: item.vin,
          orderId: hit.id,
          order: {
            ...order,
            reportHref: partnerArchiveReportHref(hit.id, hit.reportReady),
            status: hit.reportReady ? "ready" : order.status,
          },
        },
      ];
    });
    return NextResponse.json({
      ok: true,
      replay: true,
      accepted,
      failed: [],
    });
  }

  const accepted: {
    vin: string;
    orderId: string;
    order: ReturnType<typeof buildSubmittedPartnerArchiveRow>;
  }[] = [];
  const failed: { vin: string; error: string }[] = [];
  const followups: {
    orderId: string;
    vin: string;
    listingUrl: string;
    dealerQueued: boolean;
  }[] = [];

  for (const row of consumed.charged) {
    const created = await createPartnerCreditVinOrder({
      partner: {
        id: partner.id,
        email: partner.email,
        phone: partner.phone,
        contactName: partner.contactName,
        companyName: partner.companyName,
      },
      vin: row.vin,
      plan: planRaw,
      listingUrl: row.listingUrl,
      auditPurpose: row.auditPurpose,
      lotId: row.lotId,
    });
    if (!created.ok) {
      await updateB2bCreditWallet(partner.id, (wallet) => ({
        wallet: forgetB2bDebitKeys(restoreB2bCredit(wallet, planRaw, row.lotId), [
          row.spendKey,
          row.reorderKey,
        ]),
        value: true,
      }));
      failed.push({ vin: row.vin, error: "queue_failed" });
      continue;
    }
    const order = buildSubmittedPartnerArchiveRow({
      id: created.orderId,
      vin: row.vin,
      plan: planRaw,
    });
    accepted.push({
      vin: row.vin,
      orderId: created.orderId,
      order: {
        ...order,
        status: created.dealerQueued ? "processing" : "received",
      },
    });
    followups.push({
      orderId: created.orderId,
      vin: row.vin,
      listingUrl: row.listingUrl,
      dealerQueued: created.dealerQueued,
    });
  }

  schedulePartnerCreditVinOrderFollowups(followups);

  return NextResponse.json({
    ok: true,
    replay: false,
    accepted,
    failed,
  });
}

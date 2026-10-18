import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { BULK_VIN_MAX, isBulkVinFormatValid } from "@/lib/b2b-partner-bulk-vin";
import { isPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import { isB2bWalletProductId, isB2bWalletProductVisible, isB2bWalletReportLang, type B2bWalletProductId } from "@/lib/b2b-wallet";
import { purchaseB2bWalletBulk, type B2bWalletBulkItemInput } from "@/lib/b2b-wallet-bulk-purchase";
import { getClientIpFromRequest } from "@/lib/client-ip";
import {
  canonicalizeListingUrl,
  isPlausibleListingUrl,
  normalizeVin,
} from "@/lib/order-field-validation";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RawItem = { vin?: unknown; auditPurpose?: unknown; listingUrl?: unknown; reorder?: unknown };

type ParsedItems = { ok: true; items: B2bWalletBulkItemInput[] } | { ok: false; error: string };

function parseItems(raw: unknown, product: B2bWalletProductId): ParsedItems {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > BULK_VIN_MAX) return { ok: false, error: "items" };
  const items: B2bWalletBulkItemInput[] = [];
  const seen = new Set<string>();
  for (const entry of raw as RawItem[]) {
    const vin = typeof entry?.vin === "string" ? normalizeVin(entry.vin) : "";
    if (!vin || !isBulkVinFormatValid(vin)) return { ok: false, error: "vin" };
    if (seen.has(vin)) return { ok: false, error: "duplicate_vin" };
    seen.add(vin);
    let auditPurpose: B2bWalletBulkItemInput["auditPurpose"] = null;
    let listingUrl = "";
    if (product === "business") {
      const purposeRaw = typeof entry?.auditPurpose === "string" ? entry.auditPurpose.trim() : "";
      if (!isPartnerAuditPurpose(purposeRaw)) return { ok: false, error: "audit_purpose" };
      auditPurpose = purposeRaw;
      listingUrl =
        typeof entry?.listingUrl === "string" && entry.listingUrl.trim()
          ? canonicalizeListingUrl(entry.listingUrl.trim())
          : "";
      if (listingUrl && !isPlausibleListingUrl(listingUrl)) return { ok: false, error: "listing" };
    }
    items.push({ vin, auditPurpose, listingUrl, reorder: entry?.reorder === true });
  }
  return { ok: true, items };
}

export async function POST(req: Request) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = checkRateLimit(`partner-wallet-bulk:${getClientIpFromRequest(req)}`, 20, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const product = raw.product;
  if (!isB2bWalletProductId(product)) return NextResponse.json({ error: "product" }, { status: 400 });
  if (!isB2bWalletProductVisible(product, partner.walletHiddenProducts)) {
    return NextResponse.json({ error: "product_hidden" }, { status: 403 });
  }

  const reportLang = isB2bWalletReportLang(raw.reportLang) ? raw.reportLang : null;
  if (product === "dealer_pro" && !reportLang) {
    return NextResponse.json({ error: "report_lang" }, { status: 400 });
  }

  const parsed = parseItems(raw.items, product);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const bulkKey = (req.headers.get("idempotency-key") ?? "").trim().slice(0, 80);
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(bulkKey)) {
    return NextResponse.json({ error: "idempotency_key" }, { status: 400 });
  }

  const result = await purchaseB2bWalletBulk({
    partner,
    product,
    items: parsed.items,
    reportLang,
    bulkKey,
  });

  if (!result.ok) {
    if (result.error === "product_hidden") {
      return NextResponse.json({ error: "product_hidden" }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: "insufficient",
        balanceCents: result.balanceCents,
        needCents: result.needCents,
        count: result.count,
        priceCents: result.priceCents,
      },
      { status: 402 },
    );
  }

  return NextResponse.json({
    ok: true,
    product,
    accepted: result.accepted,
    skipped: result.skipped,
    failed: result.failed,
    balanceCents: result.balanceCents,
    priceCents: result.priceCents,
    chargedCents: result.chargedCents,
  });
}

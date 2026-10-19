import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { isPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import {
  b2bWalletProductRequiresReportLang,
  isB2bWalletProductId,
  isB2bWalletProductVisible,
  isB2bWalletReportLang,
} from "@/lib/b2b-wallet";
import { purchaseB2bWalletProduct } from "@/lib/b2b-wallet-purchase";
import { getClientIpFromRequest } from "@/lib/client-ip";
import {
  canonicalizeListingUrl,
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = checkRateLimit(`partner-wallet-buy:${getClientIpFromRequest(req)}`, 60, 10 * 60 * 1000);
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

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  if (!vin || !isValidVin(vin)) return NextResponse.json({ error: "vin" }, { status: 400 });

  const listingUrl =
    product === "business" && typeof raw.listingUrl === "string" && raw.listingUrl.trim()
      ? canonicalizeListingUrl(raw.listingUrl.trim())
      : "";
  if (listingUrl && !isPlausibleListingUrl(listingUrl)) {
    return NextResponse.json({ error: "listing" }, { status: 400 });
  }

  const purposeRaw = typeof raw.auditPurpose === "string" ? raw.auditPurpose.trim() : "";
  if (product === "business" && !isPartnerAuditPurpose(purposeRaw)) {
    return NextResponse.json({ error: "audit_purpose" }, { status: 400 });
  }
  const reportLang = isB2bWalletReportLang(raw.reportLang) ? raw.reportLang : null;
  if (b2bWalletProductRequiresReportLang(product) && !reportLang) {
    return NextResponse.json({ error: "report_lang" }, { status: 400 });
  }

  const idempotencyKey = (req.headers.get("idempotency-key") ?? "").trim().slice(0, 80);
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "idempotency_key" }, { status: 400 });
  }

  const result = await purchaseB2bWalletProduct({
    partner,
    product,
    vin,
    listingUrl,
    auditPurpose: isPartnerAuditPurpose(purposeRaw) ? purposeRaw : null,
    reportLang,
    idempotencyKey,
  });

  if (!result.ok) {
    const status = result.error === "insufficient" ? 402 : result.error === "product_hidden" ? 403 : 500;
    return NextResponse.json(
      { error: result.error, balanceCents: result.balanceCents, priceCents: result.priceCents },
      { status },
    );
  }
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    orderId: result.orderId,
    product,
    vin,
    balanceCents: result.balanceCents,
    priceCents: result.priceCents,
  });
}

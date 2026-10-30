import { B2B_WALLET_PRODUCTS } from "@/lib/b2b-wallet";
import {
  CLIENT_LINK_DEFAULT_VALIDITY_HOURS,
  formatClientLinkExpiryLong,
  isClientLinkExpired,
  isClientLinkValidityHours,
  isSafeClientLinkToken,
} from "@/lib/client-link";
import { invoiceBuyerMetadata } from "@/lib/invoice-buyer";
import {
  canonicalizeListingUrl,
  isIncompleteVinLength,
  isPlausibleListingUrl,
  isValidOrderEmail,
  isValidOrderPhone,
  isValidVinOrPlate,
  normalizeVin,
} from "@/lib/order-field-validation";
import { formatEurFromCents } from "@/lib/order-upsell";

/**
 * PROVIN Business unikālā pirkuma saite (`/b/[token]`).
 * Atsevišķa no `/s/` (AUDITS klienta saites) un `/p/` (IRISS piedāvājumi).
 * Summa NAV saites ierakstā: to vienmēr nosaka serveris (`BUSINESS_LINK_AMOUNT_CENTS`).
 */

export const BUSINESS_LINK_PATH_PREFIX = "/b";
export const BUSINESS_LINK_FULFILLMENT = "business_link";
export const BUSINESS_LINK_PRODUCT_NAME = "PROVIN BUSINESS";
/** 69,99 € - Business minimālā cena (`b2b-wallet`). */
export const BUSINESS_LINK_AMOUNT_CENTS = B2B_WALLET_PRODUCTS.business.minCents;
export const BUSINESS_LINK_DEFAULT_VALIDITY_HOURS = CLIENT_LINK_DEFAULT_VALIDITY_HOURS;

export type BusinessLinkRecipientChannel = "email" | "whatsapp";
export type BusinessLinkStatus = "open" | "paid";

export type BusinessLinkRecord = {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  status: BusinessLinkStatus;
  recipientChannel: BusinessLinkRecipientChannel;
  recipient: string;
  prefillVin: string;
  paidAt?: string;
  paidStripeSessionId?: string;
  lastStripeCheckoutSessionId?: string;
};

export type BusinessLinkAdminInput = {
  recipientChannel: BusinessLinkRecipientChannel;
  recipient: string;
  prefillVin: string;
  validityHours: number;
};

export type BusinessLinkPublicView = {
  productName: string;
  amountCents: number;
  expiresAt: string;
  prefillVin: string;
  prefillEmail: string;
  prefillPhone: string;
};

export function isBusinessLinkPath(pathname: string): boolean {
  return pathname === BUSINESS_LINK_PATH_PREFIX || pathname.startsWith(`${BUSINESS_LINK_PATH_PREFIX}/`);
}

export function businessLinkPublicPath(token: string): string {
  return `${BUSINESS_LINK_PATH_PREFIX}/${token}`;
}

export function businessLinkAbsoluteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${businessLinkPublicPath(token)}`;
}

export function isSafeBusinessLinkToken(token: string): boolean {
  return isSafeClientLinkToken(token);
}

export function formatBusinessLinkAmount(): string {
  return formatEurFromCents(BUSINESS_LINK_AMOUNT_CENTS);
}

export function isBusinessLinkUsable(
  record: Pick<BusinessLinkRecord, "status" | "expiresAt">,
  nowMs = Date.now(),
): boolean {
  return record.status === "open" && !isClientLinkExpired(record.expiresAt, nowMs);
}

export function normalizeBusinessLinkAdminInput(
  raw: Partial<BusinessLinkAdminInput> | null | undefined,
): BusinessLinkAdminInput | { error: string } {
  const recipientChannel: BusinessLinkRecipientChannel = raw?.recipientChannel === "whatsapp" ? "whatsapp" : "email";
  const validityHours =
    typeof raw?.validityHours === "number" ? raw.validityHours : BUSINESS_LINK_DEFAULT_VALIDITY_HOURS;
  if (!isClientLinkValidityHours(validityHours)) return { error: "invalid_validity" };
  const prefillVin = typeof raw?.prefillVin === "string" ? normalizeVin(raw.prefillVin) : "";
  if (prefillVin && !isValidVinOrPlate(prefillVin)) return { error: "invalid_vin" };
  return {
    recipientChannel,
    recipient: typeof raw?.recipient === "string" ? raw.recipient.trim().slice(0, 254) : "",
    prefillVin,
    validityHours,
  };
}

export function newBusinessLinkRecord(
  tokenHash: string,
  input: BusinessLinkAdminInput,
  nowMs = Date.now(),
): BusinessLinkRecord {
  return {
    tokenHash,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + input.validityHours * 60 * 60 * 1000).toISOString(),
    status: "open",
    recipientChannel: input.recipientChannel,
    recipient: input.recipient,
    prefillVin: input.prefillVin,
  };
}

export function parseBusinessLinkRecord(raw: unknown): BusinessLinkRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tokenHash = typeof o.tokenHash === "string" ? o.tokenHash.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return null;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const expiresAt = typeof o.expiresAt === "string" ? o.expiresAt : "";
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(expiresAt))) return null;
  const status: BusinessLinkStatus | null = o.status === "paid" || o.status === "open" ? o.status : null;
  if (!status) return null;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
  return {
    tokenHash,
    createdAt,
    expiresAt,
    status,
    recipientChannel: o.recipientChannel === "whatsapp" ? "whatsapp" : "email",
    recipient: str("recipient"),
    prefillVin: normalizeVin(str("prefillVin")),
    ...(str("paidAt") ? { paidAt: str("paidAt") } : {}),
    ...(str("paidStripeSessionId") ? { paidStripeSessionId: str("paidStripeSessionId") } : {}),
    ...(str("lastStripeCheckoutSessionId") ? { lastStripeCheckoutSessionId: str("lastStripeCheckoutSessionId") } : {}),
  };
}

export function businessLinkPublicView(record: BusinessLinkRecord): BusinessLinkPublicView {
  return {
    productName: BUSINESS_LINK_PRODUCT_NAME,
    amountCents: BUSINESS_LINK_AMOUNT_CENTS,
    expiresAt: record.expiresAt,
    prefillVin: record.prefillVin,
    prefillEmail: record.recipientChannel === "email" && isValidOrderEmail(record.recipient) ? record.recipient : "",
    prefillPhone: record.recipientChannel === "whatsapp" && isValidOrderPhone(record.recipient) ? record.recipient : "",
  };
}

export type BusinessLinkSubmitFields = {
  email: string;
  vin: string;
  listingUrl: string;
  phone: string;
  companyName: string;
  companyReg: string;
  companyAddress: string;
};

export type BusinessLinkSubmitError = "email" | "vin" | "vin_length" | "listing" | "phone" | "consent";

/** E-pasts un VIN obligāti (bez VIN Business rinda adminā kļūst par paku, nevis VIN darbu). */
export function validateBusinessLinkSubmission(
  record: Pick<BusinessLinkRecord, "prefillVin" | "recipientChannel" | "recipient">,
  fields: BusinessLinkSubmitFields,
  withdrawalConsent: boolean,
): { ok: true; resolved: BusinessLinkSubmitFields } | { ok: false; error: BusinessLinkSubmitError } {
  if (!withdrawalConsent) return { ok: false, error: "consent" };

  const email = fields.email.trim() || (record.recipientChannel === "email" ? record.recipient : "");
  if (!email || !isValidOrderEmail(email)) return { ok: false, error: "email" };

  const vinRaw = normalizeVin(fields.vin);
  const vin = vinRaw || record.prefillVin;
  if (!vin || !isValidVinOrPlate(vin)) {
    return { ok: false, error: isIncompleteVinLength(vin) ? "vin_length" : "vin" };
  }

  const listingRaw = fields.listingUrl.trim();
  const listingUrl = listingRaw ? canonicalizeListingUrl(listingRaw) : "";
  if (listingUrl && !isPlausibleListingUrl(listingUrl)) return { ok: false, error: "listing" };

  const phone = fields.phone.trim() || (record.recipientChannel === "whatsapp" ? record.recipient : "");
  if (fields.phone.trim() && !isValidOrderPhone(phone)) return { ok: false, error: "phone" };

  return {
    ok: true,
    resolved: {
      email,
      vin: normalizeVin(vin),
      listingUrl,
      phone: phone && isValidOrderPhone(phone) ? phone : "",
      companyName: fields.companyName.trim(),
      companyReg: fields.companyReg.trim(),
      companyAddress: fields.companyAddress.trim(),
    },
  };
}

export function buildBusinessLinkStripeMetadata(opts: {
  tokenHash: string;
  vin: string;
  listingUrl: string;
  phone: string;
  companyName?: string;
  companyReg?: string;
  companyAddress?: string;
}): Record<string, string> {
  return {
    ...invoiceBuyerMetadata({
      companyName: opts.companyName,
      companyReg: opts.companyReg,
      companyAddress: opts.companyAddress,
    }),
    checkout_line: "business",
    fulfillment: BUSINESS_LINK_FULFILLMENT,
    business_link_hash: opts.tokenHash,
    vin: opts.vin,
    listing_url: opts.listingUrl,
    phone: opts.phone,
    report_delivery: "email",
    withdrawal_waiver_ack: "true",
    authorization_ack: "true",
  };
}

export function businessLinkHashFromStripeMetadata(metadata: Record<string, string> | null | undefined): string | null {
  if ((metadata?.fulfillment ?? "").trim() !== BUSINESS_LINK_FULFILLMENT) return null;
  const hash = (metadata?.business_link_hash ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}

export type BusinessLinkCheckoutSessionParams = {
  mode: "payment";
  customer_email: string;
  line_items: [
    {
      price_data: {
        currency: "eur";
        product_data: { name: string; description: string };
        unit_amount: number;
      };
      quantity: 1;
    },
  ];
  success_url: string;
  cancel_url: string;
  phone_number_collection: { enabled: false };
  metadata: Record<string, string>;
  locale: "lv";
};

/** Summa vienmēr `BUSINESS_LINK_AMOUNT_CENTS`; klienta ievade to neietekmē. */
export function buildBusinessLinkCheckoutSessionParams(opts: {
  origin: string;
  token: string;
  tokenHash: string;
  resolved: BusinessLinkSubmitFields;
}): BusinessLinkCheckoutSessionParams {
  const origin = opts.origin.replace(/\/$/, "");
  const r = opts.resolved;
  return {
    mode: "payment",
    customer_email: r.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: BUSINESS_LINK_PRODUCT_NAME,
            description: "Pasūtījums tiks izveidots pēc apmaksas.",
          },
          unit_amount: BUSINESS_LINK_AMOUNT_CENTS,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/lv/paldies?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${businessLinkPublicPath(opts.token)}`,
    phone_number_collection: { enabled: false },
    metadata: buildBusinessLinkStripeMetadata({
      tokenHash: opts.tokenHash,
      vin: r.vin,
      listingUrl: r.listingUrl,
      phone: r.phone,
      companyName: r.companyName,
      companyReg: r.companyReg,
      companyAddress: r.companyAddress,
    }),
    locale: "lv",
  };
}

export function buildBusinessLinkWhatsAppText(opts: { url: string; expiresAt: string }): string {
  return [
    "Sveiki!",
    "",
    `Jūsu personīgā ${BUSINESS_LINK_PRODUCT_NAME} saite (${formatBusinessLinkAmount()}, derīga līdz ${formatClientLinkExpiryLong(opts.expiresAt)}):`,
    "",
    opts.url,
    "",
    "Ievadiet datus un veiciet apmaksu. Pasūtījums tiks izveidots pēc apmaksas.",
  ].join("\n");
}

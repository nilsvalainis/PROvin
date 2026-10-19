import { canonicalizeListingUrl, isIncompleteVinLength, isPlausibleListingUrl, isValidOrderEmail, isValidOrderPhone, isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import { formatEurFromCents } from "@/lib/order-upsell";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/;

export const CLIENT_LINK_PATH_PREFIX = "/s";
export const CLIENT_LINK_FULFILLMENT = "client_link";
export const CLIENT_LINK_DEFAULT_PRODUCT = "PROVIN AUDITS PRO";
export const CLIENT_LINK_DEFAULT_AMOUNT_CENTS = 9999;
export const CLIENT_LINK_DEFAULT_VALIDITY_HOURS = 48;
export const CLIENT_LINK_VALIDITY_HOURS = [1, 6, 12, 24, 48, 72, 168] as const;
export type ClientLinkValidityHours = (typeof CLIENT_LINK_VALIDITY_HOURS)[number];

export const CLIENT_LINK_MIN_AMOUNT_CENTS = 100;
export const CLIENT_LINK_MAX_AMOUNT_CENTS = 500_000;
export const CLIENT_LINK_PRODUCT_MAX = 80;

export type ClientLinkRecipientChannel = "email" | "whatsapp";
export type ClientLinkStatus = "open" | "paid";

export type ClientLinkRequiredFields = {
  email: boolean;
  vin: boolean;
  listingUrl: boolean;
  phone: boolean;
};

export type ClientLinkRecord = {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  status: ClientLinkStatus;
  productName: string;
  amountCents: number;
  recipientChannel: ClientLinkRecipientChannel;
  recipient: string;
  prefillVin: string;
  prefillListingUrl: string;
  require: ClientLinkRequiredFields;
  paidAt?: string;
  paidStripeSessionId?: string;
  lastStripeCheckoutSessionId?: string;
};

export type ClientLinkPublicView = {
  productName: string;
  amountCents: number;
  expiresAt: string;
  require: ClientLinkRequiredFields;
  prefillVin: string;
  prefillListingUrl: string;
  prefillEmail: string;
  prefillPhone: string;
};

export type ClientLinkAdminInput = {
  recipientChannel: ClientLinkRecipientChannel;
  recipient: string;
  productName: string;
  amountCents: number;
  prefillVin: string;
  prefillListingUrl: string;
  require: ClientLinkRequiredFields;
  validityHours: number;
};

export function isClientLinkPath(pathname: string): boolean {
  return pathname === CLIENT_LINK_PATH_PREFIX || pathname.startsWith(`${CLIENT_LINK_PATH_PREFIX}/`);
}

export function clientLinkPublicPath(token: string): string {
  return `${CLIENT_LINK_PATH_PREFIX}/${token}`;
}

export function clientLinkAbsoluteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${clientLinkPublicPath(token)}`;
}

export function isSafeClientLinkToken(token: string): boolean {
  return TOKEN_RE.test(token.trim());
}

export function isClientLinkValidityHours(v: number): v is ClientLinkValidityHours {
  return (CLIENT_LINK_VALIDITY_HOURS as readonly number[]).includes(v);
}

export function defaultClientLinkRequire(): ClientLinkRequiredFields {
  return { email: true, vin: true, listingUrl: true, phone: false };
}

export function defaultClientLinkAdminInput(): ClientLinkAdminInput {
  return {
    recipientChannel: "email",
    recipient: "",
    productName: CLIENT_LINK_DEFAULT_PRODUCT,
    amountCents: CLIENT_LINK_DEFAULT_AMOUNT_CENTS,
    prefillVin: "",
    prefillListingUrl: "",
    require: defaultClientLinkRequire(),
    validityHours: CLIENT_LINK_DEFAULT_VALIDITY_HOURS,
  };
}

export function parseEurToCents(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
  if (!t || !/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  if (!Number.isFinite(cents)) return null;
  if (cents < CLIENT_LINK_MIN_AMOUNT_CENTS || cents > CLIENT_LINK_MAX_AMOUNT_CENTS) return null;
  return cents;
}

export function formatClientLinkAmount(cents: number): string {
  return formatEurFromCents(cents);
}

export function sanitizeProductName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, CLIENT_LINK_PRODUCT_MAX);
}

export function expiresAtFromCreated(createdAtIso: string, validityHours: number): string {
  const created = Date.parse(createdAtIso);
  const hours = isClientLinkValidityHours(validityHours) ? validityHours : CLIENT_LINK_DEFAULT_VALIDITY_HOURS;
  return new Date(created + hours * 60 * 60 * 1000).toISOString();
}

export function isClientLinkExpired(expiresAt: string, nowMs = Date.now()): boolean {
  const t = Date.parse(expiresAt);
  return !Number.isFinite(t) || t <= nowMs;
}

export function isClientLinkUsable(record: Pick<ClientLinkRecord, "status" | "expiresAt">, nowMs = Date.now()): boolean {
  return record.status === "open" && !isClientLinkExpired(record.expiresAt, nowMs);
}

const RIGA_EXPIRY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function rigaExpiryParts(iso: string): { day: string; month: string; year: string; hour: string; minute: string } | null {
  const d = new Date(iso);
  if (!iso.trim() || Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(RIGA_EXPIRY.formatToParts(d).map((x) => [x.type, x.value]));
  if (!p.day || !p.month || !p.year || !p.hour || !p.minute) return null;
  return { day: p.day, month: p.month, year: p.year, hour: p.hour, minute: p.minute };
}

/** Admin: `16.10 19:50` (Europe/Riga). */
export function formatClientLinkExpiryShort(iso: string): string {
  const p = rigaExpiryParts(iso);
  if (!p) return "";
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

/** Client: `16.10.2026 19:50` (Europe/Riga). */
export function formatClientLinkExpiryLong(iso: string): string {
  const p = rigaExpiryParts(iso);
  if (!p) return "";
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export function clientLinkPublicView(record: ClientLinkRecord): ClientLinkPublicView {
  const email = record.recipientChannel === "email" && isValidOrderEmail(record.recipient) ? record.recipient.trim() : "";
  const phone = record.recipientChannel === "whatsapp" && isValidOrderPhone(record.recipient) ? record.recipient.trim() : "";
  return {
    productName: record.productName,
    amountCents: record.amountCents,
    expiresAt: record.expiresAt,
    require: record.require,
    prefillVin: record.prefillVin,
    prefillListingUrl: record.prefillListingUrl,
    prefillEmail: record.require.email ? email : "",
    prefillPhone: record.require.phone ? phone : "",
  };
}

export function normalizeClientLinkAdminInput(raw: Partial<ClientLinkAdminInput> | null | undefined): ClientLinkAdminInput | { error: string } {
  const base = defaultClientLinkAdminInput();
  const channel: ClientLinkRecipientChannel = raw?.recipientChannel === "whatsapp" ? "whatsapp" : "email";
  const productName = sanitizeProductName(typeof raw?.productName === "string" ? raw.productName : base.productName) || CLIENT_LINK_DEFAULT_PRODUCT;
  const amountCents =
    typeof raw?.amountCents === "number" && Number.isFinite(raw.amountCents)
      ? Math.round(raw.amountCents)
      : base.amountCents;
  if (amountCents < CLIENT_LINK_MIN_AMOUNT_CENTS || amountCents > CLIENT_LINK_MAX_AMOUNT_CENTS) {
    return { error: "invalid_amount" };
  }
  const validityHours = typeof raw?.validityHours === "number" ? raw.validityHours : base.validityHours;
  if (!isClientLinkValidityHours(validityHours)) return { error: "invalid_validity" };

  const prefillVin = typeof raw?.prefillVin === "string" ? normalizeVin(raw.prefillVin) : "";
  if (prefillVin && !isValidVinOrPlate(prefillVin)) return { error: "invalid_vin" };

  const listingRaw = typeof raw?.prefillListingUrl === "string" ? raw.prefillListingUrl.trim() : "";
  const prefillListingUrl = listingRaw ? canonicalizeListingUrl(listingRaw) : "";
  if (prefillListingUrl && !isPlausibleListingUrl(prefillListingUrl)) return { error: "invalid_listing" };

  const requireIn = raw?.require;
  const require: ClientLinkRequiredFields =
    requireIn && typeof requireIn === "object"
      ? {
          email: requireIn.email === true,
          vin: requireIn.vin === true,
          listingUrl: requireIn.listingUrl === true,
          phone: requireIn.phone === true,
        }
      : defaultClientLinkRequire();

  return {
    recipientChannel: channel,
    recipient: typeof raw?.recipient === "string" ? raw.recipient.trim() : "",
    productName,
    amountCents,
    prefillVin,
    prefillListingUrl,
    require,
    validityHours,
  };
}

export type ClientLinkSubmitFields = {
  email: string;
  vin: string;
  listingUrl: string;
  phone: string;
};

export type ClientLinkSubmitError = "email" | "vin" | "vin_length" | "listing" | "phone" | "consent";

export function validateClientLinkSubmission(
  record: Pick<ClientLinkRecord, "require" | "prefillVin" | "prefillListingUrl" | "recipientChannel" | "recipient">,
  fields: ClientLinkSubmitFields,
  withdrawalConsent: boolean,
): { ok: true; resolved: ClientLinkSubmitFields } | { ok: false; error: ClientLinkSubmitError } {
  if (!withdrawalConsent) return { ok: false, error: "consent" };

  const emailRaw = fields.email.trim();
  const fallbackEmail = record.recipientChannel === "email" ? record.recipient.trim() : "";
  const email = emailRaw || fallbackEmail;
  if (record.require.email || emailRaw) {
    if (!email || !isValidOrderEmail(email)) return { ok: false, error: "email" };
  } else if (email && !isValidOrderEmail(email)) {
    return { ok: false, error: "email" };
  }

  const vinRaw = normalizeVin(fields.vin);
  const vin = vinRaw || record.prefillVin;
  if (record.require.vin || vinRaw) {
    if (!vin || !isValidVinOrPlate(vin)) {
      if (isIncompleteVinLength(vinRaw || vin)) return { ok: false, error: "vin_length" };
      return { ok: false, error: "vin" };
    }
  }

  const listingRaw = fields.listingUrl.trim() ? canonicalizeListingUrl(fields.listingUrl.trim()) : "";
  const listingUrl = listingRaw || record.prefillListingUrl;
  if (record.require.listingUrl) {
    if (!listingUrl || !isPlausibleListingUrl(listingUrl)) return { ok: false, error: "listing" };
  } else if (listingUrl && !isPlausibleListingUrl(listingUrl)) {
    return { ok: false, error: "listing" };
  }

  const phoneRaw = fields.phone.trim();
  const fallbackPhone = record.recipientChannel === "whatsapp" ? record.recipient.trim() : "";
  const phone = phoneRaw || fallbackPhone;
  if (record.require.phone || phoneRaw) {
    if (!phone || !isValidOrderPhone(phone)) return { ok: false, error: "phone" };
  } else if (phone && !isValidOrderPhone(phone)) {
    return { ok: false, error: "phone" };
  }

  return {
    ok: true,
    resolved: {
      email: email && isValidOrderEmail(email) ? email : "",
      vin: vin && isValidVinOrPlate(vin) ? normalizeVin(vin) : "",
      listingUrl: listingUrl && isPlausibleListingUrl(listingUrl) ? listingUrl : "",
      phone: phone && isValidOrderPhone(phone) ? phone : "",
    },
  };
}

export function buildClientLinkWhatsAppText(opts: { url: string; productName: string; expiresAt: string; amountCents: number }): string {
  const until = formatClientLinkExpiryLong(opts.expiresAt);
  return [
    "Sveiki!",
    "",
    `Jūsu personīgā ${opts.productName} saite (${formatClientLinkAmount(opts.amountCents)}, derīga līdz ${until}):`,
    "",
    opts.url,
    "",
    "Ievadiet datus un veiciet apmaksu. Pasūtījums tiks izveidots pēc apmaksas.",
  ].join("\n");
}

export function buildClientLinkWhatsAppUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(text);
  if (digits.length >= 8) {
    const intl = digits.startsWith("371") ? digits : digits.startsWith("00") ? digits.slice(2) : `371${digits}`;
    return `https://wa.me/${intl}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function buildClientLinkEmailCopy(
  opts: { url: string; productName: string; expiresAt: string; amountCents: number },
  templatesDoc?: MessageTemplatesDoc | null,
): { subject: string; text: string } {
  const until = formatClientLinkExpiryLong(opts.expiresAt);
  const amount = formatClientLinkAmount(opts.amountCents);
  const rendered = renderTemplateById(
    "email.client_link",
    {
      produkts: opts.productName,
      summa: amount,
      derigs_lidz: until,
      maksajuma_saite: opts.url,
    },
    templatesDoc,
  );
  if (rendered?.subject && rendered.text) {
    return { subject: rendered.subject, text: rendered.text };
  }
  return {
    subject: `${opts.productName}: Jūsu apmaksas saite`,
    text: [
      "Labdien!",
      "",
      "Nosūtām Jūsu personīgo apmaksas saiti.",
      "",
      `Produkts: ${opts.productName}`,
      `Summa: ${amount}`,
      `Saite derīga līdz: ${until}`,
      "",
      "Pasūtījumu izveidosim, tiklīdz saņemsim apmaksu.",
      "",
      `Apmaksāt: ${opts.url}`,
    ].join("\n"),
  };
}

export function parseClientLinkRecord(raw: unknown): ClientLinkRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tokenHash = typeof o.tokenHash === "string" ? o.tokenHash.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return null;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const expiresAt = typeof o.expiresAt === "string" ? o.expiresAt : "";
  if (!createdAt || !expiresAt || !Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(expiresAt))) {
    return null;
  }
  const status: ClientLinkStatus | null = o.status === "paid" || o.status === "open" ? o.status : null;
  if (!status) return null;
  const productName = sanitizeProductName(typeof o.productName === "string" ? o.productName : "");
  if (!productName) return null;
  const amountCents = Math.round(Number(o.amountCents));
  if (!Number.isFinite(amountCents) || amountCents < CLIENT_LINK_MIN_AMOUNT_CENTS || amountCents > CLIENT_LINK_MAX_AMOUNT_CENTS) {
    return null;
  }
  const recipientChannel: ClientLinkRecipientChannel = o.recipientChannel === "whatsapp" ? "whatsapp" : "email";
  const reqRaw = o.require && typeof o.require === "object" ? (o.require as Record<string, unknown>) : {};
  return {
    tokenHash,
    createdAt,
    expiresAt,
    status,
    productName,
    amountCents,
    recipientChannel,
    recipient: typeof o.recipient === "string" ? o.recipient.trim() : "",
    prefillVin: typeof o.prefillVin === "string" ? normalizeVin(o.prefillVin) : "",
    prefillListingUrl: typeof o.prefillListingUrl === "string" ? o.prefillListingUrl.trim() : "",
    require: {
      email: reqRaw.email === true,
      vin: reqRaw.vin === true,
      listingUrl: reqRaw.listingUrl === true,
      phone: reqRaw.phone === true,
    },
    ...(typeof o.paidAt === "string" && o.paidAt ? { paidAt: o.paidAt } : {}),
    ...(typeof o.paidStripeSessionId === "string" && o.paidStripeSessionId
      ? { paidStripeSessionId: o.paidStripeSessionId }
      : {}),
    ...(typeof o.lastStripeCheckoutSessionId === "string" && o.lastStripeCheckoutSessionId
      ? { lastStripeCheckoutSessionId: o.lastStripeCheckoutSessionId }
      : {}),
  };
}

export function applyAdminInputToRecord(record: ClientLinkRecord, input: ClientLinkAdminInput): ClientLinkRecord {
  return {
    ...record,
    productName: input.productName,
    amountCents: input.amountCents,
    recipientChannel: input.recipientChannel,
    recipient: input.recipient,
    prefillVin: input.prefillVin,
    prefillListingUrl: input.prefillListingUrl,
    require: input.require,
    expiresAt: expiresAtFromCreated(record.createdAt, input.validityHours),
  };
}

export function buildClientLinkStripeMetadata(opts: {
  tokenHash: string;
  vin: string;
  listingUrl: string;
  phone: string;
}): Record<string, string> {
  return {
    checkout_line: "audit",
    fulfillment: CLIENT_LINK_FULFILLMENT,
    client_link_hash: opts.tokenHash,
    vin: opts.vin,
    listing_url: opts.listingUrl,
    phone: opts.phone,
    report_delivery: "email",
    withdrawal_waiver_ack: "true",
    authorization_ack: "true",
  };
}

export function clientLinkHashFromStripeMetadata(metadata: Record<string, string> | null | undefined): string | null {
  const fulfillment = (metadata?.fulfillment ?? "").trim();
  const hash = (metadata?.client_link_hash ?? "").trim().toLowerCase();
  if (fulfillment !== CLIENT_LINK_FULFILLMENT) return null;
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  return hash;
}

export type ClientLinkCheckoutSessionParams = {
  mode: "payment";
  customer_email?: string;
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

export function buildClientLinkCheckoutSessionParams(opts: {
  origin: string;
  token: string;
  tokenHash: string;
  productName: string;
  amountCents: number;
  email: string;
  vin: string;
  listingUrl: string;
  phone: string;
}): ClientLinkCheckoutSessionParams {
  const origin = opts.origin.replace(/\/$/, "");
  const back = `${origin}${clientLinkPublicPath(opts.token)}`;
  const thanks = `${origin}/lv/paldies?session_id={CHECKOUT_SESSION_ID}`;
  const params: ClientLinkCheckoutSessionParams = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: opts.productName,
            description: "Pasūtījums tiks izveidots pēc apmaksas.",
          },
          unit_amount: opts.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: thanks,
    cancel_url: back,
    phone_number_collection: { enabled: false },
    metadata: buildClientLinkStripeMetadata({
      tokenHash: opts.tokenHash,
      vin: opts.vin,
      listingUrl: opts.listingUrl,
      phone: opts.phone,
    }),
    locale: "lv",
  };
  if (opts.email) params.customer_email = opts.email;
  return params;
}

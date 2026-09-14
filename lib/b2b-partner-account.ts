import { isValidOrderEmail, isValidOrderPhone } from "@/lib/order-field-validation";

export type B2bPartnerStatus = "active" | "disabled";

/** Individuālas pakas cenas (centi). null = kataloga noklusējums. */
export type B2bPartnerPriceOverrides = {
  business1: number | null;
  business10: number | null;
  dealer1: number | null;
  dealer10: number | null;
};

export type B2bPartnerRecord = {
  id: string;
  companyName: string;
  companyReg: string;
  companyAddress: string;
  contactName: string;
  email: string;
  phone: string;
  passwordHash: string;
  status: B2bPartnerStatus;
  createdAt: string;
  updatedAt: string;
  /** null = vēl jāapstiprina. Veciem ierakstiem parse aizpilda ar createdAt. */
  emailVerifiedAt: string | null;
  emailVerifyHash: string | null;
  emailVerifyExpiresAt: string | null;
  emailVerifyPurpose: "signup" | "email_change" | null;
  pendingEmail: string | null;
  /** Atsevišķā Dīlera paka. Noklusējums false - ieslēdz admin pēc sarunas. */
  dealerEnabled: boolean;
  prices: B2bPartnerPriceOverrides;
};

export type B2bPartnerPublicProfile = Omit<
  B2bPartnerRecord,
  "passwordHash" | "emailVerifyHash" | "emailVerifyExpiresAt" | "emailVerifyPurpose"
>;

export type B2bPartnerWriteInput = {
  companyName: string;
  companyReg: string;
  companyAddress: string;
  contactName: string;
  email: string;
  phone: string;
};

export type B2bPartnerFieldError =
  | "companyName"
  | "companyReg"
  | "companyAddress"
  | "contactName"
  | "email"
  | "phone"
  | "password";

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function normalizePartnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSafeB2bPartnerId(id: string): boolean {
  return /^ptr_[a-f0-9]{16}$/.test(id.trim());
}

export function emptyB2bPartnerPrices(): B2bPartnerPriceOverrides {
  return { business1: null, business10: null, dealer1: null, dealer10: null };
}

function parseOptionalCents(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n < 1 || n > 1_000_000_00) return null;
  return n;
}

export function parseB2bPartnerPrices(raw: unknown): B2bPartnerPriceOverrides {
  if (!raw || typeof raw !== "object") return emptyB2bPartnerPrices();
  const o = raw as Record<string, unknown>;
  return {
    business1: parseOptionalCents(o.business1),
    business10: parseOptionalCents(o.business10),
    dealer1: parseOptionalCents(o.dealer1),
    dealer10: parseOptionalCents(o.dealer10),
  };
}

/** Euro tekstu (79,99 / 79.99) -> centi; tukšs = null (kataloga noklusējums). */
export function euroTextToCents(raw: string): number | null | "invalid" {
  const t = raw.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "invalid";
  const euros = Number(t);
  if (!Number.isFinite(euros) || euros <= 0 || euros > 1_000_000) return "invalid";
  return Math.round(euros * 100);
}

export function centsToEuroInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function toPublicPartner(partner: B2bPartnerRecord): B2bPartnerPublicProfile {
  return {
    id: partner.id,
    companyName: partner.companyName,
    companyReg: partner.companyReg,
    companyAddress: partner.companyAddress,
    contactName: partner.contactName,
    email: partner.email,
    phone: partner.phone,
    status: partner.status,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
    emailVerifiedAt: partner.emailVerifiedAt,
    pendingEmail: partner.pendingEmail,
    dealerEnabled: partner.dealerEnabled,
    prices: partner.prices,
  };
}

export function normalizePartnerWriteInput(raw: B2bPartnerWriteInput): B2bPartnerWriteInput {
  return {
    companyName: clip(raw.companyName, 200),
    companyReg: clip(raw.companyReg, 32),
    companyAddress: clip(raw.companyAddress, 300),
    contactName: clip(raw.contactName, 120),
    email: normalizePartnerEmail(raw.email).slice(0, 254),
    phone: clip(raw.phone, 40),
  };
}

export function partnerFieldError(input: B2bPartnerWriteInput): B2bPartnerFieldError | null {
  const n = normalizePartnerWriteInput(input);
  if (n.companyName.length < 2) return "companyName";
  if (n.companyReg.length < 6) return "companyReg";
  if (n.companyAddress.length < 4) return "companyAddress";
  if (n.contactName.length < 2) return "contactName";
  if (!isValidOrderEmail(n.email)) return "email";
  if (!isValidOrderPhone(n.phone)) return "phone";
  return null;
}

export function isUsablePartnerPassword(password: string): boolean {
  const t = password.trim();
  return t.length >= 8 && t.length <= 200;
}

export function parsePartnerRecord(raw: unknown): B2bPartnerRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const status = o.status === "disabled" ? "disabled" : o.status === "active" ? "active" : null;
  const email = typeof o.email === "string" ? normalizePartnerEmail(o.email) : "";
  const passwordHash = typeof o.passwordHash === "string" ? o.passwordHash : "";
  if (!isSafeB2bPartnerId(id) || !status || !isValidOrderEmail(email) || !passwordHash.startsWith("scrypt$")) {
    return null;
  }
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : createdAt;
  if (!createdAt) return null;
  const purpose =
    o.emailVerifyPurpose === "signup" || o.emailVerifyPurpose === "email_change" ? o.emailVerifyPurpose : null;
  const pendingEmail =
    typeof o.pendingEmail === "string" && isValidOrderEmail(normalizePartnerEmail(o.pendingEmail))
      ? normalizePartnerEmail(o.pendingEmail).slice(0, 254)
      : null;
  let emailVerifiedAt: string | null;
  if ("emailVerifiedAt" in o) {
    emailVerifiedAt =
      typeof o.emailVerifiedAt === "string" && o.emailVerifiedAt.trim() ? o.emailVerifiedAt.trim() : null;
  } else {
    emailVerifiedAt = createdAt;
  }
  return {
    id,
    companyName: typeof o.companyName === "string" ? clip(o.companyName, 200) : "",
    companyReg: typeof o.companyReg === "string" ? clip(o.companyReg, 32) : "",
    companyAddress: typeof o.companyAddress === "string" ? clip(o.companyAddress, 300) : "",
    contactName: typeof o.contactName === "string" ? clip(o.contactName, 120) : "",
    email,
    phone: typeof o.phone === "string" ? clip(o.phone, 40) : "",
    passwordHash,
    status,
    createdAt,
    updatedAt,
    emailVerifiedAt,
    emailVerifyHash: typeof o.emailVerifyHash === "string" && o.emailVerifyHash.trim() ? o.emailVerifyHash.trim() : null,
    emailVerifyExpiresAt:
      typeof o.emailVerifyExpiresAt === "string" && o.emailVerifyExpiresAt.trim()
        ? o.emailVerifyExpiresAt.trim()
        : null,
    emailVerifyPurpose: purpose,
    pendingEmail,
    dealerEnabled: o.dealerEnabled === true,
    prices: parseB2bPartnerPrices(o.prices),
  };
}

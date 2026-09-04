import { isValidOrderEmail, isValidOrderPhone } from "@/lib/order-field-validation";

export type B2bPartnerStatus = "active" | "disabled";

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
};

export type B2bPartnerPublicProfile = Omit<B2bPartnerRecord, "passwordHash">;

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
  };
}

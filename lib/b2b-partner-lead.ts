import { isValidOrderEmail, isValidOrderPhone } from "@/lib/order-field-validation";

/** „Saņemt cenu piedāvājumu” pieteikums no partneru pieteikšanās lapas. */
export type B2bPartnerLead = {
  id: string;
  createdAt: string;
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  message: string;
  locale: string;
  consentAt: string;
  /** Kad operators atzīmēja kā apstrādātu. */
  handledAt: string | null;
};

export type B2bPartnerLeadInput = {
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  message: string;
  consent: boolean;
};

export type B2bPartnerLeadField = "contactName" | "companyName" | "phone" | "email" | "consent";

export type B2bPartnerLeadsDoc = { version: 1; leads: B2bPartnerLead[] };

export const B2B_PARTNER_LEADS_MAX = 1000;

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function normalizeB2bPartnerLeadInput(raw: Record<string, unknown>): B2bPartnerLeadInput {
  return {
    contactName: clip(raw.contactName, 120),
    companyName: clip(raw.companyName, 200),
    phone: clip(raw.phone, 40),
    email: clip(raw.email, 254).toLowerCase(),
    message: typeof raw.message === "string" ? raw.message.trim().slice(0, 2000) : "",
    consent: raw.consent === true,
  };
}

/** Pirmais nederīgais obligātais lauks (formas secībā) vai `null`. */
export function b2bPartnerLeadFieldError(input: B2bPartnerLeadInput): B2bPartnerLeadField | null {
  if (input.contactName.length < 2) return "contactName";
  if (input.companyName.length < 2) return "companyName";
  if (!isValidOrderPhone(input.phone)) return "phone";
  if (!isValidOrderEmail(input.email)) return "email";
  if (!input.consent) return "consent";
  return null;
}

export function emptyB2bPartnerLeadsDoc(): B2bPartnerLeadsDoc {
  return { version: 1, leads: [] };
}

function parseLead(raw: unknown): B2bPartnerLead | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = clip(o.id, 60);
  const createdAt = clip(o.createdAt, 40);
  const email = clip(o.email, 254);
  if (!id || !createdAt || !email) return null;
  return {
    id,
    createdAt,
    contactName: clip(o.contactName, 120),
    companyName: clip(o.companyName, 200),
    phone: clip(o.phone, 40),
    email,
    message: typeof o.message === "string" ? o.message.slice(0, 2000) : "",
    locale: clip(o.locale, 8) || "lv",
    consentAt: clip(o.consentAt, 40) || createdAt,
    handledAt: clip(o.handledAt, 40) || null,
  };
}

export function parseB2bPartnerLeadsDoc(raw: unknown): B2bPartnerLeadsDoc {
  if (!raw || typeof raw !== "object") return emptyB2bPartnerLeadsDoc();
  const list = (raw as Record<string, unknown>).leads;
  const leads: B2bPartnerLead[] = [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const lead = parseLead(item);
      if (lead) leads.push(lead);
    }
  }
  return { version: 1, leads: leads.slice(-B2B_PARTNER_LEADS_MAX) };
}

export function newB2bPartnerLeadId(now: Date): string {
  return `lead_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
}

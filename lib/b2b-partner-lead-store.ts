import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  B2B_PARTNER_LEADS_MAX,
  emptyB2bPartnerLeadsDoc,
  newB2bPartnerLeadId,
  parseB2bPartnerLeadsDoc,
  type B2bPartnerLead,
  type B2bPartnerLeadInput,
  type B2bPartnerLeadsDoc,
} from "@/lib/b2b-partner-lead";

const DOC_KEY = "leads";

const store = createJsonDocStore<B2bPartnerLeadsDoc>({
  blobPrefix: "b2b-partner-leads/",
  dirName: "b2b-partner-leads",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseB2bPartnerLeadsDoc,
  empty: emptyB2bPartnerLeadsDoc,
});

export async function listB2bPartnerLeads(): Promise<B2bPartnerLead[]> {
  const doc = await store.read(DOC_KEY);
  return [...doc.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createB2bPartnerLead(input: B2bPartnerLeadInput, locale: string): Promise<B2bPartnerLead> {
  const now = new Date();
  const lead: B2bPartnerLead = {
    id: newB2bPartnerLeadId(now),
    createdAt: now.toISOString(),
    contactName: input.contactName,
    companyName: input.companyName,
    phone: input.phone,
    email: input.email,
    message: input.message,
    locale,
    consentAt: now.toISOString(),
    handledAt: null,
  };
  await store.update(DOC_KEY, (doc) => ({
    value: true,
    next: { version: 1, leads: [...doc.leads, lead].slice(-B2B_PARTNER_LEADS_MAX) },
  }));
  return lead;
}

export async function setB2bPartnerLeadHandled(id: string, handled: boolean): Promise<boolean> {
  return store.update(DOC_KEY, (doc) => {
    const idx = doc.leads.findIndex((lead) => lead.id === id);
    if (idx < 0) return { value: false };
    const leads = doc.leads.map((lead, i) =>
      i === idx ? { ...lead, handledAt: handled ? new Date().toISOString() : null } : lead,
    );
    return { value: true, next: { version: 1, leads } };
  });
}

export async function countUnhandledB2bPartnerLeads(): Promise<number> {
  const doc = await store.read(DOC_KEY);
  return doc.leads.filter((lead) => !lead.handledAt).length;
}

import "server-only";

import { normalizePartnerEmail, toPublicPartner, type B2bPartnerPublicProfile, type B2bPartnerRecord } from "@/lib/b2b-partner-account";
import { readB2bPartnerServerSession } from "@/lib/b2b-partner-server-session";
import { getB2bPartnerById } from "@/lib/b2b-partner-store";

export async function resolveActiveB2bPartner(): Promise<B2bPartnerRecord | null> {
  const session = await readB2bPartnerServerSession();
  if (!session) return null;
  const partner = await getB2bPartnerById(session.partnerId);
  if (!partner || partner.status !== "active") return null;
  if (partner.email !== normalizePartnerEmail(session.email)) return null;
  return partner;
}

export async function resolveActiveB2bPartnerProfile(): Promise<B2bPartnerPublicProfile | null> {
  const partner = await resolveActiveB2bPartner();
  return partner ? toPublicPartner(partner) : null;
}

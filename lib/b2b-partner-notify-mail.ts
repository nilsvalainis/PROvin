import "server-only";

import { getSiteOrigin } from "@/lib/email/mail-config";
import { trySendAdminNewPartnerNotificationEmail } from "@/lib/email/send-transactional";
import type { B2bPartnerPublicProfile } from "@/lib/b2b-partner-account";

export async function dispatchAdminNewPartnerEmail(partner: B2bPartnerPublicProfile): Promise<void> {
  const origin = getSiteOrigin();
  await trySendAdminNewPartnerNotificationEmail({
    partnerId: partner.id,
    companyName: partner.companyName,
    companyReg: partner.companyReg,
    companyAddress: partner.companyAddress,
    contactName: partner.contactName,
    email: partner.email,
    phone: partner.phone,
    adminUrl: `${origin}/admin/partneri/${encodeURIComponent(partner.id)}`,
  });
}

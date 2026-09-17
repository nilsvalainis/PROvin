import "server-only";

import { getSiteOrigin } from "@/lib/email/mail-config";
import { trySendPartnerPasswordResetEmail } from "@/lib/email/send-transactional";
import { b2bPartnerLocale, b2bPartnerPasswordResetAbsoluteUrl } from "@/lib/b2b-partner-verify";

export async function dispatchPartnerPasswordResetEmail(args: {
  to: string;
  token: string;
  locale?: string | null;
}): Promise<void> {
  const locale = b2bPartnerLocale(args.locale);
  const resetUrl = b2bPartnerPasswordResetAbsoluteUrl(getSiteOrigin(), locale, args.token);
  await trySendPartnerPasswordResetEmail({
    to: args.to,
    resetUrl,
    locale: locale === "lv" ? "lv" : "en",
  });
}

import "server-only";

import { getSiteOrigin } from "@/lib/email/mail-config";
import { trySendPartnerVerifyEmail } from "@/lib/email/send-transactional";
import {
  b2bPartnerLocale,
  b2bPartnerVerifyAbsoluteUrl,
  type B2bEmailVerifyPurpose,
} from "@/lib/b2b-partner-verify";

export async function dispatchPartnerVerifyEmail(args: {
  to: string;
  token: string;
  locale?: string | null;
  purpose: B2bEmailVerifyPurpose;
}): Promise<void> {
  const locale = b2bPartnerLocale(args.locale);
  const verifyUrl = b2bPartnerVerifyAbsoluteUrl(getSiteOrigin(), locale, args.token);
  await trySendPartnerVerifyEmail({
    to: args.to,
    verifyUrl,
    locale: locale === "lv" ? "lv" : "en",
    purpose: args.purpose,
  });
}

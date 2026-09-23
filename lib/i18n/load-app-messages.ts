import type { AbstractIntlMessages } from "next-intl";
import { isAppLocale, type AppLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";

export type { AppLocale };

export async function loadAppMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const [
    meta,
    header,
    hero,
    pricing,
    iriss,
    faq,
    order,
    footer,
    thanks,
    misc,
    legal,
    provinSelect,
    googleReviews,
    riskAuditGuide,
    samples,
    partner,
  ] = await Promise.all([
    import(`../../messages/${locale}/meta.json`),
    import(`../../messages/${locale}/header.json`),
    import(`../../messages/${locale}/hero.json`),
    import(`../../messages/${locale}/pricing.json`),
    import(`../../messages/${locale}/iriss.json`),
    import(`../../messages/${locale}/faq.json`),
    import(`../../messages/${locale}/order.json`),
    import(`../../messages/${locale}/footer.json`),
    import(`../../messages/${locale}/thanks.json`),
    import(`../../messages/${locale}/misc.json`),
    import(`../../messages/${locale}/legal.json`),
    import(`../../messages/${locale}/provinSelect.json`),
    import(`../../messages/${locale}/googleReviews.json`),
    import(`../../messages/${locale}/riskAuditGuide.json`),
    import(`../../messages/${locale}/samples.json`),
    import(`../../messages/${locale}/partner.json`),
  ]);

  return {
    ...meta.default,
    ...header.default,
    ...hero.default,
    ...pricing.default,
    ...iriss.default,
    ...faq.default,
    ...order.default,
    ...footer.default,
    ...thanks.default,
    ...misc.default,
    ...legal.default,
    ...provinSelect.default,
    ...googleReviews.default,
    ...riskAuditGuide.default,
    ...samples.default,
    ...partner.default,
  } as AbstractIntlMessages;
}

export function resolveAppLocale(locale: string | null | undefined): AppLocale {
  return isAppLocale(locale) ? locale : routing.defaultLocale;
}

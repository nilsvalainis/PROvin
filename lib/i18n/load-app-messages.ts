import type { AbstractIntlMessages } from "next-intl";
import { isAppLocale, isB2bOnlyLocale, siteMessageLocale, type AppLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";

export type { AppLocale };

export async function loadAppMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const site = siteMessageLocale(locale);
  const chrome = isB2bOnlyLocale(locale) ? locale : site;
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
    import(`../../messages/${site}/meta.json`),
    import(`../../messages/${chrome}/header.json`),
    import(`../../messages/${site}/hero.json`),
    import(`../../messages/${site}/pricing.json`),
    import(`../../messages/${site}/iriss.json`),
    import(`../../messages/${site}/faq.json`),
    import(`../../messages/${site}/order.json`),
    import(`../../messages/${chrome}/footer.json`),
    import(`../../messages/${site}/thanks.json`),
    import(`../../messages/${site}/misc.json`),
    import(`../../messages/${chrome}/legal.json`),
    import(`../../messages/${site}/provinSelect.json`),
    import(`../../messages/${site}/googleReviews.json`),
    import(`../../messages/${site}/riskAuditGuide.json`),
    import(`../../messages/${site}/samples.json`),
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

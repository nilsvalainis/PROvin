import type { AbstractIntlMessages } from "next-intl";
import {
  isAppLocale,
  siteMessageLocale,
  type AppLocale,
  type PublicLocale,
} from "@/i18n/locales";
import { routing } from "@/i18n/routing";

export type { AppLocale };

const SITE_LOADERS: Record<
  PublicLocale,
  Record<string, () => Promise<{ default: AbstractIntlMessages }>>
> = {
  lv: {
    meta: () => import("../../messages/lv/meta.json"),
    header: () => import("../../messages/lv/header.json"),
    hero: () => import("../../messages/lv/hero.json"),
    pricing: () => import("../../messages/lv/pricing.json"),
    iriss: () => import("../../messages/lv/iriss.json"),
    faq: () => import("../../messages/lv/faq.json"),
    order: () => import("../../messages/lv/order.json"),
    footer: () => import("../../messages/lv/footer.json"),
    thanks: () => import("../../messages/lv/thanks.json"),
    misc: () => import("../../messages/lv/misc.json"),
    legal: () => import("../../messages/lv/legal.json"),
    provinSelect: () => import("../../messages/lv/provinSelect.json"),
    googleReviews: () => import("../../messages/lv/googleReviews.json"),
    riskAuditGuide: () => import("../../messages/lv/riskAuditGuide.json"),
    samples: () => import("../../messages/lv/samples.json"),
  },
  en: {
    meta: () => import("../../messages/en/meta.json"),
    header: () => import("../../messages/en/header.json"),
    hero: () => import("../../messages/en/hero.json"),
    pricing: () => import("../../messages/en/pricing.json"),
    iriss: () => import("../../messages/en/iriss.json"),
    faq: () => import("../../messages/en/faq.json"),
    order: () => import("../../messages/en/order.json"),
    footer: () => import("../../messages/en/footer.json"),
    thanks: () => import("../../messages/en/thanks.json"),
    misc: () => import("../../messages/en/misc.json"),
    legal: () => import("../../messages/en/legal.json"),
    provinSelect: () => import("../../messages/en/provinSelect.json"),
    googleReviews: () => import("../../messages/en/googleReviews.json"),
    riskAuditGuide: () => import("../../messages/en/riskAuditGuide.json"),
    samples: () => import("../../messages/en/samples.json"),
  },
};

const PARTNER_LOADERS: Record<AppLocale, () => Promise<{ default: AbstractIntlMessages }>> = {
  lv: () => import("../../messages/lv/partner.json"),
  en: () => import("../../messages/en/partner.json"),
  de: () => import("../../messages/de/partner.json"),
  ru: () => import("../../messages/ru/partner.json"),
};

export async function loadAppMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const site = siteMessageLocale(locale);
  const loaders = SITE_LOADERS[site];
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
    loaders.meta(),
    loaders.header(),
    loaders.hero(),
    loaders.pricing(),
    loaders.iriss(),
    loaders.faq(),
    loaders.order(),
    loaders.footer(),
    loaders.thanks(),
    loaders.misc(),
    loaders.legal(),
    loaders.provinSelect(),
    loaders.googleReviews(),
    loaders.riskAuditGuide(),
    loaders.samples(),
    PARTNER_LOADERS[locale](),
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
  };
}

export function resolveAppLocale(locale: string | null | undefined): AppLocale {
  return isAppLocale(locale) ? locale : routing.defaultLocale;
}

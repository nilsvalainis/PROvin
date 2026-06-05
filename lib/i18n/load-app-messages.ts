import type { AbstractIntlMessages } from "next-intl";
import { routing } from "@/i18n/routing";

export type AppLocale = (typeof routing.locales)[number];

export async function loadAppMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const [
    meta,
    header,
    hero,
    pricing,
    iriss,
    how,
    faq,
    order,
    footer,
    thanks,
    misc,
    legal,
    provinSelect,
  ] = await Promise.all([
    import(`../../messages/${locale}/meta.json`),
    import(`../../messages/${locale}/header.json`),
    import(`../../messages/${locale}/hero.json`),
    import(`../../messages/${locale}/pricing.json`),
    import(`../../messages/${locale}/iriss.json`),
    import(`../../messages/${locale}/how.json`),
    import(`../../messages/${locale}/faq.json`),
    import(`../../messages/${locale}/order.json`),
    import(`../../messages/${locale}/footer.json`),
    import(`../../messages/${locale}/thanks.json`),
    import(`../../messages/${locale}/misc.json`),
    import(`../../messages/${locale}/legal.json`),
    import(`../../messages/${locale}/provinSelect.json`),
  ]);

  return {
    ...meta.default,
    ...header.default,
    ...hero.default,
    ...pricing.default,
    ...iriss.default,
    ...how.default,
    ...faq.default,
    ...order.default,
    ...footer.default,
    ...thanks.default,
    ...misc.default,
    ...legal.default,
    ...provinSelect.default,
  };
}

import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type AppLocale = (typeof routing.locales)[number];

async function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const [
    meta,
    header,
    hero,
    pricing,
    why,
    iriss,
    how,
    faq,
    order,
    footer,
    thanks,
    misc,
    legal,
  ] = await Promise.all([
    import(`../messages/${locale}/meta.json`),
    import(`../messages/${locale}/header.json`),
    import(`../messages/${locale}/hero.json`),
    import(`../messages/${locale}/pricing.json`),
    import(`../messages/${locale}/why.json`),
    import(`../messages/${locale}/iriss.json`),
    import(`../messages/${locale}/how.json`),
    import(`../messages/${locale}/faq.json`),
    import(`../messages/${locale}/order.json`),
    import(`../messages/${locale}/footer.json`),
    import(`../messages/${locale}/thanks.json`),
    import(`../messages/${locale}/misc.json`),
    import(`../messages/${locale}/legal.json`),
  ]);

  return {
    ...meta.default,
    ...header.default,
    ...hero.default,
    ...pricing.default,
    ...why.default,
    ...iriss.default,
    ...how.default,
    ...faq.default,
    ...order.default,
    ...footer.default,
    ...thanks.default,
    ...misc.default,
    ...legal.default,
  };
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as AppLocale;
  if (!locale || !routing.locales.includes(locale)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: await loadMessages(locale),
  };
});

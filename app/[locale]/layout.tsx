import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LocaleHtmlLang } from "@/components/LocaleHtmlLang";
import { CookieConsent } from "@/components/CookieConsent";
import { LenisProvider } from "@/components/providers/LenisProvider";
import { Header } from "@/components/Header";
import { HideOnDemoPaths } from "@/components/layout/HideOnDemoPaths";
import { SiteOrderCtaPin } from "@/components/home/SiteOrderCtaPin";
import { SiteSectionRail } from "@/components/home/SiteSectionRail";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { routing } from "@/i18n/routing";
import "./demo/design-direction/demo-design-direction.css";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export const viewport: Viewport = {
  themeColor: "#030304",
  width: "device-width",
  initialScale: 1,
  /** iPhone / Android ar izcirtumu — lai `env(safe-area-inset-*)` strādā */
  viewportFit: "cover",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    metadataBase: new URL(base),
    title: {
      default: t("title"),
      template: "%s | PROVIN",
    },
    description: t("description"),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      locale: "lv_LV",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LenisProvider>
        <LocaleHtmlLang />
        <SiteSectionRail />
        <SiteOrderCtaPin />
        <HideOnDemoPaths>
          <Header />
        </HideOnDemoPaths>
        <main className="relative z-10 min-w-0 max-w-full overflow-x-clip pt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
          {children}
        </main>
        <WhatsAppFab />
        <CookieConsent />
      </LenisProvider>
    </NextIntlClientProvider>
  );
}

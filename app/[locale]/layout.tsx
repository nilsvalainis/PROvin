import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LocaleHtmlLang } from "@/components/LocaleHtmlLang";
import { CookieConsent } from "@/components/CookieConsent";
import { LenisProvider } from "@/components/providers/LenisProvider";
import { Header } from "@/components/Header";
import { SiteOrderCtaPin } from "@/components/home/SiteOrderCtaPin";
import { HomeReloadScrollToTop } from "@/components/home/HomeReloadScrollToTop";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { getCompanyPublicBrand } from "@/lib/company";
import { routing } from "@/i18n/routing";
import { getPublicSiteOrigin } from "@/lib/site-url";
import "./design-direction-theme.css";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export const viewport: Viewport = {
  themeColor: "#040406",
  width: "device-width",
  initialScale: 1,
  /** iPhone / Android ar izcirtumu — lai `env(safe-area-inset-*)` strādā */
  viewportFit: "cover",
  /** Kopā ar hero laukiem ≥16px — mazāk nejaušs pinch-zoom pie fokusa; pilnvarotā pinch joprojām iespējams dažās ierīcēs. */
  maximumScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const canonical = `${base}/${locale}`;
  const ogImage = `/${locale}/opengraph-image`;

  return {
    metadataBase: new URL(getPublicSiteOrigin()),
    title: {
      default: t("title"),
      template: "%s | PROVIN",
    },
    description: t("description"),
    alternates: {
      canonical,
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: canonical,
      siteName: getCompanyPublicBrand(),
      locale: "lv_LV",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: getCompanyPublicBrand(),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: [ogImage],
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

  const tMetaDesc = await getTranslations({ locale, namespace: "Meta" });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SiteJsonLd locale={locale} description={tMetaDesc("description")} />
      <LenisProvider>
        <HomeReloadScrollToTop />
        <LocaleHtmlLang />
        <SiteOrderCtaPin />
        <Header />
        <main className="relative z-10 min-w-0 max-w-full overflow-x-clip pt-0 pb-0">
          {children}
        </main>
        <CookieConsent />
      </LenisProvider>
    </NextIntlClientProvider>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import { HomeFeatureBreakdown } from "@/components/home/HomeFeatureBreakdown";
import { SamplesCatalog } from "@/components/home/SamplesCatalog";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageBreadcrumbs } from "@/components/seo/PageBreadcrumbs";
import { buildServiceOffersJsonLd } from "@/lib/seo-json-ld";
import { homeContentMaxClass } from "@/lib/home-layout";
import { faqPageHref, vinCheckHref } from "@/lib/paths";
import { Link } from "@/i18n/navigation";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return buildPublicPageMetadata({
    locale,
    path: "/pakalpojumi",
    title: t("servicesTitle"),
    description: t("servicesDescription"),
    ogImageAlt: t("ogImageAlt"),
    keywords: t.raw("keywords") as string[],
  });
}

export default async function PakalpojumiPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const tVin = await getTranslations({ locale, namespace: "VinCheck" });
  const tCrumb = await getTranslations({ locale, namespace: "Breadcrumbs" });
  const offers = buildServiceOffersJsonLd(
    locale,
    { mini: t("offerMiniName"), audits: t("offerAuditsName"), dealer: t("offerDealerName") },
    { mini: t("offerMiniDesc"), audits: t("offerAuditsDesc"), dealer: t("offerDealerDesc") },
  );

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <JsonLd data={offers} />
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <PageBreadcrumbs
          locale={locale}
          items={[
            { name: tCrumb("home"), path: "/" },
            { name: tCrumb("services"), path: "/pakalpojumi" },
          ]}
        />
        <header className="bg-transparent px-4 pt-6 sm:px-6 sm:pt-8">
          <div className={homeContentMaxClass}>
            <h1 className="max-w-3xl text-balance text-lg font-bold uppercase tracking-[0.14em] text-zinc-100 sm:text-xl">
              {t("servicesH1")}
            </h1>
            <p className="mt-3 max-w-3xl text-pretty text-[0.875rem] font-medium leading-[1.6] text-zinc-300 sm:text-[0.9375rem]">
              {t("servicesIntro")}
            </p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <Link href={vinCheckHref()} className="text-provin-accent no-underline transition hover:text-white">
                {tVin("homeCta")}
              </Link>
              <span className="mx-2 text-white/20" aria-hidden>
                ·
              </span>
              <Link href={faqPageHref()} className="text-white/45 no-underline transition hover:text-provin-accent">
                {tVin("ctaFaq")}
              </Link>
            </p>
          </div>
        </header>
        <SamplesCatalog />
        <HomeFeatureBreakdown showHeading />

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

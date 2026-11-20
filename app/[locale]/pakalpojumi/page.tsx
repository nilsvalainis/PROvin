import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import { ServicesCatalog } from "@/components/services/ServicesCatalog";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedBlogLinks } from "@/components/seo/RelatedBlogLinks";
import { PageBreadcrumbs } from "@/components/seo/PageBreadcrumbs";
import { buildServiceOffersJsonLd } from "@/lib/seo-json-ld";
import { homeContentMaxClass } from "@/lib/home-layout";
import { faqPageHref, vinCheckHref } from "@/lib/paths";
import { Link } from "@/i18n/navigation";
import { VinCheckTextLink } from "@/components/seo/VinCheckTextLink";
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
            <h1 className="max-w-[51rem] text-balance text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] text-zinc-100 sm:text-[44px] lg:text-[56px] lg:leading-[1.02]">
              {t("servicesH1")}
            </h1>
            <p className="mt-3 max-w-[43.75rem] text-pretty text-[15px] font-normal leading-[1.6] text-zinc-400 sm:mt-[18px] sm:text-[17px]">
              {t.rich("servicesIntro", {
                vinPage: (chunks) => <VinCheckTextLink>{chunks}</VinCheckTextLink>,
              })}
            </p>
            <p className="mt-4 flex flex-wrap gap-x-2.5 gap-y-1 text-[12.5px] font-semibold sm:text-[13px]">
              <Link href={vinCheckHref()} className="text-[#5c9dff] no-underline transition hover:text-white">
                {tVin("homeCta")}
              </Link>
              <span className="text-zinc-600" aria-hidden>
                ·
              </span>
              <Link href={faqPageHref()} className="text-[#5c9dff] no-underline transition hover:text-white">
                {tVin("ctaFaq")}
              </Link>
            </p>
          </div>
        </header>
        <ServicesCatalog />
        <RelatedBlogLinks />

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { HomeGoogleReviews } from "@/components/home/HomeGoogleReviews";
import { HomeRiskAuditGuideSection } from "@/components/home/HomeRiskAuditGuideSection";
import { HomeVinSeoSection } from "@/components/home/HomeVinSeoSection";
import { RelatedBlogLinks } from "@/components/seo/RelatedBlogLinks";
import HomePricingHero from "@/components/home/HomePricingHero";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildServiceOffersJsonLd } from "@/lib/seo-json-ld";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return buildPublicPageMetadata({
    locale,
    path: "",
    title: t("title"),
    description: t("description"),
    ogTitle: t("ogTitle"),
    ogDescription: t("ogDescription"),
    ogImageAlt: t("ogImageAlt"),
    keywords: t.raw("keywords") as string[],
  });
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const offers = buildServiceOffersJsonLd(
    locale,
    { mini: t("offerMiniName"), audits: t("offerAuditsName"), dealer: t("offerDealerName") },
    { mini: t("offerMiniDesc"), audits: t("offerAuditsDesc"), dealer: t("offerDealerDesc") },
  );

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <JsonLd data={offers} />
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <Suspense fallback={null}>
          <HomePricingHero />
        </Suspense>

        <div id="site-content" className="min-w-0 scroll-mt-14 bg-transparent pb-0 text-white home-body-ink">
          <HomeVinSeoSection />
          <RelatedBlogLinks />
          <Suspense fallback={null}>
            <HomeRiskAuditGuideSection />
          </Suspense>
          <HomeGoogleReviews />

          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { PageBreadcrumbs } from "@/components/seo/PageBreadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { VinCheckArticle, VinWindshieldFigure } from "@/components/seo/VinCheckArticle";
import { faqPageHref, pakalpojumiHref, vinDecoderHref } from "@/lib/paths";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "VinCheck" });
  const tMeta = await getTranslations({ locale, namespace: "Meta" });
  return buildPublicPageMetadata({
    locale,
    path: "/vin-koda-parbaude",
    title: t("metaTitle"),
    description: t("metaDescription"),
    ogImageAlt: tMeta("ogImageAlt"),
    keywords: tMeta.raw("keywords") as string[],
  });
}

export default async function VinCheckPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("VinCheck");
  const tCrumb = await getTranslations("Breadcrumbs");

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <PageBreadcrumbs
          locale={locale}
          items={[
            { name: tCrumb("home"), path: "/" },
            { name: tCrumb("vinCheck"), path: "/vin-koda-parbaude" },
          ]}
        />

        <VinCheckArticle
          h1={t("h1")}
          lead={t("lead")}
          sections={[
            { title: t("whatTitle"), body: t("whatBody") },
            { title: t("whyTitle"), body: t("whyBody") },
            { title: t("howTitle"), body: t("howBody") },
            { title: t("findTitle"), body: t("findBody"), figure: <VinWindshieldFigure caption={t("findIllustration")} /> },
            { title: t("historyTitle"), body: t("historyBody") },
            { title: t("vsDecoderTitle"), body: t("vsDecoderBody") },
            { title: t("latviaTitle"), body: t("latviaBody") },
          ]}
          links={[
            { href: "/#home-hero", label: t("ctaOrder"), primary: true },
            { href: pakalpojumiHref(), label: t("ctaServices") },
            { href: vinDecoderHref(), label: t("ctaDecoder") },
            { href: faqPageHref(), label: t("ctaFaq") },
          ]}
        />

        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: t("h1"),
            description: t("lead"),
            inLanguage: locale,
          }}
        />

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

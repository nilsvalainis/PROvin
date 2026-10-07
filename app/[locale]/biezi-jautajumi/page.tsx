import type { Metadata } from "next";
import { getMessages, getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageBreadcrumbs } from "@/components/seo/PageBreadcrumbs";
import { buildFaqPageJsonLd } from "@/lib/seo-json-ld";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

type FaqMsgItem = { q: string; a: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return buildPublicPageMetadata({
    locale,
    path: "/biezi-jautajumi",
    title: t("faqTitle"),
    description: t("faqDescription"),
    ogImageAlt: t("ogImageAlt"),
    keywords: t.raw("keywords") as string[],
  });
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  const tCrumb = await getTranslations("Breadcrumbs");
  const messages = await getMessages();
  const raw = (messages as { Faq?: { items?: FaqMsgItem[] } }).Faq?.items;
  const items = Array.isArray(raw) ? raw : [];
  const faqLd = items.length > 0 ? buildFaqPageJsonLd(locale, "/biezi-jautajumi", items) : null;

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <PageBreadcrumbs
          locale={locale}
          items={[
            { name: tCrumb("home"), path: "/" },
            { name: tCrumb("faq"), path: "/biezi-jautajumi" },
          ]}
        />

        {faqLd ? <JsonLd data={faqLd} /> : null}

        <Faq tone="dark" headingAs="h1" />

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

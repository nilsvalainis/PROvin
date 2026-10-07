import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { PageBreadcrumbs } from "@/components/seo/PageBreadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { faqPageHref, pakalpojumiHref } from "@/lib/paths";
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

        <article className="mx-auto w-full max-w-[42.5rem] px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-white/[0.96] sm:text-4xl">
            {t("h1")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">{t("lead")}</p>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-white/[0.96]">{t("whatTitle")}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">{t("whatBody")}</p>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-white/[0.96]">{t("whyTitle")}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">{t("whyBody")}</p>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-white/[0.96]">{t("howTitle")}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">{t("howBody")}</p>
          </section>

          <p className="mt-10 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
            <Link href="/#home-hero" className="text-provin-accent no-underline transition hover:text-white">
              {t("ctaOrder")}
            </Link>
            <Link href={pakalpojumiHref()} className="text-white/55 no-underline transition hover:text-provin-accent">
              {t("ctaServices")}
            </Link>
            <Link href={faqPageHref()} className="text-white/55 no-underline transition hover:text-provin-accent">
              {t("ctaFaq")}
            </Link>
          </p>
        </article>

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

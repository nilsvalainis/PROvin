import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import { AboutB41 } from "@/components/about/AboutB41";
import { getIrissSocialUrls, IrissSocialIcons } from "@/components/IrissSocialIcons";
import { AboutBlogTeaser } from "./AboutBlogTeaser";
import { PageBreadcrumbs } from "@/components/seo/PageBreadcrumbs";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return buildPublicPageMetadata({
    locale,
    path: "/par-mums",
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    ogImageAlt: t("ogImageAlt"),
  });
}

/** Par PROVIN — hero-stila chrome (header no layout) + kājene. Bez kājenes paliek tikai Blogs. */
export default async function ParMumsPage({ params }: Props) {
  const { locale } = await params;
  const tCrumb = await getTranslations("Breadcrumbs");
  const t = await getTranslations("Iriss");
  const social = getIrissSocialUrls();
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <PageBreadcrumbs
          locale={locale}
          items={[
            { name: tCrumb("home"), path: "/" },
            { name: tCrumb("about"), path: "/par-mums" },
          ]}
        />
        <section className="bg-transparent pb-4">
          <AboutB41
            title={t("title")}
            lead={t("pageLead")}
            social={
              <IrissSocialIcons
                tiktok={social.tiktok}
                youtube={social.youtube}
                instagram={social.instagram}
                socialLabel={t("socialLabel")}
                socialSoon={t("socialSoon")}
              />
            }
            duelA={t("punchlineLead")}
            duelB={t("punchlineAccent")}
            blocks={[
              { label: "IRISS", text: t("body1"), id: "kas-ir-iriss" },
              { label: "PROVIN", text: t("body2"), id: "kas-stav-aiz-provin" },
              { label: t("labelYou"), text: t("body3") },
            ]}
            videoId="X8SNHVh-ius"
            videoTitle={t("videoTitle")}
            playLabel={t("youtubePlayAria")}
          />
          <AboutBlogTeaser locale={locale} />
        </section>

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

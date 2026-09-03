import type { Metadata } from "next";
import { getMessages, getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Link } from "@/i18n/navigation";
import { getPublicSiteOrigin } from "@/lib/site-url";
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
  });
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Misc");
  const messages = await getMessages();
  const raw = (messages as { Faq?: { items?: FaqMsgItem[] } }).Faq?.items;
  const items = Array.isArray(raw) ? raw : [];
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const pageUrl = `${base}/${locale}/biezi-jautajumi`;
  const faqLd =
    items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((it) => ({
            "@type": "Question",
            name: it.q,
            acceptedAnswer: { "@type": "Answer", text: it.a },
          })),
          url: pageUrl,
        }
      : null;

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <div className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] pt-6 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:pt-8 lg:px-8">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 no-underline transition hover:text-provin-accent"
          >
            {t("faqBack")}
          </Link>
        </div>

        {faqLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        ) : null}

        <Faq tone="dark" />

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

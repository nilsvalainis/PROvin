import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

type PartnerTermsSection = { title: string; body: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return buildPublicPageMetadata({
    locale,
    path: "/partneriem/noteikumi",
    title: t("partnerTermsMetaTitle"),
    description: t("partnerTermsMetaDescription"),
  });
}

/** Partneru (B2B) sadarbības noteikumi + DPA pielikums (audits P7). Patērētājiem - /lietosanas-noteikumi. */
export default async function PartnerTermsPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "Legal" });
  const sections = t.raw("partnerTermsSections") as PartnerTermsSection[];

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <article className="mx-auto w-full max-w-[42.5rem] px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
          <h1 className="text-3xl font-semibold tracking-tight text-white/[0.96]">{t("partnerTermsTitle")}</h1>
          <p className="mt-2 text-sm text-white/45">{t("partnerTermsUpdated")}</p>
          <p className="mt-4 text-base leading-relaxed text-white/70">{t("partnerTermsLead")}</p>

          <div className="mt-10 space-y-8">
            {sections.map((s) => {
              const num = s.title.match(/^(\d+)\./)?.[1];
              return (
                <section key={s.title} id={num ? `partner-terms-${num}` : undefined} className="scroll-mt-24">
                  <h2 className="text-lg font-semibold text-white/[0.96]">{s.title}</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">{s.body}</p>
                </section>
              );
            })}
          </div>
        </article>
        <Footer />
      </div>
    </div>
  );
}

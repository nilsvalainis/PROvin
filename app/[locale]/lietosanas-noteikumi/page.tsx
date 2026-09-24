import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

type LegalSubsection = { heading: string; body: string };

type LegalSection = {
  title: string;
  body?: string;
  withdrawalIntro?: string;
  searchKeywordsLine?: string;
  subsections?: LegalSubsection[];
};

/** Uzticams avots (projekta tulkojumi); **tēksts** → treknraksts. */
function renderInlineBold(text: string): ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white/[0.96]">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return buildPublicPageMetadata({
    locale,
    path: "/lietosanas-noteikumi",
    title: t("termsMetaTitle"),
    description: t("termsMetaDescription"),
  });
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "Legal" });
  const sections = t.raw("termsSections") as LegalSection[];

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
    <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
    <article className="mx-auto w-full max-w-[42.5rem] px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
      <h1 className="text-3xl font-semibold tracking-tight text-white/[0.96]">
        {t("termsTitle")}
      </h1>
      <p className="mt-2 text-sm text-white/45">{t("termsUpdated")}</p>

      <p className="mt-4 text-base leading-relaxed text-white/70">
        {t.rich("termsLead", {
          section11: (chunks) => (
            <a
              href="#terms-section-11"
              className="font-semibold text-provin-accent underline decoration-provin-accent/35 underline-offset-[3px] transition hover:decoration-provin-accent/70"
            >
              {chunks}
            </a>
          ),
          note: (chunks) => (
            <strong className="font-semibold text-white/[0.96]">{chunks}</strong>
          ),
        })}
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((s, index) => {
          const num = s.title.match(/^(\d+)\./)?.[1];
          const sectionId = num ? `terms-section-${num}` : `terms-section-${index}`;

          return (
            <section key={s.title} id={sectionId} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-white/[0.96]">{s.title}</h2>

              {s.subsections?.length ? (
                <div className="mt-4 space-y-4">
                  {s.withdrawalIntro ? (
                    <p className="text-sm leading-relaxed text-white/70">{renderInlineBold(s.withdrawalIntro)}</p>
                  ) : null}
                  {s.searchKeywordsLine ? (
                    <p
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm leading-relaxed text-white/55"
                      translate="no"
                    >
                      {renderInlineBold(s.searchKeywordsLine)}
                    </p>
                  ) : null}
                  <div className="space-y-5 border-l-2 border-provin-accent/35 pl-4">
                    {s.subsections.map((sub) => (
                      <div key={sub.heading}>
                        <h3 className="text-base font-semibold text-white/[0.96]">{sub.heading}</h3>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/70">{sub.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">
                  {s.body != null ? renderInlineBold(s.body) : null}
                </p>
              )}
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

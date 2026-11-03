import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { LegalToc } from "@/components/legal/LegalToc";
import styles from "@/components/legal/legal.module.css";

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
        <strong key={i}>
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
  const toc = sections.map((s, index) => {
    const num = s.title.match(/^(\d+)\./)?.[1];
    return { id: num ? `terms-section-${num}` : `terms-section-${index}`, title: s.title };
  });

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
    <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
    <article className={styles.wrap}>
      <h1 className={styles.title}>{t("termsTitle")}</h1>
      <p className={styles.date}>{t("termsUpdated")}</p>

      <div className={styles.grid}>
        <LegalToc items={toc} label={t("tocLabel")} />
        <div className={styles.body}>
          <p className={styles.lead}>
            {t.rich("termsLead", {
              section11: (chunks) => (
                <a href="#terms-section-11" className={styles.link}>
                  {chunks}
                </a>
              ),
              note: (chunks) => <strong className="font-semibold text-white">{chunks}</strong>,
            })}
          </p>

          {sections.map((s, index) => (
            <section key={s.title} id={toc[index].id} className={styles.section}>
              <h2>{s.title}</h2>

              {s.subsections?.length ? (
                <>
                  {s.withdrawalIntro ? <p className={styles.text}>{renderInlineBold(s.withdrawalIntro)}</p> : null}
                  {s.searchKeywordsLine ? (
                    <p className={styles.note} translate="no">
                      {renderInlineBold(s.searchKeywordsLine)}
                    </p>
                  ) : null}
                  <div className={styles.subs}>
                    {s.subsections.map((sub) => (
                      <div key={sub.heading}>
                        <h3>{sub.heading}</h3>
                        <p className={styles.text}>{sub.body}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles.text}>{s.body != null ? renderInlineBold(s.body) : null}</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </article>
    <Footer />
    </div>
    </div>
  );
}

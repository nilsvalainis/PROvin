import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { CompanyLegalDisclosure } from "@/components/CompanyLegalDisclosure";

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
        <strong key={i} className="font-semibold text-[var(--color-apple-text)]">
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
  return {
    title: t("termsMetaTitle"),
  };
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
    <article className="mx-auto max-w-[65ch] px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-apple-text)]">
        {t("termsTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-provin-muted)]">{t("termsUpdated")}</p>

      <div className="mt-6 rounded-xl border border-black/[0.06] bg-[#f5f5f7]/80 px-4 py-3 sm:px-5">
        <CompanyLegalDisclosure className="text-[13px] leading-relaxed text-[#424245]" />
      </div>

      <p className="mt-4 text-base leading-relaxed text-[var(--color-provin-muted)]">
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
            <strong className="font-semibold text-[var(--color-apple-text)]">{chunks}</strong>
          ),
        })}
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((s, index) => {
          const num = s.title.match(/^(\d+)\./)?.[1];
          const sectionId = num ? `terms-section-${num}` : `terms-section-${index}`;

          return (
            <section key={s.title} id={sectionId} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-[var(--color-apple-text)]">{s.title}</h2>

              {s.subsections?.length ? (
                <div className="mt-4 space-y-4">
                  {s.withdrawalIntro ? (
                    <p className="text-sm leading-relaxed text-[#424245]">{renderInlineBold(s.withdrawalIntro)}</p>
                  ) : null}
                  {s.searchKeywordsLine ? (
                    <p
                      className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm leading-relaxed text-amber-950"
                      translate="no"
                    >
                      {renderInlineBold(s.searchKeywordsLine)}
                    </p>
                  ) : null}
                  <div className="space-y-5 border-l-2 border-[var(--color-provin-accent)]/35 pl-4">
                    {s.subsections.map((sub) => (
                      <div key={sub.heading}>
                        <h3 className="text-base font-semibold text-[var(--color-apple-text)]">{sub.heading}</h3>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#424245]">{sub.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#424245]">
                  {s.body != null ? renderInlineBold(s.body) : null}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <section id="pakalpojuma-sniedzeja-informacija" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-semibold text-[var(--color-apple-text)]">Pakalpojuma sniedzēja informācija</h2>
        <div className="mt-3 rounded-xl border border-black/[0.06] bg-[#f5f5f7]/70 px-4 py-3 sm:px-5">
          <CompanyLegalDisclosure className="not-italic text-[12px] leading-relaxed text-[#6e6e73]" />
        </div>
      </section>
    </article>
  );
}

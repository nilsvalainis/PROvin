import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { CompanyLegalDisclosure } from "@/components/CompanyLegalDisclosure";

type Props = { params: Promise<{ locale: string }> };

type LegalSection = { title: string; body: string };

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

      <p className="mt-4 text-base leading-relaxed text-[var(--color-provin-muted)]">{t("termsLead")}</p>

      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-[var(--color-apple-text)]">{s.title}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#424245]">{s.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}

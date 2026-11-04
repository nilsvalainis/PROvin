import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import { PageBreadcrumbs } from "@/components/seo/PageBreadcrumbs";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { LegalToc } from "@/components/legal/LegalToc";
import styles from "@/components/legal/legal.module.css";

type Props = { params: Promise<{ locale: string }> };

type LegalSection = { title: string; body: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return buildPublicPageMetadata({
    locale,
    path: "/privatuma-politika",
    title: t("privacyMetaTitle"),
    description: t("privacyMetaDescription"),
  });
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const tCrumb = await getTranslations({ locale, namespace: "Breadcrumbs" });
  const t = await getTranslations({ locale, namespace: "Legal" });
  const sections = t.raw("sections") as LegalSection[];
  const toc = sections.map((s, index) => ({
    id: `privacy-section-${s.title.match(/^(\d+)\./)?.[1] ?? index + 1}`,
    title: s.title,
  }));

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <PageBreadcrumbs
          locale={locale}
          items={[
            { name: tCrumb("home"), path: "/" },
            { name: tCrumb("privacy"), path: "/privatuma-politika" },
          ]}
        />
        <article className={styles.wrap}>
          <h1 className={styles.title}>{t("privacyTitle")}</h1>
          <div className={styles.grid}>
            <LegalToc items={toc} label={t("tocLabel")} />
            <div className={styles.body}>
              <p className={styles.lead}>{t("privacyLead")}</p>
              {sections.map((s, index) => (
                <section key={s.title} id={toc[index].id} className={styles.section}>
                  <h2>{s.title}</h2>
                  <p className={styles.text}>{s.body}</p>
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

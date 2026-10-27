import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Footer } from "@/components/Footer";
import { VinDecoderTool, type VinDecoderLabels } from "@/components/vin-decoder/VinDecoderTool";
import { homePath } from "@/lib/paths";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "VinDecoder" });
  return buildPublicPageMetadata({
    locale,
    path: "/vin-dekoders",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Bezmaksas VIN dekoders (audits P10 A): piltuves augšdaļa uz bezmaksas sludinājuma pārbaudi un AUDITU. */
export default async function VinDecoderPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);
  const tAll = await getTranslations({ locale });
  const raw = tAll.raw("VinDecoder") as VinDecoderLabels & { title: string; lead: string; limitsTitle: string; limitsBody: string };
  const home = homePath(locale);

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <article className="mx-auto w-full max-w-[42.5rem] px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
          <h1 className="text-3xl font-semibold tracking-tight text-white/[0.96]">{raw.title}</h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">{raw.lead}</p>
          <VinDecoderTool locale={locale} labels={raw} auditHref={home} freeCheckHref={`${home}#bezmaksas-novertejums`} />
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-white/[0.96]">{raw.limitsTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{raw.limitsBody}</p>
          </section>
        </article>
        <Footer />
      </div>
    </div>
  );
}

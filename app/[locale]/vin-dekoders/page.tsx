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
  const raw = tAll.raw("VinDecoder") as VinDecoderLabels & { title: string; lead: string };
  const home = homePath(locale);

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <section className="bg-transparent">
          <div className="mx-auto flex max-w-[80rem] flex-col gap-10 px-[max(1rem,env(safe-area-inset-left,0px))] pb-16 pr-[max(1rem,env(safe-area-inset-right,0px))] pt-24 sm:pb-20 sm:pt-32 lg:px-10">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
              <h1 className="text-balance text-[2rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-zinc-50 sm:text-[2.6rem] lg:col-span-6 lg:text-[3rem]">
                {raw.title}
              </h1>
              <p className="text-[1.05rem] leading-relaxed text-zinc-300 lg:col-span-6">{raw.lead}</p>
            </div>
            <div>
              <VinDecoderTool locale={locale} labels={raw} home={home} source="decoder" />
            </div>
          </div>
        </section>
        <Footer />
      </div>
    </div>
  );
}

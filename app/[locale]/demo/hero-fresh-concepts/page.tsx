import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { HeroFreshConceptsDemos } from "@/components/demo/HeroFreshConceptsDemos";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo — jauni hero koncepti (30)",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HeroFreshConceptsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HeroFreshConceptsDemos />;
}

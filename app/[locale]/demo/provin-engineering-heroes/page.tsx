import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { EngineeringHeroDemos } from "@/components/demo/provin-engineering/EngineeringHeroDemos";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo — Engineering Hero choreography (30)",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ProvinEngineeringHeroesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <EngineeringHeroDemos />;
}

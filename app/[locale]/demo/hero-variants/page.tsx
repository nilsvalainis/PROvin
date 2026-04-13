import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DemoCrossDemoNav } from "@/components/demo/DemoStudioQuickLinks";
import { HeroVariantsStudioSection } from "@/components/demo/HeroVariantsStudioSection";
import { routing } from "@/i18n/routing";
import "@/components/home/hero-orbit-styles";

export const metadata: Metadata = {
  title: "Hero orbit — melns / sudrabs (demo)",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HeroVariantsDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-black text-white">
      <DemoCrossDemoNav />
      <HeroVariantsStudioSection layout="standalone" />
    </div>
  );
}

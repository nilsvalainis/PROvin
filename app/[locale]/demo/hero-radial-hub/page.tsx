import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DemoCrossDemoNav } from "@/components/demo/DemoStudioQuickLinks";
import { HeroRadialHubDemos } from "@/components/demo/HeroRadialHubDemos";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Hero radialais tīkls — 10 vizuāli demo (bez teksta)",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HeroRadialHubDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-[#020203] text-white">
      <DemoCrossDemoNav />
      <HeroRadialHubDemos />
    </div>
  );
}

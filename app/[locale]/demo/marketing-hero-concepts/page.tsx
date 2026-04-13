import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DemoCrossDemoNav } from "@/components/demo/DemoStudioQuickLinks";
import { MarketingHeroConcepts5 } from "@/components/demo/MarketingHeroConcepts5";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo: 5 mārketinga hero koncepti",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function MarketingHeroConceptsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-[#030304] text-white">
      <DemoCrossDemoNav />
      <MarketingHeroConcepts5 />
    </div>
  );
}

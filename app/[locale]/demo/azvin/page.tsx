import type { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";

export const metadata: Metadata = {
  title: "VIP.VIN demo (Azerbaijan)",
  robots: { index: false, follow: false },
};

const AzvinHero = dynamic(
  () => import("@/components/demo/azvin/AzvinHero").then((m) => m.AzvinHero),
  {
    loading: () => (
      <div
        className={`home-hero-pricing-unified demo-design-dir home-hero-intro-surface ${productHeroStyles.heroIntroSurface} ${productHeroStyles.heroHomeLoadingShell}`}
        aria-busy="true"
        aria-label="Loading…"
      />
    ),
  },
);

export default function AzvinDemoPage() {
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <Suspense fallback={null}>
          <AzvinHero />
        </Suspense>
      </div>
    </div>
  );
}

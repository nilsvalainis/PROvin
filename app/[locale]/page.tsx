import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { HomeGoogleReviews } from "@/components/home/HomeGoogleReviews";
import { HomeRiskAuditGuide } from "@/components/home/HomeRiskAuditGuide";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

const HomePricingHero = dynamic(() => import("@/components/home/HomePricingHero"), {
  loading: () => (
    <div
      className={`home-hero-pricing-unified demo-design-dir home-hero-intro-surface ${productHeroStyles.heroIntroSurface} ${productHeroStyles.heroHomeLoadingShell}`}
      aria-busy="true"
      aria-label="Ielādē…"
    />
  ),
});

export default function HomePage() {
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <Suspense fallback={null}>
          <HomePricingHero />
        </Suspense>

        <div id="site-content" className="min-w-0 scroll-mt-14 bg-transparent pb-0 text-white home-body-ink">
          <HomeRiskAuditGuide />
          <HomeGoogleReviews />

          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}

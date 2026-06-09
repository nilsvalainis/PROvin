import { Suspense } from "react";
import { ProvinHeroTransitionBanner } from "@/components/pricing/ProvinHeroTransitionBanner";
import { TestPricing5Hero } from "@/components/test-pricing-5/TestPricing5Hero";
import { TestPricingTestShell } from "@/components/test-pricing-shared/TestPricingTestShell";
import { IrissSection } from "@/components/IrissSection";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { Footer } from "@/components/Footer";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PROVIN — testa cenas (v5)",
  robots: { index: false, follow: false },
};

export default function TestPricing5RoutePage() {
  return (
    <TestPricingTestShell pageRootClassName={styles.pageRoot}>
      <Suspense fallback={null}>
        <TestPricing5Hero />
      </Suspense>

      <ProvinHeroTransitionBanner />

      <div className={`home-body-ink ${styles.bodySection} ${styles.pageCanvasTail}`}>
        <section className={`demo-design-dir__section ${styles.compactSection}`}>
          <div className="demo-design-dir__shell">
            <IrissSection editorialColumn />
          </div>
        </section>

        <HomeFaqSection />

        <section className="demo-design-dir__section pb-0">
          <Footer />
        </section>
      </div>
    </TestPricingTestShell>
  );
}

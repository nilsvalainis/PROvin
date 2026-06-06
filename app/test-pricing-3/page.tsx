import { Suspense } from "react";
import { TestPricing3Hero } from "@/components/test-pricing-3/TestPricing3Hero";
import { TestPricingTestShell } from "@/components/test-pricing-shared/TestPricingTestShell";
import { IrissSection } from "@/components/IrissSection";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { Footer } from "@/components/Footer";
import styles from "@/app/test-pricing-3/test-pricing-3.module.css";

export const metadata = {
  title: "PROVIN — testa cenas (v3)",
  robots: { index: false, follow: false },
};

export default function TestPricing3RoutePage() {
  return (
    <TestPricingTestShell pageRootClassName={styles.pageRoot}>
      <Suspense fallback={null}>
        <TestPricing3Hero />
      </Suspense>

      <div className={`home-body-ink ${styles.bodySection}`}>
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

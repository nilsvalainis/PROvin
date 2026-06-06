import { Suspense } from "react";
import { TestPricing4Hero } from "@/components/test-pricing-4/TestPricing4Hero";
import { TestPricingTestShell } from "@/components/test-pricing-shared/TestPricingTestShell";
import { IrissSection } from "@/components/IrissSection";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { Footer } from "@/components/Footer";
import styles from "@/app/test-pricing-4/test-pricing-4.module.css";

export const metadata = {
  title: "PROVIN — testa cenas (v4)",
  robots: { index: false, follow: false },
};

export default function TestPricing4RoutePage() {
  return (
    <TestPricingTestShell pageRootClassName={styles.pageRoot}>
      <Suspense fallback={null}>
        <TestPricing4Hero />
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

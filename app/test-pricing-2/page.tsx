import { Suspense } from "react";
import { TestPricing2Hero } from "@/components/test-pricing-2/TestPricing2Hero";
import { TestPricing2Shell } from "@/components/test-pricing-2/TestPricing2Shell";
import { IrissSection } from "@/components/IrissSection";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { Footer } from "@/components/Footer";
import styles from "@/app/test-pricing-2/test-pricing-2.module.css";

export const metadata = {
  title: "PROVIN — testa cenas (v2)",
  robots: { index: false, follow: false },
};

export default function TestPricing2RoutePage() {
  return (
    <TestPricing2Shell>
      <Suspense fallback={null}>
        <TestPricing2Hero />
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
    </TestPricing2Shell>
  );
}

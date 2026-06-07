import { Suspense } from "react";
import { TestCheckoutPageClient } from "@/components/test-checkout/TestCheckoutPageClient";
import { TestPricingTestShell } from "@/components/test-pricing-shared/TestPricingTestShell";
import styles from "@/app/test-checkout/test-checkout.module.css";

export const metadata = {
  title: "PROVIN — testa pasūtījums",
  robots: { index: false, follow: false },
};

export default function TestCheckoutPage() {
  return (
    <TestPricingTestShell pageRootClassName={styles.pageRoot}>
      <Suspense fallback={null}>
        <TestCheckoutPageClient />
      </Suspense>
    </TestPricingTestShell>
  );
}

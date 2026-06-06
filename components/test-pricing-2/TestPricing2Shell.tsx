import type { ReactNode } from "react";
import { TestPricingTestShell } from "@/components/test-pricing-shared/TestPricingTestShell";
import styles from "@/app/test-pricing-2/test-pricing-2.module.css";

export function TestPricing2Shell({ children }: { children: ReactNode }) {
  return <TestPricingTestShell pageRootClassName={styles.pageRoot}>{children}</TestPricingTestShell>;
}

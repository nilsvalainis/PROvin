import type { ReactNode } from "react";
import { TestPricing2Header } from "@/components/test-pricing-2/TestPricing2Header";
import styles from "@/app/test-pricing-2/test-pricing-2.module.css";

export function TestPricing2Shell({ children }: { children: ReactNode }) {
  return (
    <div className={`demo-design-dir min-w-0 ${styles.pageRoot}`}>
      <TestPricing2Header />
      <main className="relative z-10 min-w-0">{children}</main>
    </div>
  );
}
